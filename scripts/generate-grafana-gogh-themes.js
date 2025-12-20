#!/usr/bin/env node

/**
 * Generate Gogh-format YAML files for Grafana's default color themes
 * Extracts colors from Grafana's SCSS variables and creates compatible theme files
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const yaml = require('js-yaml');
const { parse, converter, formatHex } = require('culori');

const OUTPUT_DIR = path.join(__dirname, 'grafana-themes');

/**
 * Fetch SCSS file from Grafana repository
 */
function fetchGrafanaScss(filename) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/grafana/grafana/main/public/sass/${filename}`;
    console.log(`Fetching ${url}...`);
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse SCSS content and extract Grafana colors
 * Returns an object with individual color properties
 */
function parseGrafanaColors(scssContent) {
  // Extract color values - handle both hex and rgba formats, and variable references
  const extractColor = (...candidates) => {
    for (let varName of candidates) {
      // Try hex format first
      const hexMatch = scssContent.match(new RegExp(`\\$${varName}\\s*:\\s*(#[0-9a-fA-F]{3,6})`));
      if (hexMatch) {
        return hexMatch[1];
      }

      // Try variable reference (e.g., $red: $red-base)
      const varRefMatch = scssContent.match(new RegExp(`\\$${varName}\\s*:\\s*\\$([-a-z0-9]+)`));
      if (varRefMatch) {
        const refVarName = varRefMatch[1];
        // Recursively extract the referenced variable
        return extractColor(refVarName);
      }

      // Try rgba format
      const rgbaMatch = scssContent.match(new RegExp(`\\$${varName}\\s*:\\s*rgba?\\s*\\(\\s*([0-9]+)\\s*,\\s*([0-9]+)\\s*,\\s*([0-9]+)`));
      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1], 10);
        const g = parseInt(rgbaMatch[2], 10);
        const b = parseInt(rgbaMatch[3], 10);
        // Convert to hex
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
      }
    }
    return null;
  };

  // Extract Grafana colors
  return {
    green: extractColor('green', 'green-base', 'alert-success-bg'),
    blue: extractColor('blue', 'blue-base'),
    red: extractColor('red', 'red-base', 'alert-error-bg'),
    orange: extractColor('orange', 'orange-base', 'alert-warning-bg'),
    yellow: extractColor('yellow', 'yellow-base'),
    purple: extractColor('purple', 'purple-base'),
    black: extractColor('black'),
    white: extractColor('white'),
    textColor: extractColor('text-color'),
    panelBg: extractColor('panel-bg'),
    // Additional colors for better theme coverage
    gray1: extractColor('gray1', 'gray-1'),
    gray2: extractColor('gray2', 'gray-2'),
    gray3: extractColor('gray3', 'gray-3'),
    gray4: extractColor('gray4', 'gray-4'),
    gray5: extractColor('gray5', 'gray-5'),
    cyan: extractColor('cyan', 'cyan-base'),
  };
}

/**
 * Convert Grafana colors to Gogh theme format
 * Gogh requires 16 ANSI colors (color_01 through color_16) plus background and foreground
 */
function convertToGoghFormat(grafanaColors, themeName, isDark) {
  // For Grafana, we'll map available colors and generate reasonable defaults for missing ones
  // Gogh color positions:
  // 01=black, 02=red, 03=green, 04=yellow, 05=blue, 06=magenta, 07=cyan, 08=white
  // 09=bright black, 10=bright red, 11=bright green, 12=bright yellow,
  // 13=bright blue, 14=bright magenta, 15=bright cyan, 16=bright white

  // Use gray variations for black/white spectrum
  const black = grafanaColors.black || grafanaColors.gray1 || '#000000';
  const white = grafanaColors.white || grafanaColors.gray5 || '#ffffff';
  const brightBlack = grafanaColors.gray2 || grafanaColors.gray3 || '#808080';
  const brightWhite = grafanaColors.white || '#ffffff';

  // Use Grafana's semantic colors
  const red = grafanaColors.red || '#e02f44';
  const green = grafanaColors.green || '#299c46';
  const yellow = grafanaColors.yellow || '#ff851b';
  const blue = grafanaColors.blue || '#1f78d1';
  const magenta = grafanaColors.purple || '#9933cc';
  const cyan = grafanaColors.cyan || '#1fd1c2ff';

  // Generate brighter versions for bright colors using OKLab perceptual color space
  const brighten = (hex) => {
    if (!hex || !hex.startsWith('#')) {return hex;}

    // Parse color and convert to OKLab
    const color = parse(hex);
    if (!color) {return hex;}

    const oklab = converter('oklab');
    const oklabColor = oklab(color);

    // Increase lightness by 0.15 in OKLab space (more perceptually accurate)
    let shift = 0.15;
    if (!isDark)
      {shift = -shift;}
    const brighterColor = {
      ...oklabColor,
      l: Math.min(1, oklabColor.l + shift),
    };

    return formatHex(brighterColor);
  };

  const brightRed = brighten(red);
  const brightGreen = brighten(green);
  const brightYellow = brighten(yellow);
  const brightBlue = brighten(blue);
  const brightMagenta = brighten(magenta);
  const brightCyan = brighten(cyan);

  // Create Gogh theme object
  const goghTheme = {
    name: themeName,

    // Standard colors (01-08)
    color_01: black,
    color_02: red,
    color_03: green,
    color_04: yellow,
    color_05: blue,
    color_06: magenta,
    color_07: cyan,
    color_08: white,

    // Bright colors (09-16)
    color_09: brightBlack,
    color_10: brightRed,
    color_11: brightGreen,
    color_12: brightYellow,
    color_13: brightBlue,
    color_14: brightMagenta,
    color_15: brightCyan,
    color_16: brightWhite,

    // Background and foreground
    background: grafanaColors.panelBg || (isDark ? '#181b1f' : '#f4f5f5'),
    foreground: grafanaColors.textColor || (isDark ? '#d8d9da' : '#2c3235'),
  };

  return goghTheme;
}

