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

const labelize = (value) =>
  String(value || '—')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const resolveLogoPath = () => {
  const configured = env.company.logoPath?.trim();
  if (!configured) return null;
  const absolute = path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
  return fs.existsSync(absolute) ? absolute : null;
};

/** Remaining usable height above footer reserve. */
const checkRemainingPageSpace = (doc, y) => {
  const bottom = doc.page.height - PAGE_MARGIN - FOOTER_RESERVE;
  return Math.max(0, bottom - y);
};

/**
 * Ensures `needed` points fit on the current page.
 * Adds a blank page (no invoice header) only when space is insufficient.
 * Returns the (possibly reset) y cursor.
 */
const ensurePageSpace = (doc, y, needed, onNewPage) => {
  if (needed <= 0) return y;
  if (checkRemainingPageSpace(doc, y) >= needed) return y;
  doc.addPage();
  const nextY = PAGE_MARGIN;
  if (typeof onNewPage === 'function') onNewPage();
  return nextY;
};

/** Measured height of wrapped text for the current font settings. */
const measureTextHeight = (doc, text, width, options = {}) => {
  const value = text == null || text === '' ? ' ' : String(text);
  return doc.heightOfString(value, {
    width,
    lineBreak: true,
    ...options,
  });
};

/**
 * Draw single-line text that must not wrap (SKU, qty, money, status…).
 * Uses ellipsis if the string is wider than the cell.
 */
const drawSingleLineText = (doc, text, x, y, width, align = 'left') => {
  const value = text == null || text === '' ? '—' : String(text);
  doc.text(value, x, y, {
    width,
    align,
    lineBreak: false,
    ellipsis: true,
  });
};

/**
 * Draw text that may wrap naturally (product titles, notes, addresses).
 * Returns the height consumed.
 */
const drawWrappingText = (doc, text, x, y, width, options = {}) => {
  const value = text == null || text === '' ? '—' : String(text);
  const height = measureTextHeight(doc, value, width, options);
  doc.text(value, x, y, {
    width,
    lineBreak: true,
    ...options,
  });
  return height;
};

const calculateRowHeight = (doc, cells, columns, paddingY = 6) => {
  let maxContent = 10;
  doc.font('Helvetica').fontSize(8);

  columns.forEach((col) => {
    const cellWidth = col.width - 12;
    const value = cells[col.key] ?? '—';
    if (col.wrap) {
      const h = measureTextHeight(doc, value, cellWidth);
      maxContent = Math.max(maxContent, h);
    } else {
      // Single-line cells: one line of text at current font size
      maxContent = Math.max(maxContent, 10);
    }
  });

  return Math.ceil(maxContent + paddingY * 2);
};

const calculateInfoCardHeight = (doc, lines, colWidth) => {
  doc.font('Helvetica').fontSize(9);
  const innerWidth = colWidth - 24;
  let bodyHeight = 0;
  lines.filter(Boolean).forEach((line) => {
    bodyHeight += measureTextHeight(doc, line, innerWidth) + 2;
  });
  // title area (26) + body + bottom padding
  return Math.max(72, 26 + bodyHeight + 12);
};

/**
 * Builds a professional invoice PDF and pipes it to `outputStream`.
 * Returns when the document has finished writing.
 */
