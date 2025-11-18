/**
 * Parse grafana dataframe into log records for panel display
 */
import { FieldType } from '@grafana/data';
import { AnsiLogRow, JsonLogRow, ParsedLogsResult, DataFrameParseResult } from '../types';


// Parse a single data series into LogRow structures
export function parseDataSeries(series: any, seriesName?: string): ParsedLogsResult {
  const out: ParsedLogsResult = {
    ansiLogs: [],
    jsonLogs: [],
  };

  if (!series || !series.fields || series.fields.length === 0) {
    out.error = `Series ${seriesName || 'unknown'} has no fields`;
    return out;
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

  // TODO: handle levels
  // const lvlCandidates = ['level', 'severity', 'loglevel', 'priority'];
  const msgCandidates = ['message', 'msg', 'log', 'line', 'content', 'text']
  const lblCandidates = ['labels', 'tags', 'metadata', 'fields'];
  for (const f of series.fields) {
    let n = f.name.toLowerCase()
    // second field after time take to be log line (which somewehat mimics how grafana's builtin
    // log panel tries to find the log message); however we allow a higher priority string field
    // to take precedence if found later
    if ('time' in extracted && !('msg' in extracted)) {
      fieldCandidate('msg', 2, f);
    }
    // "time" or "ts" string name takes precedence, else the first seen field
    if (f.type == FieldType.time) {
      fieldCandidate('time', n.includes('time') || n == 'ts' ? 0 : 1, f)
    }
    // numbers that look like timestamps
    else if (f.type == FieldType.number && f.values[0] > 1000000000) {
      fieldCandidate('time', 2, f)
    }
    // messages prefer the first seen candidate, else first seen string field
    else if (f.type == FieldType.string) {
      fieldCandidate('msg', msgCandidates.includes(n) ? 0 : 1, f)
      if (lblCandidates.includes(n)) {
        fieldCandidate('lbls', 0, f)
      }
    }
  }
  // TODO: no time field, maybe extract from the message? will be unreliable though because
  // multiline messages won't have it except for one line, so lots of messages won't have timestamps
  // and won't be able to sort; so not going to implement unless we have a good idea to make it more
  // reliable; maybe interpolate from dataframe sort order? seems too fragile to be worth the effort
  for (const expected of ["time", "msg"]) {
    if (!(expected in extracted)) {
      out.error = `Series ${seriesName || 'unknown'} is missing a ${expected} field`
      if (expected == "time") {
        out.extra = {needsTimeField: true}
      } else {
        out.extra = {needsStringField: true}
      }
      return out;
    }
  }

  // Maximum field values length. Not sure if its even possible for fields to have different
  // lengths, but simple enought to handle jagged arrays.
  let rowCount = 0;
  for (const k in extracted) {
    rowCount = Math.max(rowCount, extracted[k].field.values.length);
  }

  // Parse rows
  for (let i = 0; i < rowCount; i++) {
    const timestamp = extracted['time'].field.values[i];

    // Drop rows with null or zero timestamp
    if (!timestamp || timestamp === 0) {
      continue;
    }

    const message = extracted['msg'].field.values[i];

    // Parse labels if available
    let labels: Record<string, string> | undefined;
    if (extracted['lbls']) {
      const labelValue = extracted['lbls'].field.values[i];
      const parsedLabels = parseJSON(labelValue);
      if (parsedLabels) {
        labels = parsedLabels as Record<string, string>;
      }
    }

    // Try to parse message as JSON first
    const jsonData = parseJSON(message);

    if (jsonData) {
      // Add to JSON logs
      const jsonRow: JsonLogRow = {
        timestamp,
        data: jsonData,
        labels,
      };
      out.jsonLogs.push(jsonRow);
    } else {
      // Add to ANSI logs
      const ansiRow: AnsiLogRow = {
        timestamp,
        message,
        labels,
      };
      out.ansiLogs.push(ansiRow);
    }
  }

  return out;
}

// Parse DataFrame with multiple series, merging successful parses and tracking failures
export function parseDataFrame(data: any): DataFrameParseResult {
  console.debug("Parsing log data:", data);

  const result: DataFrameParseResult = {
    parsed: {
      ansiLogs: [],
      jsonLogs: [],
    },
    failed: {},
  };

  if (!data || !data.series) {
    console.warn("Source dataframe is empty:", data);
    return result;
  }

  // Parse each series separately
  let idx = 0;
  for (const series of data.series) {
    const seriesName = series.refId || series.name || `anonymous-${idx}`;
    console.log("Parsing series:", seriesName);

    const parsed = parseDataSeries(series, seriesName);

    if (parsed.error) {
      // Track failed series
      result.failed[seriesName] = parsed;
    } else {
      // Merge successful parses
      result.parsed.ansiLogs.push(...parsed.ansiLogs);
      result.parsed.jsonLogs.push(...parsed.jsonLogs);
    }

    idx++;
  }

  // If all series failed and we have failures, set an error on the parsed result
  if (result.parsed.ansiLogs.length === 0 && result.parsed.jsonLogs.length === 0 && Object.keys(result.failed).length > 0) {
    const firstFailure = Object.values(result.failed)[0];
    result.parsed.error = `All series failed to parse. First error: ${firstFailure.error}`;
    result.parsed.extra = firstFailure.extra;
  }

  return result;
}

// Parse a log message as JSON, returning null if not valid.
function parseJSON(val: any): Record<string, any> | null {
  // Already an object
  if (typeof val === 'object' && val !== null) {
    return val;
  }
  if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
    try {
      return JSON.parse(val);
    } catch {}
  }
  // TODO: could consider other formats like comma separated k=v pairs; though these are much more
  // prone to false positives, so I think it would need to be a panel option for explicit opt-in
  return null
}