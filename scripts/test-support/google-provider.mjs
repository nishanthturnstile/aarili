import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

// The only substituted layer is HTTPS provider transport. The real Google
// provider, Better Auth routes, state, guards, DB adapter and sessions run intact.
export function syntheticGoogle() {
  const codes = new Map();
  const tokens = [];
  const diagnostics = [];
  let calls = 0;
  function issue(authorization, profile = {}) {
    const url = new URL(authorization);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.deepEqual(url.searchParams.get("scope").split(" ").sort(), [
      "email",
      "openid",
      "profile",
    ]);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    const code = randomBytes(24).toString("hex");
    const payload = {
      sub: "synthetic-google-owner",
      email: "owner@example.test",
      email_verified: true,
      name: "Synthetic owner",
      iss: "https://accounts.google.com",
      aud: url.searchParams.get("client_id"),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...profile,
    };
    const idToken = `${Buffer.from('{"alg":"RS256","kid":"synthetic"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.synthetic-transport-signature`;
    const accessToken = `synthetic-access-${randomBytes(16).toString("hex")}`;
    const refreshToken = `synthetic-refresh-${randomBytes(16).toString("hex")}`;
    tokens.push(idToken, accessToken, refreshToken);
    codes.set(code, { url, idToken, accessToken, refreshToken });
    const callback = new URL(url.searchParams.get("redirect_uri"));
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", url.searchParams.get("state"));
    return callback.toString();
  }
  async function transport(input, init) {
    calls++;
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    assert.equal(
      url.href,
      "https://oauth2.googleapis.com/token",
      "Unexpected external provider request",
    );
    const form = new URLSearchParams(init?.body);
    const code = form.get("code");
    const found = codes.get(code);
    diagnostics.push({
      hasCode: !!code,
      codeKnown: !!found,
      hasVerifier: !!form.get("code_verifier"),
      hasClient: !!form.get("client_id"),
    });
    codes.delete(code);
    if (!found)
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    assert.equal(
      form.get("redirect_uri"),
      found.url.searchParams.get("redirect_uri"),
    );
    assert.equal(
      form.get("client_id"),
      found.url.searchParams.get("client_id"),
    );
    assert.equal(form.get("client_secret"), "synthetic-google-secret-14");
    assert.equal(
      createHash("sha256")
        .update(form.get("code_verifier"))
        .digest("base64url"),
      found.url.searchParams.get("code_challenge"),
    );
    return Response.json({
      access_token: found.accessToken,
      refresh_token: found.refreshToken,
      id_token: found.idToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid email profile",
    });
  }
  return { issue, transport, tokens, diagnostics, calls: () => calls };
}

export async function googleTransportServer(provider) {
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const response = await provider.transport(
        "https://oauth2.googleapis.com/token",
        { body: Buffer.concat(chunks).toString() },
      );
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(await response.text());
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"error":"invalid_grant"}');
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}
