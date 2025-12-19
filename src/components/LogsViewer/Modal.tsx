import React, { memo, ReactNode } from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  headerMeta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  bodyPadded?: boolean;
}

/**
 * Base modal component with consistent styling.
 * Provides overlay, animation, header/body/footer structure.
 */
export const Modal = memo<ModalProps>(({
  isOpen,
  onClose,
  title,
  headerMeta,
  children,
  footer,
  bodyPadded = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ansi-shadowed`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{title}</h3>
          {headerMeta && <span className={styles.headerMeta}>{headerMeta}</span>}
        </div>
        <div className={`${styles.body} ${bodyPadded ? styles.bodyPadded : ''}`}>
          {children}
        </div>
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
});

Modal.displayName = 'Modal';

// Export button styles for use in modal footers
export { styles as modalStyles };
