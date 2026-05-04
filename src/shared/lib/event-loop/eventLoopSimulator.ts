import type { LogEntry, LogSource, MicroTask, SimEvent, SimTimerTask, TaskId } from './types';
import { createInitialSimState, type SimState } from './simState';
import { formatLogValue } from './simValue';
import {
  createSandboxPromiseConstructor,
  formatUnknownError,
  type SandboxPromiseConstructor,
} from './sandboxPromise';

type LogContext = LogSource;

type ScheduledMicroEnqueue = {
  kind: 'micro';
  taskId: TaskId;
  label: string;
  run: () => void;
};

type ScheduledMacroEnqueue = {
  kind: 'macro';
  taskId: TaskId;
  label: string;
  delayMs: number;
  run: () => void;
};

type ScheduledEnqueue = ScheduledMicroEnqueue | ScheduledMacroEnqueue;

type MicroRegistry = Map<TaskId, () => void>;
type MacroRegistry = Map<TaskId, () => void>;

export class EventLoopSimulator {
  private state: SimState = createInitialSimState();
  private nextEventId = 1;
  private nextLogId = 1;
  private nextTaskId = 1;

  private microRegistry: MicroRegistry = new Map();
  private macroRegistry: MacroRegistry = new Map();

  private logContextStack: LogContext[] = ['sync'];

  private scheduledEnqueues: ScheduledEnqueue[] = [];

  private readonly PromiseCtor: SandboxPromiseConstructor;

  constructor() {
    this.PromiseCtor = createSandboxPromiseConstructor({
      scheduleMicrotask: (label, task) => {
        this.scheduleMicrotaskEnqueue(`micro: ${summarizeLabel(label)}`, task);
      },
    });
  }

  getState(): SimState {
    return this.state;
  }

  reset() {
    this.state = createInitialSimState();
    this.nextEventId = 1;
    this.nextLogId = 1;
    this.nextTaskId = 1;
    this.microRegistry = new Map();
    this.macroRegistry = new Map();
    this.logContextStack = ['sync'];
    this.scheduledEnqueues = [];
  }

  loadUserCode(code: string) {
    this.reset();
    this.state.sessionId += 1;
    this.state.isInitialized = true;

    const sessionId = this.state.sessionId;

    const consoleApi = {
      log: (...parts: unknown[]) => {
        this.appendConsoleLog(this.currentLogContext(), parts);
      },
    };

    const setTimeoutApi = (handler: () => void, delayMs?: number) => {
      const safeDelayMs = typeof delayMs === 'number' ? delayMs : 0;
      this.scheduleMacrotaskEnqueue(
        `macro: setTimeout(${summarizeLabel(handler.toString())}, ${safeDelayMs})`,
        safeDelayMs,
        handler,
      );
    };

    const queueMicrotaskApi = (handler: () => void) => {
      this.scheduleMicrotaskEnqueue(
        `micro: queueMicrotask(${summarizeLabel(handler.toString())})`,
        handler,
      );
    };

    try {
      this.pushLogContext('sync');
      const runner = new Function(
        'console',
        'setTimeout',
        'queueMicrotask',
        'Promise',
        `"use strict";\n${code}`,
      );

      runner(consoleApi, setTimeoutApi, queueMicrotaskApi, this.PromiseCtor);
    } catch (error) {
      this.appendError(`Ошибка при запуске кода: ${formatUnknownError(error)}`);
    } finally {
      this.popLogContext();
    }

    if (sessionId !== this.state.sessionId) {
      return;
    }
  }

