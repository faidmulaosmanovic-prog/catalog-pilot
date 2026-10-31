export function escapeCsv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: Array<Record<string, string>>) {
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? "")).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function toHandle(title: string | null, sku: string) {
  const source = (title?.trim() || sku).toLowerCase();
  const handle = source
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return handle || sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function productIdType(barcode: string) {
  if (/^\d{12}$/.test(barcode)) return "UPC";
  if (/^\d{13}$/.test(barcode)) return "EAN";
  if (/^\d{8}$/.test(barcode) || /^\d{14}$/.test(barcode)) return "GTIN";
  return "";
}
