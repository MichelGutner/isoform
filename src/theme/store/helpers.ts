/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Deeply merges two objects, creating a new object with combined properties.
 * 
 * This function performs a recursive deep merge, combining nested objects
 * while preserving immutability. Arrays are replaced rather than merged.
 * 
 * @template T - Type of the base object
 * @param base - The base object to merge into
 * @param partial - The partial object to merge from
 * @returns A new object with merged properties
 * 
 * @example
 * ```tsx
 * const base = { colors: { primary: 'blue', secondary: 'gray' } };
 * const partial = { colors: { primary: 'red' }, spacing: { md: 16 } };
 * 
 * const merged = deepMerge(base, partial);
 * // Result: { colors: { primary: 'red', secondary: 'gray' }, spacing: { md: 16 } }
 * ```
 * 
 * @example
 * ```tsx
 * const base = { theme: { light: { bg: 'white' }, dark: { bg: 'black' } } };
 * const partial = { theme: { light: { text: 'black' } } };
 * 
 * const merged = deepMerge(base, partial);
 * // Result: { 
 * //   theme: { 
 * //     light: { bg: 'white', text: 'black' }, 
 * //     dark: { bg: 'black' } 
 * //   } 
 * // }
 * ```
 * 
 * @performance
 * - Returns the original object if no changes are detected
 * - Only creates new objects when necessary
 * - Preserves array references (replaces rather than merges)
 * - Handles null and undefined values gracefully
 */
export const deepMerge = <T>(base: T, partial: Partial<T>): T => {
  // Return base if partial is the same reference
  if (partial === base) return base;

  // Return base if partial is null/undefined
  if (!partial) return base;
  
  // Return partial if base is null/undefined
  if (!base) return partial as T;
  
  // Return partial as-is if it's not an object (primitive value)
  if (typeof partial !== 'object' || partial === null) return partial as T;

  // Track if any mutations occurred for optimization
  let mutated = false;
  
  // Create new object/array based on base type
  const result: any = Array.isArray(base) ? [...base] : { ...base };

  // Iterate through all properties in partial
  for (const key in partial) {
    const partialValue = (partial as any)[key];
    const baseValue = (base as any)[key];

    // Skip if values are identical
    if (partialValue === baseValue) continue;

    // If both values are objects (and not arrays), recursively merge
    if (
      partialValue &&
      baseValue &&
      typeof partialValue === 'object' &&
      typeof baseValue === 'object' &&
      !Array.isArray(partialValue) &&
      !Array.isArray(baseValue)
    ) {
      const merged = deepMerge(baseValue, partialValue);

      // Only assign if merge resulted in changes
      if (merged !== baseValue) {
        result[key] = merged;
        mutated = true;
      }
    } else {
      // Assign primitive values, arrays, or null/undefined
      result[key] = partialValue;
      mutated = true;
    }
  }
  
  // Return original object if no mutations occurred
  return mutated ? (result as T) : base;
};

/**
 * Structural equality for theme values: primitives by value, plain objects and arrays by content,
 * functions and everything else by reference.
 *
 * Used to recognise a theme the app has already shown (switching back to "dark"), so the style
 * caches keyed by theme identity are reused instead of recompiling every component.
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!deepEqual(left[key], right[key])) return false;
  }
  return true;
};
