import React from 'react';
import { Modal, modalStyles } from './Modal';
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
  const title = isFileUrl ? 'File Link' : isDangerousUrl ? 'Warning: Dangerous Link' : 'Open External Link';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      bodyPadded
      footer={
        <>
          <button className={modalStyles.button} onClick={onClose}>
            Cancel
          </button>
          <button className={`${modalStyles.button} ${modalStyles.buttonPrimary}`} onClick={onCopy}>
            Copy
          </button>
          {!isFileUrl && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${modalStyles.button} ${modalStyles.buttonSuccess}`}
              onClick={onClose}
            >
              Open
            </a>
          )}
        </>
      }
    >
      {isDangerousUrl && (
        <p className={styles.warning}>This URL uses a potentially dangerous scheme. Proceed with caution.</p>
      )}
      {isFileUrl ? (
        <>
          <p className={styles.warning}>Browsers block file:// links for security reasons.</p>
          <p>Copy the path and paste it into your file manager or terminal:</p>
        </>
      ) : isDangerousUrl ? (
        <p>This link may execute code or perform unexpected actions. Only open if you trust the source.</p>
      ) : (
        <p>Do you want to visit this link?</p>
      )}
      <div className={styles.url}>{displayUrl}</div>
    </Modal>
  );
};
