import type pg from "pg";
import { RateLimiterPostgres, RateLimiterRes } from "rate-limiter-flexible";

export function createAbuseLimiter(
  pool: pg.Pool,
  points: number,
  duration: number,
  keyPrefix: string,
) {
  const limiter = new RateLimiterPostgres({
    storeClient: pool,
    tableName: "application_rate_limit",
    tableCreated: true,
    clearExpiredByTimeout: false,
    points,
    duration,
    keyPrefix,
  });
  return async () => {
    try {
      await limiter.consume("installation");
      return 0;
    } catch (error) {
      if (error instanceof RateLimiterRes)
        return Math.max(1, Math.ceil(error.msBeforeNext / 1000));
      throw new Error("Rate limiter unavailable");
    }
  };
}
