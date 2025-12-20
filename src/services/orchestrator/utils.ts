/**
 * Session ID Generator
 * Utilities for generating unique session identifiers
 */

/**
 * Generate a unique session ID based on current timestamp
 * Format: session_YYYYMMDD_HHMMSS
 */
export function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `session_${date}_${time}`;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
