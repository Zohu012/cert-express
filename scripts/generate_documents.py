#!/usr/bin/env python3
"""
Generate clean formatted PDF + blurred preview PNG per company.

Usage: echo '<json_array>' | python generate_documents.py <pdf_dir> <preview_dir>
Input:  JSON array of company objects via stdin
Output: JSON Lines to stdout — one per company: {"id": "...", "previewFilename": "..."}
"""

import sys
import os
import json
import re
from io import BytesIO
from datetime import datetime

# ── reportlab ─────────────────────────────────────────────────────────────────
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# ── PyMuPDF + Pillow ──────────────────────────────────────────────────────────
import fitz  # PyMuPDF
from PIL import Image, ImageFilter, ImageDraw, ImageFont

# ── Palette ───────────────────────────────────────────────────────────────────
HEADER_BG    = colors.HexColor("#1e3a5f")   # dark navy
HEADER_TEXT  = colors.white
TITLE_COLOR  = colors.HexColor("#1e3a5f")
LABEL_COLOR  = colors.HexColor("#374151")
VALUE_COLOR  = colors.HexColor("#111827")
FOOTER_COLOR = colors.HexColor("#9ca3af")
RULE_COLOR   = colors.HexColor("#d1d5db")

# Regex to make document number filesystem-safe (already MC-XXXXX-B but be safe)
_RE_UNSAFE = re.compile(r'[^A-Za-z0-9\-_]')


def safe_filename(doc_number: str) -> str:
    return _RE_UNSAFE.sub("_", doc_number)


def format_date(service_date: str) -> str:
    try:
        dt = datetime.fromisoformat(service_date[:10])
        return dt.strftime("%B %d, %Y")
    except Exception:
        return service_date


def generate_clean_pdf(company: dict, pdf_path: str) -> bool:
    """Generate a clean formatted PDF. Returns True if generated, False if skipped."""
    if os.path.exists(pdf_path):
        return False  # already exists, skip

    doc_type = company.get("documentType", "CERTIFICATE").upper()
    title_map = {
        "CERTIFICATE": "CERTIFICATE OF AUTHORITY",
        "PERMIT":      "OPERATING PERMIT",
        "LICENSE":     "MOTOR CARRIER LICENSE",
    }
    title = title_map.get(doc_type, f"{doc_type}")

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0,
        bottomMargin=0.7 * inch,
    )

    story = []

    # ── Header table (full-width navy band) ───────────────────────────────────
    header_data = [[
        Paragraph(
            '<font color="white" size="11"><b>U.S. DEPARTMENT OF TRANSPORTATION</b></font><br/>'
            '<font color="#93c5fd" size="9">Federal Motor Carrier Safety Administration</font>',
            ParagraphStyle("hdr", alignment=TA_CENTER),
        )
    ]]
    header_table = Table(header_data, colWidths=[6.8 * inch])
    header_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), HEADER_BG),
        ("TOPPADDING",  (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
        ("LEFTPADDING",  (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.35 * inch))

    # ── Document type title ────────────────────────────────────────────────────
    title_style = ParagraphStyle(
        "title",
        fontSize=18,
        fontName="Helvetica-Bold",
        textColor=TITLE_COLOR,
        alignment=TA_CENTER,
        spaceAfter=6,
    )
    story.append(Paragraph(title, title_style))

    sub_style = ParagraphStyle(
        "sub",
        fontSize=10,
        fontName="Helvetica",
        textColor=FOOTER_COLOR,
        alignment=TA_CENTER,
        spaceAfter=2,
    )
    story.append(Paragraph("Official Authority Record — Public FMCSA Registry", sub_style))
    story.append(Spacer(1, 0.15 * inch))
    story.append(HRFlowable(width="100%", thickness=1, color=RULE_COLOR, spaceAfter=0.25 * inch))

    # ── Details table ─────────────────────────────────────────────────────────
    label_style = ParagraphStyle(
        "lbl", fontSize=9, fontName="Helvetica-Bold", textColor=LABEL_COLOR
    )
    value_style = ParagraphStyle(
        "val", fontSize=11, fontName="Helvetica-Bold", textColor=VALUE_COLOR
    )

    rows = [
        [Paragraph("COMPANY NAME", label_style),
         Paragraph(company.get("companyName", ""), value_style)],
    ]
    if company.get("dbaName"):
        dba_style = ParagraphStyle("dba", fontSize=9, fontName="Helvetica", textColor=LABEL_COLOR)
        rows.append([Paragraph("", label_style),
                     Paragraph(f'D/B/A {company["dbaName"]}', dba_style)])

    rows += [
        [Paragraph("USDOT NUMBER", label_style),
         Paragraph(company.get("usdotNumber", ""), value_style)],
        [Paragraph("DOCUMENT NUMBER", label_style),
         Paragraph(company.get("documentNumber", ""), value_style)],
        [Paragraph("DOCUMENT TYPE", label_style),
         Paragraph(doc_type, value_style)],
        [Paragraph("SERVICE DATE", label_style),
         Paragraph(format_date(company.get("serviceDate", "")), value_style)],
    ]

    detail_table = Table(rows, colWidths=[1.8 * inch, 5.0 * inch])
    detail_table.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.5, RULE_COLOR),
    ]))
    story.append(detail_table)
    story.append(Spacer(1, 0.35 * inch))
    story.append(HRFlowable(width="100%", thickness=1, color=RULE_COLOR, spaceAfter=0.25 * inch))

    # ── Footer ─────────────────────────────────────────────────────────────────
    footer_style = ParagraphStyle(
        "footer",
        fontSize=8,
        fontName="Helvetica",
        textColor=FOOTER_COLOR,
        alignment=TA_CENTER,
        leading=13,
    )
    story.append(Paragraph(
        "This document is retrieved from public FMCSA records via CertExpress document delivery service.<br/>"
        "CertExpress is a private service and is not affiliated with FMCSA or any government agency.",
        footer_style,
    ))

    doc.build(story)
    with open(pdf_path, "wb") as f:
        f.write(buf.getvalue())
    return True