  step(): boolean {
    if (!this.state.isInitialized) {
      return false;
    }

    const next = this.scheduledEnqueues.shift();
    if (next) {
      if (next.kind === 'micro') {
        this.commitMicroEnqueue(next.taskId, next.label, next.run);
      } else {
        this.commitMacroEnqueue(next.taskId, next.label, next.delayMs, next.run);
      }
      return true;
    }

    if (this.state.microtasks.length > 0) {
      const task = this.state.microtasks[0];
      if (!task) return false;

      const handler = this.microRegistry.get(task.id);
      this.microRegistry.delete(task.id);

      this.pushEvent({
        kind: 'execute_microtask',
        taskId: task.id,
        note: `Выполнение microtask: ${task.label}`,
      });

      this.state.microtasks = this.state.microtasks.slice(1);

      if (!handler) {
        this.appendError(`Не найден handler для microtask ${task.id}`);
        return true;
      }

      this.runProtected(handler, 'micro');
      return true;
    }

    const readyMacroIndex = this.findReadyMacroIndex();
    if (readyMacroIndex !== null) {
      const task = this.state.macrotasks[readyMacroIndex];
      if (!task) return false;

      const handler = this.macroRegistry.get(task.id);
      this.macroRegistry.delete(task.id);

      this.pushEvent({
        kind: 'execute_macrotask',
        taskId: task.id,
        note: `Выполнение macrotask: ${task.label}`,
      });

      this.state.macrotasks = this.state.macrotasks.filter((_, index) => index !== readyMacroIndex);

      if (!handler) {
        this.appendError(`Не найден handler для macrotask ${task.id}`);
        return true;
      }

      this.runProtected(handler, 'macro');
      return true;
    }

    const nextReadyAt = this.findEarliestMacroReadyAt();
    if (nextReadyAt !== null) {
      const from = this.state.nowMs;
      this.state.nowMs = nextReadyAt;
      this.pushEvent({
        kind: 'advance_time',
        note: `Прыжок времени: ${from}ms → ${this.state.nowMs}ms`,
      });
      return true;
    }

    return false;
  }

  setIsRunning(isRunning: boolean) {
    this.state = { ...this.state, isRunning };
  }

  private currentLogContext(): LogContext {
    const top = this.logContextStack[this.logContextStack.length - 1];
    if (!top) return 'system';
    return top;
  }

  private pushLogContext(context: LogContext) {
    this.logContextStack = [...this.logContextStack, context];
  }

  private popLogContext() {
    if (this.logContextStack.length <= 1) return;
    this.logContextStack = this.logContextStack.slice(0, -1);
  }

  private scheduleMicrotaskEnqueue(label: string, run: () => void) {
    const taskId = this.createTaskId();
    this.scheduledEnqueues.push({ kind: 'micro', taskId, label, run });
  }

  private scheduleMacrotaskEnqueue(label: string, delayMs: number, run: () => void) {
    const taskId = this.createTaskId();
    this.scheduledEnqueues.push({ kind: 'macro', taskId, label, delayMs, run });
  }

  private commitMicroEnqueue(taskId: TaskId, label: string, run: () => void) {
    this.microRegistry.set(taskId, run);

    const eventId = this.nextEventId;
    this.nextEventId += 1;

    const task: MicroTask = {
      id: taskId,
      kind: 'micro',
      label,
      createdAtEventId: eventId,
    };

    this.pushEvent({
      id: eventId,
      kind: 'enqueue_microtask',
      timestampMs: this.state.nowMs,
      taskId,
      note: `Добавлено в конец microtask queue: ${label}`,
    });

    this.state = {
      ...this.state,
      microtasks: [...this.state.microtasks, task],
    };
  }

  private commitMacroEnqueue(taskId: TaskId, label: string, delayMs: number, run: () => void) {
    this.macroRegistry.set(taskId, run);

    const eventId = this.nextEventId;
    this.nextEventId += 1;

    const readyAtMs = this.state.nowMs + delayMs;

    const task: SimTimerTask = {
      id: taskId,
      kind: 'macro',
      label,
      createdAtEventId: eventId,
      readyAtMs,
    };

    this.pushEvent({
      id: eventId,
      kind: 'enqueue_macrotask',
      timestampMs: this.state.nowMs,
      taskId,
      note: `${label} (delay=${delayMs}ms, readyAt=${readyAtMs}ms)`,
    });

    this.state = {
      ...this.state,
      macrotasks: this.insertMacroTask(this.state.macrotasks, task),
    };
  }

