import { googleEntrySchema } from "@aarili/contracts";

export type GoogleConfiguration = {
  clientId: string;
  clientSecret: string;
  approvedOrigin: string;
  environment: "development" | "production";
  allowedEmails: readonly string[];
};

export function googleFromEnvironment(
  env: Record<string, string | undefined>,
): GoogleConfiguration | undefined {
  // Credentials alone never activate a connection. Approval is environment-local.
  if (env.AUTH_GOOGLE_ENABLED !== "true") return undefined;
  const prefix = env.AUTH_GOOGLE_ENVIRONMENT === "production" ? "PROD" : "DEV";
  const clientId = env[`GOOGLE_${prefix}_CLIENT_ID`];
  const clientSecret = env[`GOOGLE_${prefix}_CLIENT_SECRET`];
  const approvedOrigin = env.AUTH_GOOGLE_APPROVED_ORIGIN;
  const allowedEmails = env.AUTH_GOOGLE_ALLOWED_EMAILS?.split(",");
  if (
    !clientId ||
    !clientSecret ||
    !approvedOrigin ||
    !allowedEmails?.length ||
    !["development", "production"].includes(env.AUTH_GOOGLE_ENVIRONMENT ?? "")
  )
    return undefined;
  const configuration: GoogleConfiguration = {
    clientId,
    clientSecret,
    approvedOrigin,
    allowedEmails,
    environment: prefix === "PROD" ? "production" : "development",
  };
  try {
    validateGoogle(configuration, env.AUTH_ORIGIN ?? "");
    return configuration;
  } catch {
    // Invalid or incomplete activation never removes credential recovery.
    return undefined;
  }
}

export function validateGoogle(
  configuration: GoogleConfiguration,
  origin: string,
) {
  if (
    configuration.approvedOrigin !== origin ||
    !configuration.clientId ||
    !configuration.clientSecret ||
    configuration.allowedEmails.length === 0 ||
    configuration.allowedEmails.some(
      (email) =>
        !googleEntrySchema.shape.loginHint.safeParse(email).success ||
        email !== email.toLowerCase() ||
        email.trim() !== email,
    ) ||
    (configuration.environment === "production" &&
      (new URL(origin).protocol !== "https:" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)))
  )
    throw new Error("Google approval configuration invalid");
}
