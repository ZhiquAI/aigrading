export type RuntimeConfig = {
  apiBaseUrl: string;
  requestTimeoutMs: number;
};

export const defaultConfig: RuntimeConfig = {
  apiBaseUrl: "http://localhost:3000",
  requestTimeoutMs: 15000
};

export const mergeConfig = (
  overrides: Partial<RuntimeConfig> = {}
): RuntimeConfig => ({
  ...defaultConfig,
  ...overrides
});
