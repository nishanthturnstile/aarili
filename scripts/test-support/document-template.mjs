import { createRequire } from "node:module";

// Load the actual retained module through Node 24, as the isolated renderer
// does. A test-runner rewrite of its function bodies changes the code identity
// and must not be mistaken for the reviewed template artifact.
const fixture = createRequire(import.meta.url)(
  "../../packages/documents/test/template.mjs",
);
export const { syntheticDocumentTemplates, tamilGoldenStrings } = fixture;
