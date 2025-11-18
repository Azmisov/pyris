import React, { memo, useMemo } from 'react';
import { LogsPanelProps, ParsedLogsResult } from './types';
import { LogsViewer } from './components/LogsViewer';
import { parseDataFrame } from './utils/frame';

/**
 * Grafana Panel Adapter for LogsViewer
 *
 * This is a thin wrapper that adapts Grafana's PanelProps and DataFrame
 * to the ParsedLogsResult interface used by the core LogsViewer component.
 */
export const AnsiLogsPanel = memo<LogsPanelProps>(({
  data,
  options,
  width,
  height,
  timeRange,
}) => {
  // Parse Grafana DataFrame to structured log data
  const parsedData = useMemo<ParsedLogsResult>(() => {
    try {
      if (!data || !data.series || data.series.length === 0) {
        return { ansiLogs: [], jsonLogs: [] };
      }

      // Parse the DataFrame
      const result = parseDataFrame(data);

      // Log any failed series
      if (Object.keys(result.failed).length > 0) {
        console.warn('Some series failed to parse:', result.failed);
      }

      // Apply time range filtering if provided
      if (timeRange && timeRange.from && timeRange.to) {
        const fromMs = typeof timeRange.from === 'number' ? timeRange.from : timeRange.from.valueOf();
        const toMs = typeof timeRange.to === 'number' ? timeRange.to : timeRange.to.valueOf();

        return {
          ansiLogs: result.parsed.ansiLogs.filter(row =>
            row.timestamp >= fromMs && row.timestamp <= toMs
          ),
          jsonLogs: result.parsed.jsonLogs.filter(row =>
            row.timestamp >= fromMs && row.timestamp <= toMs
          ),
          error: result.parsed.error,
          extra: result.parsed.extra,
        };
      }

      return result.parsed;
    } catch (err) {
      console.error('AnsiLogsPanel: Error processing DataFrame:', err);
      return { ansiLogs: [], jsonLogs: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [data, timeRange]);

  // Render the core LogsViewer with Grafana-provided data
  return (
    <LogsViewer
      parsedData={parsedData}
      options={options}
      width={width}
      height={height}
    />
  );
});

AnsiLogsPanel.displayName = 'AnsiLogsPanel';

export default AnsiLogsPanel;