// FMCSA Company Census File client (Socrata SODA API).
//
// Dataset: https://data.transportation.gov/Trucking-and-Motorcoaches/Company-Census-File/az4n-8mr2
// Replaces the otrucking.com Cloudflare scraper. No browser, no CDP.

const DATASET_ID = "az4n-8mr2";
const RESOURCE_URL = `https://data.transportation.gov/resource/${DATASET_ID}.json`;
const APP_TOKEN = process.env.SOCRATA_APP_TOKEN;
const PAGE_SIZE = 50_000; // SODA hard cap per request

export interface OtruckingScrapeResult {
  companyName: string | null;
  physicalAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  companyOfficer: string | null;
  dotStatus: string | null;
  entityType: string | null;
  estYear: string | null;
  powerUnits: string | null;
  drivers: string | null;
  safetyRating: string | null;
  authorityStatus: string | null;
  authoritySince: string | null;
  carrierType: string | null;
  hazmat: string | null;
  passengerCarrier: string | null;
  mcs150Update: string | null;
  county: string | null;
  fleetBreakdown: string | null;
  cargoTypes: string | null;
  equipmentTypes: string | null;
}

export interface FmcsaMapped {
  usdotNumber: string;
  sourceUrl: string;
  data: OtruckingScrapeResult;
  mcs150Date: string | null; // raw watermark for incremental sync
}

type SodaRow = Record<string, string | number | null | undefined>;

