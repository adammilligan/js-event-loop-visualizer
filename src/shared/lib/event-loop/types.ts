export type TaskKind = 'micro' | 'macro';

export type SimEventKind =
  | 'enqueue_microtask'
  | 'enqueue_macrotask'
  | 'execute_microtask'
  | 'execute_macrotask'
  | 'console_log'
  | 'advance_time'
  | 'error';

export type TaskId = string;
export type EventId = number;
export type LogId = number;

export type MicroTask = {
  id: TaskId;
  kind: 'micro';
  label: string;
  createdAtEventId: EventId;
};

export type SimTimerTask = {
  id: TaskId;
  kind: 'macro';
  label: string;
  createdAtEventId: EventId;
  readyAtMs: number;
};

export type LogSource = 'sync' | 'micro' | 'macro' | 'system';

export type LogEntry = {
  id: LogId;
  source: LogSource;
  messageParts: string[];
  eventId: EventId;
};

export type SimEvent = {
  id: EventId;
  kind: SimEventKind;
  timestampMs: number;
  taskId?: TaskId;
  note?: string;
};