  private insertMacroTask(macros: SimTimerTask[], task: SimTimerTask): SimTimerTask[] {
    const next = [...macros, task];
    next.sort((a, b) => {
      if (a.readyAtMs !== b.readyAtMs) return a.readyAtMs - b.readyAtMs;
      return a.createdAtEventId - b.createdAtEventId;
    });
    return next;
  }

  private findReadyMacroIndex(): number | null {
    let bestIndex: number | null = null;
    let bestReadyAt = Number.POSITIVE_INFINITY;
    let bestCreatedAt = Number.POSITIVE_INFINITY;

    for (let index = 0; index < this.state.macrotasks.length; index += 1) {
      const task = this.state.macrotasks[index];
      if (!task) continue;
      if (task.readyAtMs > this.state.nowMs) continue;

      if (task.readyAtMs < bestReadyAt) {
        bestReadyAt = task.readyAtMs;
        bestCreatedAt = task.createdAtEventId;
        bestIndex = index;
        continue;
      }

      if (task.readyAtMs === bestReadyAt && task.createdAtEventId < bestCreatedAt) {
        bestCreatedAt = task.createdAtEventId;
        bestIndex = index;
      }
    }

    return bestIndex;
  }

  private findEarliestMacroReadyAt(): number | null {
    let best: number | null = null;
    for (const task of this.state.macrotasks) {
      if (task.readyAtMs <= this.state.nowMs) continue;
      if (best === null || task.readyAtMs < best) {
        best = task.readyAtMs;
      }
    }
    return best;
  }

  private runProtected(handler: () => void, context: LogContext) {
    const sessionId = this.state.sessionId;
    this.pushLogContext(context);
    try {
      handler();
    } catch (error) {
      this.appendError(`Ошибка во время выполнения: ${formatUnknownError(error)}`);
    } finally {
      this.popLogContext();
    }

    if (sessionId !== this.state.sessionId) {
      return;
    }
  }

  private appendConsoleLog(source: LogContext, parts: unknown[]) {
    const messageParts = parts.map((part) => formatLogValue(part));

    const event = this.pushEvent({
      kind: 'console_log',
      timestampMs: this.state.nowMs,
      note: `console.log(${messageParts.join(', ')})`,
    });

    const log: LogEntry = {
      id: this.nextLogId,
      source,
      messageParts,
      eventId: event.id,
    };
    this.nextLogId += 1;

    this.state = {
      ...this.state,
      logs: [...this.state.logs, log],
    };
  }

  private appendError(message: string) {
    const event = this.pushEvent({
      kind: 'error',
      timestampMs: this.state.nowMs,
      note: message,
    });

    const log: LogEntry = {
      id: this.nextLogId,
      source: 'system',
      messageParts: [message],
      eventId: event.id,
    };
    this.nextLogId += 1;

    this.state = {
      ...this.state,
      logs: [...this.state.logs, log],
    };
  }

  private pushEvent(
    partial: Omit<SimEvent, 'id' | 'timestampMs'> &
      Partial<Pick<SimEvent, 'id' | 'timestampMs'>>,
  ): SimEvent {
    const event: SimEvent = {
      id: partial.id ?? this.nextEventId,
      kind: partial.kind,
      timestampMs: partial.timestampMs ?? this.state.nowMs,
      taskId: partial.taskId,
      note: partial.note,
    };

    if (partial.id === undefined) {
      this.nextEventId += 1;
    } else if (partial.id >= this.nextEventId) {
      this.nextEventId = partial.id + 1;
    }

    this.state = {
      ...this.state,
      events: [...this.state.events, event],
    };

    return event;
  }

  private createTaskId(): TaskId {
    const id = `t${this.nextTaskId}`;
    this.nextTaskId += 1;
    return id;
  }
}

function summarizeLabel(label: string): string {
  const singleLine = label.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= 100) return singleLine;
  return `${singleLine.slice(0, 97)}...`;
}

export function formatLogLine(log: LogEntry): string {
  const body = log.messageParts.join(' ');
  return `[${log.source}] ${body}`;
}

export function formatSimEventLine(event: SimEvent): string {
  const task = event.taskId ? ` (${event.taskId})` : '';
  const note = event.note ? ` — ${event.note}` : '';
  return `${event.kind}${task}${note}`;
}

