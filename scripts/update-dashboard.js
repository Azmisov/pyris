#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Update the provisioned dashboard with sample data panels
 */

const DASHBOARD_PATH = path.join(__dirname, '..', 'provisioning', 'dashboards', 'dashboard.json');
const TESTDATA_DIR = path.join(__dirname, '..', 'provisioning', 'testdata');

// Sample configurations
const SAMPLES = [
  {
    title: 'Sample A - Application Logs',
    file: 'sample-A-dashboard.json',
    position: { x: 0, y: 0, w: 12, h: 12 },
  },
  {
    title: 'Sample C - ANSI Test Suite',
    file: 'sample-C-dashboard.json',
    position: { x: 12, y: 0, w: 12, h: 12 },
  },
];

function main() {
  console.log('Updating dashboard with sample data...\n');

  // Read the current dashboard
  const dashboard = JSON.parse(fs.readFileSync(DASHBOARD_PATH, 'utf-8'));

  // Create new panels with sample data
  const newPanels = SAMPLES.map((sample, index) => {
    const dataPath = path.join(TESTDATA_DIR, sample.file);
    const rawFrameContent = fs.readFileSync(dataPath, 'utf-8');

    console.log(`Adding panel: ${sample.title}`);
    console.log(`  Data from: ${sample.file}`);

    return {
      datasource: {
        type: 'grafana-testdata-datasource',
        uid: 'trlxrdZVk',
      },
      gridPos: {
        h: sample.position.h,
        w: sample.position.w,
        x: sample.position.x,
        y: sample.position.y,
      },
      id: index + 1,
      options: {},
      targets: [
        {
          datasource: {
            type: 'grafana-testdata-datasource',
            uid: 'trlxrdZVk',
          },
          refId: 'A',
          scenarioId: 'raw_frame',
          rawFrameContent: rawFrameContent,
        },
      ],
      title: sample.title,
      type: 'nyrix-ansilogs-panel',
    };
  });

  // Replace panels
  dashboard.panels = newPanels;

  // Write updated dashboard
  fs.writeFileSync(DASHBOARD_PATH, JSON.stringify(dashboard, null, 2), 'utf-8');

  console.log('\n✓ Dashboard updated successfully!');
  console.log(`\nPanels added:`);
  SAMPLES.forEach(sample => console.log(`  - ${sample.title}`));
  console.log(`\nDashboard: provisioning/dashboards/dashboard.json`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
