import { PanelProps } from '@grafana/data';

// Panel options for configuration
export interface LogsPanelOptions {
  // Theme selection
  themeMode: 'grafana' | 'system' | 'light' | 'dark';
  darkTheme: string;
  lightTheme: string;

  // Display options
  wrapMode: 'nowrap' | 'soft-wrap';

  // Row sizing
  rowHeight: 'auto' | 'fixed';
  fixedRowHeight: number;
  fontFamily: string;

  // Labels
  showLabels: boolean;
  selectedLabels: string[];

  // Performance
  maxLineLength: number;
  maxRenderableRows: number;
}

// Default panel options
export const defaultOptions: LogsPanelOptions = {
  themeMode: 'grafana',
  darkTheme: 'grafana-dark',
  lightTheme: 'grafana-light',
  wrapMode: 'nowrap',
  maxLineLength: 1000,
  rowHeight: 'auto',
  fixedRowHeight: 16,
  fontFamily: 'JetBrains Mono, Cascadia Mono, DejaVu Sans Mono, Consolas, Courier New, monospace',
  showLabels: false,
  selectedLabels: [],
  maxRenderableRows: 10000,
};

// Base log row with shared fields
export interface BaseLogRow {
  timestamp: number;
  seriesIndex?: number; // Original order index for stable sorting when timestamps are equal
  labels?: Record<string, string>;
  id?: string;
  level?: string;
}

// ANSI log row with text message
export interface AnsiLogRow extends BaseLogRow {
  message: string;
  strippedText?: string; // Message with ANSI codes removed, used for searching
}

// JSON log row with structured data
export interface JsonLogRow extends BaseLogRow {
  data: Record<string, any>;
}

// Union type for compatibility
export type LogRow = AnsiLogRow | JsonLogRow;

// Processed log row for rendering (ANSI logs only)
export interface ProcessedLogRow extends AnsiLogRow {
  html: string;
  strippedText: string; // Text with ANSI codes removed, used for searching
  truncatedChars?: number; // Number of characters truncated due to maxLineLength
}

// ANSI color palette types
export type AnsiColor = {
  r: number;
  g: number;
  b: number;
};

export type ColorPalette = AnsiColor[];

// Panel props interface using proper Grafana types
export interface LogsPanelProps extends PanelProps<LogsPanelOptions> {}

// Error context for PanelDataErrorView
export interface ParseErrorContext {
  needsTimeField?: boolean;
  needsStringField?: boolean;
  needsNumberField?: boolean;
}

// Parsed logs result structure (single series)
export interface ParsedLogsResult {
  ansiLogs: AnsiLogRow[];
  jsonLogs: JsonLogRow[];
  error?: string;
  extra?: ParseErrorContext;
}

// DataFrame parse result (multiple series)
export interface DataFrameParseResult {
  parsed: ParsedLogsResult;
  failed: Record<string, ParsedLogsResult>;
}