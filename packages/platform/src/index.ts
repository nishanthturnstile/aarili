import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// There are no public configuration variables in this increment.
export function validateEnvironment(
  runtimeEnv: Record<string, string | undefined>,
) {
  if (Object.keys(runtimeEnv).some((key) => key.startsWith("NEXT_PUBLIC_"))) {
    throw new Error(
      "Public environment variables are not allowed in this scaffold",
    );
  }
  return createEnv({
    server: {
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
    },
    runtimeEnv: { NODE_ENV: runtimeEnv.NODE_ENV },
    isServer: true,
    emptyStringAsUndefined: true,
    onValidationError: () => {
      throw new Error("Invalid server environment configuration");
    },
  });
}
