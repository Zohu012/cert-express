#!/usr/bin/env python3
"""
Parse FMCSA Certificate PDF and split into individual company PDFs.

Usage: python parse_pdf.py <input_pdf_path> <output_dir>
Output: JSON lines (one company per line) to stdout, status to stderr.
"""

import sys
import os
import re
import json
import uuid
from datetime import datetime

from pypdf import PdfReader, PdfWriter


# ── Pre-compiled regex patterns ───────────────────────────────────────────────
_RE_DATE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{1,2},?\s+\d{4}"
)
_RE_DOC_TYPE = re.compile(r"^(CERTIFICATE|PERMIT|LICENSE)$", re.IGNORECASE)
_RE_DOC_NUM = re.compile(r"^((?:MC|FF|MX)-\d+-[A-Z])$")
_RE_DOT = re.compile(r"U\.?S\.?\s*DOT\s*No\.?\s*(\d+)")
_RE_ENV_DOC = re.compile(r"^(MC|FF|MX)-\d+$")
_RE_CSZ = re.compile(r"^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$")
_RE_DBA = re.compile(r"^D/?B/?A\s*", re.IGNORECASE)
_RE_CITY_STATE = re.compile(r"^[A-Z][A-Z\s]+,\s*[A-Z]{2}$")

# Lines to skip when filtering envelope header boilerplate
_ENVELOPE_SKIP = re.compile(
    r"FMCSA|1200 New Jersey|Washington,\s*DC|OFFICIAL BUSINESS|PENALTY FOR"
)


def parse_certificate_page(text: str) -> dict:
    """Parse odd page (certificate/permit/license) for company data.

    pypdf text order for this page:
      header lines → SERVICE DATE → LICENSE → MC-XXXXX-B → company name →
      city, STATE → body text → signature → U.S. DOT No. XXXXXX

    The DOT number appears at the BOTTOM of the page in pypdf's stream order,
    so we anchor company-name extraction on the document number line instead.
    """
    data = {
        "serviceDate": None,
        "documentType": None,
        "documentNumber": None,
        "usdotNumber": None,
        "companyName": None,
        "dbaName": None,
        "city": None,
        "state": None,
    }

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Service date
    for i, line in enumerate(lines):
        if "SERVICE DATE" in line.upper():
            date_match = _RE_DATE.search(" ".join(lines[i : i + 3]))
            if date_match:
                try:
                    raw = date_match.group(0).replace(",", "")
                    data["serviceDate"] = datetime.strptime(raw, "%B %d %Y").strftime(
                        "%Y-%m-%d"
                    )
                except ValueError:
                    pass
            break

    # Document type and number
    for line in lines:
        if _RE_DOC_TYPE.match(line):
            data["documentType"] = line.upper()
        doc_match = _RE_DOC_NUM.match(line)
        if doc_match:
            data["documentNumber"] = doc_match.group(1)

    # USDOT Number — scan entire page (may appear anywhere in stream order)
    for line in lines:
        dot_match = _RE_DOT.search(line)
        if dot_match:
            data["usdotNumber"] = dot_match.group(1)
            break

    # Company name + DBA + city/state
    # Anchor: lines between the document number (MC-XXXXX-B) and the body text
    # that starts with "This Permit/Certificate/License/authority".
    # Skip any DOT number line that may appear in between (pdfplumber order).
    doc_found = False
    name_lines = []
    for line in lines:
        if doc_found:
            if any(
                marker in line
                for marker in [
                    "This Permit",
                    "This Certificate",
                    "This License",
                    "This authority",
                ]
            ):
                break
            if _RE_DOT.search(line):
                continue  # skip DOT line if it falls between doc# and company (pdfplumber order)
            name_lines.append(line)
        elif _RE_DOC_NUM.match(line):
            doc_found = True

    if name_lines:
        data["companyName"] = name_lines[0]
        for nl in name_lines[1:]:
            if nl.upper().startswith("D/B/A") or nl.upper().startswith("DBA"):
                data["dbaName"] = _RE_DBA.sub("", nl).strip()
            elif _RE_CITY_STATE.match(nl):
                parts = nl.rsplit(",", 1)
                data["city"] = parts[0].strip()
                data["state"] = parts[1].strip()

    return data


