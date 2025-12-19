import React, { memo } from 'react';
import { CopyableValue } from '../CopyableValue';
import { Modal, modalStyles } from './Modal';
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
  const entries = Object.entries(labels);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Labels"
      headerMeta={`${entries.length} label${entries.length !== 1 ? 's' : ''}`}
      footer={
        <button className={modalStyles.button} onClick={onClose}>
          Close
        </button>
      }
    >
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
    </Modal>
  );
});

LabelsModal.displayName = 'LabelsModal';
