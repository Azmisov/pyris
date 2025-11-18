import { useCallback } from 'react';
import { AnsiLogRow } from '../../../types';

export function useClipboard(
  filteredRows: AnsiLogRow[],
  selectedRowIndex: number | undefined
) {
  const copyToClipboard = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  const copyAllLogs = useCallback(() => {
    const text = filteredRows.map(row => row.strippedText || row.message).join('\n');
    copyToClipboard(text);
  }, [filteredRows, copyToClipboard]);

  const copySelectedLog = useCallback(() => {
    if (selectedRowIndex !== undefined && filteredRows[selectedRowIndex]) {
      const row = filteredRows[selectedRowIndex];
      copyToClipboard(row.strippedText || row.message);
    }
  }, [selectedRowIndex, filteredRows, copyToClipboard]);

  return {
    copyToClipboard,
    copyAllLogs,
    copySelectedLog,
  };
}
