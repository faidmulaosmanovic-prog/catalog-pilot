export type MappingRule = {
  targetColumn: string;
  source:
    | { type: "field"; path: string }
    | { type: "attribute"; key: string }
    | { type: "literal"; value: string }
    | { type: "transform"; name: string };
};

export type TemplateSchema = {
  headers: string[];
  requiredFields: string[];
  allowedValues?: Record<string, string[]>;
  mappingRules: MappingRule[];
};

export const SHOPIFY_TEMPLATE_2026_1: TemplateSchema = {
  headers: [
    "Handle",
    "Title",
    "Body (HTML)",
    "Vendor",
    "Published",
    "Option1 Name",
    "Option1 Value",
    "Variant SKU",
    "Variant Price",
    "Variant Inventory Qty",
    "Variant Barcode",
    "Image Src",
    "Status",
  ],
  requiredFields: ["Variant SKU"],
  allowedValues: {
    Published: ["TRUE", "FALSE"],
    Status: ["active", "draft", "archived"],
  },
  mappingRules: [
    { targetColumn: "Handle", source: { type: "transform", name: "handle" } },
    { targetColumn: "Title", source: { type: "field", path: "title" } },
    { targetColumn: "Body (HTML)", source: { type: "field", path: "description" } },
    { targetColumn: "Vendor", source: { type: "field", path: "brand" } },
    { targetColumn: "Published", source: { type: "transform", name: "published" } },
    { targetColumn: "Option1 Name", source: { type: "field", path: "option1Name" } },
    { targetColumn: "Option1 Value", source: { type: "field", path: "option1Value" } },
    { targetColumn: "Variant SKU", source: { type: "field", path: "sku" } },
    { targetColumn: "Variant Price", source: { type: "field", path: "price" } },
    { targetColumn: "Variant Inventory Qty", source: { type: "field", path: "quantity" } },
    { targetColumn: "Variant Barcode", source: { type: "field", path: "barcode" } },
    { targetColumn: "Image Src", source: { type: "field", path: "imageUrl" } },
    { targetColumn: "Status", source: { type: "field", path: "status" } },
  ],
};

export const AMAZON_TEMPLATE_2026_1: TemplateSchema = {
  headers: [
    "sku",
    "product-id",
    "product-id-type",
    "item-name",
    "brand-name",
    "item-price",
    "quantity",
    "main-image-url",
    "product-description",
  ],
  requiredFields: ["sku", "item-name", "item-price"],
  allowedValues: {
    "product-id-type": ["", "UPC", "EAN", "GTIN"],
  },
  mappingRules: [
    { targetColumn: "sku", source: { type: "field", path: "sku" } },
    { targetColumn: "product-id", source: { type: "field", path: "barcode" } },
    { targetColumn: "product-id-type", source: { type: "transform", name: "productIdType" } },
    { targetColumn: "item-name", source: { type: "field", path: "title" } },
    { targetColumn: "brand-name", source: { type: "field", path: "brand" } },
    { targetColumn: "item-price", source: { type: "field", path: "price" } },
    { targetColumn: "quantity", source: { type: "field", path: "quantity" } },
    { targetColumn: "main-image-url", source: { type: "field", path: "imageUrl" } },
    { targetColumn: "product-description", source: { type: "field", path: "description" } },
  ],
};
