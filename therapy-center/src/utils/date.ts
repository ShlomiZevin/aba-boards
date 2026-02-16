/**
 * Convert Firestore Timestamp or date string to JavaScript Date
 * Handles: Firestore Timestamp objects, ISO strings, Date objects
 */
export function toDate(value: unknown): Date {
  if (!value) {
    return new Date();
  }

  // Already a Date
  if (value instanceof Date) {
    return value;
  }

  // Firestore Timestamp (has seconds and nanoseconds)
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // Firestore Timestamp format: { seconds: number, nanoseconds: number }
    // or { _seconds: number, _nanoseconds: number }
    const seconds = obj.seconds ?? obj._seconds;
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000);
    }
  }

  // String (ISO date string)
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Number (milliseconds timestamp)
  if (typeof value === 'number') {
    return new Date(value);
  }

  // Fallback
  console.warn('Unable to convert to date:', value);
  return new Date();
}
