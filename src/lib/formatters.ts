/**
 * Formatting utilities for the application
 */

/**
 * Format amount as Indian Rupees
 * Shows lakhs (L) for amounts >= 1 lakh
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "₹0";

  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format amount as Indian Rupees (full format)
 * Always shows full amount without abbreviation
 */
export function formatCurrencyFull(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "₹0";

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format date as DD MMM YYYY (e.g., 15 Dec 2024)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";

  const d = typeof date === "string" ? new Date(date) : date;

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format date as DD/MM/YYYY
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return "-";

  const d = typeof date === "string" ? new Date(date) : date;

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format date and time
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";

  const d = typeof date === "string" ? new Date(date) : date;

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format time as HH:MM AM/PM
 */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return "-";

  const d = typeof date === "string" ? new Date(date) : date;

  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "-";

  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (Math.abs(diffMins) < 60) {
    if (diffMins === 0) return "just now";
    return diffMins > 0
      ? `in ${diffMins} min${diffMins === 1 ? "" : "s"}`
      : `${Math.abs(diffMins)} min${Math.abs(diffMins) === 1 ? "" : "s"} ago`;
  }

  if (Math.abs(diffHours) < 24) {
    return diffHours > 0
      ? `in ${diffHours} hour${diffHours === 1 ? "" : "s"}`
      : `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? "" : "s"} ago`;
  }

  if (Math.abs(diffDays) <= 30) {
    return diffDays > 0
      ? `in ${diffDays} day${diffDays === 1 ? "" : "s"}`
      : `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`;
  }

  return formatDate(d);
}

/**
 * Format number with Indian numbering system (lakhs, crores)
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0";

  return num.toLocaleString("en-IN");
}

/**
 * Format percentage
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value === null || value === undefined) return "0%";

  return `${value.toFixed(decimals)}%`;
}

/**
 * Format phone number for display
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";

  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Format as +91 XXXXX XXXXX for Indian numbers
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  return phone;
}

/**
 * Format quantity with unit
 */
export function formatQuantity(
  quantity: number | null | undefined,
  unit: string
): string {
  if (quantity === null || quantity === undefined) return "-";

  return `${quantity.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${unit}`;
}
