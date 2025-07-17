/**
 * Helper functions for interacting with localStorage in a type-safe way.
 * Only works in client-side code (browser environment).
 */

const isBrowser = typeof window !== 'undefined';

export function save(key: string, value: any) {
  if (!isBrowser) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function load(key: string, defaultValue: any = null) {
  if (!isBrowser) return defaultValue;
  
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return defaultValue;
  }
}

export function remove(key: string) {
  if (!isBrowser) return;
  localStorage.removeItem(key);
}