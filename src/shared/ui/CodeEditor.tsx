import type { ReactNode } from 'react';

import styles from './layout.module.css';

type Props = {
  code: string;
  onChangeCode: (nextCode: string) => void;
  headerActions?: ReactNode;
};

export function CodeEditor({ code, onChangeCode, headerActions }: Props) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Код</h2>
        {headerActions}
      </header>
      <div className={styles.panelBody}>
        <textarea
          value={code}
          onChange={(event) => onChangeCode(event.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            height: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            padding: 12,
            background: 'transparent',
            color: 'inherit',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        />
      </div>
    </section>
  );
}

