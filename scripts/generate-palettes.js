#!/usr/bin/env node

/**
 * Build ANSI logs panel palettes from Gogh themes
 * https://github.com/Gogh-Co/Gogh
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');
const { parse, converter, formatHex } = require('culori');

const GOGH_REPO = 'https://github.com/Gogh-Co/Gogh.git';
const TEMP_DIR = path.join(__dirname, 'tmp-gogh');
const THEMES_DIR = path.join(TEMP_DIR, 'themes');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'theme', 'gogh-themes.json');

/**
 * Calculate if theme is dark based on background color lightness
 * Uses Oklab perceptual color space for accurate lightness measurement
 * Returns true if background is dark (lightness < 0.5)
 */
function calculateIsDark(hexColor) {
  // Remove quotes and # prefix, ensure it starts with #
  let hex = hexColor.replace(/['"]/g, '');
  if (!hex.startsWith('#')) {
    hex = '#' + hex;
  }

  // Parse color and convert to Oklab
  const color = parse(hex);
  if (!color) {
    // Fallback to dark if parsing fails
    return true;
  }

  // Convert to Oklab color space
  const oklab = converter('oklab');
  const oklabColor = oklab(color);

  // In Oklab, L (lightness) ranges from 0 (black) to 1 (white)
  // Threshold at 0.5 for dark/light classification
  // A background with L < 0.5 is dark
  return oklabColor.l < 0.5;
}

/**
 * Generate three background accent colors by shifting in OKLab space
 * For dark themes: shift lighter (positive L delta)
 * For light themes: shift darker (negative L delta)
 * Returns [accent1, accent2, accent3] as hex strings
 */
function generateBgAccents(hexColor, isDark) {
  // Remove quotes and # prefix, ensure it starts with #
  let hex = hexColor.replace(/['"]/g, '');
  if (!hex.startsWith('#')) {
    hex = '#' + hex;
  }

  // Parse color
  const color = parse(hex);
  if (!color) {
    // Return original color if parsing fails
    return [hex, hex, hex];
  }

  // Convert to Oklab color space
  const oklab = converter('oklab');
  const oklabColor = oklab(color);

  // Shift amounts: progressive shifts for accent1, accent2, accent3
  // Positive shift (lighter) for dark themes, negative (darker) for light themes
  const shiftDirection = isDark ? 1 : -1;
  const shifts = [0.08, 0.12, 0.16];

  const accents = shifts.map(shift => {
    const shiftedColor = {
      ...oklabColor,
      l: Math.max(0, Math.min(1, oklabColor.l + (shift * shiftDirection))),
    };
    return formatHex(shiftedColor);
  });

  return accents;
}


/**
 * Parse Gogh YAML theme file
 */
function parseGoghTheme(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const theme = yaml.load(content);

    if (!theme) {
      return null;
    }

    // Extract the 16 ANSI colors in order
    const colors = [
      theme.color_01, // black
      theme.color_02, // red
      theme.color_03, // green
      theme.color_04, // yellow
      theme.color_05, // blue
      theme.color_06, // magenta
      theme.color_07, // cyan
      theme.color_08, // white
      theme.color_09, // bright black
      theme.color_10, // bright red
      theme.color_11, // bright green
      theme.color_12, // bright yellow
      theme.color_13, // bright blue
      theme.color_14, // bright magenta
      theme.color_15, // bright cyan
      theme.color_16, // bright white
    ];

    // Validate all 16 ANSI colors are present
    if (colors.some(c => !c)) {
      return null;
    }

    // Add background and foreground if available
    if (theme.background) {
      colors.push(theme.background); // 16: background
    }
    if (theme.foreground) {
      colors.push(theme.foreground); // 17: foreground
    }

    // Determine if theme is dark based on background color lightness
    // We ignore the variant field because it's often incorrect in the source data
    let isDark = true;
    if (theme.background) {
      isDark = calculateIsDark(theme.background);
    }

    // Generate background accent colors (lighter for dark themes, darker for light)
    if (theme.background) {
      const accents = generateBgAccents(theme.background, isDark);
      colors.push(...accents); // 18: bgAccent1, 19: bgAccent2, 20: bgAccent3
    }

    // Convert to lowercase hex without quotes
    const hexColors = colors.map(c => c.toLowerCase().replace(/['"]/g, ''));

    return {
      name: theme.name || path.basename(filePath, '.yml'),
      colors: hexColors,
      dark: isDark
    };
  } catch (err) {
    console.error(`Failed to parse ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Main function
 */
function main() {
  try {
    // Clean up temp directory if it exists
    if (fs.existsSync(TEMP_DIR)) {
      console.log('Cleaning up existing temp directory...');
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    // Clone the Gogh repository
    console.log('Cloning Gogh repository...');
    execSync(`git clone --depth 1 ${GOGH_REPO} ${TEMP_DIR}`, { stdio: 'inherit' });

    // Copy Grafana theme YAML files to Gogh themes directory
    const grafanaThemesDir = path.join(__dirname, 'grafana-themes');
    if (fs.existsSync(grafanaThemesDir)) {
      console.log('\nCopying Grafana theme files...');
      const grafanaFiles = fs.readdirSync(grafanaThemesDir)
        .filter(f => f.endsWith('.yml'));

      for (const file of grafanaFiles) {
        const srcPath = path.join(grafanaThemesDir, file);
        const destPath = path.join(THEMES_DIR, file);
        fs.copyFileSync(srcPath, destPath);
        console.log(`  Copied ${file}`);
      }
      console.log(`Copied ${grafanaFiles.length} Grafana theme(s)`);

      if (grafanaFiles.length !== 2) {
        console.warn(`\n⚠️  Warning: Expected 2 Grafana theme files (grafana-dark.yml and grafana-light.yml), but found ${grafanaFiles.length}.`);
        console.warn('Please run: node scripts/generate-grafana-gogh-themes.js');
      }
    } else {
      console.warn('\n⚠️  Warning: grafana-themes directory not found.');
      console.warn('Please run: node scripts/generate-grafana-gogh-themes.js');
    }

    // Read all YAML files from themes directory
    console.log('\nParsing theme files...');
    const files = fs.readdirSync(THEMES_DIR)
      .filter(f => f.endsWith('.yml'));

    console.log(`Found ${files.length} theme files`);

    const themes = {};
    let succeeded = 0;

    // Process each theme file
    for (const file of files) {
      const filePath = path.join(THEMES_DIR, file);
      const theme = parseGoghTheme(filePath);

      if (theme) {
        // Use filename without extension as key (convert to kebab-case)
        const key = file
          .replace('.yml', '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        themes[key] = theme;
        succeeded++;
      }
    }

    console.log(`Successfully parsed ${succeeded}/${files.length} themes`);

    // Write to JSON file
    const output = JSON.stringify(themes, null, 2);
    fs.writeFileSync(OUTPUT_FILE, output);
    console.log(`\nWrote ${succeeded} themes to ${path.relative(process.cwd(), OUTPUT_FILE)}`);

    // Clean up temp directory
    console.log('\nCleaning up...');
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });

    console.log('Done!');
    console.log(`\nSample themes included:`);
    Object.keys(themes)
      .slice(0, 15)
      .forEach(key => console.log(`  - ${themes[key].name}`));

    console.log(`\nTotal: ${succeeded} themes available`);
  } catch (err) {
    console.error('Error:', err.message);

    // Clean up on error
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    process.exit(1);
  }
}

main();
