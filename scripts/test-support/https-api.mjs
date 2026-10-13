import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, request } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function withHttpsApi(createApi, run) {
  const directory = await mkdtemp(join(tmpdir(), "aarili-synthetic-tls-"));
  const openssl =
    process.platform === "win32" &&
    existsSync("C:/Program Files/Git/usr/bin/openssl.exe")
      ? "C:/Program Files/Git/usr/bin/openssl.exe"
      : "openssl";
  let server;
  try {
    execFileSync(
      openssl,
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        join(directory, "key.pem"),
        "-out",
        join(directory, "cert.pem"),
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
      ],
      { stdio: "ignore" },
    );
    const key = await readFile(join(directory, "key.pem"));
    const cert = await readFile(join(directory, "cert.pem"));
    let api;
    server = createServer({ key, cert }, async (incoming, outgoing) => {
      try {
        const chunks = [];
        for await (const chunk of incoming) chunks.push(chunk);
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers))
          if (value)
            headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        const response = await api.fetch(
          new Request(
            `https://localhost:${server.address().port}${incoming.url}`,
            {
              method: incoming.method,
              headers,
              ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
            },
          ),
        );
        outgoing.writeHead(response.status, {
          ...Object.fromEntries(response.headers),
          "set-cookie": response.headers.getSetCookie(),
        });
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        outgoing.writeHead(503);
        outgoing.end("Request failed");
      }
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const port = server.address().port;
    const origin = `https://localhost:${port}`;
    api = createApi(origin);
    async function send(path, body, headers = {}, method = "POST") {
      return new Promise((resolve, reject) => {
        const req = request(
          {
            host: "127.0.0.1",
            servername: "localhost",
            port,
            path: `/api${path}`,
            ca: cert,
            method,
            headers: {
              Origin: origin,
              "Content-Type": "application/json",
              ...headers,
            },
          },
          (res) => {
            let data = "";
            res.on("data", (b) => {
              data += b;
            });
            res.on("end", () =>
              resolve({ status: res.statusCode, headers: res.headers, data }),
            );
          },
        );
        req.once("error", reject);
        if (body !== undefined) req.write(JSON.stringify(body));
        req.end();
      });
    }
    await run(send);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    // Unique OS temp fixture only; never a checkout or a persistent TLS credential.
    await rm(directory, { recursive: true, force: true });
  }
}
