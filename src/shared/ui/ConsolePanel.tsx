import styles from './layout.module.css';

type Props = {
  lines: string[];
  onClear: () => void;
};

export function ConsolePanel({ lines, onClear }: Props) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Консоль</h2>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </header>
      <div className={styles.panelBody} style={{ padding: 12 }}>
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {lines.length === 0 ? '—' : lines.join('\n')}
        </pre>
      </div>
    </section>
  );
}

