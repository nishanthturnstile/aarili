import { withDocumentSharingHost } from "./document-sharing-host.mjs";

let disconnected = false,
  stop;
process.on("disconnect", () => {
  disconnected = true;
  stop?.();
});

await withDocumentSharingHost(async (host) => {
  if (disconnected) return;
  process.send({ ready: true, origin: host.origin, input: host.input });
  await new Promise((resolve) => {
    let release;
    stop = () => {
      release?.();
      resolve();
    };
    process.on("message", async (m) => {
      if (m.command === "stop") {
        release?.();
        resolve();
        return;
      }
      try {
        let value;
        switch (m.command) {
          case "count":
            value = (
              await host.f.admin.query(
                "select count(*)::int as n from document_share_event where kind='marked-sent'",
              )
            ).rows[0].n;
            break;
          case "lose":
            host.loseNextReply();
            break;
          case "storage":
            host.storageUnavailable(m.value === true);
            break;
          case "delay":
            if (m.value) {
              host.delayFile(
                new Promise((r) => {
                  release = r;
                }),
              );
            } else {
              release?.();
              host.delayFile(null);
            }
            break;
          default:
            throw Error("Unknown synthetic control");
        }
        process.send({ id: m.id, value });
      } catch {
        process.send({ id: m.id, error: "Synthetic control failed" });
      }
    });
  });
});
if (process.connected) process.disconnect();
