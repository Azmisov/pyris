import { useEffect } from 'react';

/**
 * Custom hook for keyboard navigation in the logs viewer
 *
 * Provides keyboard shortcuts for navigating through log entries and performing actions:
 * - **ArrowDown**: Select next log entry (or first entry if none selected)
 * - **ArrowUp**: Select previous log entry
 * - **Ctrl+C / Cmd+C**: Copy selected log (or all logs if none selected)
 * - **Escape**: Clear selection
 *
 * Only responds to keyboard events when document.body is the active element,
 * preventing conflicts with input fields and other interactive elements.
 *
 * @param {number} filteredRowsLength - Total number of log entries available for selection
 * @param {number | undefined} selectedRowIndex - Currently selected row index (undefined if none)
 * @param {Function} setSelectedRowIndex - Function to update the selected row index
 * @param {Function} copySelectedLog - Function to copy the currently selected log to clipboard
 * @param {Function} copyAllLogs - Function to copy all visible logs to clipboard
 *
 * @example
 * ```tsx
 * function LogsViewer() {
 *   const [selectedIndex, setSelectedIndex] = useState<number | undefined>();
 *   const { copyAllLogs, copySelectedLog } = useClipboard(logs, selectedIndex);
 *
 *   useKeyboardNavigation(
 *     logs.length,
 *     selectedIndex,
 *     setSelectedIndex,
 *     copySelectedLog,
 *     copyAllLogs
 *   );
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useKeyboardNavigation(
  filteredRowsLength: number,
  selectedRowIndex: number | undefined,
  setSelectedRowIndex: (index: number | undefined) => void,
  copySelectedLog: () => void,
  copyAllLogs: () => void
) {
  useEffect(() => {
    /**
     * Handles keyboard events for log navigation and actions
     * Only processes events when document.body is the target to avoid
     * interfering with input fields, search boxes, etc.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keyboard events when focus is on input elements
      if (event.target !== document.body) {return;}

      switch (event.key) {
        case 'ArrowDown':
          // Move selection down or select first entry if nothing selected
          if (selectedRowIndex !== undefined && selectedRowIndex < filteredRowsLength - 1) {
            setSelectedRowIndex(selectedRowIndex + 1);
          } else if (selectedRowIndex === undefined && filteredRowsLength > 0) {
            setSelectedRowIndex(0);
          }
          event.preventDefault();
          break;

        case 'ArrowUp':
          // Move selection up (only if a row is already selected)
          if (selectedRowIndex !== undefined && selectedRowIndex > 0) {
            setSelectedRowIndex(selectedRowIndex - 1);
          }
          event.preventDefault();
          break;

        case 'c':
          // Copy selected log or all logs (Ctrl+C on Windows/Linux, Cmd+C on Mac)
          if (event.ctrlKey || event.metaKey) {
            if (selectedRowIndex !== undefined) {
              copySelectedLog();
            } else {
              copyAllLogs();
            }
            event.preventDefault();
          }
          break;

        case 'Escape':
          // Clear selection
          setSelectedRowIndex(undefined);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRowIndex, filteredRowsLength, copySelectedLog, copyAllLogs, setSelectedRowIndex]);
}
