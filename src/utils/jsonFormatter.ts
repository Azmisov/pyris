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
  expandedPaths?: Set<string>; // Set of expanded paths (format: "rowIndex:path")
  rowIndex?: number; // Current row index for path generation
}

/**
 * Format JSON data to ANSI-colored HTML with collapse/expand support
 */
export function formatJsonToAnsi(data: any, options: FormatJsonOptions): string {
  const { compact, depth, indentSize = 2, expandedPaths = new Set(), rowIndex = 0 } = options;

  return formatValue(data, [], depth, compact, indentSize, expandedPaths, rowIndex);
}

function formatValue(
  value: any,
  path: string[],
  depth: number,
  compact: boolean,
  indentSize: number,
  expandedPaths: Set<string>,
  rowIndex: number
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
    return formatObject(value, path, depth, compact, indentSize, expandedPaths, rowIndex);
  }

  // Arrays
  if (isArray(value)) {
    return formatArray(value, path, depth, compact, indentSize, expandedPaths, rowIndex);
  }

  // Fallback for undefined, functions, etc.
  return ansiWrap(String(value), 'fg-8');
}

function formatObject(
  obj: Record<string, any>,
  path: string[],
  depth: number,
  compact: boolean,
  indentSize: number,
  expandedPaths: Set<string>,
  rowIndex: number
): string {
  const entries = Object.entries(obj);

  if (entries.length === 0) {
    return '{}';
  }

  // Check if should collapse (depth >= 2 and not expanded)
  const pathString = `${rowIndex}:${path.join('.')}`;
  const shouldCollapse = depth >= 2 && !expandedPaths.has(pathString);

  if (shouldCollapse) {
    return `<span class="json-ellipsis" data-path="${escapeHtml(pathString)}">{…}</span>`;
  }

  if (compact) {
    // Single line: {key: value, key2: value2}
    const parts = entries.map(([key, val]) => {
      const keyHtml = ansiWrap(key, 'dim');
      const valHtml = formatValue(val, [...path, key], depth + 1, true, indentSize, expandedPaths, rowIndex);
      return `${keyHtml}: ${valHtml}`;
    });
    return `{${parts.join(', ')}}`;
  } else {
    // Multi-line
    const indent = ' '.repeat(depth * indentSize);
    const nextIndent = ' '.repeat((depth + 1) * indentSize);

    // If this object is expanded from a collapsed state, make the opening bracket clickable to collapse
    // Add flash animation since this is a newly created element
    const isExpanded = depth >= 2 && expandedPaths.has(pathString);
    const openBracket = isExpanded
      ? `<span class="json-collapse json-expanded-flash" data-path="${escapeHtml(pathString)}" title="Click to collapse">{</span>`
      : '{';

    const parts = entries.map(([key, val], i) => {
      const keyHtml = `<span class="ansi-dim ansi-italic">${escapeHtml(key)}</span>`;
      const valHtml = formatValue(val, [...path, key], depth + 1, false, indentSize, expandedPaths, rowIndex);
      const comma = i < entries.length - 1 ? ',' : '';
      return `${nextIndent}${keyHtml}: ${valHtml}${comma}`;
    });
    return `${openBracket}\n${parts.join('\n')}\n${indent}}`;
  }
}

function formatArray(
  arr: any[],
  path: string[],
  depth: number,
  compact: boolean,
  indentSize: number,
  expandedPaths: Set<string>,
  rowIndex: number
): string {
  if (arr.length === 0) {
    return '[]';
  }

  // Check if should collapse (depth >= 2 and not expanded)
  const pathString = `${rowIndex}:${path.join('.')}`;
  const shouldCollapse = depth >= 2 && !expandedPaths.has(pathString);

  if (shouldCollapse) {
    return `<span class="json-ellipsis" data-path="${escapeHtml(pathString)}">[…]</span>`;
  }

  if (compact) {
    // Single line: [item1, item2, item3]
    const parts = arr.map((item, i) =>
      formatValue(item, [...path, String(i)], depth + 1, true, indentSize, expandedPaths, rowIndex)
    );
    return `[${parts.join(', ')}]`;
  } else {
    // Multi-line
    const indent = ' '.repeat(depth * indentSize);
    const nextIndent = ' '.repeat((depth + 1) * indentSize);

    // If this array is expanded from a collapsed state, make the opening bracket clickable to collapse
    // Add flash animation since this is a newly created element
    const isExpanded = depth >= 2 && expandedPaths.has(pathString);
    const openBracket = isExpanded
      ? `<span class="json-collapse json-expanded-flash" data-path="${escapeHtml(pathString)}" title="Click to collapse">[</span>`
      : '[';

    const parts = arr.map((item, i) => {
      const itemHtml = formatValue(item, [...path, String(i)], depth + 1, false, indentSize, expandedPaths, rowIndex);
      const comma = i < arr.length - 1 ? ',' : '';
      return `${nextIndent}${itemHtml}${comma}`;
    });
    return `${openBracket}\n${parts.join('\n')}\n${indent}]`;
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
