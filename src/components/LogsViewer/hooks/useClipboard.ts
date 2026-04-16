import { useCallback } from 'react';
import { LogRow } from '../../../types';

function rowToText(row: LogRow): string {
  if ('data' in row) {
    return row.message;
  }
  return row.strippedText || row.message;
}

export function useClipboard(
  filteredRows: LogRow[],
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
    const text = filteredRows.map(rowToText).join('\n');
    copyToClipboard(text);
  }, [filteredRows, copyToClipboard]);

  const copySelectedLog = useCallback(() => {
    if (selectedRowIndex !== undefined && filteredRows[selectedRowIndex]) {
      copyToClipboard(rowToText(filteredRows[selectedRowIndex]));
    }
  }, [selectedRowIndex, filteredRows, copyToClipboard]);

  return {
    copyToClipboard,
    copyAllLogs,
    copySelectedLog,
  };
}
