import { NodeClient } from "@sentry/node";
import pino from "pino";

// Never accept arbitrary message text, URLs, error values or caller field names.
const codes = [
  "web.unhandled",
  "web.job_failed",
  "worker.job_failed",
  "web.request_failed",
  "worker.unavailable",
  "worker.shutdown",
] as const;
type Code = (typeof codes)[number];
export type OperationalEvidence = {
  code: Code;
  surface: "web" | "worker";
  requestId?: string;
};
function scrub(input: unknown): OperationalEvidence | null {
  if (!input || typeof input !== "object") return null;
  // Snapshot each property once: getters must not change a value after validation.
  const { code, surface, requestId } = input as Record<string, unknown>;
  if (
    !codes.includes(code as Code) ||
    (surface !== "web" && surface !== "worker")
  )
    return null;
  return {
    code: code as Code,
    surface: surface,
    ...(typeof requestId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      requestId,
    )
      ? { requestId: requestId.toLowerCase() }
      : {}),
  };
}
export function createPrivateTelemetry(
  options: {
    logSink?: (line: string) => void;
    localErrorSink?: (payload: unknown) => void;
  } = {},
) {
  const logger = pino(
    {
      base: null,
      serializers: { err: () => undefined },
      redact: {
        paths: [
          "name",
          "phone",
          "measurements",
          "cookie",
          "authorization",
          "body",
          "url",
          "err",
        ],
        remove: true,
      },
    },
    {
      write(line: string) {
        try {
          (
            options.logSink ??
            ((s: string) => {
              process.stdout.write(s);
            })
          )(line);
        } catch {
          /* Diagnostics must never interrupt owner operations. */
        }
      },
    },
  );
  // There is deliberately no external transport/configuration path in this slice.
  // A local client is only constructed for an explicitly injected local sink.
  const client = options.localErrorSink
    ? new NodeClient({
        dsn: "https://local@127.0.0.1/1",
        environment: "local",
        release: "aarili-private-observability",
        integrations: [],
        stackParser: () => [],
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          graphQL: { document: false, variables: false },
          genAI: { inputs: false, outputs: false },
          databaseQueryData: false,
          queues: false,
          stackFrameVariables: false,
          frameContextLines: 0,
        },
        includeServerName: false,
        enableOpenTelemetrySetup: false,
        enableRuntimeChannelInjection: false,
        sendClientReports: false,

        beforeSend(event) {
          const safe = scrub(event.tags);
          return safe
            ? {
                type: undefined,
                ...(event.event_id ? { event_id: event.event_id } : {}),
                ...(event.timestamp ? { timestamp: event.timestamp } : {}),
                level: "error",
                message: safe.code,
                tags: { ...safe },
              }
            : null;
        },
        transport: () => ({
          send(envelope) {
            try {
              options.localErrorSink?.(envelope);
            } catch {
              /* Local sink failures are isolated. */
            }
            return Promise.resolve({ statusCode: 200 });
          },
          flush: () => Promise.resolve(true),
        }),
      })
    : undefined;
  return {
    report(input: unknown) {
      try {
        const safe = scrub(input);
        if (!safe) return;
        logger.error(safe, safe.code);
        client?.captureEvent({
          message: safe.code,
          level: "error",
          tags: { ...safe },
        });
      } catch {
        /* Includes hostile getters and unavailable adapters. */
      }
    },
    async flush() {
      try {
        return (await client?.flush(1000)) ?? true;
      } catch {
        return false;
      }
    },
  };
}
export const privateTelemetry = createPrivateTelemetry();
