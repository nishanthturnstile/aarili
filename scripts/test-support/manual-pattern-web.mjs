import { withMeasurementFit } from "./measurement-fit-fixtures.mjs";
import { withMediaWeb } from "./media-web.mjs";
export function withPatternWeb(run, { photo = false, seed } = {}) {
  return withMediaWeb(run, {
    surface: "manual-patterns",
    fixture: (callback) =>
      withMeasurementFit(
        async (f) => {
          const target = await f.sources.accept();
          const fixture = { ...f, target };
          await seed?.(fixture);
          await callback(fixture);
        },
        { photo },
      ),
  });
}
