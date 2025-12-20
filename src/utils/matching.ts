import { LogRow, AnsiLogRow } from '../types';

/**
 * Tokenize text into word tokens (contiguous word characters)
 */
function tokenize(text: string): string[] {
  return text.match(/\w+/g) || [];
}

/**
 * Build frequency map from tokens
 */
function buildFrequencyMap(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

/**
 * Calculate decreasing weight sum for n occurrences: 1 + 1/2 + 1/4 + ... + 1/2^(n-1)
 * This is a geometric series that converges to 2, giving diminishing returns for repeated tokens.
 */
function decreasingWeightSum(n: number): number {
  if (n <= 0) {return 0;}
  // Sum = 2 * (1 - (1/2)^n) = 2 - 2^(1-n)
  return 2 - Math.pow(2, 1 - n);
}

/**
 * Calculate match score using decreasing weights by frequency.
 * Each token match contributes tokenLength * (1 + 1/2 + 1/4 + ...) based on match count.
 * This reduces the impact of high-frequency tokens that appear many times.
 */
function tokenMatchScore(
  sourceFreq: Map<string, number>,
  targetFreq: Map<string, number>
): number {
  let score = 0;
  for (const [token, sourceCount] of sourceFreq) {
    const targetCount = targetFreq.get(token) || 0;
    const matchCount = Math.min(sourceCount, targetCount);
    score += decreasingWeightSum(matchCount) * token.length;
  }
  return score;
}

/**
 * Type guard for AnsiLogRow
 */
function isAnsiLogRow(row: LogRow): row is AnsiLogRow {
  return 'message' in row;
}

/**
 * Get text content from a row for comparison
 */
function getRowText(row: LogRow): string {
  if (isAnsiLogRow(row)) {
    return row.strippedText ?? row.message;
  }
  // JSON row: stringify the data
  return JSON.stringify(row.data);
}

/**
 * Binary search to find index of row nearest to timestamp.
 * Assumes rows are sorted in ascending order by timestamp.
 */
export function findNearestByTimestamp(
  rows: Array<{ timestamp: number }>,
  target: number
): number {
  if (rows.length === 0) {return 0;}

  let left = 0;
  let right = rows.length - 1;
  let nearestIndex = 0;
  let minDiff = Infinity;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = rows[mid].timestamp;
    const diff = Math.abs(midTimestamp - target);

    if (diff < minDiff) {
      minDiff = diff;
      nearestIndex = mid;
    }

    if (midTimestamp < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return nearestIndex;
}

/**
 * Binary search to find left/right bounds of rows within timestamp buffer.
 * Returns indices [left, right] inclusive where timestamps are within center ± buffer.
 */
function findTimestampBounds(
  rows: Array<{ timestamp: number }>,
  center: number,
  buffer: number
): { left: number; right: number } {
  if (rows.length === 0) {return { left: 0, right: -1 };}

  const minTimestamp = center - buffer;
  const maxTimestamp = center + buffer;

  // Find leftmost index where timestamp >= minTimestamp
  let left = 0;
  let right = rows.length - 1;
  let leftBound = rows.length;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (rows[mid].timestamp >= minTimestamp) {
      leftBound = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // Find rightmost index where timestamp <= maxTimestamp
  left = 0;
  right = rows.length - 1;
  let rightBound = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (rows[mid].timestamp <= maxTimestamp) {
      rightBound = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return { left: leftBound, right: rightBound };
}

/** Timestamp buffer for candidate matching (milliseconds) */
const TIMESTAMP_BUFFER_MS = 1000;

/**
 * Find the best matching row in targetRows for a given sourceRow.
 * Uses timestamp-based binary search to narrow candidates, then token matching to score.
 */
export function findMatchingRow(
  sourceRow: LogRow,
  targetRows: LogRow[],
  timestampBuffer: number = TIMESTAMP_BUFFER_MS
): number | undefined {
  if (targetRows.length === 0) {return undefined;}

  const sourceText = getRowText(sourceRow);
  const sourceTokens = tokenize(sourceText);
  const sourceFreq = buildFrequencyMap(sourceTokens);
  const centerIndex = findNearestByTimestamp(targetRows, sourceRow.timestamp);
  const { left, right } = findTimestampBounds(targetRows, sourceRow.timestamp, timestampBuffer);

  // If no rows within buffer, just return the nearest by timestamp
  if (left > right) {
    console.log('[ViewModeSwitch] No rows in buffer, using nearest:', centerIndex);
    return centerIndex;
  }

  console.log('[ViewModeSwitch] Source:', sourceText, 'tokens:', sourceTokens);

  let bestIndex = centerIndex;
  const centerText = getRowText(targetRows[centerIndex]);
  const centerTokens = tokenize(centerText);
  let bestScore = tokenMatchScore(sourceFreq, buildFrequencyMap(centerTokens));
  console.log('[ViewModeSwitch] Candidate', centerIndex, 'score:', bestScore, centerText, 'tokens:', centerTokens);

  // Search outward from center (check -offset, then +offset)
  for (let offset = 1; centerIndex + offset <= right || centerIndex - offset >= left; offset++) {
    for (let dir = -offset; dir <= offset; dir += 2 * offset) {
      const idx = centerIndex + dir;
      if (idx >= left && idx <= right) {
        const targetText = getRowText(targetRows[idx]);
        const targetTokens = tokenize(targetText);
        const score = tokenMatchScore(sourceFreq, buildFrequencyMap(targetTokens));
        console.log('[ViewModeSwitch] Candidate', idx, 'score:', score, targetText, 'tokens:', targetTokens);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = idx;
        }
      }
    }
  }

  console.log('[ViewModeSwitch] Best:', bestIndex, 'score:', bestScore);
  return bestIndex;
}
