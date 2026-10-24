import { withMediaWeb } from "./media-web.mjs";
import { withQuotationIssues } from "./quotation-issue-fixtures.mjs";

let stop;
process.on("disconnect", () => stop?.());
await withMediaWeb(
  async (f) => {
    process.send({
      ready: true,
      origin: f.origin,
      cookie: f.a.cookie,
      proposalId: f.proposalId,
    });
    await new Promise((resolve) => {
      stop = resolve;
      process.on("message", async (m) => {
        if (m.command === "stop") {
          resolve();
          return;
        }
        try {
          if (m.command === "renderFailure") f.failRender(m.value);
          else if (m.command === "sourceChange") {
            const p = await f.setup("settings/profile", { method: "GET" });
            await f.setup("settings/profile", {
              method: "PUT",
              etag: `"v${p.version}"`,
              body: { ...p.profile, address: "SYNTHETIC revised profile" },
            });
          } else throw Error("Unknown synthetic control");
          process.send({ id: m.id, value: true });
        } catch {
          process.send({ id: m.id, error: "Synthetic control failed" });
        }
      });
    });
  },
  { surface: "quotation-issues", fixture: withQuotationIssues },
);
if (process.connected) process.disconnect();
