import { memo, useMemo, useCallback } from 'react';
import { AnsiLogsPanelProps } from './types';
import { LogsViewer, LogData } from './components/LogsViewer';
import { parseDataFrame } from './utils/frame';

/**
 * Grafana Panel Adapter for LogsViewer
 *
 * This is a thin wrapper that adapts Grafana's PanelProps and DataFrame
 * to the simple LogData interface used by the core LogsViewer component.
 */
export const AnsiLogsPanel = memo<AnsiLogsPanelProps>(({
  data,
  options,
  width,
  height,
  timeRange,
}) => {
  // Convert Grafana DataFrame to simple LogData array
  const logs = useMemo<LogData[]>(() => {
    try {
      if (!data || !data.series || data.series.length === 0) {
        return [];
      }

      // Parse the first DataFrame (in a production implementation,
      // we might want to merge multiple DataFrames)
      const firstFrame = data.series[0];
      const logRows = parseDataFrame(firstFrame);

      // Apply time range filtering if provided
      if (timeRange && timeRange.from && timeRange.to) {
        const fromMs = typeof timeRange.from === 'number' ? timeRange.from : timeRange.from.valueOf();
        const toMs = typeof timeRange.to === 'number' ? timeRange.to : timeRange.to.valueOf();

        const filtered = logRows.filter(row =>
          row.timestamp >= fromMs && row.timestamp <= toMs
        );

        return filtered;
      }

      return logRows;
    } catch (err) {
      console.error('AnsiLogsPanel: Error processing DataFrame:', err);
      return [];
    }
  }, [data, timeRange]);

  // Handle row click events (currently no-op)
  const handleRowClick = useCallback((_log: LogData, _index: number) => {
    // No-op: could emit events here for integration with other Grafana panels
  }, []);

  // Render the core LogsViewer with Grafana-provided data
  return (
    <LogsViewer
      logs={logs}
      options={options}
      width={width}
      height={height}
      onRowClick={handleRowClick}
    />
  );
});

AnsiLogsPanel.displayName = 'AnsiLogsPanel';

export default AnsiLogsPanel;