import { verifySession } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only show the admin navbar when the viewer is authenticated.
  // Login page (and any other unauthenticated admin routes) render without it.
  const adminId = await verifySession();

  if (!adminId) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  );
}
