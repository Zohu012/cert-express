import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPushToken } from "@/lib/otrucking-sync-auth";

const dataSchema = z
  .object({
    companyName: z.string().nullable(),
    physicalAddress: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zipCode: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    companyOfficer: z.string().nullable(),
    dotStatus: z.string().nullable(),
    entityType: z.string().nullable(),
    estYear: z.string().nullable(),
    powerUnits: z.string().nullable(),
    drivers: z.string().nullable(),
    safetyRating: z.string().nullable(),
    authorityStatus: z.string().nullable(),
    authoritySince: z.string().nullable(),
    carrierType: z.string().nullable(),
    hazmat: z.string().nullable(),
    passengerCarrier: z.string().nullable(),
    mcs150Update: z.string().nullable(),
    county: z.string().nullable(),
    fleetBreakdown: z.string().nullable(),
    cargoTypes: z.string().nullable(),
    equipmentTypes: z.string().nullable(),
  })
  .partial();

const bodySchema = z.object({
  usdotNumber: z.string().min(1),
  sourceUrl: z.string().url(),
  status: z.enum(["success", "not_found", "error"]),
  error: z.string().optional().nullable(),
  data: dataSchema.optional(),
});

export async function POST(req: NextRequest) {
  if (!verifyPushToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.format() }, { status: 400 });
  }
  const { usdotNumber, sourceUrl, status, error, data } = parsed.data;

  if (status === "success" && data) {
    const nonNull: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v != null && v !== "") nonNull[k] = v as string;
    }
    await prisma.otruckingCompany.upsert({
      where: { usdotNumber },
      create: {
        usdotNumber,
        sourceUrl,
        ...data,
        scrapeStatus: "success",
        scrapeError: null,
        scrapedAt: new Date(),
      },
      update: {
        sourceUrl,
        ...nonNull,
        scrapeStatus: "success",
        scrapeError: null,
        scrapedAt: new Date(),
      },
    });
  } else {
    await prisma.otruckingCompany.upsert({
      where: { usdotNumber },
      create: {
        usdotNumber,
        sourceUrl,
        scrapeStatus: status,
        scrapeError: error || null,
        scrapedAt: null,
      },
      update: {
        sourceUrl,
        scrapeStatus: status,
        scrapeError: error || null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
