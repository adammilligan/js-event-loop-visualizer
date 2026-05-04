import type { MicroTask, SimTimerTask } from '@/shared/lib/event-loop';

import styles from '@/shared/ui/layout.module.css';

type Props = {
  microtasks: readonly MicroTask[];
  macrotasks: readonly SimTimerTask[];
};

export function QueueVisualizer({ microtasks, macrotasks }: Props) {
  const combined: Array<MicroTask | SimTimerTask> = [...microtasks, ...macrotasks];

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Очередь</h2>
      </header>
      <div className={styles.panelBody} style={{ padding: 12, display: 'grid', gap: 12 }}>
        <QueueBlock title="В порядке выполнения (micro перед macro)" items={combined} />
      </div>
    </section>
  );
}

function QueueBlock({
  title,
  items,
}: {
  title: string;
  items: readonly (MicroTask | SimTimerTask)[];
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.9 }}>{title}</div>
      {items.length === 0 ? (
        <span style={{ opacity: 0.6, fontSize: 12 }}>пусто</span>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
          {items.map((item) => (
            <li key={item.id} style={{ listStylePosition: 'outside' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.35,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: '1 1 auto',
                    minWidth: 0,
                  }}
                  title={formatQueueLabel(item)}
                >
                  {formatQueueLabel(item)}
                </div>
                <span
                  style={{
                    flex: '0 0 auto',
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(0,0,0,0.18)',
                    opacity: 0.9,
                  }}
                >
                  {item.kind}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function formatQueueLabel(item: MicroTask | SimTimerTask): string {
  if (item.kind === 'macro') {
    return `${item.label} @${item.readyAtMs}ms`;
  }

  return item.label;
}