function val(row: SodaRow, key: string): string | null {
  const v = row[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function joinNonEmpty(parts: (string | null)[], sep = "; "): string | null {
  const filtered = parts.filter((p): p is string => !!p && p.trim() !== "");
  return filtered.length === 0 ? null : filtered.join(sep);
}

// FMCSA cargo classification fields are individual `crgo_*` columns set to "X" when applicable.
// Aggregate every such column into a JSON object of { humanLabel: true }.
// Cargo label map: FMCSA crgo_* column suffix → human-readable label
const CARGO_LABELS: Record<string, string> = {
  genfreight: "General Freight",
  household: "Household Goods",
  metal: "Metal: Sheets, Coils, Rolls",
  motorveh: "Motor Vehicles",
  driveaway: "Drive/Tow Away",
  logpole: "Logs, Poles, Beams, Lumber",
  building: "Building Materials",
  mobilehome: "Mobile Homes",
  machlarge: "Machinery, Large Objects",
  oilfield: "Oilfield Equipment",
  livestock: "Livestock",
  grainfeed: "Grain, Feed, Hay",
  coalcoke: "Coal/Coke",
  meat: "Meat",
  garbage: "Garbage/Refuse",
  usmail: "U.S. Mail",
  chemicals: "Chemicals",
  commdryblk: "Commodities Dry Bulk",
  refrigfood: "Refrigerated Food",
  beverages: "Beverages",
  paperprod: "Paper Products",
  utilities: "Utilities",
  farmsupply: "Farm Supplies",
  construction: "Construction",
  waterwell: "Water Well",
  cargoothr: "Other",
  intermodal: "Intermodal Containers",
  passengers: "Passengers",
  charter: "Charter/Tour",
  schoolbus: "School Bus",
  religion: "Religious Organization",
  urbantrans: "Urban/Mass Transit",
  migrant: "Migrant",
  usgovcargo: "U.S. Government",
};

function buildCargoTypes(row: SodaRow): string | null {
  const labels: string[] = [];
  for (const [key, raw] of Object.entries(row)) {
    if (!key.startsWith("crgo_")) continue;
    if (String(raw).trim().toUpperCase() !== "X") continue;
    const suffix = key.replace(/^crgo_/, "");
    labels.push(CARGO_LABELS[suffix] ?? suffix.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  return labels.length === 0 ? null : JSON.stringify(labels);
}

function buildFleetBreakdown(row: SodaRow): string | null {
  const obj = {
    truckUnits: val(row, "truck_units"),
    powerUnits: val(row, "power_units"),
    busUnits: val(row, "bus_units"),
    ownedTractors: val(row, "owntract"),
  };
  const hasAny = Object.values(obj).some((v) => v != null);
  return hasAny ? JSON.stringify(obj) : null;
}

function buildEquipmentTypes(row: SodaRow): string | null {
  const types: string[] = [];
  const trucks = val(row, "truck_units");
  const owned = val(row, "owntract");
  if (trucks && trucks !== "0") types.push(`${trucks} Truck(s)`);
  if (owned && owned !== "0") types.push(`${owned} Owned Tractor(s)`);
  return types.length === 0 ? null : JSON.stringify(types);
}

function statusCodeToLabel(code: string | null): string | null {
  if (!code) return null;
  const c = code.toUpperCase();
  if (c === "A") return "ACTIVE";
  if (c === "I") return "INACTIVE";
  return c;
}

function docketStatusToLabel(code: string | null): string | null {
  if (!code) return null;
  const c = code.toUpperCase();
  if (c === "A") return "Active";
  if (c === "I") return "Inactive";
  return c;
}

function deriveEstYear(addDate: string | null): string | null {
  if (!addDate) return null;
  const m = addDate.match(/^(\d{4})/);
  return m ? m[1] : null;
}

function derivePassengerCarrier(row: SodaRow): string | null {
  const bus = val(row, "bus_units");
  if (bus == null) return null;
  return Number(bus) > 0 ? "Yes" : "No";
}

export function mapFmcsaRow(row: SodaRow): FmcsaMapped | null {
  const dot = val(row, "dot_number");
  if (!dot) return null;

  const data: OtruckingScrapeResult = {
    companyName: val(row, "dba_name") ?? val(row, "legal_name"),
    physicalAddress: val(row, "phy_street"),
    city: val(row, "phy_city"),
    state: val(row, "phy_state"),
    zipCode: val(row, "phy_zip"),
    phone: val(row, "phone"),
    email: val(row, "email_address"),
    companyOfficer: joinNonEmpty([val(row, "company_officer_1"), val(row, "company_officer_2")]),
    dotStatus: statusCodeToLabel(val(row, "status_code")),
    entityType: val(row, "business_org_desc"),
    estYear: deriveEstYear(val(row, "add_date")),
    powerUnits: val(row, "power_units"),
    drivers: val(row, "total_drivers"),
    safetyRating: null, // not in this dataset
    authorityStatus: docketStatusToLabel(val(row, "docket1_status_code")),
    authoritySince: null, // not in this dataset
    carrierType: val(row, "classdef"),
    hazmat: val(row, "hm_ind"),
    passengerCarrier: derivePassengerCarrier(row),
    mcs150Update: val(row, "mcs150_date"),
    county: val(row, "phy_cnty"),
    fleetBreakdown: buildFleetBreakdown(row),
    cargoTypes: buildCargoTypes(row),
    equipmentTypes: buildEquipmentTypes(row),
  };

  return {
    usdotNumber: dot,
    sourceUrl: `${RESOURCE_URL}?dot_number=${dot}`,
    data,
    mcs150Date: val(row, "mcs150_date"),
  };
}

function buildHeaders(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (APP_TOKEN) h["X-App-Token"] = APP_TOKEN;
  return h;
}

async function sodaGet(params: URLSearchParams): Promise<SodaRow[]> {
  const url = `${RESOURCE_URL}?${params.toString()}`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw new Error(`SODA GET ${url} → HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as SodaRow[];
}

export async function fetchCarrierByDot(dotNumber: string): Promise<FmcsaMapped | null> {
  const rows = await sodaGet(new URLSearchParams({ dot_number: dotNumber, $limit: "1" }));
  if (rows.length === 0) return null;
  return mapFmcsaRow(rows[0]);
}

interface PageOpts {
  /** Optional SoQL WHERE clause (without the leading `$where=`). */
  where?: string;
  /** Page size override (default PAGE_SIZE = 50000). */
  limit?: number;
  /** Stop after N rows total. */
  maxRows?: number;
  /** Called after each page so callers can log progress. */
  onPage?: (info: { fetched: number; offset: number; pageRows: number }) => void;
}

async function* paginate(opts: PageOpts = {}): AsyncIterable<SodaRow> {
  const limit = opts.limit ?? PAGE_SIZE;
  let offset = 0;
  let fetched = 0;
  while (true) {
    const params = new URLSearchParams({
      $limit: String(limit),
      $offset: String(offset),
      $order: "dot_number", // stable order required for offset paging
    });
    if (opts.where) params.set("$where", opts.where);

    const rows = await sodaGet(params);
    opts.onPage?.({ fetched, offset, pageRows: rows.length });
    if (rows.length === 0) return;

    for (const row of rows) {
      yield row;
      fetched++;
      if (opts.maxRows && fetched >= opts.maxRows) return;
    }
    if (rows.length < limit) return;
    offset += limit;
  }
}

export async function* fetchAllCarriers(opts: {
  maxRows?: number;
  onPage?: PageOpts["onPage"];
} = {}): AsyncIterable<FmcsaMapped> {
  for await (const row of paginate({ maxRows: opts.maxRows, onPage: opts.onPage })) {
    const mapped = mapFmcsaRow(row);
    if (mapped) yield mapped;
  }
}

export async function* fetchCarriersChangedSince(
  watermark: string,
  opts: { maxRows?: number; onPage?: PageOpts["onPage"] } = {}
): AsyncIterable<FmcsaMapped> {
  // mcs150_date is a text field shaped like "20260506 1125" — lexical >= works.
  const where = `mcs150_date >= '${watermark}'`;
  for await (const row of paginate({ where, maxRows: opts.maxRows, onPage: opts.onPage })) {
    const mapped = mapFmcsaRow(row);
    if (mapped) yield mapped;
  }
}
