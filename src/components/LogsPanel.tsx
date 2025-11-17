import React, { useMemo } from 'react';
import { LogsPanelProps } from 'types';
// import { css } from '@emotion/css';
// import { useTheme2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { LogsViewer } from './LogsViewer';
import { parseDataFrame } from '../utils/frame';



export const LogsPanel: React.FC<LogsPanelProps> = ({ options, data, width, height, fieldConfig, id }) => {
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

  // Parse data frame into structured log rows
  const parsedData = useMemo(() => {
    return parseDataFrame(data);
  }, [data]);

  // Handle errors from parsing
  if (parsedData.error) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        message={parsedData.error}
        {...parsedData.extra}
      />
    );
  }

  // Render the logs
  return (
    <LogsViewer
        parsedData={parsedData}
        options={options}
        width={width}
        height={height}
      />
  );
};
