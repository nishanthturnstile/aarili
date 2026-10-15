import { fileURLToPath } from "node:url";
import { validateEnvironment } from "@aarili/platform";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

validateEnvironment(process.env);

const nextConfig: NextConfig = {
  devIndicators: false,
  // Raw development URLs can contain OAuth codes; browser errors can echo
  // entered values. Keep both out of the unsanitized framework terminal log.
  logging: { incomingRequests: false, browserToTerminal: false },
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  typedRoutes: true,
  async headers() {
    return [
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
    // These fixtures restart Next with a new database/origin for every case.
    // Reusing persisted development chunks can produce HMR hash reload loops.
    ...(process.env.AARILI_OWNER_UI_TRIAL === "true" &&
    phase === PHASE_DEVELOPMENT_SERVER
      ? { experimental: { turbopackFileSystemCacheForDev: false } }
      : {}),
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
