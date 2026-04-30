// Repairs storage URLs corrupted by a pre-2026-02-25 FileUploader bug that
// double-prefixed the bucket name (e.g. ".../public/payment-proofs/payment-proofs/...").
// The actual object lives at the un-doubled path, so stripping the duplicate
// segment makes historical proofs viewable again.
const KNOWN_BUCKETS = [
  "payment-proofs",
  "settlement-proofs",
  "work-updates",
  "vendor-photos",
  "vendor-qr",
  "tea-shop-qr",
  "contract-documents",
];

export function sanitizeStorageUrl(url: string | null | undefined): string {
  if (!url) return "";
  for (const bucket of KNOWN_BUCKETS) {
    const doubled = `/${bucket}/${bucket}/`;
    const fixed = `/${bucket}/`;
    if (url.includes(doubled)) {
      return url.split(doubled).join(fixed);
    }
  }
  return url;
}
