import ExcelJS from "exceljs";

/** Columns used for both export and import templates. */
export const PRODUCT_IMPORT_HEADERS = [
  "title",
  "sku",
  "description",
  "price",
  "quantity",
  "assignUserId",
];

/** Export includes optional read-only context columns after the importable ones. */
export const PRODUCT_EXPORT_HEADERS = [
  ...PRODUCT_IMPORT_HEADERS,
  "ownerName",
  "createdAt",
];

const normalizeHeader = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

const HEADER_ALIASES = {
  title: "title",
  name: "title",
  productname: "title",
  product: "title",
  sku: "sku",
  description: "description",
  desc: "description",
  price: "price",
  quantity: "quantity",
  qty: "quantity",
  stock: "quantity",
  assignuserid: "assignUserId",
  sellerid: "assignUserId",
  seller: "assignUserId",
};

const escapeCsv = (value) => {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const productsToCsv = (rows) => {
  const lines = [PRODUCT_EXPORT_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      PRODUCT_EXPORT_HEADERS.map((key) => escapeCsv(row[key] ?? "")).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
};

export const productsToXlsxBuffer = async (rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.columns = PRODUCT_EXPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: header === "description" ? 40 : 18,
  }));
  for (const row of rows) {
    sheet.addRow(row);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const productsToJson = (rows) =>
  `${JSON.stringify(rows, null, 2)}\n`;

const pickImportFields = (item, rowNumber) => {
  const row = { __rowNumber: rowNumber };
  PRODUCT_IMPORT_HEADERS.forEach((key) => {
    if (item?.[key] == null) return;
    row[key] = item[key];
  });
  // Accept common aliases on JSON objects too
  if (row.title == null && item?.name != null) row.title = item.name;
  if (row.quantity == null && item?.stock != null) row.quantity = item.stock;
  if (row.quantity == null && item?.qty != null) row.quantity = item.qty;
  if (row.assignUserId == null && item?.sellerId != null) {
    row.assignUserId = item.sellerId;
  }
  return row;
};

export const parseJsonToRows = (text) => {
  let parsed;
  try {
    parsed = JSON.parse(String(text || "").replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Invalid JSON file");
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.products)
      ? parsed.products
      : Array.isArray(parsed?.items)
        ? parsed.items
        : null;

  if (!list) {
    throw new Error(
      "JSON must be an array of products, or an object with a products/items array",
    );
  }

  return list.map((item, index) => pickImportFields(item, index + 1));
};

const parseCsvLine = (line) => {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
};

export const parseCsvToRows = (text) => {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map(
    (header) => HEADER_ALIASES[normalizeHeader(header)] || null,
  );

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const row = { __rowNumber: index + 2 };
    headers.forEach((key, cellIndex) => {
      if (!key) return;
      row[key] = cells[cellIndex] ?? "";
    });
    return row;
  });
};

export const parseXlsxToRows = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] =
      HEADER_ALIASES[normalizeHeader(cell.value)] || null;
  });

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const mapped = { __rowNumber: rowNumber };
    let hasValue = false;
    headers.forEach((key, colNumber) => {
      if (!key) return;
      const cell = row.getCell(colNumber);
      let value = cell.value;
      if (value && typeof value === "object" && "text" in value) {
        value = value.text;
      }
      if (value == null) value = "";
      mapped[key] = typeof value === "string" ? value : String(value);
      if (String(mapped[key]).trim()) hasValue = true;
    });
    if (hasValue) rows.push(mapped);
  });

  return rows;
};

export const mapProductToExportRow = (product) => ({
  title: product.title || "",
  sku: product.sku || "",
  description: product.description || "",
  price: product.price ?? 0,
  quantity: product.quantity ?? product.totalQuantity ?? 0,
  assignUserId: "",
  ownerName: product.owner?.name || product.ownerName || "",
  createdAt: product.createdAt
    ? new Date(product.createdAt).toISOString().slice(0, 10)
    : "",
});
