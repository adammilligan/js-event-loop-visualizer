import { useEffect, useMemo, useState } from 'react';

import { CodeEditor, ConsolePanel } from '@/shared/ui';
import styles from '@/shared/ui/layout.module.css';
import { EXAMPLES, EventLoopSimulator, formatLogLine, formatSimEventLine } from '@/shared/lib/event-loop';
import { QueueVisualizer, Timeline } from '@/widgets/event-loop';

export function EventLoopPage() {
  const [code, setCode] = useState<string>(getDefaultCode());
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastRandomExampleId, setLastRandomExampleId] = useState<string | null>(null);

  const [simulator] = useState<EventLoopSimulator>(() => new EventLoopSimulator());

  const [, setSimTick] = useState<number>(0);

  const simState = simulator.getState();

  const consoleLines = useMemo(
    () => simState.logs.map((log) => formatLogLine(log)),
    [simState.logs],
  );

  const timelineLines = useMemo(
    () => simState.events.map((event) => formatSimEventLine(event)),
    [simState.events],
  );

  const refresh = () => {
    setSimTick((prev) => prev + 1);
  };

  const stop = () => {
    setIsRunning(false);
    simulator.reset();
    refresh();
  };

  const pickRandomExample = () => {
    if (EXAMPLES.length === 0) return;

    const maxAttempts = 5;
    let next = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    for (let i = 0; i < maxAttempts; i += 1) {
      if (!lastRandomExampleId || next.id !== lastRandomExampleId) break;
      next = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    }

    stop();
    setLastRandomExampleId(next.id);
    setCode(next.code);
  };

  useEffect(() => {
    if (!isRunning) return;

    const intervalId = window.setInterval(() => {
      const didStep = simulator.step();
      refresh();
      if (!didStep) {
        setIsRunning(false);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, simulator]);

  return (
    <div className={styles.page}>
      <CodeEditor
        code={code}
        onChangeCode={setCode}
        headerActions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                if (!simulator.getState().isInitialized) {
                  simulator.loadUserCode(code);
                }
                simulator.step();
                refresh();
              }}
              disabled={isRunning}
            >
              Step
            </button>
            <button type="button" onClick={pickRandomExample} disabled={isRunning}>
              Random
            </button>
            <button
              type="button"
              onClick={() => {
                if (!simulator.getState().isInitialized) {
                  simulator.loadUserCode(code);
                }
                setIsRunning(true);
                refresh();
              }}
              disabled={isRunning}
            >
              Run
            </button>
            <button
              type="button"
              onClick={() => {
                stop();
              }}
            >
              Stop
            </button>
          </div>
        }
      />

      <QueueVisualizer microtasks={simState.microtasks} macrotasks={simState.macrotasks} />

      <ConsolePanel
        lines={consoleLines}
        onClear={() => {
          stop();
        }}
      />

      <Timeline events={timelineLines} />
    </div>
  );
}

function getDefaultCode() {
  return [
    "console.log('A');",
    'Promise.resolve().then(() => {',
    "  console.log('B');",
    "  Promise.resolve().then(() => console.log('C'));",
    '});',
    "setTimeout(() => console.log('T'), 0);",
    "console.log('D');",
  ].join('\n');
}

