type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const write = (level: LogLevel, message: string, meta: LogMeta = {}): void => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };
  // Keep output structured for future log pipeline ingestion.
  console.log(JSON.stringify(payload));
};

export const telemetryLogger = {
  info: (message: string, meta?: LogMeta): void => write("info", message, meta),
  warn: (message: string, meta?: LogMeta): void => write("warn", message, meta),
  error: (message: string, meta?: LogMeta): void => write("error", message, meta)
};
