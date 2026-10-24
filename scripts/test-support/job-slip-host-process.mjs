import { designOk, designRequest } from "./design-choices-fixtures.mjs";
import { withJobSlipWeb } from "./job-slip-web.mjs";
import {
  physicalPattern,
  publishPattern,
  referenceAction,
} from "./manual-pattern-fixtures.mjs";

let stop;
process.on("disconnect", () => stop?.());
await withJobSlipWeb(async (f) => {
  process.send({
    ready: true,
    origin: f.origin,
    cookie: f.a.cookie,
    pieceId: f.scope.pieceId,
    orderId: f.scope.orderId,
  });
  await new Promise((resolve) => {
    stop = resolve;
    process.on("message", async (m) => {
      if (m.command === "stop") {
        resolve();
        return;
      }
      try {
        if (m.command === "renderFailure") f.setRenderFailure(m.value);
        else if (m.command === "sourceChange") {
          await publishPattern(
            f,
            await physicalPattern(f, {
              content: {
                ...(await physicalPattern(f)).content,
                locator: "SYNTHETIC corrected browser source",
              },
            }),
          );
          const page = await designRequest(f, "manual-patterns/list", {
            method: "POST",
            body: { ...f.scope, readerVersion: 2 },
          }).then(designOk);
          await publishPattern(
            f,
            await referenceAction(f, page.state.latestSavedId, "select"),
          );
        } else throw Error("Unknown control");
        process.send({ id: m.id, value: true });
      } catch {
        process.send({ id: m.id, error: "Synthetic control failed" });
      }
    });
  });
});
if (process.connected) process.disconnect();
