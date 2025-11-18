#!/usr/bin/env node

/**
 * Test if @ansi-tools/parser can parse OSC-8 hyperlink sequences
 * This is a standalone test to see if we can replace converters/osc8.ts
 */

const { parse } = require('@ansi-tools/parser');

console.log('='.repeat(80));
console.log('Testing @ansi-tools/parser OSC-8 Support');
console.log('='.repeat(80));
console.log();

// Test 1: Basic OSC-8 with BEL terminator
console.log('Test 1: Basic OSC-8 with BEL terminator');
console.log('Input: ESC]8;;https://example.com BEL Example Link ESC]8;; BEL');
const test1 = '\x1b]8;;https://example.com\x07Example Link\x1b]8;;\x07';
const tokens1 = parse(test1);
console.log('Tokens:', JSON.stringify(tokens1, null, 2));
console.log();

// Test 2: Basic OSC-8 with ST terminator
console.log('Test 2: Basic OSC-8 with ST terminator (ESC \\)');
console.log('Input: ESC]8;;https://example.com ESC\\ Example Link ESC]8;; ESC\\');
const test2 = '\x1b]8;;https://example.com\x1b\\Example Link\x1b]8;;\x1b\\';
const tokens2 = parse(test2);
console.log('Tokens:', JSON.stringify(tokens2, null, 2));
console.log();

// Test 3: OSC-8 with parameters
console.log('Test 3: OSC-8 with parameters');
console.log('Input: ESC]8;id=123:foo=bar;https://example.com BEL Link Text ESC]8;; BEL');
const test3 = '\x1b]8;id=123:foo=bar;https://example.com\x07Link Text\x1b]8;;\x07';
const tokens3 = parse(test3);
console.log('Tokens:', JSON.stringify(tokens3, null, 2));
console.log();

// Test 4: Mixed ANSI color codes and OSC-8
console.log('Test 4: Mixed ANSI colors and OSC-8');
console.log('Input: Red text + OSC-8 link + Green text');
const test4 = '\x1b[31mRed text\x1b[0m \x1b]8;;https://example.com\x07Link\x1b]8;;\x07 \x1b[32mGreen\x1b[0m';
const tokens4 = parse(test4);
console.log('Tokens:', JSON.stringify(tokens4, null, 2));
console.log();

// Test 5: Multiple OSC-8 links
console.log('Test 5: Multiple OSC-8 links');
const test5 = 'Visit \x1b]8;;https://example.com\x07Example\x1b]8;;\x07 or \x1b]8;;https://github.com\x07GitHub\x1b]8;;\x07';
const tokens5 = parse(test5);
console.log('Tokens:', JSON.stringify(tokens5, null, 2));
console.log();

// Test 6: Real-world example from sample logs
console.log('Test 6: Real-world OSC-8 from sample logs');
const test6 = '\x1b]8;;https://example.com\x07Example Website\x1b]8;;\x07';
const tokens6 = parse(test6);
console.log('Tokens:');
tokens6.forEach((token, index) => {
  console.log(`  Token ${index}:`, {
    type: token.type,
    raw: token.raw.replace(/[\x00-\x1f\x7f-\x9f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`),
    command: token.command,
    params: token.params,
    pos: token.pos,
  });
});
console.log();

// Test 7: file:// and vscode:// links
console.log('Test 7: file:// and vscode:// OSC-8 links');
const test7 = '\x1b]8;;file:///home/user/file.txt\x07File Link\x1b]8;;\x07 and \x1b]8;;vscode://file/path/to/file.ts:42:10\x07VSCode Link\x1b]8;;\x07';
const tokens7 = parse(test7);
console.log('Tokens:', tokens7.length);
tokens7.forEach((token, index) => {
  if (token.type === 'OSC') {
    console.log(`  OSC Token ${index}:`, {
      command: token.command,
      params: token.params,
    });
  }
});
console.log();

// Analysis
console.log('='.repeat(80));
console.log('ANALYSIS: Can @ansi-tools/parser replace converters/osc8.ts?');
console.log('='.repeat(80));
console.log();

// Check capabilities
let hasOscTokens = false;
let canExtractUrl = false;
let canExtractParams = false;
let canIdentifyText = false;
let hasPositionInfo = false;

tokens6.forEach(token => {
  if (token.type === 'OSC') {
    hasOscTokens = true;
    if (token.command === '8') {
      if (token.params && token.params.length >= 2) {
        canExtractUrl = true;
        if (token.params[0]) {
          canExtractParams = true;
        }
      }
    }
  }
  if (token.type === 'TEXT') {
    canIdentifyText = true;
  }
  if (token.pos !== undefined) {
    hasPositionInfo = true;
  }
});

console.log('Capabilities Check:');
console.log('  ✓ Parser supports OSC tokens:', hasOscTokens);
console.log('  ✓ Can extract URLs from OSC-8:', canExtractUrl);
console.log('  ✓ Can extract parameters:', canExtractParams);
console.log('  ✓ Can identify link text (TEXT tokens):', canIdentifyText);
console.log('  ✓ Provides position information:', hasPositionInfo);
console.log();

if (hasOscTokens && canExtractUrl) {
  console.log('Token Structure for OSC-8:');
  console.log('  - Type: "OSC"');
  console.log('  - Command: "8" (for OSC-8 sequences)');
  console.log('  - Params: Array where:');
  console.log('    - params[0] = parameters string (id=value:key=value)');
  console.log('    - params[1] = URL (for open) or empty string (for close)');
  console.log('  - Position: token.pos');
  console.log();

  console.log('✓ YES - Parser CAN replace custom OSC-8 implementation!');
  console.log();
  console.log('Implementation approach:');
  console.log('  1. Iterate through tokens from parse()');
  console.log('  2. Track OSC-8 state:');
  console.log('     - When OSC command=8 && params[1] exists → link opened');
  console.log('     - Collect TEXT tokens until next OSC-8');
  console.log('     - When OSC command=8 && params[1] empty → link closed');
  console.log('  3. Build link objects with:');
  console.log('     - url: from params[1] of open OSC');
  console.log('     - text: concatenated TEXT token raw values');
  console.log('     - params: parsed from params[0]');
  console.log('     - positions: from token.pos');
  console.log();
} else {
  console.log('✗ NO - Parser cannot fully replace custom implementation');
  console.log('Missing:', {
    oscTokens: !hasOscTokens,
    urlExtraction: !canExtractUrl,
  });
  console.log();
}

console.log('='.repeat(80));
