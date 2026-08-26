import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a value
 * @param initialValue Initial value for the state
 * @param delay Delay in milliseconds (default: 300ms)
 * @returns [value, setValue] tuple where setValue updates the debounced value
 */
export function useDebouncedValue<T>(initialValue: T, delay: number = 300): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return [debouncedValue, setValue];
}