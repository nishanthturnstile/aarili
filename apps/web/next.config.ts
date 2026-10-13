import { fileURLToPath } from "node:url";
import { validateEnvironment } from "@aarili/platform";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

validateEnvironment(process.env);

const nextConfig: NextConfig = {
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
    typescript: {
      tsconfigPath:
        phase === PHASE_DEVELOPMENT_SERVER
          ? "tsconfig.json"
          : "tsconfig.build.json",
    },
  };
}
