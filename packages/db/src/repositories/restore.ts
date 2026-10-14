export type RestoreState = {
  epoch: string;
  outbound: boolean;
  frozen: boolean;
};
export interface RestoreRepository {
  lockState(): Promise<RestoreState | undefined>;
  practice(): Promise<boolean | undefined>;
}
