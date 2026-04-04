import jexl from 'jexl';
import { LogRow } from '../types';

export interface ExpressionResult {
  filter: (log: LogRow) => Promise<boolean>;
  error: null;
}

export interface ExpressionError {
  filter: null;
  error: string;
}

export type ParsedExpression = ExpressionResult | ExpressionError;

/**
 * Parse a jexl expression for filtering JSON logs.
 *
 * Expressions are evaluated against the parsed JSON data of each log row.
 * Example: `level == "error"`, `status == 200 && method in ["POST", "PUT"]`
 *
 * @param exprBody - Expression string from user input
 * @returns Parsed expression or error
 */
export function parseExpression(exprBody: string): ParsedExpression {
  const trimmed = exprBody.trim();
  if (!trimmed) {
    throw new Error('parseExpression called with empty expression');
  }

  try {
    const compiled = jexl.compile(trimmed);
    return {
      filter: (log: LogRow) => {
        if (!('data' in log)) {
          return Promise.resolve(false);
        }
        return compiled.eval(log.data as Record<string, unknown>);
      },
      error: null,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Invalid expression';
    return {
      filter: null,
      error: errorMsg,
    };
  }
}
