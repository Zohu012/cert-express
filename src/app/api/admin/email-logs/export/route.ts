import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

const SORTABLE_COLS = [
  "sentAt", "serviceDate", "companyName", "usdotNumber", "toEmail",
  "clickCount", "lastClickAt", "openCount", "firstOpenAt", "orderDate",
] as const;
type SortCol = typeof SORTABLE_COLS[number];
type PrismaSortCol = Exclude<SortCol, "orderDate">;

function toSortCol(s: string | null | undefined): SortCol {
  return (SORTABLE_COLS as readonly string[]).includes(s ?? "")
    ? (s as SortCol)
    : "sentAt";
}

function makeOrderBy(
  col: PrismaSortCol,
  dir: "asc" | "desc"
): Prisma.EmailLogOrderByWithRelationInput {
  const map: Record<PrismaSortCol, Prisma.EmailLogOrderByWithRelationInput> = {
    sentAt:       { sentAt:      dir },
    serviceDate:  { company: { serviceDate: dir } },
    companyName:  { company: { companyName:  dir } },
    usdotNumber:  { company: { usdotNumber:  dir } },
    toEmail:      { toEmail:     dir },
    clickCount:   { clickCount:  dir },
    lastClickAt:  { lastClickAt: dir },
    openCount:    { openCount:   dir },
    firstOpenAt:  { firstOpenAt: dir },
  };
  return map[col];
}

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d;
}

function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const query        = url.searchParams.get("q")        || "";
  const dateFrom     = url.searchParams.get("dateFrom") || "";
  const dateTo       = url.searchParams.get("dateTo")   || "";
  const clickFilter  = url.searchParams.get("clicks")   || "";
  const openedFilter = url.searchParams.get("opened")   || "";
  const sortBy       = toSortCol(url.searchParams.get("sort"));
  const sortDir      = url.searchParams.get("dir") === "asc" ? "asc" : "desc";

  const where: Prisma.EmailLogWhereInput = {};
  if (query) {
    where.OR = [
      { toEmail:  { contains: query } },
      { company: { companyName: { contains: query } } },
      { company: { usdotNumber: { contains: query } } },
    ];
  }
  if (dateFrom || dateTo) {
    const f: Prisma.DateTimeFilter = {};
    if (dateFrom) f.gte = new Date(dateFrom);
    if (dateTo)   f.lt  = endOfDay(dateTo);
    where.sentAt = f;
  }
  if (clickFilter  === "yes") where.clickCount = { gt: 0 };
  else if (clickFilter === "no") where.clickCount = 0;
  if (openedFilter === "yes") where.openCount = { gt: 0 };
  else if (openedFilter === "no") where.openCount = 0;

  const include = {
    company: { select: { companyName: true, usdotNumber: true, serviceDate: true } },
  } as const;

  const rows = sortBy === "orderDate"
    ? await prisma.emailLog.findMany({ where, include })
    : await prisma.emailLog.findMany({ where, orderBy: makeOrderBy(sortBy, sortDir), include });

  const companyIds = [...new Set(rows.map(r => r.companyId))];
  const paidOrders = companyIds.length > 0
    ? await prisma.order.findMany({
        where: { companyId: { in: companyIds }, status: "completed" },
        select: { companyId: true, createdAt: true },
      })
    : [];

  const latestOrderByCompany = new Map<string, Date>();
  for (const o of paidOrders) {
    const existing = latestOrderByCompany.get(o.companyId);
    if (!existing || o.createdAt > existing) {
      latestOrderByCompany.set(o.companyId, o.createdAt);
    }
  }

  if (sortBy === "orderDate") {
    // Nulls last in both directions (matches the page).
    rows.sort((a, b) => {
      const da = latestOrderByCompany.get(a.companyId);
      const db = latestOrderByCompany.get(b.companyId);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return sortDir === "asc"
        ? da.getTime() - db.getTime()
        : db.getTime() - da.getTime();
    });
  }

  const header = [
    "Sent At", "Doc Date", "Company", "US DOT #", "Email",
    "Opened", "Clicks", "Last Click", "Order Date",
  ];

  const lines: string[] = [header.map(csvEscape).join(",")];
  for (const r of rows) {
    const docDate = r.company.serviceDate ? isoDateOnly(new Date(r.company.serviceDate)) : "";
    const opened  = r.firstOpenAt ? new Date(r.firstOpenAt).toISOString() : "";
    const lastClk = r.lastClickAt ? new Date(r.lastClickAt).toISOString() : "";
    const orderD  = latestOrderByCompany.get(r.companyId);
    const orderDate = orderD ? isoDateOnly(orderD) : "";
    lines.push([
      new Date(r.sentAt).toISOString(),
      docDate,
      r.company.companyName,
      r.company.usdotNumber,
      r.toEmail,
      opened,
      String(r.clickCount),
      lastClk,
      orderDate,
    ].map(csvEscape).join(","));
  }

  // UTF-8 BOM so Excel detects encoding correctly for non-ASCII names.
  const body = "﻿" + lines.join("\r\n");
  const filename = `email-history-${dateFrom || "all"}_to_${dateTo || "today"}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
