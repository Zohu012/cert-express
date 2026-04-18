import Link from "next/link";
import { Card } from "@/components/ui/card";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function UnsubscribedPage() {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const unsubscribed = await prisma.company.findMany({
    where: { emailStatus: "unsubscribed" },
    select: {
      id: true,
      companyName: true,
      email: true,
      usdotNumber: true,
      documentType: true,
      emailSentAt: true,
    },
    orderBy: { emailSentAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Unsubscribed ({unsubscribed.length})</h1>
        <Link
          href="/admin/emails"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          ← Back to Campaigns
        </Link>
      </div>

      <Card>
        {unsubscribed.length === 0 ? (
          <p className="text-gray-400 text-sm">No unsubscribed contacts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Company</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">USDOT</th>
                  <th className="pb-2 pr-4 font-medium">Document</th>
                  <th className="pb-2 font-medium">Last Emailed</th>
                </tr>
              </thead>
              <tbody>
                {unsubscribed.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.companyName}</td>
                    <td className="py-2 pr-4 text-gray-600">{c.email}</td>
                    <td className="py-2 pr-4 text-gray-600">{c.usdotNumber}</td>
                    <td className="py-2 pr-4 text-gray-600">{c.documentType}</td>
                    <td className="py-2 text-gray-500">
                      {c.emailSentAt
                        ? new Date(c.emailSentAt).toLocaleDateString("en-US")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
