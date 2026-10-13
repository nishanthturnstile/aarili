import type { JSX as ReactJSX } from "react";

// Next 16.4 typed-route output still refers to the legacy global element name.
// Preserve the exact React 19 type. See docs/agents/Issue_2_Workspace_Evidence.md.
declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
  }
}
