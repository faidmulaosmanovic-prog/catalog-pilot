import { IMPORT_TARGET_FIELDS, type ImportTargetField } from "@/server/db/schema/constants";

const DELIMITERS = [",", ";", "\t", "|"] as const;

const ALIASES: Record<ImportTargetField, string[]> = {
  sku: ["sku", "item sku", "seller sku", "variant sku"],
  title: ["title", "name", "product title", "item name"],
  description: ["description", "body", "body html", "product description"],
  brand: ["brand", "manufacturer", "brand name"],
  price: ["price", "variant price", "regular price"],
  currency: ["currency"],
  quantity: ["qty", "quantity", "inventory", "stock"],
  barcode: ["upc", "ean", "gtin", "barcode"],
  image_url: ["image", "image src", "image url", "main image"],
  status: ["status"],
};

export function decodeCatalogFile(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: bytes.subarray(3).toString("utf8"), encoding: "utf-8-sig" };
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text, encoding: "utf-8" };
  } catch {
    return { text: bytes.toString("latin1"), encoding: "windows-1252" };
  }
}

export function parseCsv(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}

export function detectDelimiter(text: string) {
  let best: string = ",";
  let bestScore = -1;
  for (const delimiter of DELIMITERS) {
    const rows = parseCsv(text, delimiter).slice(0, 20);
    const width = rows[0]?.length ?? 0;
    if (width < 2) {
      continue;
    }
    const consistent = rows.filter((row) => row.length === width).length;
    const score = consistent * 100 + width;
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

export function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function suggestMappings(headers: string[]) {
  const used = new Set<ImportTargetField>();
  const suggestions: Array<{ sourceColumn: string; targetField: ImportTargetField; confidence: number }> = [];
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let match: { target: ImportTargetField; confidence: number } | null = null;
    for (const target of IMPORT_TARGET_FIELDS) {
      if (used.has(target)) {
        continue;
      }
      const aliases = ALIASES[target];
      if (aliases.includes(normalized)) {
        match = { target, confidence: 0.99 };
        break;
      }
    }
    if (match) {
      used.add(match.target);
      suggestions.push({
        sourceColumn: header,
        targetField: match.target,
        confidence: match.confidence,
      });
    }
  }
  return suggestions;
}

export function readCatalogTable(bytes: Buffer) {
  const decoded = decodeCatalogFile(bytes);
  const delimiter = detectDelimiter(decoded.text);
  const table = parseCsv(decoded.text, delimiter);
  const headers = (table[0] ?? []).map((header) => header.trim());
  return {
    encoding: decoded.encoding,
    delimiter,
    headers,
    rows: table.slice(1),
  };
}
