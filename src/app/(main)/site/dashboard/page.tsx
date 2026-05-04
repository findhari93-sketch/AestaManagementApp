import { Suspense } from "react";
import { getSelectedSiteIdFromCookie } from "@/lib/cookies/site-cookie";
import { getDashboardData } from "@/lib/data/dashboard";
import DashboardContent from "./dashboard-content";
import DashboardSkeleton from "./dashboard-skeleton";

async function DashboardData({ siteId }: { siteId: string }) {
  const dashboardData = await getDashboardData(siteId);
  return <DashboardContent serverSiteId={siteId} initialData={dashboardData} />;
}

export default async function SiteDashboardPage() {
  const siteId = await getSelectedSiteIdFromCookie();

  // If no site selected, render client component without data
  // It will show "Please select a site" message
  if (!siteId) {
    return <DashboardContent serverSiteId={null} initialData={null} />;
  }

  // Suspense lets the RSC stream commit immediately with the skeleton,
  // so navigation transitions instantly even while the heavy fetch runs.
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData siteId={siteId} />
    </Suspense>
  );
}
