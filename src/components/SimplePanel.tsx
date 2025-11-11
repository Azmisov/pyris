import React from 'react';
import { SimpleOptions } from 'types';
// import { css } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { PanelProps, FieldType } from '@grafana/data';

interface Props extends PanelProps<SimpleOptions> {}

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id }) => {
  const theme = useTheme2();
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

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  // 1. Find the first frame that is marked as 'LogLines'
  const logFrame = data.series.find(
    (frame) => frame.meta?.preferredVisualisationType === 'logs'
  );

  if (!logFrame) {
    return <div>No series have "logs" preferred visualisation type</div>;
  }

  // Simple heuristic to extract time + message fields
  const extracted: Record<string, { field: any; priority: number }> = {}
  function fieldCandidate(name: string, priority: number, field: any) {
    // prefer first seen field if equal priority
    if (name in extracted && extracted[name].priority <= priority) {
      return;
    }
    extracted[name] = { field, priority };
  }
  const msgPriorities = ['msg', 'message', 'body', 'line']
  for (const f of logFrame.fields) {
    let n = f.name.toLowerCase()
    // second field after time take to be log line (which somewehat mimics how grafana's builtin
    // log panel tries to find the log message); however we allow a higher priority string field
    // to take precedence if found later
    if ('time' in extracted && !('msg' in extracted)) {
      fieldCandidate('msg', msgPriorities.length + 1, f);
    }
    // first seen time field takes precedence, unless we see one explicitly named "time"
    if (f.type == FieldType.time) {
      fieldCandidate(n, n == 'time' ? 0 : 1, f)
    }
    if (f.type == FieldType.string) {
      let priority = msgPriorities.indexOf(n);
      fieldCandidate(n, priority == -1 ? msgPriorities.length : priority, f)
    }
  }
  for (const expected of ["time", "msg"]) {
    if (!(expected in extracted)) {
      return <div>Log frame is missing a {expected} field</div>;
    }
  }
  const timeField = extracted.time.field;
  const bodyField = extracted.msg.field;


  // 3. Create an array of log row objects to render
  const logRows = [];
  for (let i = 0; i < logFrame.length; i++) {
    logRows.push({
      time: timeField.values[i],
      body: bodyField.values[i],
    });
  }

  // 4. Render the list
  return (
    <div style={{ overflow: 'auto', height, width, backgroundColor: "red" }}>
      {logRows.map((row, i) => (
        <div key={i} style={{ borderBottom: '1px solid ' + theme.colors.border.weak, padding: '4px' }}>
          <span style={{ marginRight: '10px', color: theme.colors.text.secondary }}>
            {/* Format this timestamp as needed */}
            {new Date(row.time).toISOString()}
          </span>
          <span>{row.body}</span>
        </div>
      ))}
    </div>
  );
};
