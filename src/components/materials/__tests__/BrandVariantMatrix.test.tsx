import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Stub out image avatar — not needed for these tests
vi.mock("@/components/common/EntityImageAvatar", () => ({
  EntityImageAvatar: () => <span data-testid="entity-avatar" />,
}));
import { BrandsTabContent } from "../MaterialInspectPane";
import type { BrandWithVariantLinks } from "@/types/material.types";
import type { Material } from "@/types/material.types";

const BASE_MATERIAL: Partial<Material> = {
  id: "m1",
  name: "Test",
  code: null,
  local_name: null,
  category_id: null,
  parent_id: null,
  description: null,
  unit: "BAG",
  secondary_unit: null,
  conversion_factor: null,
  hsn_code: null,
  gst_rate: null,
  specifications: null,
  weight_per_unit: null,
  weight_unit: null,
  length_per_piece: null,
  length_unit: null,
  rods_per_bundle: null,
  min_order_qty: null,
  reorder_level: null,
  image_url: null,
  is_active: true,
  created_at: "",
  updated_at: "",
  created_by: null,
};

const mockVariants: Material[] = [
  { ...BASE_MATERIAL, id: "v1", name: "43 Grade", parent_id: "m1" } as Material,
  { ...BASE_MATERIAL, id: "v2", name: "53 Grade", parent_id: "m1" } as Material,
];

const mockBrandLinks: BrandWithVariantLinks[] = [
  {
    id: "b1",
    material_id: "m1",
    brand_name: "Ultratech",
    variant_name: null,
    is_preferred: true,
    quality_rating: 5,
    notes: null,
    image_url: null,
    is_active: true,
    created_at: "",
    material_brand_variant_links: [
      { id: "l1", brand_id: "b1", variant_id: "v1", is_active: true, image_url: null, created_at: "" },
      { id: "l2", brand_id: "b1", variant_id: "v2", is_active: false, image_url: null, created_at: "" },
    ],
  },
  {
    id: "b2",
    material_id: "m1",
    brand_name: "ACC",
    variant_name: null,
    is_preferred: false,
    quality_rating: 4,
    notes: null,
    image_url: null,
    is_active: true,
    created_at: "",
    material_brand_variant_links: [],
  },
];

describe("BrandsTabContent", () => {
  it("renders one card per brand", () => {
    render(<BrandsTabContent brandLinks={mockBrandLinks} variants={mockVariants} />);
    expect(screen.getAllByText("Ultratech")).toHaveLength(1);
    expect(screen.getAllByText("ACC")).toHaveLength(1);
  });

  it("shows a filled chip for linked variant (is_active=true)", () => {
    render(<BrandsTabContent brandLinks={mockBrandLinks} variants={mockVariants} />);
    const chip = screen.getByTestId("variant-chip-b1-v1");
    expect(chip).toHaveClass("MuiChip-filled");
  });

  it("shows an outlined chip for unlinked variant (is_active=false)", () => {
    render(<BrandsTabContent brandLinks={mockBrandLinks} variants={mockVariants} />);
    const chip = screen.getByTestId("variant-chip-b1-v2");
    expect(chip).toHaveClass("MuiChip-outlined");
  });

  it("shows all variant chips even when brand has no links", () => {
    render(<BrandsTabContent brandLinks={mockBrandLinks} variants={mockVariants} />);
    // ACC has no links — variants should still render as outlined (unlinked/unknown)
    expect(screen.getByTestId("variant-chip-b2-v1")).toBeInTheDocument();
    expect(screen.getByTestId("variant-chip-b2-v2")).toBeInTheDocument();
  });

  it("shows empty state when no brands", () => {
    render(<BrandsTabContent brandLinks={[]} variants={[]} />);
    expect(screen.getByText(/no brands/i)).toBeInTheDocument();
  });
});
