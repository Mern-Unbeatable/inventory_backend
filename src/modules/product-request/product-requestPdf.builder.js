import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import env from '../../config/env.js';

const PAGE_MARGIN = 48;
const FOOTER_RESERVE = 56;
const COLORS = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  headerBg: '#0f172a',
  headerText: '#ffffff',
  accent: '#1e293b',
  soft: '#f8fafc',
  rowAlt: '#f1f5f9',
  notice: '#b45309',
};

const money = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);

const dateOnly = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const dateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const resolveLogoPath = () => {
  const configured = env.company.logoPath?.trim();
  if (!configured) return null;
  const absolute = path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
  return fs.existsSync(absolute) ? absolute : null;
};

const checkRemainingPageSpace = (doc, y) => {
  const bottom = doc.page.height - PAGE_MARGIN - FOOTER_RESERVE;
  return Math.max(0, bottom - y);
};

const ensurePageSpace = (doc, y, needed, onNewPage) => {
  if (needed <= 0) return y;
  if (checkRemainingPageSpace(doc, y) >= needed) return y;
  doc.addPage();
  const nextY = PAGE_MARGIN;
  if (typeof onNewPage === 'function') onNewPage();
  return nextY;
};

const measureTextHeight = (doc, text, width, options = {}) => {
  const value = text == null || text === '' ? ' ' : String(text);
  return doc.heightOfString(value, { width, lineBreak: true, ...options });
};

const drawSingleLineText = (doc, text, x, y, width, align = 'left') => {
  const value = text == null || text === '' ? '—' : String(text);
  doc.text(value, x, y, { width, align, lineBreak: false, ellipsis: true });
};

const drawWrappingText = (doc, text, x, y, width, options = {}) => {
  const value = text == null || text === '' ? ' ' : String(text);
  const height = measureTextHeight(doc, value, width, options);
  doc.text(value, x, y, { width, lineBreak: true, ...options });
  return height;
};

const CELL_PAD_X = 6;
const CELL_PAD_Y = 6;
const TABLE_HEADER_HEIGHT = 22;
const BODY_FONT_SIZE = 8;

/** Column widths always sum to `contentWidth` so header/body share one grid. */
const buildTableColumns = (contentWidth) => {
  const sku = 95;
  const qty = 40;
  const unit = 85;
  const total = 89;
  const product = contentWidth - sku - qty - unit - total;

  return [
    { key: 'product', label: 'Product', width: product, align: 'left', wrap: true },
    { key: 'sku', label: 'SKU', width: sku, align: 'left', wrap: false },
    { key: 'qty', label: 'Qty', width: qty, align: 'right', wrap: false },
    { key: 'unit', label: 'Unit Price', width: unit, align: 'right', wrap: false },
    { key: 'total', label: 'Line Total', width: total, align: 'right', wrap: false },
  ];
};

const getColumnStarts = (columns, startX) => {
  let x = startX;
  return columns.map((col) => {
    const left = x;
    x += col.width;
    return left;
  });
};

const calculateRowHeight = (doc, cells, columns, paddingY = CELL_PAD_Y) => {
  let maxContent = 10;
  doc.font('Helvetica').fontSize(BODY_FONT_SIZE);

  columns.forEach((col) => {
    const cellWidth = col.width - CELL_PAD_X * 2;
    const value = cells[col.key] ?? '—';
    if (col.wrap) {
      const h = measureTextHeight(doc, value, cellWidth);
      maxContent = Math.max(maxContent, h);
    } else {
      maxContent = Math.max(maxContent, 10);
    }
  });

  return Math.ceil(maxContent + paddingY * 2);
};

