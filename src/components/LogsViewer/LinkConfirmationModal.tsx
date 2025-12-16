import React from 'react';
import styles from './LinkConfirmationModal.module.css';

interface LinkConfirmationModalProps {
  isOpen: boolean;
  url: string;
  displayUrl: string;
  isFileUrl: boolean;
  isDangerousUrl: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export const LinkConfirmationModal: React.FC<LinkConfirmationModalProps> = ({
  isOpen,
  url,
  displayUrl,
  isFileUrl,
  isDangerousUrl,
  onClose,
  onCopy,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ansi-shadowed`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>
            {isFileUrl ? 'File Link' : isDangerousUrl ? 'Warning: Dangerous Link' : 'Open External Link'}
          </h3>
        </div>
        <div className={styles.body}>
          {isDangerousUrl && (
            <p className={styles.warning}>⚠️ This URL uses a potentially dangerous scheme. Proceed with caution.</p>
          )}
          {isFileUrl ? (
            <>
              <p className={styles.warning}>⚠️ Browsers block file:// links for security reasons.</p>
              <p>Copy the path and paste it into your file manager or terminal:</p>
            </>
          ) : isDangerousUrl ? (
            <p>This link may execute code or perform unexpected actions. Only open if you trust the source.</p>
          ) : (
            <p>Do you want to visit this link?</p>
          )}
          <div className={styles.url}>{displayUrl}</div>
        </div>
        <div className={styles.footer}>
          <button className={styles.button} onClick={onClose}>
            Cancel
          </button>
          <button className={`${styles.button} ${styles.copyButton}`} onClick={onCopy}>
            Copy
          </button>
          {!isFileUrl && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.button} ${styles.confirmButton}`}
              onClick={onClose}
            >
              Open
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
