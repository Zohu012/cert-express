import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";

export default async function AdminDashboard() {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const [totalCompanies, totalOrders, completedOrders, totalRevenue, recentPdfs] =
    await Promise.all([
      prisma.company.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: "completed" } }),
      prisma.order.aggregate({
        where: { status: "completed" },
        _sum: { amount: true },
      }),
      prisma.sourcePdf.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  const revenue = (totalRevenue._sum.amount || 0) / 100;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Companies" value={totalCompanies.toLocaleString()} />
        <StatCard label="Total Orders" value={totalOrders.toLocaleString()} />
        <StatCard label="Completed Sales" value={completedOrders.toLocaleString()} />
        <StatCard
          label="Total Revenue"
          value={`$${revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
        />
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Recent PDF Uploads</h2>
        {recentPdfs.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No PDFs uploaded yet. Go to Upload PDF to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Filename</th>
                  <th className="pb-2 pr-4">Issue Date</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Companies</th>
                  <th className="pb-2">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {recentPdfs.map((pdf) => (
                  <tr key={pdf.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{pdf.filename}</td>
                    <td className="py-2 pr-4">
                      {new Date(pdf.issueDate).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          pdf.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : pdf.status === "processing"
                              ? "bg-yellow-100 text-yellow-800"
                              : pdf.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {pdf.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{pdf.companyCount}</td>
                    <td className="py-2 text-gray-500">
                      {new Date(pdf.createdAt).toLocaleString()}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}
