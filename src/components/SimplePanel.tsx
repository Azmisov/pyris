import React, { useMemo } from 'react';
import { AnsiLogsPanelOptions } from 'types';
// import { css } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { PanelProps } from '@grafana/data';
import { LogsViewer } from './LogsViewer';
import { parseDataFrame } from '../utils/frame';

interface Props extends PanelProps<AnsiLogsPanelOptions> {}

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id }) => {
  const theme = useTheme2();
  // const styles = useStyles2(getStyles);

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
