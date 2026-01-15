/**
 * Formatting utility functions for the Attendance feature
 */

/**
 * Format time string to HH:MM format
 * @param time - Time string in HH:MM:SS format
 * @returns Formatted time string or "-" if null
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "-";
  return time.substring(0, 5); // HH:MM
}

/**
 * Get progress indicator color based on percentage
 * @param percent - Progress percentage (0-100)
 * @returns Material-UI color name
 */
export function getProgressColor(percent: number): "success" | "warning" | "error" {
  if (percent >= 80) return "success";
  if (percent >= 50) return "warning";
  return "error";
}

/**
 * Format currency amount in Indian Rupees format
 * @param amount - Amount to format
 * @returns Formatted string with Rs. prefix
 */
export function formatCurrency(amount: number): string {
  return `Rs.${amount.toLocaleString("en-IN")}`;
}

/**
 * Format laborer count with proper pluralization
 * @param count - Number of laborers
 * @returns Formatted string
 */
export function formatLaborerCount(count: number): string {
  return count === 1 ? "1 laborer" : `${count} laborers`;
}
