import React, { memo } from 'react';
import { CopyableValue } from '../CopyableValue';
import styles from './LabelsModal.module.css';

interface LabelsModalProps {
  isOpen: boolean;
  labels: Record<string, string>;
  onClose: () => void;
}

/**
 * Modal displaying key-value labels in a table format.
 * Values are clickable to copy them to clipboard.
 */
export const LabelsModal = memo<LabelsModalProps>(({
  isOpen,
  labels,
  onClose,
}) => {
  if (!isOpen) return null;

  const entries = Object.entries(labels);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ansi-shadowed`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Labels</h3>
          <span className={styles.count}>{entries.length} label{entries.length !== 1 ? 's' : ''}</span>
        </div>
        <div className={styles.body}>
          {entries.length === 0 ? (
            <p className={styles.empty}>No labels available</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, value]) => (
                  <tr key={key}>
                    <td className={styles.keyCell}>{key}</td>
                    <td className={styles.valueCell}>
                      <CopyableValue value={value}>
                        {value}
                      </CopyableValue>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className={styles.footer}>
          <button className={styles.button} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

LabelsModal.displayName = 'LabelsModal';
