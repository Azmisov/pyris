/**
 * LogCountIndex - Efficient timestamp-based log counting
 *
 * Maintains an index into a sorted array of timestamps and provides
 * efficient counting of logs between timestamps using exponential + binary search.
 */

/** Histogram bin with start/end timestamps and log count */
export interface HistogramBin {
  startTime: number;
  /** End time is exclusive */
  endTime: number;
  count: number;
}

export class LogCountIndex {
  private timestamps: number[];
  private currentIndex: number = 0;
  private binStartTime: number = 0;
  private bins: HistogramBin[] = [];
  /** Cache last bin index for hover lookups */
  private lastBinIndex: number = 0;

  constructor(timestamps: number[]) {
    this.timestamps = timestamps;
  }

  /**
   * Search for the next index (first timestamp >= target)
   * Uses exponential search followed by binary search for efficiency
   * Optimized for monotonic forward queries (target >= current timestamp)
   * Returns the index, or timestamps.length if all timestamps are < target
   */
  private search(target: number): number {
    // Beyond end (currentIndex can only equal length, never exceed it)
    if (this.currentIndex === this.timestamps.length) {
      return this.timestamps.length;
    }

    // Beyond start
    if (target <= this.timestamps[this.currentIndex]) {
      return this.currentIndex;
    }

    // Exponential search to find upper bound
    let bound = 1;
    while (
      this.currentIndex + bound < this.timestamps.length &&
      this.timestamps[this.currentIndex + bound] < target
    ) {
      bound *= 2;
    }

    // Binary search within bounds
    const start = this.currentIndex;
    const end = Math.min(this.currentIndex + bound, this.timestamps.length);
    return this.binarySearch(target, start, end);
  }

  /**
   * Binary search for first index where timestamps[index] >= target
   */
  private binarySearch(target: number, start: number, end: number): number {
    let left = start;
    let right = end;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.timestamps[mid] < target) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  /**
   * Count logs between current bin start and next_timestamp
   * Updates current index, bin start time, and stores bin data (only if count > 0)
   *
   * IMPORTANT: nextTimestamp must be >= binStartTime (monotonically increasing)
   *
   * @param nextTimestamp - The end timestamp of the bin (must be >= previous bin end)
   * @returns The count of logs in the bin (always >= 0)
   */
  count(nextTimestamp: number): number {
    // Validate monotonic usage (bins must move forward)
    if (nextTimestamp < this.binStartTime) {
      throw new Error(
        `LogCountIndex.count(): nextTimestamp (${nextTimestamp}) must be >= binStartTime (${this.binStartTime}). ` +
        `Bins must be generated in increasing order.`
      );
    }

    const nextIndex = this.search(nextTimestamp);
    const count = nextIndex - this.currentIndex;

    // Sanity check: count should never be negative due to monotonic guarantee
    if (count < 0) {
      throw new Error(`LogCountIndex internal error: negative count (${count})`);
    }

    // Only store bin information if count > 0
    if (count > 0) {
      // Clamp bin boundaries to actual data range
      const firstTimestamp = this.timestamps[0];
      const lastTimestamp = this.timestamps[this.timestamps.length - 1];

      this.bins.push({
        // Clamp start to first timestamp
        startTime: Math.max(this.binStartTime, firstTimestamp),
        // Clamp end to last timestamp (exclusive, so use last + small epsilon)
        endTime: Math.min(nextTimestamp, lastTimestamp),
        count,
      });
    }

    // Update state for next iteration
    this.currentIndex = nextIndex;
    this.binStartTime = nextTimestamp;

    return count;
  }

  /**
   * Reset the index to start over
   * Clears bin data, sets initial bin start time, and positions index
   * at the first timestamp >= initialTimestamp
   *
   * @param initialTimestamp - The starting timestamp for the first bin
   */
  reset(initialTimestamp: number): void {
    this.binStartTime = initialTimestamp;
    this.bins = [];
    this.lastBinIndex = 0;

    // Position index at first timestamp >= initialTimestamp
    // Use binary search from start since we're resetting
    this.currentIndex = this.binarySearch(initialTimestamp, 0, this.timestamps.length);
  }

  /**
   * Get the accumulated bins
   */
  getBins(): HistogramBin[] {
    return this.bins;
  }

  /**
   * Get the total number of timestamps
   */
  getLength(): number {
    return this.timestamps.length;
  }

  /**
   * Find the bin that contains the given timestamp
   * Uses cached last bin index with exponential search for efficient hover lookups
   * Searches forward or backward based on timestamp relative to cached bin
   *
   * @param timestamp - The timestamp to search for
   * @returns The bin containing the timestamp, or null if no bin contains it
   */
  findBinForTimestamp(timestamp: number): HistogramBin | null {
    if (this.bins.length === 0) {
      return null;
    }

    // Check cached bin first (optimizes for sequential hover)
    if (this.lastBinIndex < this.bins.length) {
      const cachedBin = this.bins[this.lastBinIndex];
      if (timestamp >= cachedBin.startTime && timestamp < cachedBin.endTime) {
        return cachedBin;
      }
    }

    // Determine search direction based on cached bin
    const cachedBin = this.bins[Math.min(this.lastBinIndex, this.bins.length - 1)];
    const searchForward = timestamp >= cachedBin.endTime;

    let foundIndex: number;

    if (searchForward) {
      // Exponential search forward
      foundIndex = this.exponentialSearchBinsForward(timestamp);
    } else {
      // Exponential search backward
      foundIndex = this.exponentialSearchBinsBackward(timestamp);
    }

    if (foundIndex !== -1) {
      this.lastBinIndex = foundIndex;
      return this.bins[foundIndex];
    }

    return null;
  }

  /**
   * Exponential search forward through bins
   */
  private exponentialSearchBinsForward(timestamp: number): number {
    let start = this.lastBinIndex;
    let bound = 1;

    // Find upper bound
    while (start + bound < this.bins.length && this.bins[start + bound].endTime <= timestamp) {
      bound *= 2;
    }

    // Binary search within bounds
    return this.binarySearchBins(
      timestamp,
      start,
      Math.min(start + bound + 1, this.bins.length)
    );
  }

  /**
   * Exponential search backward through bins
   */
  private exponentialSearchBinsBackward(timestamp: number): number {
    let start = this.lastBinIndex;
    let bound = 1;

    // Find lower bound
    while (start - bound >= 0 && this.bins[start - bound].startTime > timestamp) {
      bound *= 2;
    }

    // Binary search within bounds
    return this.binarySearchBins(
      timestamp,
      Math.max(start - bound, 0),
      start + 1
    );
  }

  /**
   * Binary search for bin containing timestamp
   * Returns index of bin where startTime <= timestamp < endTime, or -1 if not found
   */
  private binarySearchBins(timestamp: number, start: number, end: number): number {
    let left = start;
    let right = end;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const bin = this.bins[mid];

      if (timestamp < bin.startTime) {
        right = mid;
      } else if (timestamp >= bin.endTime) {
        left = mid + 1;
      } else {
        // Found: startTime <= timestamp < endTime
        return mid;
      }
    }

    return -1;
  }
}
