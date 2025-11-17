import React from 'react';

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
    <div className="ansi-modal-overlay" onClick={onClose}>
      <div className="ansi-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ansi-modal-header">
          <h3>
            {isFileUrl ? 'File Link' : isDangerousUrl ? 'Warning: Dangerous Link' : 'Open External Link'}
          </h3>
        </div>
        <div className="ansi-modal-body">
          {isDangerousUrl && (
            <p className="ansi-modal-warning">⚠️ This URL uses a potentially dangerous scheme. Proceed with caution.</p>
          )}
          {isFileUrl ? (
            <>
              <p className="ansi-modal-warning">⚠️ Browsers block file:// links for security reasons.</p>
              <p>Copy the path and paste it into your file manager or terminal:</p>
            </>
          ) : isDangerousUrl ? (
            <p>This link may execute code or perform unexpected actions. Only open if you trust the source.</p>
          ) : (
            <p>Do you want to visit this link?</p>
          )}
          <div className="ansi-modal-url">{displayUrl}</div>
        </div>
        <div className="ansi-modal-footer">
          <button className="ansi-modal-button ansi-modal-button-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="ansi-modal-button ansi-modal-button-copy" onClick={onCopy}>
            Copy
          </button>
          {!isFileUrl && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="ansi-modal-button ansi-modal-button-confirm"
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
