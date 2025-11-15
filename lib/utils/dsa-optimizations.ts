/**
 * DSA (Data Structures and Algorithms) Optimizations
 *
 * This file contains optimized utility functions using DSA concepts:
 * - Sets for O(1) lookups instead of O(n) array operations
 * - Maps for O(1) key-value lookups
 * - Single-pass algorithms to reduce time complexity
 * - Memoization for expensive operations
 * - Early returns to avoid unnecessary computations
 *
 * Performance improvements:
 * - Reduced time complexity from O(n²) to O(n)
 * - Reduced time complexity from O(n*m) to O(n)
 * - Faster lookups using hash-based data structures
 */

/**
 * Creates a Set from an array for O(1) lookups
 *
 * @param items - Array of items
 * @returns Set for O(1) membership testing
 *
 * Performance: O(n) to create, O(1) for lookups
 *
 * Use case: When you need to check if an item exists in a collection multiple times
 */
export function createLookupSet<T>(items: T[]): Set<T> {
  return new Set(items);
}

/**
 * Creates a Map from an array with a key extractor function
 *
 * @param items - Array of items
 * @param keyExtractor - Function to extract key from item
 * @returns Map for O(1) key-value lookups
 *
 * Performance: O(n) to create, O(1) for lookups
 *
 * Use case: When you need to find items by a specific key multiple times
 */
export function createLookupMap<T, K>(
  items: T[],
  keyExtractor: (item: T) => K
): Map<K, T> {
  const map = new Map<K, T>();
  for (const item of items) {
    map.set(keyExtractor(item), item);
  }
  return map;
}

/**
 * Memoization wrapper for expensive functions
 *
 * @param fn - Function to memoize
 * @param keyGenerator - Function to generate cache key from arguments
 * @returns Memoized function
 *
 * Performance: O(1) lookup after first call
 *
 * Use case: When a function is called multiple times with the same arguments
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Batch processes items in chunks to avoid memory issues
 *
 * @param items - Array of items to process
 * @param chunkSize - Number of items per chunk
 * @param processor - Function to process each chunk
 * @returns Array of processed results
 *
 * Performance: O(n) with controlled memory usage
 *
 * Use case: When processing large arrays that might cause memory issues
 */
export async function batchProcess<T, R>(
  items: T[],
  chunkSize: number,
  processor: (chunk: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await processor(chunk);
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Groups items by a key using Map for O(1) lookups
 *
 * @param items - Array of items
 * @param keyExtractor - Function to extract grouping key
 * @returns Map of key to array of items
 *
 * Performance: O(n) single pass
 *
 * Use case: When you need to group items by a property
 */
export function groupBy<T, K>(
  items: T[],
  keyExtractor: (item: T) => K
): Map<K, T[]> {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const key = keyExtractor(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  return groups;
}

/**
 * Finds intersection of two arrays using Set for O(1) lookups
 *
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns Array of common items
 *
 * Performance: O(n + m) instead of O(n*m) with nested loops
 *
 * Use case: When finding common items between two arrays
 */
export function arrayIntersection<T>(arr1: T[], arr2: T[]): T[] {
  const set1 = new Set(arr1);
  const result: T[] = [];

  for (const item of arr2) {
    if (set1.has(item)) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Finds difference of two arrays using Set for O(1) lookups
 *
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns Array of items in arr1 but not in arr2
 *
 * Performance: O(n + m) instead of O(n*m) with nested loops
 *
 * Use case: When finding items in one array but not in another
 */
export function arrayDifference<T>(arr1: T[], arr2: T[]): T[] {
  const set2 = new Set(arr2);
  return arr1.filter((item) => !set2.has(item));
}
