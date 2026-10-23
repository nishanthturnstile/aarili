import { withMeasurementFit } from "./measurement-fit-fixtures.mjs";
import { withMediaWeb } from "./media-web.mjs";
export function withPatternWeb(run) {
  return withMediaWeb(run, {
    surface: "manual-patterns",
    fixture: (callback) =>
      withMeasurementFit(
        async (f) => {
          const target = await f.sources.accept();
          await callback({ ...f, target });
        },
        { photo: false },
      ),
  });
}
