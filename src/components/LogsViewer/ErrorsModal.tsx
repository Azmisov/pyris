import React, { memo } from 'react';
import { Modal, modalStyles } from './Modal';
import styles from './ErrorsModal.module.css';

export interface SeriesError {
  seriesName: string;
  error: string;
}

interface ErrorsModalProps {
  isOpen: boolean;
  errors: SeriesError[];
  onClose: () => void;
}

/**
 * Modal displaying series parsing errors in a list format.
 */
export const ErrorsModal = memo<ErrorsModalProps>(({
  isOpen,
  errors,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Loading Errors"
      headerMeta={`${errors.length} error${errors.length !== 1 ? 's' : ''}`}
      footer={
        <button className={modalStyles.button} onClick={onClose}>
          Close
        </button>
      }
    >
      {errors.length === 0 ? (
        <p className={styles.empty}>No errors</p>
      ) : (
        <ul className={styles.errorList}>
          {errors.map((err, idx) => (
            <li key={idx} className={styles.errorItem}>
              <span className={styles.seriesName}>{err.seriesName}</span>
              <span className={styles.errorMessage}>{err.error}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
});

ErrorsModal.displayName = 'ErrorsModal';
