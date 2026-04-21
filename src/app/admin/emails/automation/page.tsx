import Link from "next/link";
import { Card } from "@/components/ui/card";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAutomationConfig,
  getAutomationState,
  countEligibleCandidates,
  isWithinWindow,
} from "@/lib/email-automation";
import { EmailAutomationForm } from "@/components/email-automation-form";
import { EmailAutomationDashboard } from "@/components/email-automation-dashboard";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const config = await getAutomationConfig();
  const state = await getAutomationState();
  const eligibleCount = await countEligibleCandidates(config);
  const withinWindow = isWithinWindow(config);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Email Automation</h1>
        <Link
          href="/admin/emails"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          ← Back to Campaigns
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <EmailAutomationForm initialConfig={config} />
          </Card>
        </div>
        <div>
          <Card>
            <EmailAutomationDashboard
              initialConfig={config}
              initialState={state}
              initialEligibleCount={eligibleCount}
              initialWithinWindow={withinWindow}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
