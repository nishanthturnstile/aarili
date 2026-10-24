import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  command,
  documentRunArguments,
  ensureDocumentImage,
} from "./document-runtime-image.mjs";

const output = resolve(`.scratch/quotation-pdf-proof-${randomUUID()}`);
await mkdir(output, { recursive: true });
const image = await ensureDocumentImage();
await command([
  "run",
  "--rm",
  ...documentRunArguments,
  "--mount",
  `type=bind,source=${output},target=/proof`,
  image,
  "--quotation-proof",
]);
console.info(await readFile(`${output}/quotation-evidence.json`, "utf8"));
console.info(`Quotation PDF proof: ${output}`);
