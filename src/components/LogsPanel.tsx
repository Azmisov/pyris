import React, { useMemo } from 'react';
import { LogsPanelProps } from 'types';
// import { css } from '@emotion/css';
// import { useTheme2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { LogsViewer } from './LogsViewer';
import { parseDataFrame } from '../utils/frame';


export const LogsPanel: React.FC<LogsPanelProps> = ({ options, data, width, height, fieldConfig, id, onChangeTimeRange, timeRange, timeZone, eventBus }) => {
  // const theme = useTheme2();
  // const styles = useStyles2(getStyles);

  /* data format:
    timeRange: {to, from}
    series: [
      meta: {preferredVisualisationType: "logs", typeVersion},
      length: #,
      name, refId: str, (the series name)
      fields: [{
        name: time, message, etc
        type: time (unix timestamp int), string
        values: []
      }]
    ]
  */

  // Parse data frame into structured log rowsx
  const parseResult = useMemo(() => {
    const result = parseDataFrame(data);
    console.log("Parsed data:", result);
    if (Object.keys(result.failed).length > 0) {
      console.warn("Failed to parse some series:", result.failed);
    }
    return result;
  }, [data]);

  // Handle time range change from timeline
  const handleTimeRangeChange = useMemo(() => {
    if (!onChangeTimeRange) {return undefined;}

    return (startTimeMs: number, endTimeMs: number) => {
      onChangeTimeRange({
        from: startTimeMs,
        to: endTimeMs,
      });
    };
  }, [onChangeTimeRange]);

  // Convert dashboard time range to milliseconds
  const dashboardTimeRangeMs = useMemo(() => {
    if (!timeRange) {return undefined;}

    const fromMs = typeof timeRange.from === 'number' ? timeRange.from : timeRange.from.valueOf();
    const toMs = typeof timeRange.to === 'number' ? timeRange.to : timeRange.to.valueOf();

    return { from: fromMs, to: toMs };
  }, [timeRange]);

  // Handle errors from parsing
  if (parseResult.parsed.error) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        message={parseResult.parsed.error}
        {...parseResult.parsed.extra}
      />
    );
  }

  // Render the logs
  return (
    <LogsViewer
        parsedData={parseResult.parsed}
        failedSeries={parseResult.failed}
        options={options}
        width={width}
        height={height}
        onTimeRangeChange={handleTimeRangeChange}
        dashboardTimeRange={dashboardTimeRangeMs}
        timeZone={timeZone}
        eventBus={eventBus}
      />
  );
};
