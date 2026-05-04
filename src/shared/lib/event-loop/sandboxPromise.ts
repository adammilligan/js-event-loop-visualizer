import { formatLogValue } from './simValue';

type PromiseState = 'pending' | 'fulfilled';

type ThenHandler = {
  label: string;
  onFulfilled: (value: unknown) => unknown;
  resolveChained: (value: unknown) => void;
  rejectChained: (reason: unknown) => void;
};

export type SandboxPromiseDeps = {
  scheduleMicrotask: (label: string, task: () => void) => void;
};

export type SandboxPromise = {
  then: (onFulfilled?: (value: unknown) => unknown) => SandboxPromise;
};

export type SandboxPromiseConstructor = {
  new (executor: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => void): SandboxPromise;
  resolve: (value: unknown) => SandboxPromise;
};

export function createResolvedSandboxPromise(
  deps: SandboxPromiseDeps,
  value: unknown,
): SandboxPromise {
  return createSandboxPromise(deps, (resolve) => {
    resolve(value);
  });
}

export function createSandboxPromise(
  deps: SandboxPromiseDeps,
  executor: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => void,
): SandboxPromise {
  let state: PromiseState = 'pending';
  let fulfilledValue: unknown;
  const pendingHandlers: ThenHandler[] = [];

  const fulfillNow = (value: unknown) => {
    if (state !== 'pending') return;

    state = 'fulfilled';
    fulfilledValue = value;

    for (const handler of pendingHandlers) {
      deps.scheduleMicrotask(handler.label, () => {
        try {
          const nextValue = handler.onFulfilled(fulfilledValue);
          handler.resolveChained(nextValue);
        } catch (error) {
          handler.rejectChained(error);
        }
      });
    }

    pendingHandlers.length = 0;
  };

  executor(
    (value) => {
      fulfillNow(value);
    },
    () => {
      // v1: reject не используется в учебной песочнице
    },
  );

  const then = (onFulfilled?: (value: unknown) => unknown): SandboxPromise => {
    return createSandboxPromise(deps, (resolveChained, rejectChained) => {
      const fulfilled = onFulfilled ?? ((v: unknown) => v);
      const callbackLabel = onFulfilled ? onFulfilled.toString() : 'then()';

      if (state === 'fulfilled') {
        deps.scheduleMicrotask(callbackLabel, () => {
          try {
            resolveChained(fulfilled(fulfilledValue));
          } catch (error) {
            rejectChained(error);
          }
        });
        return;
      }

      pendingHandlers.push({
        label: callbackLabel,
        onFulfilled: fulfilled,
        resolveChained,
        rejectChained,
      });
    });
  };

  return { then };
}

export function createSandboxPromiseConstructor(deps: SandboxPromiseDeps): SandboxPromiseConstructor {
  class SandboxPromiseImpl implements SandboxPromise {
    private inner: SandboxPromise;

    constructor(
      executor: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => void,
    ) {
      this.inner = createSandboxPromise(deps, executor);
    }

    then(onFulfilled?: (value: unknown) => unknown): SandboxPromise {
      return this.inner.then(onFulfilled);
    }

    static resolve(value: unknown): SandboxPromise {
      return new SandboxPromiseImpl((resolve) => resolve(value));
    }
  }

  return SandboxPromiseImpl;
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return formatLogValue(error);
}

