import type { WeightCalculation } from "@/types/material.types";

/**
 * Calculate total weight from quantity for materials with weight_per_unit
 */
export function calculateWeight(
  weightPerUnit: number | null | undefined,
  quantity: number,
  weightUnit: string = "kg"
): WeightCalculation | null {
  if (!weightPerUnit || weightPerUnit <= 0 || quantity <= 0) {
    return null;
  }

  const totalWeight = quantity * weightPerUnit;

  return {
    pieces: quantity,
    totalWeight,
    weightUnit,
    weightPerUnit,
    displayText: `${quantity} pcs = ${formatWeight(totalWeight)} ${weightUnit}`,
  };
}

/**
 * Format weight with appropriate decimal places
 */
export function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return (weight / 1000).toFixed(2);
  }
  if (weight >= 100) {
    return weight.toFixed(1);
  }
  if (weight >= 1) {
    return weight.toFixed(2);
  }
  return weight.toFixed(3);
}

/**
 * Convert weight between units
 */
export function convertWeight(
  weight: number,
  fromUnit: string,
  toUnit: string
): number {
  const toKg: Record<string, number> = {
    g: 0.001,
    kg: 1,
    ton: 1000,
  };

  const weightInKg = weight * (toKg[fromUnit] || 1);
  return weightInKg / (toKg[toUnit] || 1);
}

/**
 * Format weight with automatic unit conversion for large values
 */
export function formatWeightWithUnit(
  weight: number | null | undefined,
  unit: string = "kg"
): string {
  if (weight === null || weight === undefined) return "-";

  // Convert large kg values to tons
  if (unit === "kg" && weight >= 1000) {
    return `${(weight / 1000).toFixed(2)} ton`;
  }
  // Convert large g values to kg
  if (unit === "g" && weight >= 1000) {
    return `${(weight / 1000).toFixed(2)} kg`;
  }

  return `${formatWeight(weight)} ${unit}`;
}

/**
 * Format quantity with weight equivalent
 */
export function formatQuantityWithWeight(
  quantity: number | null | undefined,
  unit: string,
  weightPerUnit: number | null | undefined,
  weightUnit: string = "kg"
): string {
  if (quantity === null || quantity === undefined) return "-";

  const baseText = `${quantity.toLocaleString("en-IN")} ${unit}`;

  if (weightPerUnit && weightPerUnit > 0) {
    const totalWeight = quantity * weightPerUnit;
    return `${baseText} (${formatWeightWithUnit(totalWeight, weightUnit)})`;
  }

  return baseText;
}

// Common TMT bar weights per piece (12m standard length)
export const TMT_WEIGHTS: Record<string, number> = {
  "6mm": 0.222, // kg per 12m piece
  "8mm": 0.395,
  "10mm": 0.617,
  "12mm": 0.888,
  "16mm": 1.58,
  "20mm": 2.469,
  "25mm": 3.858,
  "32mm": 6.316,
};

// Standard rods per bundle for different TMT sizes
export const TMT_RODS_PER_BUNDLE: Record<string, number> = {
  "6mm": 12,
  "8mm": 10,
  "10mm": 7,
  "12mm": 5,
  "16mm": 3,
  "20mm": 2,
  "25mm": 2,
  "32mm": 2,
};

// Standard length for TMT bars in meters
export const TMT_STANDARD_LENGTH = 12;
