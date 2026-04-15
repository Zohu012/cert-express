#!/usr/bin/env python3
"""
Parse FMCSA Certificate PDF and split into individual company PDFs.

Usage: python parse_pdf.py <input_pdf_path> <output_dir>
Output: JSON array of parsed companies to stdout, errors to stderr.
"""

import sys
import os
import re
import json
import uuid
from datetime import datetime

import pdfplumber
from pypdf import PdfReader, PdfWriter


def parse_certificate_page(text: str) -> dict:
    """Parse odd page (certificate/permit/license) for company data."""
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
            # Date might be on the same line or next line
            date_match = re.search(
                r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}",
                " ".join(lines[i : i + 3]),
            )
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
        if re.match(r"^(CERTIFICATE|PERMIT|LICENSE)$", line.upper()):
            data["documentType"] = line.upper()
        doc_match = re.match(r"^((?:MC|FF|MX)-\d+-[A-Z])$", line)
        if doc_match:
            data["documentNumber"] = doc_match.group(1)

    # USDOT Number
    for line in lines:
        dot_match = re.search(r"U\.?S\.?\s*DOT\s*No\.?\s*(\d+)", line)
        if dot_match:
            data["usdotNumber"] = dot_match.group(1)
            break

    # Company name and DBA - appears after DOT number line
    dot_found = False
    name_lines = []
    for line in lines:
        if dot_found:
            # Stop at known markers
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
            name_lines.append(line)
        if "DOT No" in line or "DOT no" in line:
            dot_found = True

    if name_lines:
        # First line is company name
        data["companyName"] = name_lines[0]

        for nl in name_lines[1:]:
            if nl.upper().startswith("D/B/A") or nl.upper().startswith("DBA"):
                dba = re.sub(r"^D/?B/?A\s*", "", nl, flags=re.IGNORECASE).strip()
                data["dbaName"] = dba
            elif re.match(r"^[A-Z\s]+,\s*[A-Z]{2}$", nl):
                # City, STATE pattern
                parts = nl.rsplit(",", 1)
                data["city"] = parts[0].strip()
                data["state"] = parts[1].strip()

    return data


def parse_envelope_page(text: str) -> dict:
    """Parse even page (envelope) for full mailing address."""
    data = {
        "streetAddress": None,
        "city": None,
        "state": None,
        "zipCode": None,
        "companyName": None,
        "dbaName": None,
    }

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Find the address block - after the document number line (MC-xxxxx, FF-xxxxx)
    doc_idx = None
    for i, line in enumerate(lines):
        if re.match(r"^(MC|FF|MX)-\d+$", line):
            doc_idx = i
            break

    if doc_idx is None:
        return data

    # Lines after doc number: company name, optional DBA, street, city/state/zip
    addr_lines = lines[doc_idx + 1 :]

    if not addr_lines:
        return data

    # Company name
    data["companyName"] = addr_lines[0]

    # Check for DBA
    remaining = addr_lines[1:]
    if remaining and (
        remaining[0].upper().startswith("D/B/A")
        or remaining[0].upper().startswith("DBA")
    ):
        dba = re.sub(r"^D/?B/?A\s*", "", remaining[0], flags=re.IGNORECASE).strip()
        data["dbaName"] = dba
        remaining = remaining[1:]

    # Last line should be city, state zip
    if remaining:
        last = remaining[-1]
        csz_match = re.match(
            r"^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$", last
        )
        if csz_match:
            data["city"] = csz_match.group(1).strip()
            data["state"] = csz_match.group(2)
            data["zipCode"] = csz_match.group(3)

        # Everything between company/DBA and city line is street address
        street_lines = remaining[:-1]
        if street_lines:
            data["streetAddress"] = " ".join(street_lines)

    return data


def process_pdf(input_path: str, output_dir: str) -> int:
    """Process the full PDF, split into per-company files, and stream each as a JSON line."""
    os.makedirs(output_dir, exist_ok=True)

    reader = PdfReader(input_path)
    total_pages = len(reader.pages)
    count = 0

    with pdfplumber.open(input_path) as pdf:
        for i in range(0, total_pages - 1, 2):
            try:
                # Extract text from both pages
                cert_text = pdf.pages[i].extract_text() or ""
                env_text = pdf.pages[i + 1].extract_text() or ""

                cert_data = parse_certificate_page(cert_text)
                env_data = parse_envelope_page(env_text)

                # Merge data (certificate page is primary, envelope fills in address)
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

                # Split: create 2-page PDF for this company
                filename = f"{uuid.uuid4()}.pdf"
                writer = PdfWriter()
                writer.add_page(reader.pages[i])
                writer.add_page(reader.pages[i + 1])

                output_path = os.path.join(output_dir, filename)
                with open(output_path, "wb") as f:
                    writer.write(f)

                company["pdfFilename"] = filename

                # Emit immediately so Node.js can start DB inserts without waiting
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
