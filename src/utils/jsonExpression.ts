import { LogRow } from '../types';

export interface ExpressionResult {
  filter: (log: LogRow) => boolean;
  error: null;
}

export interface ExpressionError {
  filter: null;
  error: string;
}

export type ParsedExpression = ExpressionResult | ExpressionError;

/**
 * Parse a JavaScript expression for filtering JSON logs
 *
 * The expression body is provided without "r => " prefix (added by UI)
 * Example input: "r.level === 'error'" (not "r => r.level === 'error'")
 * The variable 'r' represents the parsed JSON data (row.data)
 *
 * @param exprBody - Expression body from user input (without "r => " prefix)
 * @returns Parsed expression or error
 */
export function parseExpression(exprBody: string): ParsedExpression {
  try {
    // Validate basic syntax
    const trimmed = exprBody.trim();
    if (!trimmed) {
      console.log('[parseExpression] Empty expression');
      return {
        filter: () => true, // Empty expression matches all
        error: null,
      };
    }

    console.log('[parseExpression] Parsing expression:', trimmed);

    // Create function with 'r' as parameter
    // eslint-disable-next-line no-new-func
    const func = new Function('r', `return ${trimmed}`);

    console.log('[parseExpression] Successfully created function');

    // Return wrapped filter that throws on first error
    return {
      filter: (log: LogRow) => {
        // Only filter JSON logs
        if (!('data' in log)) {
          return false;
        }
        // Let errors bubble up - they'll be caught by the filtering logic
        const result = func(log.data);
        return Boolean(result);
      },
      error: null,
    };
  } catch (error) {
    // Syntax error during function creation
    const errorMsg = error instanceof Error ? error.message : 'Invalid expression';
    console.log('[parseExpression] Caught syntax error:', errorMsg);
    return {
      filter: null,
      error: errorMsg,
    };
  }
}

/**
 * Filter JSON logs using an expression
 */
export function filterJsonLogs(
  logs: LogRow[],
  exprBody: string
): LogRow[] {
  const parsed = parseExpression(exprBody);

  if (parsed.error || !parsed.filter) {
    console.error('Expression error:', parsed.error);
    return logs; // Return all logs on error
  }

  return logs.filter(parsed.filter);
}
