import crypto from "crypto";

export function generateKey(prefix = "KEY"): string {
  const random = crypto.randomBytes(12).toString("hex").toUpperCase();
  return `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}-${random.slice(8, 12)}`;
}

export function parseChannelIds(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/[<#>]/g, ""))
    .filter(Boolean);
}

export function parseImageUrls(options: Record<string, unknown>): string[] {
  const images: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const val = options[`image${i}`];
    if (val && typeof val === "string") images.push(val);
  }
  return images;
}