def parse_envelope_page(text: str) -> dict:
    """Parse even page (envelope) for full mailing address.

    pypdf text order for this page:
      FMCSA header → OFFICIAL BUSINESS → city, STATE ZIP → street →
      company name → MC-XXXXXX   (address block is BEFORE the doc number)

    pdfplumber text order (legacy):
      FMCSA header → MC-XXXXXX → company name → street → city, STATE ZIP

    We try after the doc number first (pdfplumber), fall back to before it
    reversed (pypdf).
    """
    data = {
        "streetAddress": None,
        "city": None,
        "state": None,
        "zipCode": None,
        "companyName": None,
        "dbaName": None,
    }

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    doc_idx = None
    for i, line in enumerate(lines):
        if _RE_ENV_DOC.match(line):
            doc_idx = i
            break

    if doc_idx is None:
        return data

    # ── Try pdfplumber order: address lines AFTER doc number ────────────────
    addr_lines = [l for l in lines[doc_idx + 1 :] if l]

    # ── Fall back to pypdf order: address lines BEFORE doc number, reversed ─
    if not addr_lines or not any(_RE_CSZ.match(l) for l in addr_lines):
        pre = [l for l in lines[:doc_idx] if l and not _ENVELOPE_SKIP.search(l)]
        addr_lines = list(reversed(pre))

    if not addr_lines:
        return data

    # Parse: first line = company name, optional DBA, street(s), last line = CSZ
    data["companyName"] = addr_lines[0]

    remaining = addr_lines[1:]
    if remaining and (
        remaining[0].upper().startswith("D/B/A")
        or remaining[0].upper().startswith("DBA")
    ):
        data["dbaName"] = _RE_DBA.sub("", remaining[0]).strip()
        remaining = remaining[1:]

    if remaining:
        last = remaining[-1]
        csz_match = _RE_CSZ.match(last)
        if csz_match:
            data["city"] = csz_match.group(1).strip()
            data["state"] = csz_match.group(2)
            data["zipCode"] = csz_match.group(3)

        street_lines = remaining[:-1]
        if street_lines:
            data["streetAddress"] = " ".join(street_lines)

    return data


def process_pdf(input_path: str, output_dir: str) -> int:
    """Process the full PDF, split into per-company files, stream each as a JSON line."""
    os.makedirs(output_dir, exist_ok=True)

    reader = PdfReader(input_path)
    total_pages = len(reader.pages)
    print(f"TOTAL_PAGES:{total_pages}", file=sys.stderr, flush=True)
    count = 0

    for i in range(0, total_pages - 1, 2):
        try:
            cert_text = reader.pages[i].extract_text() or ""
            env_text = reader.pages[i + 1].extract_text() or ""

            cert_data = parse_certificate_page(cert_text)
            env_data = parse_envelope_page(env_text)

            company = {
                "companyName": cert_data["companyName"] or env_data["companyName"] or "UNKNOWN",
                "dbaName": cert_data["dbaName"] or env_data["dbaName"],
                "streetAddress": env_data["streetAddress"],
                "city": env_data["city"] or cert_data["city"],
                "state": env_data["state"] or cert_data["state"],
                "zipCode": env_data["zipCode"],
                "usdotNumber": cert_data["usdotNumber"] or "UNKNOWN",
                "documentNumber": cert_data["documentNumber"] or "UNKNOWN",
                "documentType": cert_data["documentType"] or "UNKNOWN",
                "serviceDate": cert_data["serviceDate"] or "1970-01-01",
                "pdfFilename": None,
            }

            filename = f"{uuid.uuid4()}.pdf"
            writer = PdfWriter()
            writer.add_page(reader.pages[i])
            writer.add_page(reader.pages[i + 1])

            output_path = os.path.join(output_dir, filename)
            with open(output_path, "wb") as f:
                writer.write(f)

            company["pdfFilename"] = filename

            print(json.dumps(company), flush=True)
            count += 1

        except Exception as e:
            print(
                f"WARNING: Failed to process pages {i+1}-{i+2}: {e}",
                file=sys.stderr,
            )
            continue

    return count


def main():
    if len(sys.argv) != 3:
        print("Usage: python parse_pdf.py <input_pdf> <output_dir>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Error: File not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    count = process_pdf(input_path, output_dir)
    print(f"Processed {count} companies", file=sys.stderr)


if __name__ == "__main__":
    main()
