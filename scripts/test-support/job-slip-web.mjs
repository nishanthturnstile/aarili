import { withJobSlips } from "./job-slip-fixtures.mjs";
import { withMediaWeb } from "./media-web.mjs";
export function withJobSlipWeb(run) {
  return withMediaWeb(run, {
    surface: "job-slips",
    fixture: (callback) =>
      withJobSlips((f) =>
        callback({ ...f, composition: f.documentComposition }),
      ),
  });
}
