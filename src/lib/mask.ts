// Smart per-field masking for public-facing company profile pages.
// Keeps enough of each value to be recognizable ("is this me?") while
// redacting the rest so we don't republish scraped PII verbatim.

const X = "XXX";

function hasContent(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// "John Smith" -> "JohnXXX"
// Keep the first 4 chars of the raw input, then append XXX.
// For very short inputs (< 4 chars) we keep what's there and still append XXX.
export function maskOfficerName(name: string | null | undefined): string {
  if (!hasContent(name)) return "";
  const trimmed = name.trim();
  const head = trimmed.slice(0, 4);
  return `${head}${X}`;
}

// "555-123-4567" -> "(555) XXX-XXXX"
// "+1 (555) 123-4567" -> "(555) XXX-XXXX"
// If fewer than 10 digits, return a fully masked placeholder.
export function maskPhone(phone: string | null | undefined): string {
  if (!hasContent(phone)) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "XXX-XXX-XXXX";
  // Use the last 10 digits (drop country code if present).
  const ten = digits.slice(-10);
  const area = ten.slice(0, 3);
  return `(${area}) XXX-XXXX`;
}

// "john.doe@gmail.com" -> "johXXX@XXX.com"
// Keeps the first 3 chars of the local-part, masks the rest of the local
// and the domain name, but preserves the TLD so readers can still tell
// "gmail vs custom domain" at a glance without exposing the full address.
export function maskEmail(email: string | null | undefined): string {
  if (!hasContent(email)) return "";
  const at = email.indexOf("@");
  if (at <= 0) return `${X}@${X}`;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const localHead = local.slice(0, 3);
  const dot = domain.lastIndexOf(".");
  const tld = dot >= 0 ? domain.slice(dot) : "";
  return `${localHead}${X}@${X}${tld}`;
}

const STREET_SUFFIXES = new Set([
  "st", "street", "ave", "avenue", "rd", "road", "blvd", "boulevard",
  "dr", "drive", "ln", "lane", "way", "ct", "court", "pl", "place",
  "pkwy", "parkway", "ter", "terrace", "hwy", "highway", "cir", "circle",
  "trl", "trail", "sq", "square", "row",
]);

// "123 Main Street" -> "123 XXX Street"
// "500 South Oak Ave" -> "500 XXX Ave"
// If no house number, still mask the street name but keep any suffix.
// City / state / zip are NOT handled here — those stay visible on the page.
export function maskStreet(street: string | null | undefined): string {
  if (!hasContent(street)) return "";
  const parts = street.trim().split(/\s+/);
  if (parts.length === 0) return "";

  // House number = leading token that starts with a digit.
  const first = parts[0];
  const hasNumber = /^\d/.test(first);
  const number = hasNumber ? first : "";
  const rest = hasNumber ? parts.slice(1) : parts;

  // Suffix = last token if it looks like a street-type word.
  let suffix = "";
  if (rest.length > 0) {
    const last = rest[rest.length - 1].replace(/[.,]/g, "").toLowerCase();
    if (STREET_SUFFIXES.has(last)) {
      suffix = rest[rest.length - 1];
    }
  }

  const masked = [number, X, suffix].filter(Boolean).join(" ");
  return masked;
}
