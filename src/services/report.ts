/**
 * Report Generation Service
 * Generates screening reports in PDF format using jsPDF.
 */

import { jsPDF } from 'jspdf';
import type { ScreeningResult } from '../types';

function addHeader(doc: jsPDF, result: ScreeningResult) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(15, 23, 42); // navy
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('IP-SAKTI SAHAYAK', 14, 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Preliminary IP/TK Screening Report', 14, 27);

  // Metadata
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date(result.timestamp).toLocaleString()}`, 14, 34);
  doc.text(`Session: ${result.session_id}`, 120, 34);
  doc.text(`Mode: ${result.mode === 'demo' ? 'Local Verification' : 'AI Verified'}`, 120, 27);

  return 48; // return Y position after header
}

function addSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(241, 245, 249); // light gray bg
  doc.rect(14, y, doc.internal.pageSize.getWidth() - 28, 8, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 18, y + 5.5);
  return y + 14;
}

function addKeyValue(doc: jsPDF, y: number, key: string, value: string): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(key, 18, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(value, 70, y);
  return y + 5;
}

function addWrappedText(doc: jsPDF, y: number, text: string, maxWidth: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 18, y);
    y += 4.5;
  }
  return y + 2;
}

function addRiskBadge(doc: jsPDF, y: number, level: string, reason: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Risk badge color
  if (level === 'LOWER_INITIAL_RISK') {
    doc.setFillColor(220, 252, 231); // green
    doc.setTextColor(22, 101, 52);
  } else if (level === 'FURTHER_ASSESSMENT') {
    doc.setFillColor(254, 243, 199); // amber
    doc.setTextColor(146, 64, 14);
  } else {
    doc.setFillColor(254, 226, 226); // red
    doc.setTextColor(153, 27, 27);
  }

  doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(level.replace(/_/g, ' '), 20, y + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const reasonLines = doc.splitTextToSize(reason, pageWidth - 44);
  doc.text(reasonLines[0], 20, y + 15);
  if (reasonLines.length > 1) {
    doc.text(reasonLines[1], 20, y + 19);
  }

  return y + 30;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 270) {
    doc.addPage();
    return 20;
  }
  return y;
}

export function generateReportPDF(result: ScreeningResult): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - 36;

  let y = addHeader(doc, result);

  // ─── SCREENING INPUT ───
  y = addSectionTitle(doc, y, 'SCREENING INPUT');
  y = addKeyValue(doc, y, 'Product Name:', result.parsed_input.productName);
  y = addKeyValue(doc, y, 'Ingredients:', result.parsed_input.ingredients.join(', '));
  if (result.parsed_input.description) {
    y = addKeyValue(doc, y, 'Description:', result.parsed_input.description);
  }
  y = addKeyValue(doc, y, 'Traditional Reference:', result.parsed_input.traditionalReference);
  y = addKeyValue(doc, y, 'Innovation Type:', result.parsed_input.innovationType);
  y = addKeyValue(doc, y, 'Jurisdiction:', result.jurisdiction_route);
  y += 4;

  // ─── RISK CLASSIFICATION ───
  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, y, 'RISK CLASSIFICATION');
  y = addRiskBadge(doc, y, result.risk_level, result.risk_reason);
  y += 2;

  // ─── SCREENING SUMMARY ───
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, y, 'SCREENING SUMMARY');
  y = addWrappedText(doc, y, result.generated_answer, maxWidth);
  y += 2;

  // ─── RELEVANT LEGAL PROVISIONS ───
  y = checkPageBreak(doc, y, 20);
  y = addSectionTitle(doc, y, 'RELEVANT LEGAL PROVISIONS');
  const seenSources = new Set<string>();
  for (const e of result.selected_evidence) {
    const key = `${e.chunk.source_name} | ${e.chunk.provision}`;
    if (seenSources.has(key)) continue;
    seenSources.add(key);
    y = checkPageBreak(doc, y, 8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`• ${e.chunk.source_name}, ${e.chunk.provision} (p.${e.chunk.page_number})`, 18, y);
    y += 5;
  }
  y += 4;

  // ─── CLAIM VERIFICATION ───
  y = checkPageBreak(doc, y, 20);
  y = addSectionTitle(doc, y, 'CLAIM VERIFICATION SUMMARY');

  // Summary counts
  const vs = result.verification_summary;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Total: ${vs.total}`, 18, y);
  doc.setTextColor(22, 101, 52);
  doc.text(`Supported: ${vs.supported}`, 50, y);
  doc.setTextColor(146, 64, 14);
  doc.text(`Partial: ${vs.partially_supported}`, 90, y);
  doc.setTextColor(153, 27, 27);
  doc.text(`Unsupported: ${vs.unsupported}`, 120, y);
  y += 8;

  // Individual claims
  for (const v of result.claim_verifications) {
    y = checkPageBreak(doc, y, 25);
    const statusSymbol = v.status === 'SUPPORTED' ? '✓' : v.status === 'PARTIALLY_SUPPORTED' ? '⚠' : '✕';

    // Claim text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`[${statusSymbol}] ${v.status}`, 18, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const claimLines = doc.splitTextToSize(v.claim_text, maxWidth - 4);
    doc.text(claimLines.slice(0, 2), 22, y);
    y += claimLines.length > 1 ? 9 : 5;

    // Source & confidence
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Source: ${v.source_name}, ${v.provision} | Confidence: ${(v.confidence * 100).toFixed(0)}% | Method: ${v.method}`, 22, y);
    y += 5;

    // Reason
    if (v.reason) {
      doc.setTextColor(71, 85, 105);
      const reasonLines = doc.splitTextToSize(`Reason: ${v.reason}`, maxWidth - 8);
      doc.text(reasonLines.slice(0, 2), 26, y);
      y += reasonLines.length > 1 ? 9 : 5;
    }
    y += 3;
  }
  y += 2;

  // ─── SCREENING RULES ───
  y = checkPageBreak(doc, y, 20);
  y = addSectionTitle(doc, y, 'SCREENING RULES TRIGGERED');
  for (const rule of result.triggered_rules) {
    if (rule.triggered) {
      y = checkPageBreak(doc, y, 6);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(`• [${rule.risk_contribution.toUpperCase()}] ${rule.name}`, 18, y);
      y += 5;
    }
  }
  y += 4;

  // ─── NEXT STEP ───
  y = checkPageBreak(doc, y, 20);
  y = addSectionTitle(doc, y, 'RECOMMENDED NEXT STEP');
  y = addWrappedText(doc, y, result.recommended_next_step, maxWidth);
  y += 4;

  // ─── ESCALATION STATUS ───
  y = checkPageBreak(doc, y, 15);
  y = addSectionTitle(doc, y, 'EXPERT ESCALATION STATUS');
  if (result.escalation_request) {
    y = addKeyValue(doc, y, 'Status:', result.escalation_request.status);
    y = addKeyValue(doc, y, 'Reason:', result.escalation_request.reason);
    y = addKeyValue(doc, y, 'Requested:', new Date(result.escalation_request.timestamp).toLocaleString());
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('No escalation request submitted.', 18, y);
    y += 5;
  }
  y += 6;

  // ─── DISCLAIMER ───
  y = checkPageBreak(doc, y, 25);
  doc.setFillColor(255, 251, 235); // amber bg
  doc.roundedRect(14, y, maxWidth, 20, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text('DISCLAIMER', 18, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 80, 20);
  const disclaimer = 'IP-SAKTI Sahayak provides preliminary IP/TK screening assistance only. This report does not constitute legal advice or a patentability opinion. Consult a qualified IP professional for final legal assessment.';
  const discLines = doc.splitTextToSize(disclaimer, maxWidth - 8);
  doc.text(discLines, 18, y + 11);

  // ─── FOOTER ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `IP-SAKTI SAHAYAK — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  // ─── DOWNLOAD ───
  const filename = `IP-SAKTI-Screening-${result.parsed_input.productName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
  doc.save(filename);
}

export function downloadReport(result: ScreeningResult): void {
  generateReportPDF(result);
}