export const buildInvoicePdf = ({
  invoice,
  customer,
  seller,
  payments,
  generatedBy,
  outputStream,
}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: `${invoice.invoiceNumber} Invoice`,
        Author: env.company.name,
        Subject: 'Sales Invoice',
      },
    });

    doc.on('error', reject);
    outputStream.on('error', reject);
    doc.pipe(outputStream);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    let y = PAGE_MARGIN;

    // ── Invoice brand header (first page only) ───────────────────
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
        // Ignore unreadable logos and continue with text-only header.
      }
    }

    doc
      .fillColor(COLORS.headerText)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(env.company.name, headerTextX, 30, {
        width: contentWidth - (headerTextX - PAGE_MARGIN) - 140,
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
        contentWidth - (headerTextX - PAGE_MARGIN) - 140
      );
    });

    doc
      .fillColor(COLORS.headerText)
      .font('Helvetica-Bold')
      .fontSize(22);
    drawSingleLineText(doc, 'INVOICE', PAGE_MARGIN, 38, contentWidth, 'right');

    y = 130;

    // ── Invoice meta ─────────────────────────────────────────────
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11);
    drawSingleLineText(doc, invoice.invoiceNumber, PAGE_MARGIN, y, contentWidth);

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
    drawSingleLineText(
      doc,
      `Status: ${labelize(invoice.status)}   ·   Payment: ${labelize(invoice.paymentStatus)}`,
      PAGE_MARGIN,
      y + 16,
      contentWidth
    );
    drawSingleLineText(
      doc,
      `Created: ${dateOnly(invoice.createdAt)}${
        invoice.confirmedAt
          ? `   ·   Confirmed: ${dateOnly(invoice.confirmedAt)}`
          : ''
      }`,
      PAGE_MARGIN,
      y + 30,
      contentWidth
    );

    y += 58;

    // ── Seller / Customer cards (dynamic height) ─────────────────
    const colWidth = (contentWidth - 16) / 2;
    const sellerLines = [
      seller?.name || '—',
      seller?.branch?.name ? `Branch: ${seller.branch.name}` : null,
      seller?.branch?.country?.name
        ? `Country: ${seller.branch.country.name}`
        : null,
      seller?.email || null,
    ];
    const customerLines = [
      customer?.name || '—',
      customer?.email || null,
      customer?.phone || null,
      customer?.address || null,
    ];

    const cardHeight = Math.max(
      calculateInfoCardHeight(doc, sellerLines, colWidth),
      calculateInfoCardHeight(doc, customerLines, colWidth)
    );

    y = ensurePageSpace(doc, y, cardHeight + 16);

    const drawInfoCard = (x, title, lines) => {
      doc.save();
      doc.roundedRect(x, y, colWidth, cardHeight, 6).fill(COLORS.soft);
      doc.restore();
      doc
        .fillColor(COLORS.accent)
        .font('Helvetica-Bold')
        .fontSize(9);
      drawSingleLineText(doc, title.toUpperCase(), x + 12, y + 10, colWidth - 24);

      doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
      let lineY = y + 26;
      lines.filter(Boolean).forEach((line) => {
        const h = drawWrappingText(doc, line, x + 12, lineY, colWidth - 24);
        lineY += h + 2;
      });
    };

    drawInfoCard(PAGE_MARGIN, 'Seller', sellerLines);
    drawInfoCard(PAGE_MARGIN + colWidth + 16, 'Bill To', customerLines);
    y += cardHeight + 24;

    // ── Line items table ─────────────────────────────────────────
    // Wider SKU column so typical SKUs stay on one line; product may wrap.
    const columns = [
      { key: 'product', label: 'Product', width: 190, align: 'left', wrap: true },
      { key: 'sku', label: 'SKU', width: 95, align: 'left', wrap: false },
      { key: 'qty', label: 'Qty', width: 40, align: 'right', wrap: false },
      { key: 'unit', label: 'Unit Price', width: 85, align: 'right', wrap: false },
      { key: 'total', label: 'Line Total', width: 89, align: 'right', wrap: false },
    ];

    const TABLE_HEADER_HEIGHT = 22;

    const drawTableHeader = () => {
      doc.save();
      doc.rect(PAGE_MARGIN, y, contentWidth, TABLE_HEADER_HEIGHT).fill(COLORS.accent);
      doc.restore();
      let x = PAGE_MARGIN;
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      columns.forEach((col) => {
        drawSingleLineText(doc, col.label, x + 6, y + 7, col.width - 12, col.align);
        x += col.width;
      });
      y += TABLE_HEADER_HEIGHT;
    };

    /** Page break for table body: repeat column headers only (not brand header). */
    const ensureTableRowSpace = (rowHeight) => {
      const needed = rowHeight;
      if (checkRemainingPageSpace(doc, y) >= needed) return;
      doc.addPage();
      y = PAGE_MARGIN;
      drawTableHeader();
    };

    y = ensurePageSpace(doc, y, 18 + TABLE_HEADER_HEIGHT + 24);
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10);
    drawSingleLineText(doc, 'Invoice Items', PAGE_MARGIN, y, contentWidth);
    y += 18;
    drawTableHeader();

    const items = invoice.items || [];
    if (!items.length) {
      y = ensurePageSpace(doc, y, 28);
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9);
      drawSingleLineText(
        doc,
        'No line items on this invoice.',
        PAGE_MARGIN + 6,
        y + 6,
        contentWidth - 12
      );
      y += 28;
    } else {
      items.forEach((item, index) => {
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

        let x = PAGE_MARGIN;
        const textY = y + 6;
        doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8);

        columns.forEach((col) => {
          const cellWidth = col.width - 12;
          const value = cells[col.key];
          if (col.wrap) {
            drawWrappingText(doc, value, x + 6, textY, cellWidth, {
              align: col.align,
            });
          } else {
            drawSingleLineText(doc, value, x + 6, textY, cellWidth, col.align);
          }
          x += col.width;
        });

        y += rowHeight;
      });
    }

    doc
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + contentWidth, y)
      .strokeColor(COLORS.line)
      .lineWidth(1)
      .stroke();
    y += 16;

    // ── Summary (only break page if the block itself cannot fit) ─
    const summaryRows = [
      ['Subtotal', money(invoice.totalAmount)],
      ['Total Amount', money(invoice.totalAmount)],
      ['Paid Amount', money(invoice.paidAmount)],
      ['Due Amount', money(invoice.dueAmount)],
    ];
    const summaryHeight = summaryRows.length * 16 + 8;
    y = ensurePageSpace(doc, y, summaryHeight);

    const summaryX = PAGE_MARGIN + contentWidth - 220;
    summaryRows.forEach(([label, value], index) => {
      const rowY = y + index * 16;
      const isDue = label === 'Due Amount';
      doc
        .font(isDue ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor(COLORS.muted);
      drawSingleLineText(doc, label, summaryX, rowY, 110);
      doc.fillColor(COLORS.ink);
      drawSingleLineText(doc, value, summaryX + 110, rowY, 110, 'right');
    });
    y += summaryHeight + 12;

    // ── Notes ────────────────────────────────────────────────────
    if (invoice.notes) {
      const notesTitleHeight = 14;
      doc.font('Helvetica').fontSize(9);
      const notesBodyHeight = measureTextHeight(
        doc,
        invoice.notes,
        contentWidth
      );
      const notesBlockHeight = notesTitleHeight + notesBodyHeight + 16;
      const maxContentHeight =
        doc.page.height - PAGE_MARGIN * 2 - FOOTER_RESERVE;

      // Move the whole notes block only when it fits on a page but not here.
      // Extremely long notes start on a new page and grow downward.
      if (
        notesBlockHeight <= maxContentHeight &&
        checkRemainingPageSpace(doc, y) < notesBlockHeight
      ) {
        y = ensurePageSpace(doc, y, notesBlockHeight);
      } else if (checkRemainingPageSpace(doc, y) < notesTitleHeight + 24) {
        y = ensurePageSpace(doc, y, notesTitleHeight + 24);
      }

      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.accent);
      drawSingleLineText(doc, 'Notes', PAGE_MARGIN, y, contentWidth);
      y += notesTitleHeight;

      doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
      const used = drawWrappingText(
        doc,
        invoice.notes,
        PAGE_MARGIN,
        y,
        contentWidth
      );
      y += used + 16;
    }

    // ── Payment history ──────────────────────────────────────────
    if (payments?.length) {
      const paymentHeaderHeight = 16 + 22;
      y = ensurePageSpace(doc, y, paymentHeaderHeight + 18);

      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink);
      drawSingleLineText(doc, 'Payment History', PAGE_MARGIN, y, contentWidth);
      y += 16;

      doc.save();
      doc.rect(PAGE_MARGIN, y, contentWidth, 20).fill(COLORS.soft);
      doc.restore();
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
      drawSingleLineText(doc, 'Date', PAGE_MARGIN + 8, y + 6, 160);
      drawSingleLineText(doc, 'Amount', PAGE_MARGIN + 180, y + 6, 100, 'right');
      drawSingleLineText(doc, 'Method', PAGE_MARGIN + 300, y + 6, 180);
      y += 22;

      const drawPaymentColumnHeader = () => {
        doc.save();
        doc.rect(PAGE_MARGIN, y, contentWidth, 20).fill(COLORS.soft);
        doc.restore();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
        drawSingleLineText(doc, 'Date', PAGE_MARGIN + 8, y + 6, 160);
        drawSingleLineText(doc, 'Amount', PAGE_MARGIN + 180, y + 6, 100, 'right');
        drawSingleLineText(doc, 'Method', PAGE_MARGIN + 300, y + 6, 180);
        y += 22;
      };

      payments.forEach((payment) => {
        const rowHeight = 16;
        if (checkRemainingPageSpace(doc, y) < rowHeight) {
          doc.addPage();
          y = PAGE_MARGIN;
          doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink);
          drawSingleLineText(
            doc,
            'Payment History (continued)',
            PAGE_MARGIN,
            y,
            contentWidth
          );
          y += 16;
          drawPaymentColumnHeader();
        }

        doc.font('Helvetica').fontSize(8).fillColor(COLORS.ink);
        drawSingleLineText(
          doc,
          dateOnly(payment.paymentDate || payment.createdAt),
          PAGE_MARGIN + 8,
          y,
          160
        );
        drawSingleLineText(
          doc,
          money(payment.amount),
          PAGE_MARGIN + 180,
          y,
          100,
          'right'
        );
        drawSingleLineText(
          doc,
          labelize(payment.paymentMethod),
          PAGE_MARGIN + 300,
          y,
          180
        );
        y += rowHeight;
      });
      y += 10;
    }

    // ── Footer on every page (inside printable bounds) ───────────
    // Content already stays above FOOTER_RESERVE via checkRemainingPageSpace.
    // Do not ensurePageSpace(footer) here — that created empty trailing pages.
    const footerText = env.company.footer || 'Thank you for your business.';
    const generatedLine = `Generated: ${dateTime(new Date())}   ·   Generated by: ${
      generatedBy || 'System'
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
