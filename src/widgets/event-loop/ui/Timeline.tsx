import { useEffect, useRef } from 'react';

import styles from '@/shared/ui/layout.module.css';

type Props = {
  events: string[];
};

export function Timeline({ events }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const isPinnedToBottomRef = useRef<boolean>(true);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const thresholdPx = 8;

    const updatePin = () => {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isPinnedToBottomRef.current = distanceToBottom <= thresholdPx;
    };

    updatePin();
    el.addEventListener('scroll', updatePin, { passive: true });

    return () => {
      el.removeEventListener('scroll', updatePin);
    };
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    if (!isPinnedToBottomRef.current) return;

    el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>События</h2>
      </header>
      <div ref={bodyRef} className={styles.panelBody} style={{ padding: 12 }}>
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          {events.length === 0 ? (
            <li style={{ opacity: 0.6 }}>—</li>
          ) : (
            events.map((event, index) => <li key={`${index}-${event}`}>{event}</li>)
          )}
        </ol>
      </div>
    </section>
  );
}

