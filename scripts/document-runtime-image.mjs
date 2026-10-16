import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export async function documentImage() {
  const hash = createHash("sha256");
  async function tree(path) {
    for (const e of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const p = `${path}/${e.name}`;
      if (e.isDirectory()) await tree(p);
      else {
        hash.update(p);
        hash.update(await readFile(p));
      }
    }
  }
  for (const p of [
    "packages/documents/dist",
    "packages/documents/assets",
    "packages/documents/test",
    "packages/contracts/dist",
    "infra/pdf",
  ])
    await tree(p);
  for (const p of [
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "packages/documents/package.json",
    "packages/contracts/package.json",
  ]) {
    hash.update(p);
    hash.update(await readFile(p));
  }
  return `aarili-documents:${hash.digest("hex").slice(0, 24)}`;
}
export async function command(args, input, quiet = false) {
  return new Promise((ok, no) => {
    const p = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "",
      err = "";
    p.stdout.on("data", (b) => {
      out += b;
      if (!quiet) process.stdout.write(b);
    });
    p.stderr.on("data", (b) => {
      err += b;
      if (!quiet) process.stderr.write(b);
    });
    p.on("error", () => no(Error("Document verification Docker unavailable")));
    p.on("close", (code) =>
      code === 0
        ? ok(out)
        : no(
            Error(
              quiet
                ? "Document verification command failed"
                : `Document Docker command failed (${code}): ${err.slice(-1500)}`,
            ),
          ),
    );
    p.stdin.end(input);
  });
}
export const documentRunArguments = [
  "--init",
  "--network",
  "none",
  "--read-only",
  "--memory",
  "1g",
  "--cpus",
  "1",
  "--pids-limit",
  "256",
  "--shm-size",
  "256m",
  "--tmpfs",
  "/tmp:rw,noexec,nosuid,size=256m,mode=1777",
  "--cap-drop",
  "ALL",
  "--cap-add",
  "SYS_CHROOT",
  "--security-opt",
  "no-new-privileges",
  "--security-opt",
  `seccomp=${resolve("infra/pdf/seccomp.json")}`,
];
let build;
export async function ensureDocumentImage() {
  build ??= (async () => {
    const image = await documentImage();
    try {
      await command(["image", "inspect", image], undefined, true);
    } catch {
      // An explicit small context avoids including node_modules, secrets or
      // unrelated application/build files, regardless of Docker ignore behavior.
      await mkdir(".scratch", { recursive: true });
      const context = await mkdtemp(resolve(".scratch/pdf-runtime-context-"));
      try {
        for (const p of [
          "packages/documents/dist",
          "packages/documents/assets",
          "packages/documents/test",
          "packages/contracts/dist",
          "infra/pdf",
        ]) {
          await mkdir(dirname(`${context}/${p}`), { recursive: true });
          await cp(p, `${context}/${p}`, { recursive: true });
        }
        for (const p of [
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          ".npmrc",
          "patches",
        ]) {
          await mkdir(dirname(`${context}/manifests/${p}`), {
            recursive: true,
          });
          await cp(p, `${context}/manifests/${p}`, { recursive: true });
        }
        for (const root of ["packages", "apps"])
          for (const e of await readdir(root, { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            const p = `${root}/${e.name}/package.json`;
            await mkdir(dirname(`${context}/manifests/${p}`), {
              recursive: true,
            });
            await cp(p, `${context}/manifests/${p}`);
          }
        await command([
          "build",
          "--file",
          `${context}/infra/pdf/Dockerfile`,
          "--target",
          "verification",
          "--tag",
          image,
          context,
        ]);
      } finally {
        const path = relative(resolve(".scratch"), context);
        assert(path && !path.startsWith("..") && !isAbsolute(path));
        await rm(context, { recursive: true, force: true });
      }
    }
    return image;
  })();
  return build;
}
if (
  resolve(process.argv[1] ?? "") ===
  resolve("scripts/document-runtime-image.mjs")
) {
  const image = await ensureDocumentImage();
  assert(image);
  console.info(`Private document verification image ready: ${image}`);
}
