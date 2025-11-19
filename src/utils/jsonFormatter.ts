/**
 * JSON Formatter - Convert JSON to ANSI-colored HTML for rendering
 *
 * This module provides utilities to format JSON data with ANSI color codes
 * for display in the logs panel.
 */

export interface FormatJsonOptions {
  compact: boolean; // Single-line vs multi-line
  depth: number; // Current nesting depth
  indentSize?: number; // Spaces per indent level (default: 2)
}

/**
 * Format JSON data to ANSI-colored HTML
 * For Phase 1, we keep it simple - no expand/collapse yet
 */
export function formatJsonToAnsi(data: any, options: FormatJsonOptions): string {
  const { compact, depth, indentSize = 2 } = options;

  return formatValue(data, [], depth, compact, indentSize);
}

function formatValue(
  value: any,
  path: string[],
  depth: number,
  compact: boolean,
  indentSize: number
): string {
  const type = typeof value;

  // Primitives
  if (value === null) {
    return ansiWrap('null', 'fg-8'); // gray
  }
  if (type === 'boolean') {
    return ansiWrap(String(value), 'fg-3'); // yellow
  }
  if (type === 'number') {
    return ansiWrap(String(value), 'fg-6'); // cyan
  }
  if (type === 'string') {
    return ansiWrap(JSON.stringify(value), 'fg-2'); // green
  }

  // Objects
  if (isObject(value)) {
    return formatObject(value, path, depth, compact, indentSize);
  }

  // Arrays
  if (isArray(value)) {
    return formatArray(value, path, depth, compact, indentSize);
  }

  // Fallback for undefined, functions, etc.
  return ansiWrap(String(value), 'fg-8');
}

function formatObject(
  obj: Record<string, any>,
  path: string[],
  depth: number,
  compact: boolean,
  indentSize: number
): string {
  const entries = Object.entries(obj);

  if (entries.length === 0) {
    return '{}';
  }

  if (compact) {
    // Single line: {key: value, key2: value2}
    const parts = entries.map(([key, val]) => {
      const keyHtml = ansiWrap(key, 'dim');
      const valHtml = formatValue(val, [...path, key], depth + 1, true, indentSize);
      return `${keyHtml}: ${valHtml}`;
    });
    return `{${parts.join(', ')}}`;
  } else {
    // Multi-line
    const indent = ' '.repeat(depth * indentSize);
    const nextIndent = ' '.repeat((depth + 1) * indentSize);
    const parts = entries.map(([key, val], i) => {
      const keyHtml = `<span class="ansi-dim ansi-italic">${escapeHtml(key)}</span>`;
      const valHtml = formatValue(val, [...path, key], depth + 1, false, indentSize);
      const comma = i < entries.length - 1 ? ',' : '';
      return `${nextIndent}${keyHtml}: ${valHtml}${comma}`;
    });
    return `{\n${parts.join('\n')}\n${indent}}`;
  }
}

function formatArray(
  arr: any[],
  path: string[],
  depth: number,
  compact: boolean,
  indentSize: number
): string {
  if (arr.length === 0) {
    return '[]';
  }

  if (compact) {
    // Single line: [item1, item2, item3]
    const parts = arr.map((item, i) =>
      formatValue(item, [...path, String(i)], depth + 1, true, indentSize)
    );
    return `[${parts.join(', ')}]`;
  } else {
    // Multi-line
    const indent = ' '.repeat(depth * indentSize);
    const nextIndent = ' '.repeat((depth + 1) * indentSize);
    const parts = arr.map((item, i) => {
      const itemHtml = formatValue(item, [...path, String(i)], depth + 1, false, indentSize);
      const comma = i < arr.length - 1 ? ',' : '';
      return `${nextIndent}${itemHtml}${comma}`;
    });
    return `[\n${parts.join('\n')}\n${indent}]`;
  }
}

/**
 * Wrap text in ANSI color class span
 */
function ansiWrap(text: string, className: string): string {
  return `<span class="ansi-${className}">${escapeHtml(text)}</span>`;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if value is a plain object
 */
function isObject(val: any): boolean {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Check if value is an array
 */
function isArray(val: any): boolean {
  return Array.isArray(val);
}
