import type { LogEntry, MicroTask, SimEvent, SimTimerTask } from './types';

export type SimState = {
  sessionId: number;
  nowMs: number;
  microtasks: MicroTask[];
  macrotasks: SimTimerTask[];
  events: SimEvent[];
  logs: LogEntry[];
  isRunning: boolean;
  isInitialized: boolean;
};

export function createInitialSimState(): SimState {
  return {
    sessionId: 0,
    nowMs: 0,
    microtasks: [],
    macrotasks: [],
    events: [],
    logs: [],
    isRunning: false,
    isInitialized: false,
  };
}

