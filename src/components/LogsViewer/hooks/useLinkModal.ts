import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook for managing link click confirmation modal
 *
 * This hook intercepts clicks on <a> tags within a container and displays a confirmation
 * modal before allowing the user to navigate. This provides security by:
 * - Warning users about potentially dangerous URL schemes (javascript:, data:, etc.)
 * - Informing users that file:// URLs cannot be opened directly in browsers
 * - Giving users the option to copy URLs instead of opening them
 *
 * @returns {Object} Modal state and handlers
 * @returns {boolean} isModalOpen - Whether the confirmation modal is currently open
 * @returns {string} pendingUrl - The full URL that was clicked (awaiting user confirmation)
 * @returns {boolean} isFileUrl - True if the URL uses the file:// protocol
 * @returns {boolean} isDangerousUrl - True if the URL uses a potentially dangerous scheme
 * @returns {string} displayUrl - User-friendly URL for display (strips file:// prefix)
 * @returns {Function} handlePanelClick - Click handler to attach to the container element
 * @returns {Function} closeModal - Closes the modal and clears pending URL state
 * @returns {Function} copyUrl - Copies the URL to clipboard and closes the modal
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isModalOpen, displayUrl, handlePanelClick, closeModal, copyUrl } = useLinkModal();
 *
 *   return (
 *     <div onClick={handlePanelClick}>
 *       <a href="https://example.com">Click me</a>
 *       {isModalOpen && (
 *         <Modal url={displayUrl} onClose={closeModal} onCopy={copyUrl} />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLinkModal() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string>('');

  /**
   * Click handler that intercepts anchor tag clicks
   * Attach this to a parent container element with onClick
   */
  const handlePanelClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link && link.href) {
      event.preventDefault();
      setPendingUrl(link.href);
      setIsModalOpen(true);
    }
  }, []);

  /**
   * Closes the modal and resets the pending URL state
   */
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setPendingUrl('');
  }, []);

  /**
   * Checks if the pending URL uses the file:// protocol
   * File URLs cannot be opened directly in browsers for security reasons
   */
  const isFileUrl = useMemo(() => {
    try {
      return pendingUrl.startsWith('file://');
    } catch {
      return false;
    }
  }, [pendingUrl]);

  /**
   * Checks if the pending URL uses a dangerous scheme
   * Dangerous schemes include: javascript, vbscript, data, about
   * These can execute code or perform unexpected actions
   */
  const isDangerousUrl = useMemo(() => {
    try {
      const parsed = new URL(pendingUrl);
      const scheme = parsed.protocol.replace(':', '').toLowerCase();
      const DANGEROUS_SCHEMES = ['javascript', 'vbscript', 'data', 'about'];
      return DANGEROUS_SCHEMES.includes(scheme);
    } catch {
      return false;
    }
  }, [pendingUrl]);

  /**
   * Returns a user-friendly display version of the URL
   * For file:// URLs, strips the protocol prefix to show just the path
   */
  const displayUrl = useMemo(() => {
    if (isFileUrl) {
      return pendingUrl.replace(/^file:\/\//, '');
    }
    return pendingUrl;
  }, [pendingUrl, isFileUrl]);

  /**
   * Copies the URL to the clipboard
   * For file URLs, copies the path without the file:// prefix
   * Automatically closes the modal after copying
   */
  const copyUrl = useCallback(async () => {
    try {
      const urlToCopy = isFileUrl ? displayUrl : pendingUrl;
      await navigator.clipboard.writeText(urlToCopy);
      closeModal();
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }, [pendingUrl, displayUrl, isFileUrl, closeModal]);

  return {
    isModalOpen,
    pendingUrl,
    isFileUrl,
    isDangerousUrl,
    displayUrl,
    handlePanelClick,
    closeModal,
    copyUrl,
  };
}
