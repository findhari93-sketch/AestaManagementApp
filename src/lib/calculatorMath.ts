export type LengthUnit = 'ft' | 'in';

/** Convert a value to feet. */
export function toFeet(value: number, unit: LengthUnit): number {
  return unit === 'in' ? value / 12 : value;
}

/**
 * Calculate cubic feet (Gana adi) from timber dimensions.
 * Length can be ft or in; width and thickness are typically in inches but accept ft too.
 */
export function calculateCubicFeet(
  length: number, lengthUnit: LengthUnit,
  width: number, widthUnit: LengthUnit,
  thickness: number, thicknessUnit: LengthUnit,
  qty: number,
): number {
  return toFeet(length, lengthUnit)
    * toFeet(width, widthUnit)
    * toFeet(thickness, thicknessUnit)
    * qty;
}

/** Format a cft value with 3 decimal places. */
export function formatCft(cft: number): string {
  return `${cft.toFixed(3)} cft`;
}

/** qty × unit price = total cost */
export function calculateLinearCost(qty: number, unitPrice: number): number {
  return qty * unitPrice;
}

/** Format a number as Indian Rupees (no decimals).
 * Manual formatter avoids Node.js vs browser Intl locale divergence
 * that causes React hydration mismatches on SSR-ed pages.
 */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  const str = Math.abs(rounded).toString();
  let formatted: string;
  if (str.length <= 3) {
    formatted = str;
  } else {
    const last3 = str.slice(-3);
    const rest = str.slice(0, -3);
    formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return (rounded < 0 ? '-₹' : '₹') + formatted;
}
