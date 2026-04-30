#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Convert sample log files to Grafana TestData DataFrame JSON format
 *
 * This script reads line-based sample log files and converts them to
 * Grafana DataFrame format with proper timestamps and labels.
 */

// Configuration
const SAMPLES_DIR = path.join(__dirname, '..', 'samples');
const OUTPUT_DIR = path.join(__dirname, '..', 'provisioning', 'testdata');

// Sample file configurations
const SAMPLE_FILES = [
  {
    input: 'B.txt',
    output: 'sample-B.json',
    labels: { source: 'sample-B', app: 'app_worker', type: 'hybrid' },
    extractTimestampHybrid: true,
  },
  {
    input: 'C.txt',
    output: 'sample-C.json',
    labels: { source: 'sample-C', app: 'ansi_test', type: 'ansi' },
    generateTimestamp: true,
  },
];

/**
 * Extract timestamp from A.txt log lines
 * Format: [38;5;144m2025-10-22 00:45:38.12[0m
 *
 * Text lines have no TZ marker. The paired JSON entries do (e.g. -06:00); pass that
 * offset in via tzOffset so both representations resolve to the same UTC instant.
 * Defaults to 'Z' (UTC) if no offset has been detected yet.
 */
function extractTimestampFromLogLine(line, tzOffset = 'Z') {
  const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}\.\d{2})/);
  if (timestampMatch) {
    const datePart = timestampMatch[1];
    const timePart = timestampMatch[2];
    const ms = new Date(`${datePart}T${timePart}${tzOffset}`).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * Extract the TZ offset (e.g. "-06:00", "+00:00", "Z") from an ISO-8601 string,
 * or null if the string has no offset marker.
 */
function extractTzOffset(isoString) {
  const m = isoString.match(/(Z|[+-]\d{2}:\d{2})$/);
  return m ? m[1] : null;
}

/**
 * Check if a line is JSON (starts with { and ends with })
 */
function isJsonLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

/** Common field names carrying an ISO-8601 timestamp on JSON log lines. */
const JSON_TIME_FIELDS = ['log_time', 'time', 'timestamp', 'ts', '@timestamp'];

function getJsonTimeString(json) {
  for (const f of JSON_TIME_FIELDS) {
    if (typeof json[f] === 'string') {return json[f];}
  }
  return null;
}

/**
 * Extract timestamp from a JSON log line by checking common time field names.
 */
function extractTimestampFromJson(line) {
  try {
    const json = JSON.parse(line);
    const s = getJsonTimeString(json);
    if (s) {
      const ms = new Date(s).getTime();
      return Number.isFinite(ms) ? ms : null;
    }
  } catch (error) {
    // Not valid JSON, return null
  }
  return null;
}

/**
 * Generate random interval between 0-5 seconds
 */
function getRandomInterval() {
  return Math.floor(Math.random() * 5000);
}

/**
 * Convert a sample file to DataFrame JSON format
 * Creates both the new schema format and the old columns/rows format for dashboard embedding
 */
function convertSampleFile(config) {
  const inputPath = path.join(SAMPLES_DIR, config.input);
  const outputPath = path.join(OUTPUT_DIR, config.output);
  const dashboardOutputPath = path.join(OUTPUT_DIR, config.output.replace('.json', '-dashboard.json'));

  console.log(`Converting ${config.input} -> ${config.output}`);

  // Read input file
  const content = fs.readFileSync(inputPath, 'utf-8');
  const lines = content.split('\n');

  console.log(`  Read ${lines.length} lines`);

  // Prepare DataFrame structure (new format)
  const dataFrame = {
    schema: {
      name: config.output.replace('.json', ''),
      fields: [
        { name: 'Time', type: 'time', typeInfo: { frame: 'time.Time' } },
        { name: 'Message', type: 'string' },
        { name: 'Labels', type: 'string' },
      ],
    },
    data: {
      values: [
        [], // Time values
        [], // Message values
        [], // Labels values
      ],
    },
  };

  // Prepare old format for dashboard embedding
  const dashboardFrame = {
    columns: [
      { text: 'Time', type: 'time' },
      { text: 'Message', type: 'string' },
      { text: 'Labels', type: 'string' },
    ],
    rows: [],
  };

  // Convert labels to JSON string
  const labelsJson = JSON.stringify(config.labels);

  // For hybrid samples, detect the source TZ from the first JSON line that carries
  // one. Text lines lack a TZ marker and would otherwise be interpreted as UTC,
  // drifting from JSON timestamps by the source's local offset (see
  // extractTimestampFromLogLine).
  let detectedTzOffset = 'Z';
  if (config.extractTimestampHybrid) {
    for (const line of lines) {
      if (!isJsonLine(line)) {continue;}
      try {
        const json = JSON.parse(line);
        const s = getJsonTimeString(json);
        const offset = s ? extractTzOffset(s) : null;
        if (offset) {
          detectedTzOffset = offset;
          break;
        }
      } catch {}
    }
  }

  // Process each line
  let currentTimestamp = 0; // Will be set to first extracted timestamp
  // For hybrid format, track timestamps separately
  let jsonTimestamp = 0;
  let textTimestamp = 0;

  for (const line of lines) {
    if (config.extractTimestampHybrid) {
      // Hybrid format: check if line is JSON or text
      if (isJsonLine(line)) {
        // JSON line - extract from log_time field
        const extractedTimestamp = extractTimestampFromJson(line);
        if (extractedTimestamp) {
          if (jsonTimestamp === 0) {
            jsonTimestamp = extractedTimestamp;
          } else if (extractedTimestamp >= jsonTimestamp) {
            jsonTimestamp = extractedTimestamp;
          } else {
            // Timestamp went backwards, increment by 1ms to maintain order
            jsonTimestamp += 1;
            console.warn("Out-of-order JSON logs");
          }
          currentTimestamp = jsonTimestamp;
        } else {
          // Fallback to previous JSON timestamp
          currentTimestamp = jsonTimestamp || Date.now();
        }
      } else {
        // Text line - extract from log line
        const extractedTimestamp = extractTimestampFromLogLine(line, detectedTzOffset);
        if (extractedTimestamp) {
          if (textTimestamp === 0) {
            textTimestamp = extractedTimestamp;
          } else if (extractedTimestamp >= textTimestamp) {
            textTimestamp = extractedTimestamp;
          } else {
            // Timestamp went backwards, increment by 1ms to maintain order
            textTimestamp += 1;
            console.warn("Out-of-order text logs");
          }
          currentTimestamp = textTimestamp;
        } else {
          // Reuse previous text timestamp (for multiline messages)
          currentTimestamp = textTimestamp || Date.now();
        }
      }
    } else if (config.extractTimestamp) {
      // Try to extract timestamp from line
      const extractedTimestamp = config.extractTimestamp(line);
      if (extractedTimestamp) {
        // Initialize on first timestamp
        if (currentTimestamp === 0) {
          currentTimestamp = extractedTimestamp;
        }
        // Ensure timestamps are always ascending
        // If extracted timestamp is earlier than current, increment current instead
        else if (extractedTimestamp >= currentTimestamp) {
          currentTimestamp = extractedTimestamp;
        } else {
          // Timestamp went backwards, increment by 1ms to maintain order
          currentTimestamp += 1;
          console.warn("Out-of-order sample logs")
        }
      }
      // If no timestamp found, reuse previous timestamp (for multiline messages)
      // currentTimestamp stays the same
    } else if (config.generateTimestamp) {
      // Generate timestamp with random interval
      if (currentTimestamp === 0) {
        currentTimestamp = Date.now();
      }
      currentTimestamp += getRandomInterval();
    }

    // Add to new format
    dataFrame.data.values[0].push(currentTimestamp);
    dataFrame.data.values[1].push(line);
    dataFrame.data.values[2].push(labelsJson);

    // Add to old format
    dashboardFrame.rows.push([currentTimestamp, line, labelsJson]);
  }

  // Write output files
  fs.writeFileSync(outputPath, JSON.stringify(dataFrame, null, 2), 'utf-8');
  console.log(`  Wrote ${dataFrame.data.values[0].length} log entries to ${outputPath}`);

  fs.writeFileSync(dashboardOutputPath, JSON.stringify([dashboardFrame], null, 2), 'utf-8');
  console.log(`  Wrote dashboard format to ${dashboardOutputPath}`);
}

/**
 * Main execution
 */
function main() {
  console.log('Converting sample logs to TestData DataFrame format\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`Creating output directory: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Convert each sample file
  for (const config of SAMPLE_FILES) {
    try {
      convertSampleFile(config);
    } catch (error) {
      console.error(`Error converting ${config.input}:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n✓ Conversion complete!');
  console.log(`\nOutput files:`);
  for (const config of SAMPLE_FILES) {
    console.log(`  - provisioning/testdata/${config.output} (DataFrame format)`);
    console.log(`  - provisioning/testdata/${config.output.replace('.json', '-dashboard.json')} (Dashboard inline format)`);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  convertSampleFile,
  extractTimestampFromLogLine,
  extractTimestampFromJson,
  isJsonLine,
};
