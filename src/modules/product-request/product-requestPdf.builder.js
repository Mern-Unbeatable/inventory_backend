import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import env from '../../config/env.js';

const PAGE_MARGIN = 48;
const FOOTER_RESERVE = 70;
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

/**
 * Builds a Product Request PDF (not an invoice) and pipes it to `outputStream`.
 * Layout mirrors the invoice PDF: SKU under title, equal row padding, branded footer.
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

    // Branding: address + email only (match invoice PDF).
    doc.font('Helvetica').fontSize(9).fillColor('#cbd5e1');
    const companyLines = [env.company.address, env.company.email].filter(Boolean);
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
    drawSingleLineText(
      doc,
      'Request List — Not an Invoice',
      PAGE_MARGIN,
      54,
      contentWidth,
      'right'
    );

    y = 130;

    // Meta + disclaimer
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11);
    drawSingleLineText(doc, 'Product Request', PAGE_MARGIN, y, contentWidth);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
    drawSingleLineText(
      doc,
      `Date: ${dateTime(new Date())}`,
      PAGE_MARGIN,
      y + 16,
      contentWidth
    );
    y += 34;

    doc.fillColor(COLORS.notice).font('Helvetica-Bold').fontSize(8);
    const disclaimer =
      'This document is a product request list for quotation purposes only. It is not a sales invoice, payment request, or order confirmation.';
    const disclaimerHeight = measureTextHeight(doc, disclaimer, contentWidth);
    drawWrappingText(doc, disclaimer, PAGE_MARGIN, y, contentWidth);
    y += disclaimerHeight + 16;

    // Customer card — labeled fields
    const customerLines = [
      `Name: ${customer?.name || '—'}`,
      customer?.email ? `Email: ${customer.email}` : null,
    ].filter(Boolean);
    const cardHeight = Math.max(72, 26 + customerLines.length * 14 + 12);
    y = ensurePageSpace(doc, y, cardHeight + 16);

    doc.save();
    doc.roundedRect(PAGE_MARGIN, y, contentWidth, cardHeight, 6).fill(COLORS.soft);
    doc.restore();
    doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(9);
    drawSingleLineText(
      doc,
      'REQUESTED BY',
      PAGE_MARGIN + 12,
      y + 10,
      contentWidth - 24
    );
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
    let lineY = y + 26;
    customerLines.forEach((line) => {
      const h = drawWrappingText(
        doc,
        line,
        PAGE_MARGIN + 12,
        lineY,
        contentWidth - 24
      );
      lineY += h + 2;
    });
    y += cardHeight + 24;

    // Table — SKU under product title (same as invoice PDF)
    const columns = [
      { key: 'product', label: 'Product', width: 286, align: 'left', wrap: true },
      { key: 'qty', label: 'Qty', width: 36, align: 'right', wrap: false },
      { key: 'unit', label: 'Unit Price', width: 84, align: 'right', wrap: false },
      { key: 'total', label: 'Line Total', width: 93, align: 'right', wrap: false },
    ];

    const TABLE_HEADER_HEIGHT = 22;
    const ROW_PAD_Y = 4;
    const PRODUCT_TITLE_SIZE = 8;
    const PRODUCT_SKU_SIZE = 7;
    const PRODUCT_SKU_GAP = 1;
    const textOpts = { lineGap: 0, lineBreak: true };

    const measureProductCellHeight = (title, sku, cellWidth) => {
      doc.font('Helvetica').fontSize(PRODUCT_TITLE_SIZE);
      let height = measureTextHeight(doc, title || '—', cellWidth, textOpts);
      if (sku) {
        doc.font('Helvetica').fontSize(PRODUCT_SKU_SIZE);
        height +=
          PRODUCT_SKU_GAP +
          measureTextHeight(doc, `SKU: ${sku}`, cellWidth, textOpts);
      }
      return height;
    };

    const drawTableHeader = () => {
      doc.save();
      doc
        .rect(PAGE_MARGIN, y, contentWidth, TABLE_HEADER_HEIGHT)
        .fill(COLORS.accent);
      doc.restore();
      let x = PAGE_MARGIN;
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      columns.forEach((col) => {
        drawSingleLineText(
          doc,
          col.label,
          x + 6,
          y + 7,
          col.width - 12,
          col.align
        );
        x += col.width;
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
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const lineTotal =
        item.lineTotal != null
          ? Number(item.lineTotal) || 0
          : Math.round(unitPrice * quantity * 100) / 100;

      const productTitle = item.product?.title || '—';
      const productSku = item.product?.sku || '';
      const cells = {
        product: productTitle,
        qty: String(quantity),
        unit: money(unitPrice),
        total: money(lineTotal),
      };

      const productCol = columns[0];
      const productCellWidth = productCol.width - 12;
      const productContentHeight = measureProductCellHeight(
        productTitle,
        productSku,
        productCellWidth
      );
      const rowHeight = Math.ceil(productContentHeight + ROW_PAD_Y * 2);
      ensureTableRowSpace(rowHeight);

      if (index % 2 === 0) {
        doc.save();
        doc.rect(PAGE_MARGIN, y, contentWidth, rowHeight).fill(COLORS.rowAlt);
        doc.restore();
      }

      let x = PAGE_MARGIN;
      const textY = y + ROW_PAD_Y;

      columns.forEach((col) => {
        const cellWidth = col.width - 12;
        const value = cells[col.key];

        if (col.key === 'product') {
          doc
            .fillColor(COLORS.ink)
            .font('Helvetica')
            .fontSize(PRODUCT_TITLE_SIZE);
          const titleHeight = drawWrappingText(
            doc,
            productTitle,
            x + 6,
            textY,
            cellWidth,
            { align: col.align, ...textOpts }
          );
          if (productSku) {
            doc
              .fillColor(COLORS.muted)
              .font('Helvetica')
              .fontSize(PRODUCT_SKU_SIZE);
            drawWrappingText(
              doc,
              `SKU: ${productSku}`,
              x + 6,
              textY + titleHeight + PRODUCT_SKU_GAP,
              cellWidth,
              { align: col.align, ...textOpts }
            );
          }
        } else {
          doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8);
          drawSingleLineText(doc, value, x + 6, textY, cellWidth, col.align);
        }
        x += col.width;
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
    const websiteUrl = env.company.website || '';
    const generatedLine = `Generated: ${dateTime(new Date())}   ·   Generated by: ${
      generatedBy || 'Customer'
    }   ·   ${footerText}`;

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
      drawSingleLineText(
        doc,
        generatedLine,
        PAGE_MARGIN,
        footerTop + 10,
        contentWidth
      );
      if (websiteUrl) {
        drawSingleLineText(
          doc,
          websiteUrl,
          PAGE_MARGIN,
          footerTop + 24,
          contentWidth
        );
      }
    }

    doc.on('end', resolve);
    doc.end();
  });
