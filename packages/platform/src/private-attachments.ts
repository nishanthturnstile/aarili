import { MediaContentRejected } from "./media-content-error.js";

function bad(): never {
  throw new MediaContentRejected();
}
function unsupported(): never {
  throw new MediaContentRejected("unsupported");
}
type Ref = { ref: string };
type Value =
  | number
  | boolean
  | null
  | string
  | Ref
  | Value[]
  | Map<string, Value>;
const isRef = (v: Value | undefined): v is Ref =>
  !!v && typeof v === "object" && "ref" in v;
const dict = (v: Value | undefined) => (v instanceof Map ? v : bad());
// A bounded non-rendering PDF lexical/indirect-object reader. Unsupported
// encryption, incremental updates and compressed cross-reference/object streams
// are rejected explicitly. No stream decompression, URL fetch or action execution.
class PdfReader {
  position: number;
  tokens = 0;
  constructor(
    readonly bytes: Buffer,
    position = 0,
  ) {
    this.position = position;
  }
  whitespace() {
    while (this.position < this.bytes.length) {
      const c = this.bytes[this.position];
      if (c === 37) {
        while (
          this.position < this.bytes.length &&
          ![10, 13].includes(this.bytes[this.position] ?? 0)
        )
          this.position++;
      } else if ([0, 9, 10, 12, 13, 32].includes(c ?? -1)) this.position++;
      else break;
    }
  }
  word() {
    this.whitespace();
    const start = this.position;
    while (
      this.position < this.bytes.length &&
      this.bytes[this.position] !== 0 &&
      !/[\s()[\]<>/%]/.test(String.fromCharCode(this.bytes[this.position] ?? 0))
    ) {
      this.position++;
      if (this.position - start > 4096) unsupported();
    }
    if (start === this.position) bad();
    return this.bytes.toString("latin1", start, this.position);
  }
  value(depth = 0): Value {
    if (++this.tokens > 200000 || depth > 32) unsupported();
    this.whitespace();
    const c = this.bytes[this.position++];
    if (c === 60 && this.bytes[this.position] === 60) {
      this.position++;
      const entries = new Map<string, Value>();
      while (true) {
        this.whitespace();
        if (
          this.bytes[this.position] === 62 &&
          this.bytes[this.position + 1] === 62
        ) {
          this.position += 2;
          return entries;
        }
        const name = this.value(depth + 1);
        if (
          typeof name !== "string" ||
          !name.startsWith("/") ||
          entries.has(name)
        )
          bad();
        entries.set(name, this.value(depth + 1));
      }
    }
    if (c === 91) {
      const entries: Value[] = [];
      while (true) {
        this.whitespace();
        if (this.bytes[this.position] === 93) {
          this.position++;
          return entries;
        }
        entries.push(this.value(depth + 1));
      }
    }
    if (c === 47) {
      const start = this.position;
      while (
        this.position < this.bytes.length &&
        this.bytes[this.position] !== 0 &&
        !/[\s()[\]<>/%]/.test(
          String.fromCharCode(this.bytes[this.position] ?? 0),
        )
      ) {
        this.position++;
        if (this.position - start > 4096) unsupported();
      }
      const name = this.bytes.toString("latin1", start, this.position);
      if (/#(?![0-9a-fA-F]{2})/.test(name)) bad();
      return `/${name.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)))}`;
    }
    if (c === 40) {
      let balance = 1;
      while (this.position < this.bytes.length && balance) {
        const next = this.bytes[this.position++];
        if (next === 92) this.position++;
        else if (next === 40) {
          if (++balance > 32) unsupported();
        } else if (next === 41) balance--;
      }
      if (balance || this.position > this.bytes.length) bad();
      return "literal";
    }
    if (c === 60) {
      while (
        this.position < this.bytes.length &&
        this.bytes[this.position] !== 62
      ) {
        if (
          !/[0-9a-fA-F\s]/.test(
            String.fromCharCode(this.bytes[this.position++] ?? 0),
          )
        )
          bad();
      }
      if (this.bytes[this.position++] !== 62) bad();
      return "hex";
    }
    this.position--;
    const token = this.word();
    if (["true", "false", "null"].includes(token))
      return token === "null" ? null : token === "true";
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) bad();
    const number = Number(token);
    if (!Number.isFinite(number)) bad();
    const position = this.position;
    this.whitespace();
    if (/\d/.test(String.fromCharCode(this.bytes[this.position] ?? 0))) {
      const generation = this.word();
      this.whitespace();
      if (this.bytes[this.position] === 82) {
        this.position++;
        if (
          !Number.isInteger(number) ||
          number < 1 ||
          !/^\d+$/.test(generation)
        )
          bad();
        return { ref: `${number}:${Number(generation)}` };
      }
    }
    this.position = position;
    return number;
  }
}
export function validatePdf(bytes: Buffer) {
  if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(bytes.toString("latin1", 0, 12)))
    bad();
  const tail = bytes.toString("latin1", Math.max(0, bytes.length - 1024));
  const end = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(tail);
  if (!end) bad();
  const xrefOffset = Number(end[1]);
  if (
    !Number.isSafeInteger(xrefOffset) ||
    xrefOffset < 8 ||
    xrefOffset >= bytes.length
  )
    bad();
  if (bytes.toString("ascii", xrefOffset, xrefOffset + 4) !== "xref")
    unsupported();
  const r = new PdfReader(bytes, xrefOffset);
  if (r.word() !== "xref") bad();
  const offsets = new Map<string, number>();
  const covered = new Set<number>();
  let total = 0;
  while (true) {
    const first = r.word();
    if (first === "trailer") break;
    const countText = r.word();
    if (!/^\d+$/.test(first) || !/^\d+$/.test(countText)) bad();
    const start = Number(first),
      count = Number(countText);
    total += count;
    if (count < 1 || start + count > 100000 || total > 100000) unsupported();
    for (let i = 0; i < count; i++) {
      if (covered.has(start + i)) bad();
      covered.add(start + i);
      const offset = r.word(),
        generation = r.word(),
        state = r.word();
      if (
        !/^\d{10}$/.test(offset) ||
        !/^\d{5}$/.test(generation) ||
        !["n", "f"].includes(state)
      )
        bad();
      if (start + i === 0 && (state !== "f" || generation !== "65535")) bad();
      if (state === "n") {
        const key = `${start + i}:${Number(generation)}`;
        if (
          offsets.has(key) ||
          Number(offset) < 8 ||
          Number(offset) >= xrefOffset
        )
          bad();
        offsets.set(key, Number(offset));
      }
    }
  }
  const trailer = dict(r.value());
  if (
    trailer.has("/Encrypt") ||
    trailer.has("/Prev") ||
    trailer.has("/XRefStm")
  )
    unsupported();
  const size = trailer.get("/Size");
  if (
    typeof size !== "number" ||
    !Number.isInteger(size) ||
    size < 2 ||
    size > 100000 ||
    size !== total
  )
    bad();
  for (let i = 0; i < size; i++) if (!covered.has(i)) bad();
  if (r.word() !== "startxref" || Number(r.word()) !== xrefOffset) bad();
  const objects = new Map<string, Value>();
  const streams = new Set<string>();
  const ranges: [number, number][] = [];
  const ordered = [...offsets].sort((a, b) => a[1] - b[1]);
  for (let index = 0; index < ordered.length; index++) {
    const [key, offset] = ordered[index] ?? bad();
    const limit = ordered[index + 1]?.[1] ?? xrefOffset;
    if (
      limit <= offset ||
      !/[0-9]/.test(String.fromCharCode(bytes[offset] ?? 0))
    )
      bad();
    const o = new PdfReader(bytes.subarray(0, limit), offset);
    const header = `${o.word()}:${Number(o.word())}`;
    if (header !== key || o.word() !== "obj") bad();
    const value = o.value();
    const next = o.word();
    if (next === "stream") {
      streams.add(key);
      const length = dict(value).get("/Length");
      if (isRef(length)) unsupported();
      if (typeof length !== "number" || !Number.isInteger(length) || length < 0)
        bad();
      if (bytes[o.position] === 13) o.position++;
      if (bytes[o.position++] !== 10 || o.position + length >= xrefOffset)
        bad();
      o.position += length;
      if (o.word() !== "endstream" || o.word() !== "endobj") bad();
    } else if (next !== "endobj") bad();
    if (
      value instanceof Map &&
      ["/ObjStm", "/XRef"].includes(String(value.get("/Type")))
    )
      unsupported();
    ranges.push([offset, o.position]);
    objects.set(key, value);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++)
    if ((ranges[i]?.[0] ?? 0) < (ranges[i - 1]?.[1] ?? Infinity)) bad();
  const resolve = (v: Value | undefined): Value =>
    isRef(v) ? (objects.get(v.ref) ?? bad()) : (v ?? bad());
  let visits = 0;
  function references(v: Value, depth = 0) {
    if (++visits > 200000 || depth > 32) unsupported();
    if (isRef(v)) {
      if (!objects.has(v.ref)) bad();
    } else if (Array.isArray(v))
      for (const item of v) references(item, depth + 1);
    else if (v instanceof Map)
      for (const item of v.values()) references(item, depth + 1);
  }
  for (const value of objects.values()) references(value);
  const catalog = dict(resolve(trailer.get("/Root")));
  if (catalog.get("/Type") !== "/Catalog") bad();
  const seen = new Set<string>();
  function pages(
    v: Value | undefined,
    parent?: Ref,
    depth = 0,
    inheritedBox?: Value,
  ): number {
    if (depth > 32 || !isRef(v) || seen.has(v.ref)) bad();
    seen.add(v.ref);
    const d = dict(resolve(v));
    if (
      parent &&
      (!isRef(d.get("/Parent")) || (d.get("/Parent") as Ref).ref !== parent.ref)
    )
      bad();
    const box = d.get("/MediaBox") ?? inheritedBox;
    if (d.get("/Type") === "/Page") {
      const dimensions = resolve(box);
      if (
        !Array.isArray(dimensions) ||
        dimensions.length !== 4 ||
        !dimensions.every((x) => typeof x === "number") ||
        Number(dimensions[2]) <= Number(dimensions[0]) ||
        Number(dimensions[3]) <= Number(dimensions[1])
      )
        bad();
      const contents = d.get("/Contents");
      if (contents !== undefined) {
        if (isRef(contents) && Array.isArray(objects.get(contents.ref)))
          unsupported();
        const entries = Array.isArray(contents) ? contents : [contents];
        if (entries.some((entry) => !isRef(entry) || !streams.has(entry.ref)))
          bad();
      }
      return 1;
    }
    if (d.get("/Type") !== "/Pages" || !Array.isArray(d.get("/Kids"))) bad();
    let count = 0;
    for (const child of d.get("/Kids") as Value[])
      count += pages(child, v, depth + 1, box);
    if (!count || d.get("/Count") !== count) bad();
    return count;
  }
  pages(catalog.get("/Pages"));
}

