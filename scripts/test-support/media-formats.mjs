// Entirely synthetic blank-page, silence and generated-pixel fixtures.
export function blankPdf(stream = "", overrides = {}) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 595 842] >>",
    "<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  for (const [index, value] of Object.entries(overrides))
    objects[Number(index)] = value;
  let value = "%PDF-1.7\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(value));
    value += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(value);
  value += `xref\n0 5\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((x) => `${String(x).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(value);
}
export function silenceWav() {
  const data = Buffer.alloc(44 + 1600);
  data.write("RIFF", 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24);
  data.writeUInt32LE(16000, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(1600, 40);
  return data;
}
export function silenceMp3() {
  // MPEG1 LayerIII, 128kbps/44.1kHz stereo, zero side information (zero
  // part2_3_length/big_values => silence), no preceding bit reservoir.
  const frame = Buffer.alloc(417);
  frame.set([255, 251, 144, 0]);
  return Buffer.concat(Array.from({ length: 6 }, () => frame));
}
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const box = (name, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([u32(body.length + 8), Buffer.from(name), body]);
};
const full = (name, ...parts) => box(name, Buffer.alloc(4), ...parts);
export function silenceM4a() {
  const ftyp = box(
    "ftyp",
    Buffer.from("M4A "),
    u32(0),
    Buffer.from("M4A isom"),
  );
  // AAC-LC stereo silent access unit. Browser native decoding is tested
  // separately; structural validation itself never decodes compressed audio.
  const sample = Buffer.from([0x21, 0x10, 0x04, 0x60, 0x8c, 0x1c]);
  const samples = Array.from({ length: 5 }, () => sample),
    mdat = box("mdat", ...samples);
  const descriptor = (tag, ...parts) => {
    const data = Buffer.concat(parts);
    return Buffer.concat([Buffer.from([tag, data.length]), data]);
  };
  const esds = full(
    "esds",
    descriptor(
      3,
      Buffer.from([0, 1, 0]),
      descriptor(
        4,
        Buffer.from([0x40, 0x15, 0, 0, 0, 0, 1, 0xf4, 0, 0, 1, 0xf4, 0]),
        descriptor(5, Buffer.from([0x12, 0x10])),
      ),
      descriptor(6, Buffer.from([2])),
    ),
  );
  const audio = Buffer.alloc(28);
  audio.writeUInt16BE(1, 6);
  audio.writeUInt16BE(2, 16);
  audio.writeUInt16BE(16, 18);
  audio.writeUInt32BE(44100 * 65536, 24);
  const stbl = box(
    "stbl",
    full("stsd", u32(1), box("mp4a", audio, esds)),
    full("stts", u32(1), u32(5), u32(1024)),
    full("stsc", u32(1), u32(1), u32(5), u32(1)),
    full("stsz", u32(sample.length), u32(5)),
    full("stco", u32(1), u32(ftyp.length + 8)),
  );
  const url = box("url ", u32(1)),
    dinf = box("dinf", full("dref", u32(1), url));
  const mdhd = Buffer.alloc(20);
  mdhd.writeUInt32BE(44100, 8);
  mdhd.writeUInt32BE(5120, 12);
  mdhd.writeUInt16BE(0x55c4, 16);
  const hdlr = Buffer.alloc(20);
  hdlr.write("soun", 4);
  const media = box(
    "mdia",
    full("mdhd", mdhd),
    full("hdlr", hdlr),
    box("minf", full("smhd", Buffer.alloc(4)), dinf, stbl),
  );
  const tkhd = Buffer.alloc(84);
  tkhd.writeUInt32BE(3, 0);
  tkhd.writeUInt32BE(1, 12);
  tkhd.writeUInt32BE(116, 20);
  tkhd.writeUInt16BE(0x100, 36);
  tkhd.writeUInt32BE(0x10000, 40);
  tkhd.writeUInt32BE(0x10000, 56);
  tkhd.writeUInt32BE(0x40000000, 72);
  const mvhd = Buffer.alloc(96);
  mvhd.writeUInt32BE(1000, 8);
  mvhd.writeUInt32BE(116, 12);
  mvhd.writeUInt32BE(0x10000, 16);
  mvhd.writeUInt16BE(0x100, 20);
  mvhd.writeUInt32BE(0x10000, 32);
  mvhd.writeUInt32BE(0x10000, 48);
  mvhd.writeUInt32BE(0x40000000, 64);
  mvhd.writeUInt32BE(2, 92);
  return Buffer.concat([
    ftyp,
    mdat,
    box("moov", full("mvhd", mvhd), box("trak", box("tkhd", tkhd), media)),
  ]);
}
