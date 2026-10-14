export type ScheduleRun = {
  id: string;
  shopId: string;
  task: "foundation.daily" | "foundation.nightly";
  authorizerId: string;
  grantVersion: number;
  businessDate: string;
  epoch: string;
};
export interface ScheduleRepository {
  lock(task: string): Promise<void>;
  run(id: string): Promise<ScheduleRun | undefined>;
  enabled(run: ScheduleRun): Promise<boolean>;
  epoch(): Promise<string | undefined>;
  quarantined(id: string): Promise<boolean>;
  quarantine(run: ScheduleRun, epoch: string): Promise<void>;
  effected(id: string): Promise<boolean>;
  apply(run: ScheduleRun): Promise<void>;
}
