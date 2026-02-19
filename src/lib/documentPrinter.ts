/**
 * Unified document printer — delegates to documentTemplates for HTML generation.
 * Single entry point for printing archived documents.
 */
import { generateDkpHTML, generateReceiptHTML, generatePndHTML, generateEuroprotocolHTML, generateCashReceiptHTML, generateSalesReceiptHTML, printDocumentHTML } from '@/lib/documentTemplates';

export function printDocumentArchive(type: string, documentData: Record<string, any>): void {
  let html: string;

  switch (type) {
    case 'dkp':
      html = generateDkpHTML(documentData as any);
      break;
    case 'receipt':
    case 'cash_receipt':
      html = generateCashReceiptHTML(documentData as any);
      break;
    case 'sales_receipt':
      html = generateSalesReceiptHTML(documentData as any);
      break;
    case 'pnd':
      html = generatePndHTML(documentData as any);
      break;
    case 'europrotocol': {
      const euroBody = generateEuroprotocolHTML(documentData as any);
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Европротокол</title>
<style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0;padding:0;width:210mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}html,body{margin:0;padding:0;background:white;font-family:Arial,sans-serif;font-size:11px}</style>
</head><body>${euroBody}</body></html>`;
      break;
    }
    default:
      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Документ</title></head><body><pre>${JSON.stringify(documentData, null, 2)}</pre></body></html>`;
  }

  printDocumentHTML(html);
}
