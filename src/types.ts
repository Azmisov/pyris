import React from 'react';
import { PanelProps } from '@grafana/data';

// Panel options for configuration
export interface AnsiLogsPanelOptions {
  // Theme selection
  themeMode: 'dark' | 'light' | 'system';
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
export const defaultOptions: AnsiLogsPanelOptions = {
  themeMode: 'system',
  darkTheme: 'grafana-dark',
  lightTheme: 'grafana-light',
  wrapMode: 'nowrap',
  maxLineLength: 1000,
  rowHeight: 'auto',
  fixedRowHeight: 20,
  fontFamily: 'JetBrains Mono, Cascadia Mono, DejaVu Sans Mono, Consolas, Courier New, monospace',
  showLabels: true,
  selectedLabels: [],
  maxRenderableRows: 10000,
};

// Base log row with shared fields
export interface BaseLogRow {
  timestamp: number;
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
}

// ANSI color palette types
export type AnsiColor = {
  r: number;
  g: number;
  b: number;
};

export type ColorPalette = AnsiColor[];

// OSC-8 link structure
export interface Osc8Link {
  url: string;
  text: string;
  start: number;
  end: number;
  params?: Record<string, string>;
}

// AST node types for rendered content
export type ContentNode =
  | { type: 'text'; content: string }
  | { type: 'span'; content: string; styles: Record<string, string> }
  | { type: 'link'; content: string; url: string; attrs: Record<string, string> };

// Memoization key for row processing
export interface MemoKey {
  message: string;
  options: Pick<AnsiLogsPanelOptions, 'wrapMode' | 'maxLineLength'>;
}

// Virtual list item props
export interface VirtualListItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    rows: ProcessedLogRow[];
    options: AnsiLogsPanelOptions;
  };
}

// Panel props interface using proper Grafana types
export type AnsiLogsPanelProps = PanelProps<AnsiLogsPanelOptions>;

// Error context for PanelDataErrorView
export interface ParseErrorContext {
  needsTimeField?: boolean;
  needsStringField?: boolean;
  needsNumberField?: boolean;
}

// Parsed logs result structure
export interface ParsedLogsResult {
  ansiLogs: AnsiLogRow[];
  jsonLogs: JsonLogRow[];
  error?: string;
  extra?: ParseErrorContext;
}