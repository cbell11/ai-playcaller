/**
 * Helper functions for interacting with localStorage in a type-safe way.
 * Only works in client-side code (browser environment).
 */

/**
 * Loads data from localStorage for the given key.
 * Attempts to parse the stored JSON value and returns the fallback if anything fails.
 * 
 * @param key - The localStorage key to read from
 * @param fallback - Default value to return if key doesn't exist or parsing fails
 * @returns The parsed value from localStorage or the fallback value
 */
export function load<T>(key: string, fallback: T): T {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return fallback;
    }
  
    try {
      const item = localStorage.getItem(key);
      // Return fallback if item doesn't exist
      if (item === null) {
        return fallback;
      }
      // Parse and return the stored value
      return JSON.parse(item) as T;
    } catch (error) {
      // Return fallback on any error (invalid JSON, localStorage not available, etc)
      console.warn(`Error loading from localStorage key "${key}":`, error);
      return fallback;
    }
  }
  
  /**
   * Saves data to localStorage by stringifying it first.
   * Only operates in client-side code.
   * 
   * @param key - The localStorage key to write to
   * @param value - The value to stringify and store
   */
  export function save<T>(key: string, value: T): void {
    // Only proceed if we're in a browser environment
    if (typeof window === 'undefined') {
      return;
    }
  
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error(`Error saving to localStorage key "${key}":`, error);
    }
  }