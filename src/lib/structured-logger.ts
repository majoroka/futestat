export function logStructuredEvent(
  enabled: boolean,
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown>,
): void {
  if (!enabled) {
    return;
  }

  process.stderr.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...fields,
    })}\n`,
  );
}
