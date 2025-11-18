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
    input: 'A.txt',
    output: 'sample-A.json',
    labels: { source: 'sample-A', app: 'st_anomaly_detect' },
    extractTimestamp: extractTimestampFromLogLine,
  },
  {
    input: 'C.txt',
    output: 'sample-C.json',
    labels: { source: 'sample-C', type: 'ansi-test' },
    generateTimestamp: true,
  },
];

/**
 * Extract timestamp from A.txt log lines
 * Format: [38;5;144m2025-10-22 00:45:38.12[0m
 */
function extractTimestampFromLogLine(line) {
  const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{2})/);
  if (timestampMatch) {
    const timestampStr = timestampMatch[1];
    // Parse format: 2025-10-22 00:45:38.12
    const [datePart, timePart] = timestampStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, secondWithMs] = timePart.split(':');
    const [second, centiseconds] = secondWithMs.split('.');

    const date = new Date(
      year,
      month - 1,
      day,
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
      parseInt(centiseconds) * 10 // Convert centiseconds to milliseconds
    );

    return date.getTime();
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
  const lines = content.split('\n').filter(line => line.trim().length > 0);

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

  // Process each line
  let currentTimestamp = Date.now();

  for (const line of lines) {
    let timestamp;

    if (config.extractTimestamp) {
      // Try to extract timestamp from line
      timestamp = config.extractTimestamp(line);
      if (timestamp) {
        currentTimestamp = timestamp;
      } else {
        // If no timestamp found, use previous + small increment
        currentTimestamp += 100;
      }
    } else if (config.generateTimestamp) {
      // Generate timestamp with random interval
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

module.exports = { convertSampleFile, extractTimestampFromLogLine };
