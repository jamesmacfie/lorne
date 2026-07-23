export type LogContext = {
  requestId?: string;
  jobId?: string;
  userHash?: string;
  state?: string;
  durationMs?: number;
  code?: string;
  usage?: Record<string, number>;
};

export function logEvent(event: string, context: LogContext = {}): void {
  console.info(JSON.stringify({ event, at: new Date().toISOString(), ...context }));
}
