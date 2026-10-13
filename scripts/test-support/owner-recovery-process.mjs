import { createApi } from "@aarili/api";
import { createOwnerAuth } from "@aarili/auth";

// Private IPC only; credentials/tokens are never arguments, output or artifacts.
process.once("message", async ({ action, body }) => {
  const owner = createOwnerAuth({
    connectionString: process.env.DATABASE_URL,
    origin: "http://127.0.0.1:3103",
    secret: process.env.TEST_AUTH_SECRET,
    setupToken: "",
    capture: async (message) => process.send({ capture: message }),
  });
  try {
    const api = createApi(async () => true, owner);
    const response = await api.fetch(
      new Request(`http://127.0.0.1:3103/api/owner/recovery/${action}`, {
        method: "POST",
        headers: { Origin: owner.origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    process.send({ status: response.status });
  } catch {
    process.send({ status: 503 });
  } finally {
    await owner.close();
    process.disconnect();
  }
});
