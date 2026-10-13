import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { createOwnerAuth } from "@aarili/auth";

const owner = createOwnerAuth({
  connectionString: process.env.DATABASE_URL,
  secret: process.env.TEST_AUTH_SECRET,
  setupToken: process.env.TEST_SETUP_TOKEN,
  origin: "http://127.0.0.1:3103",
  capture: async ({ code }) => {
    process.send({ code });
  },
});
try {
  if (process.env.TEST_AUTH_ACTION === "limits") {
    const api = createApi(async () => true, owner);
    const send = (path, body) =>
      api.fetch(
        new Request(`http://127.0.0.1:3103/api${path}`, {
          method: "POST",
          headers: {
            Origin: owner.origin,
            "Content-Type": "application/json",
            "X-Setup-Token": "wrong",
            "Idempotency-Key": randomUUID(),
          },
          body: JSON.stringify(body),
        }),
      );
    const setup = await send("/owner/setup", {
      name: "Synthetic",
      shopName: "Synthetic",
      email: "owner@example.test",
      password: "synthetic-long-passphrase-12",
    });
    const signin = await send("/auth/sign-in/email", {
      email: "owner@example.test",
      password: "wrong-password-000",
    });
    process.send({ setupStatus: setup.status, signInStatus: signin.status });
  } else {
    await owner.resend(
      "owner@example.test",
      "synthetic-long-passphrase-12",
      process.env.TEST_SETUP_TOKEN,
    );
  }
} finally {
  await owner.close();
}
