export type LogLevel = "info" | "warn" | "error";

export const logEvent = (
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {}
): void => {
  const payload = {
    level,
    message,
    context,
    timestamp: new Date().toISOString()
  };
  // JSON log format keeps observability tools easy to integrate later.
  console.log(JSON.stringify(payload));
};