def generate_preview(pdf_path: str, preview_path: str, original_pdf_path: str | None = None) -> bool:
    """Render first page of PDF, blur lower 60%, add watermark. Returns True if generated."""
    if os.path.exists(preview_path):
        return False  # already exists, skip

    # Prefer the original FMCSA PDF for a more authentic preview
    source_pdf = original_pdf_path if original_pdf_path and os.path.exists(original_pdf_path) else pdf_path

    # Render at 200 DPI for ~1200px width
    pdf_doc = fitz.open(source_pdf)
    page = pdf_doc[0]
    mat = fitz.Matrix(200 / 72, 200 / 72)  # 200 DPI
    pix = page.get_pixmap(matrix=mat, alpha=False)
    pdf_doc.close()

    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    width, height = img.size

    # ── Blur bottom 60% ───────────────────────────────────────────────────────
    split_y = int(height * 0.40)          # keep top 40% sharp
    top    = img.crop((0, 0, width, split_y))
    bottom = img.crop((0, split_y, width, height))

    bottom_blurred = bottom.filter(ImageFilter.GaussianBlur(radius=22))

    # Semi-transparent gray overlay on blurred region (simulate via composite)
    overlay = Image.new("RGB", bottom_blurred.size, (210, 210, 215))
    bottom_final = Image.blend(bottom_blurred, overlay, alpha=0.35)

    # ── Watermark text ────────────────────────────────────────────────────────
    draw = ImageDraw.Draw(bottom_final)
    bw, bh = bottom_final.size

    # Try to use a system font; fall back to default
    try:
        font_big   = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except OSError:
        try:
            font_big   = ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", 36)
            font_small = ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans.ttf", 18)
        except OSError:
            font_big   = ImageFont.load_default()
            font_small = font_big

    main_text = "PREVIEW ONLY"
    sub_text  = "Click below to unlock the full document"

    # Centre of the blurred zone
    cy = bh // 2

    # Main text (white, centred)
    bbox = draw.textbbox((0, 0), main_text, font=font_big)
    tw = bbox[2] - bbox[0]
    draw.text(((bw - tw) // 2, cy - 36), main_text, fill=(255, 255, 255), font=font_big)

    # Sub text (light gray, centred)
    bbox2 = draw.textbbox((0, 0), sub_text, font=font_small)
    tw2 = bbox2[2] - bbox2[0]
    draw.text(((bw - tw2) // 2, cy + 14), sub_text, fill=(220, 220, 220), font=font_small)

    # ── Reassemble and save ───────────────────────────────────────────────────
    result = Image.new("RGB", (width, height))
    result.paste(top, (0, 0))
    result.paste(bottom_final, (0, split_y))

    result.save(preview_path, "PNG", optimize=True)
    return True


def main():
    if len(sys.argv) != 3:
        print("Usage: python generate_documents.py <pdf_dir> <preview_dir>", file=sys.stderr)
        sys.exit(1)

    pdf_dir     = sys.argv[1]
    preview_dir = sys.argv[2]
    os.makedirs(pdf_dir, exist_ok=True)
    os.makedirs(preview_dir, exist_ok=True)

    raw = sys.stdin.read().strip()
    if not raw:
        print("No input received on stdin", file=sys.stderr)
        sys.exit(1)

    try:
        companies = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Processing {len(companies)} companies...", file=sys.stderr, flush=True)

    for company in companies:
        company_id  = company.get("id", "")
        doc_number  = company.get("documentNumber", "")
        pdf_filename = company.get("pdfFilename", "")
        safe_name   = safe_filename(doc_number)

        pdf_path     = os.path.join(pdf_dir, f"{safe_name}.pdf")
        preview_path = os.path.join(preview_dir, f"{safe_name}.png")
        # Original FMCSA PDF (UUID.pdf) — more authentic for preview
        original_pdf = os.path.join(pdf_dir, pdf_filename) if pdf_filename else None

        try:
            pdf_new     = generate_clean_pdf(company, pdf_path)
            preview_new = generate_preview(pdf_path, preview_path, original_pdf)

            action = []
            if pdf_new:     action.append("pdf")
            if preview_new: action.append("preview")
            if action:
                print(f"  {doc_number}: generated {', '.join(action)}", file=sys.stderr, flush=True)

            print(json.dumps({"id": company_id, "previewFilename": f"{safe_name}.png"}), flush=True)

        except Exception as e:
            print(f"  ERROR {doc_number}: {e}", file=sys.stderr, flush=True)
            print(json.dumps({"id": company_id, "previewFilename": None}), flush=True)

    print("Done.", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