const drawTableCell = (doc, { text, x, y, width, align, wrap, rowHeight, font = 'Helvetica' }) => {
  const cellWidth = width - CELL_PAD_X * 2;
  const innerX = x + CELL_PAD_X;
  const contentHeight = wrap
    ? measureTextHeight(doc, text, cellWidth)
    : BODY_FONT_SIZE + 1;
  const textY = y + Math.max(CELL_PAD_Y, (rowHeight - contentHeight) / 2);

  doc.font(font).fontSize(BODY_FONT_SIZE);
  if (wrap) {
    drawWrappingText(doc, text, innerX, textY, cellWidth, { align });
  } else {
    drawSingleLineText(doc, text, innerX, textY, cellWidth, align);
  }
};

/**
 * Builds a Product Request PDF (not an invoice) and pipes it to `outputStream`.
 */
export const buildProductRequestPdf = ({
  customer,
  items,
  grandTotal,
  generatedBy,
  outputStream,
}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: 'Product Request',
        Author: env.company.name,
        Subject: 'Product Request List',
      },
    });

    doc.on('error', reject);
    outputStream.on('error', reject);
    doc.pipe(outputStream);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    let y = PAGE_MARGIN;

    // Brand header
    doc.save();
    doc.rect(0, 0, pageWidth, 110).fill(COLORS.headerBg);
    doc.restore();

    const logoPath = resolveLogoPath();
    let headerTextX = PAGE_MARGIN;
    if (logoPath) {
      try {
        doc.image(logoPath, PAGE_MARGIN, 28, { height: 48, fit: [120, 48] });
        headerTextX = PAGE_MARGIN + 130;
      } catch {
        // ignore unreadable logo
      }
    }

    doc
      .fillColor(COLORS.headerText)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(env.company.name, headerTextX, 30, {
        width: contentWidth - (headerTextX - PAGE_MARGIN) - 160,
        lineBreak: true,
      });

    doc.font('Helvetica').fontSize(9).fillColor('#cbd5e1');
    const companyLines = [
      env.company.address,
      [env.company.phone, env.company.email].filter(Boolean).join(' · '),
    ].filter(Boolean);
    companyLines.forEach((line, index) => {
      drawSingleLineText(
        doc,
        line,
        headerTextX,
        54 + index * 12,
        contentWidth - (headerTextX - PAGE_MARGIN) - 160
      );
    });

    doc.fillColor(COLORS.headerText).font('Helvetica-Bold').fontSize(18);
    drawSingleLineText(
      doc,
      'PRODUCT REQUEST',
      PAGE_MARGIN,
      34,
      contentWidth,
      'right'
    );
    doc.font('Helvetica').fontSize(9).fillColor('#cbd5e1');
    drawSingleLineText(doc, 'Request List — Not an Invoice', PAGE_MARGIN, 54, contentWidth, 'right');

    y = 130;

    // Meta + disclaimer
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11);
    drawSingleLineText(doc, 'Product Request', PAGE_MARGIN, y, contentWidth);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
    drawSingleLineText(doc, `Date: ${dateOnly(new Date())}`, PAGE_MARGIN, y + 16, contentWidth);
    y += 34;

    doc.fillColor(COLORS.notice).font('Helvetica-Bold').fontSize(8);
    const disclaimer =
      'This document is a product request list for quotation purposes only. It is not a sales invoice, payment request, or order confirmation.';
    const disclaimerHeight = measureTextHeight(doc, disclaimer, contentWidth);
    drawWrappingText(doc, disclaimer, PAGE_MARGIN, y, contentWidth);
    y += disclaimerHeight + 16;

    // Customer card
    const customerLines = [customer?.name || '—', customer?.email || null].filter(Boolean);
    const cardHeight = Math.max(72, 26 + customerLines.length * 14 + 12);
    y = ensurePageSpace(doc, y, cardHeight + 16);

    doc.save();
    doc.roundedRect(PAGE_MARGIN, y, contentWidth, cardHeight, 6).fill(COLORS.soft);
    doc.restore();
    doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(9);
    drawSingleLineText(doc, 'REQUESTED BY', PAGE_MARGIN + 12, y + 10, contentWidth - 24);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
    let lineY = y + 26;
    customerLines.forEach((line) => {
      const h = drawWrappingText(doc, line, PAGE_MARGIN + 12, lineY, contentWidth - 24);
      lineY += h + 2;
    });
    y += cardHeight + 24;

    // Table — column grid spans full content width (matches invoice PDF layout)
    const columns = buildTableColumns(contentWidth);
    const columnStarts = getColumnStarts(columns, PAGE_MARGIN);

    const drawTableHeader = () => {
      doc.save();
      doc.rect(PAGE_MARGIN, y, contentWidth, TABLE_HEADER_HEIGHT).fill(COLORS.accent);
      doc.restore();

      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(BODY_FONT_SIZE);
      columns.forEach((col, index) => {
        drawTableCell(doc, {
          text: col.label,
          x: columnStarts[index],
          y,
          width: col.width,
          align: col.align,
          wrap: false,
          rowHeight: TABLE_HEADER_HEIGHT,
          font: 'Helvetica-Bold',
        });
      });
      y += TABLE_HEADER_HEIGHT;
    };

    const ensureTableRowSpace = (rowHeight) => {
      if (checkRemainingPageSpace(doc, y) >= rowHeight) return;
      doc.addPage();
      y = PAGE_MARGIN;
      drawTableHeader();
    };

    y = ensurePageSpace(doc, y, 18 + TABLE_HEADER_HEIGHT + 24);
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10);
    drawSingleLineText(doc, 'Requested Items', PAGE_MARGIN, y, contentWidth);
    y += 18;
    drawTableHeader();

    (items || []).forEach((item, index) => {
      const cells = {
        product: item.product?.title || '—',
        sku: item.product?.sku || '—',
        qty: String(item.quantity ?? 0),
        unit: money(item.unitPrice),
        total: money(item.lineTotal),
      };

      const rowHeight = calculateRowHeight(doc, cells, columns);
      ensureTableRowSpace(rowHeight);

      if (index % 2 === 0) {
        doc.save();
        doc.rect(PAGE_MARGIN, y, contentWidth, rowHeight).fill(COLORS.rowAlt);
        doc.restore();
      }

      doc.fillColor(COLORS.ink);
      columns.forEach((col, colIndex) => {
        drawTableCell(doc, {
          text: cells[col.key],
          x: columnStarts[colIndex],
          y,
          width: col.width,
          align: col.align,
          wrap: col.wrap,
          rowHeight,
        });
      });

      y += rowHeight;
    });

    doc
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + contentWidth, y)
      .strokeColor(COLORS.line)
      .lineWidth(1)
      .stroke();
    y += 16;

    const summaryHeight = 24;
    y = ensurePageSpace(doc, y, summaryHeight);
    const summaryX = PAGE_MARGIN + contentWidth - 220;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.muted);
    drawSingleLineText(doc, 'Grand Total', summaryX, y, 110);
    doc.fillColor(COLORS.ink);
    drawSingleLineText(doc, money(grandTotal), summaryX + 110, y, 110, 'right');
    y += summaryHeight + 8;

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
    drawSingleLineText(
      doc,
      'Please share this request with our team to proceed. No payment is required at this stage.',
      PAGE_MARGIN,
      y,
      contentWidth
    );

    const footerText =
      env.company.footer || 'Thank you for your interest in our products.';
    const generatedLine = `Generated: ${dateTime(new Date())}   ·   Generated by: ${
      generatedBy || 'Customer'
    }`;

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      const footerTop = doc.page.height - PAGE_MARGIN - FOOTER_RESERVE + 8;
      doc
        .moveTo(PAGE_MARGIN, footerTop)
        .lineTo(PAGE_MARGIN + contentWidth, footerTop)
        .strokeColor(COLORS.line)
        .lineWidth(1)
        .stroke();
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
      drawSingleLineText(doc, generatedLine, PAGE_MARGIN, footerTop + 10, contentWidth);
      drawSingleLineText(doc, footerText, PAGE_MARGIN, footerTop + 24, contentWidth);
    }

    doc.on('end', resolve);
    doc.end();
  });