function wav(b: Buffer) {
  if (
    b.length < 44 ||
    b.toString("ascii", 0, 4) !== "RIFF" ||
    b.toString("ascii", 8, 12) !== "WAVE" ||
    b.readUInt32LE(4) + 8 !== b.length
  )
    bad();
  let position = 12,
    block = 0,
    data = 0,
    fmt = false;
  while (position < b.length) {
    if (position + 8 > b.length) bad();
    const tag = b.toString("ascii", position, position + 4),
      size = b.readUInt32LE(position + 4),
      start = position + 8;
    if (start + size > b.length) bad();
    if (tag === "fmt ") {
      if (fmt || size < 16) bad();
      fmt = true;
      const format = b.readUInt16LE(start),
        channels = b.readUInt16LE(start + 2),
        rate = b.readUInt32LE(start + 4),
        speed = b.readUInt32LE(start + 8),
        bits = b.readUInt16LE(start + 14);
      block = b.readUInt16LE(start + 12);
      if (![1, 3].includes(format)) unsupported();
      if (
        channels < 1 ||
        channels > 8 ||
        rate < 8000 ||
        rate > 192000 ||
        ![8, 16, 24, 32].includes(bits) ||
        (format === 3 && bits !== 32) ||
        block !== (channels * bits) / 8 ||
        speed !== rate * block
      )
        bad();
    } else if (tag === "data") {
      if (data || !fmt || !size || size % block) bad();
      data = size;
    }
    position = start + size + (size % 2);
  }
  if (position !== b.length || !fmt || !data) bad();
}
function mp3(b: Buffer) {
  let p = 0,
    frames = 0,
    previousVersion = -1,
    previousRate = -1;
  if (b.toString("ascii", 0, 3) === "ID3") {
    if (b.length < 10 || ![3, 4].includes(b[3] ?? 0) || (b[5] ?? 0) & 15)
      unsupported();
    let size = 0;
    for (let i = 6; i < 10; i++) {
      if ((b[i] ?? 128) > 127) bad();
      size = size * 128 + (b[i] ?? 0);
    }
    p = 10 + size + ((b[5] ?? 0) & 16 ? 10 : 0);
    if (p >= b.length) bad();
  }
  const end =
    b.length >= 128 &&
    b.toString("ascii", b.length - 128, b.length - 125) === "TAG"
      ? b.length - 128
      : b.length;
  let previousData = 0;
  while (p < end) {
    if (p + 4 > end || b[p] !== 255 || ((b[p + 1] ?? 0) & 224) !== 224) bad();
    const h1 = b[p + 1] ?? 0,
      h2 = b[p + 2] ?? 0,
      h3 = b[p + 3] ?? 0,
      version = (h1 >> 3) & 3,
      layer = (h1 >> 1) & 3,
      index = h2 >> 4,
      frequency = (h2 >> 2) & 3;
    if (
      version === 1 ||
      layer !== 1 ||
      index === 0 ||
      index === 15 ||
      frequency === 3 ||
      (h3 & 3) === 2
    )
      bad();
    const bitrate =
      (version === 3
        ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
        : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[
        index
      ] ?? 0;
    const rate =
      ([44100, 48000, 32000][frequency] ?? 0) /
      (version === 3 ? 1 : version === 2 ? 2 : 4);
    if (frames && (version !== previousVersion || rate !== previousRate)) bad();
    const size =
      Math.floor(((version === 3 ? 144000 : 72000) * bitrate) / rate) +
      ((h2 >> 1) & 1);
    const crc = h1 & 1 ? 0 : 2,
      side = version === 3 ? (h3 >> 6 === 3 ? 17 : 32) : h3 >> 6 === 3 ? 9 : 17;
    if (size <= 4 + crc + side || p + size > end) bad();
    const offset = p + 4 + crc,
      reservoir =
        version === 3
          ? ((b[offset] ?? 0) << 1) | ((b[offset + 1] ?? 0) >> 7)
          : (b[offset] ?? 0);
    if (reservoir > previousData) bad();
    const channels = h3 >> 6 === 3 ? 1 : 2;
    let bit = offset * 8;
    const read = (length: number) => {
      if (bit + length > (offset + side) * 8) bad();
      let value = 0;
      for (let i = 0; i < length; i++) {
        value =
          value * 2 + (((b[Math.floor(bit / 8)] ?? 0) >> (7 - (bit % 8))) & 1);
        bit++;
      }
      return value;
    };
    read(version === 3 ? 9 : 8);
    read(version === 3 ? (channels === 1 ? 5 : 3) : channels === 1 ? 1 : 2);
    if (version === 3)
      for (let channel = 0; channel < channels; channel++) read(4);
    let encodedBits = 0;
    const table = () => {
      const number = read(5);
      if (number === 4 || number === 14) bad();
    };
    for (let granule = 0; granule < (version === 3 ? 2 : 1); granule++)
      for (let channel = 0; channel < channels; channel++) {
        encodedBits += read(12);
        if (read(9) > 288) bad();
        read(8);
        read(version === 3 ? 4 : 9);
        if (read(1)) {
          const block = read(2),
            mixed = read(1);
          if (!block || (mixed && block !== 2)) bad();
          table();
          table();
          read(9);
        } else {
          table();
          table();
          table();
          if (read(4) + read(3) > 20) bad();
        }
        if (version === 3) read(1);
        read(1);
        read(1);
      }
    const dataBytes = size - 4 - crc - side;
    if (
      encodedBits > (dataBytes + reservoir) * 8 ||
      bit !== (offset + side) * 8
    )
      bad();
    previousData += dataBytes;
    previousVersion = version;
    previousRate = rate;
    frames++;
    p += size;
  }
  if (p !== end || frames < 2) bad();
}
type Box = { type: string; start: number; data: number; end: number };
function m4a(b: Buffer) {
  let count = 0;
  function boxes(start: number, end: number): Box[] {
    const result: Box[] = [];
    while (start < end) {
      if (++count > 50000 || start + 8 > end) bad();
      let size = b.readUInt32BE(start),
        header = 8;
      if (size === 1) {
        if (start + 16 > end) bad();
        const large = b.readBigUInt64BE(start + 8);
        if (large > BigInt(b.length)) bad();
        size = Number(large);
        header = 16;
      }
      if (size === 0) size = end - start;
      if (size < header || start + size > end) bad();
      result.push({
        type: b.toString("ascii", start + 4, start + 8),
        start,
        data: start + header,
        end: start + size,
      });
      start += size;
    }
    if (start !== end) bad();
    return result;
  }
  const one = (list: Box[], name: string): Box => {
    const found = list.filter((x) => x.type === name);
    if (found.length !== 1) bad();
    return found[0] ?? bad();
  };
  const children = (box: Box) => boxes(box.data, box.end);
  const full = (box: Box, min: number) => {
    if (box.data + 4 + min > box.end) bad();
    if (b[box.data] !== 0) unsupported();
    if (b.readUInt32BE(box.data) !== 0) bad();
    return box.data + 4;
  };
  const top = boxes(0, b.length),
    ftyp = one(top, "ftyp"),
    moov = one(top, "moov"),
    mdat = top.filter((x) => x.type === "mdat");
  if (
    ftyp.end - ftyp.data < 8 ||
    (ftyp.end - ftyp.data) % 4 ||
    !mdat.length ||
    top.some((x) => ["moof", "mfra"].includes(x.type))
  )
    unsupported();
  const brands = [];
  for (let p = ftyp.data; p < ftyp.end; p += 4)
    if (p !== ftyp.data + 4) brands.push(b.toString("ascii", p, p + 4));
  if (!brands.some((x) => ["M4A ", "isom", "mp42", "mp41"].includes(x)))
    unsupported();
  const movie = children(moov);
  const movieHeader = one(movie, "mvhd");
  const mhp = full(movieHeader, 96);
  const movieTimescale = b.readUInt32BE(mhp + 8),
    movieDuration = b.readUInt32BE(mhp + 12);
  if (!movieTimescale || !movieDuration) bad();
  if (movie.some((x) => x.type === "mvex")) unsupported();
  const tracks = movie.filter((x) => x.type === "trak");
  if (tracks.length !== 1) unsupported();
  for (const track of tracks) {
    const trackChildren = children(track),
      trackHeader = one(trackChildren, "tkhd");
    if (
      trackHeader.end - trackHeader.data !== 84 ||
      b[trackHeader.data] !== 0 ||
      !b.readUInt32BE(trackHeader.data + 12) ||
      !b.readUInt32BE(trackHeader.data + 20)
    )
      bad();
    const media = children(one(trackChildren, "mdia")),
      handler = one(media, "hdlr");
    const mediaHeader = one(media, "mdhd"),
      mdp = full(mediaHeader, 20);
    const mediaTimescale = b.readUInt32BE(mdp + 8),
      mediaDuration = b.readUInt32BE(mdp + 12);
    if (!mediaTimescale || !mediaDuration) bad();
    const hp = full(handler, 8);
    if (b.toString("ascii", hp + 4, hp + 8) !== "soun") unsupported();
    const minf = children(one(media, "minf")),
      dinf = children(one(minf, "dinf")),
      dref = one(dinf, "dref"),
      dp = full(dref, 4);
    const references = boxes(dp + 4, dref.end);
    if (
      b.readUInt32BE(dp) !== references.length ||
      references.length !== 1 ||
      references[0]?.type !== "url "
    )
      bad();
    const reference = references[0] ?? bad();
    if (
      reference.end - reference.data !== 4 ||
      b.readUInt32BE(reference.data) !== 1
    )
      unsupported();
    const table = children(one(minf, "stbl")),
      description = one(table, "stsd"),
      sp = full(description, 4);
    const entries = boxes(sp + 4, description.end);
    if (b.readUInt32BE(sp) !== 1 || entries.length !== 1) unsupported();
    const audio = entries[0] ?? bad();
    if (audio.type !== "mp4a" || audio.end - audio.data < 28) unsupported();
    if (
      b.readUInt16BE(audio.data + 6) !== 1 ||
      b.readUInt16BE(audio.data + 8) !== 0
    )
      unsupported();
    const channels = b.readUInt16BE(audio.data + 16),
      rate = b.readUInt32BE(audio.data + 24) / 65536;
    if (channels < 1 || channels > 8 || rate < 8000 || rate > 192000) bad();
    const extensions = boxes(audio.data + 28, audio.end),
      esds = one(extensions, "esds"),
      ep = full(esds, 2);
    // The elementary-stream descriptors are length-delimited. Accept AAC-LC
    // only, never video/encrypted/unknown codecs disguised as an audio handler.
    let descriptorCount = 0,
      decoder = false,
      config = false;
    function descriptors(start: number, end: number) {
      while (start < end) {
        if (++descriptorCount > 100) bad();
        const tag = b[start++];
        let length = 0,
          complete = false;
        for (let n = 0; n < 4; n++) {
          if (start >= end) bad();
          const octet = b[start++] ?? 0;
          length = length * 128 + (octet & 127);
          if (!(octet & 128)) {
            complete = true;
            break;
          }
        }
        const finish = start + length;
        if (!complete || finish > end) bad();
        if (tag === 3) {
          if (length < 3) bad();
          const flags = b[start + 2] ?? 0;
          if (flags !== 0) unsupported();
          descriptors(start + 3, finish);
        } else if (tag === 4) {
          if (length < 13 || b[start] !== 64 || (b[start + 1] ?? 0) >> 2 !== 5)
            unsupported();
          decoder = true;
          descriptors(start + 13, finish);
        } else if (tag === 5) {
          if (length < 2 || (b[start] ?? 0) >> 3 !== 2) unsupported();
          const fi = (((b[start] ?? 0) & 7) << 1) | ((b[start + 1] ?? 0) >> 7),
            cc = ((b[start + 1] ?? 0) >> 3) & 15;
          const frequencies = [
            96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000,
            12000, 11025, 8000, 7350,
          ];
          if (frequencies[fi] !== rate || cc !== channels) bad();
          config = true;
        }
        start = finish;
      }
    }
    descriptors(ep, esds.end);
    if (!decoder || !config) bad();
    const sz = one(table, "stsz"),
      zp = full(sz, 8),
      fixed = b.readUInt32BE(zp),
      samples = b.readUInt32BE(zp + 4);
    if (
      samples < 1 ||
      samples > 1000000 ||
      sz.end !== zp + 8 + (fixed ? 0 : samples * 4)
    )
      bad();
    const sizes = Array.from(
      { length: samples },
      (_, i) => fixed || b.readUInt32BE(zp + 8 + i * 4),
    );
    if (sizes.some((x) => x < 1)) bad();
    const co = one(
        table,
        table.some((x) => x.type === "co64") ? "co64" : "stco",
      ),
      cp = full(co, 4),
      chunks = b.readUInt32BE(cp),
      stride = co.type === "co64" ? 8 : 4;
    if (chunks < 1 || chunks > samples || co.end !== cp + 4 + chunks * stride)
      bad();
    const sc = one(table, "stsc"),
      scp = full(sc, 4),
      runs = b.readUInt32BE(scp);
    if (runs < 1 || runs > chunks || sc.end !== scp + 4 + runs * 12) bad();
    const mappings = Array.from({ length: runs }, (_, i) => ({
      first: b.readUInt32BE(scp + 4 + i * 12),
      count: b.readUInt32BE(scp + 8 + i * 12),
      description: b.readUInt32BE(scp + 12 + i * 12),
    }));
    if (
      mappings[0]?.first !== 1 ||
      mappings.some(
        (x, i) =>
          x.count < 1 ||
          x.description !== 1 ||
          x.first > chunks ||
          (i > 0 && x.first <= (mappings[i - 1]?.first ?? 0)),
      )
    )
      bad();
    const stts = one(table, "stts"),
      tp = full(stts, 4),
      times = b.readUInt32BE(tp);
    if (times < 1 || times > samples || stts.end !== tp + 4 + times * 8) bad();
    let timed = 0,
      duration = 0;
    for (let i = 0; i < times; i++) {
      const n = b.readUInt32BE(tp + 4 + i * 8),
        delta = b.readUInt32BE(tp + 8 + i * 8);
      if (!n || !delta) bad();
      timed += n;
      duration += n * delta;
    }
    if (timed !== samples || duration !== mediaDuration) bad();
    let sample = 0,
      run = 0;
    const ranges: [number, number][] = [];
    for (let i = 0; i < chunks; i++) {
      if ((mappings[run + 1]?.first ?? Infinity) === i + 1) run++;
      const offsetBig =
        co.type === "co64"
          ? b.readBigUInt64BE(cp + 4 + i * 8)
          : BigInt(b.readUInt32BE(cp + 4 + i * 4));
      if (offsetBig > BigInt(b.length)) bad();
      const offset = Number(offsetBig);
      let length = 0;
      for (let j = 0; j < (mappings[run]?.count ?? 0); j++) {
        if (sample >= samples) bad();
        length += sizes[sample++] ?? 0;
      }
      if (!mdat.some((x) => offset >= x.data && offset + length <= x.end))
        bad();
      ranges.push([offset, offset + length]);
    }
    if (sample !== samples) bad();
    ranges.sort((a, c) => a[0] - c[0]);
    for (let i = 1; i < ranges.length; i++)
      if ((ranges[i]?.[0] ?? 0) < (ranges[i - 1]?.[1] ?? Infinity)) bad();
  }
}
export function validateAudio(bytes: Buffer, type: string) {
  try {
    if (type === "audio/wav") wav(bytes);
    else if (type === "audio/mpeg") mp3(bytes);
    else if (type === "audio/mp4") m4a(bytes);
    else unsupported();
  } catch (error) {
    if (error instanceof MediaContentRejected) throw error;
    bad();
  }
}
