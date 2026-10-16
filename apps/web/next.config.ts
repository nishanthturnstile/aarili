import { fileURLToPath } from "node:url";
import { validateEnvironment } from "@aarili/platform";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

validateEnvironment(process.env);

const nextConfig: NextConfig = {
  devIndicators: false,
  // OAuth callback codes must not enter development request/browser logs.
  logging: { incomingRequests: false, browserToTerminal: false },
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  // Native runtime companions are not all discoverable from the .node addon
  // (notably Windows libvips DLLs). Include only installed sharp/libvips lib
  // directories, across pnpm's platform package names; build scripts stay off.
  outputFileTracingIncludes: {
    "/*": [
      "../../node_modules/.pnpm/@img+sharp-*/node_modules/@img/sharp-*/lib/**/*",
    ],
  },
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; connect-src 'self'",
          },
        ],
      },
      {
        source: "/offline.html",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default function configureNext(phase: string): NextConfig {
  return {
    ...nextConfig,
    distDir:
      process.env.AARILI_UI_VERIFICATION === "true" &&
      phase === PHASE_DEVELOPMENT_SERVER
        ? ".next-ui"
        : ".next",
    typescript: {
      tsconfigPath:
        phase === PHASE_DEVELOPMENT_SERVER
          ? "tsconfig.json"
          : "tsconfig.build.json",
    },
  };
}