/**
 * Write Gogh theme to YAML file
 */
function writeGoghTheme(theme, filename) {
  const yamlContent = yaml.dump(theme, {
    lineWidth: -1, // Don't wrap lines
    quotingType: '"',
    forceQuotes: true,
  });

  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, yamlContent, 'utf8');
  console.log(`✓ Written ${filename}`);

  return filePath;
}

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex) {
  const clean = hex.replace(/^#/, '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Generate ANSI color preview for Gogh theme
 * Shows all 16 ANSI colors plus background and foreground
 */
function generateColorPreview(goghTheme) {
  let preview = '';

  // Display all 16 ANSI colors (color_01 through color_16)
  for (let i = 1; i <= 16; i++) {
    const colorKey = `color_${i.toString().padStart(2, '0')}`;
    const color = goghTheme[colorKey];

    if (color) {
      const rgb = hexToRgb(color);
      const coloredBlock = `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m█\x1b[0m`;
      preview += coloredBlock;
    }
  }

  // Add separator
  preview += ' │ ';

  // Add background and foreground
  if (goghTheme.background) {
    const rgb = hexToRgb(goghTheme.background);
    const coloredBlock = `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m█\x1b[0m`;
    preview += coloredBlock;
  }

  if (goghTheme.foreground) {
    const rgb = hexToRgb(goghTheme.foreground);
    const coloredBlock = `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m█\x1b[0m`;
    preview += coloredBlock;
  }

  return preview;
}

/**
 * Display Gogh theme with color preview
 */
function displayTheme(goghTheme, label) {
  console.log(`\n${label}:`);
  console.log(`  ${goghTheme.name}`);
  console.log(`  ${generateColorPreview(goghTheme)}`);
  console.log(`  Background: ${goghTheme.background}`);
  console.log(`  Foreground: ${goghTheme.foreground}`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Generating Grafana Gogh themes...\n');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`Created output directory: ${OUTPUT_DIR}\n`);
    }

    // Fetch Grafana SCSS files
    console.log('Fetching Grafana SCSS files...');
    const [darkScss, lightScss] = await Promise.all([
      fetchGrafanaScss('_variables.dark.generated.scss'),
      fetchGrafanaScss('_variables.light.generated.scss'),
    ]);
    console.log('✓ Fetched SCSS files\n');

    // Parse colors
    console.log('Parsing color palettes...');
    const darkColors = parseGrafanaColors(darkScss);
    const lightColors = parseGrafanaColors(lightScss);
    console.log('✓ Parsed color palettes');

    // Convert to Gogh format
    console.log('\nConverting to Gogh format...');
    const darkTheme = convertToGoghFormat(darkColors, 'Grafana Dark', true);
    const lightTheme = convertToGoghFormat(lightColors, 'Grafana Light', false);
    console.log('✓ Converted to Gogh format');

    // Display themes with color previews
    console.log('\n' + '='.repeat(60));
    displayTheme(darkTheme, 'Grafana Dark Theme');
    displayTheme(lightTheme, 'Grafana Light Theme');
    console.log('='.repeat(60));

    // Write YAML files
    console.log('\nWriting YAML files...');
    const darkFile = writeGoghTheme(darkTheme, 'grafana-dark.yml');
    const lightFile = writeGoghTheme(lightTheme, 'grafana-light.yml');

    console.log('\n' + '='.repeat(60));
    console.log('✓ Done!');
    console.log('\nGenerated files:');
    console.log(`  - ${path.relative(process.cwd(), darkFile)}`);
    console.log(`  - ${path.relative(process.cwd(), lightFile)}`);
    console.log('\nThese YAML files are compatible with Gogh theme format.');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
  }
}

main();
