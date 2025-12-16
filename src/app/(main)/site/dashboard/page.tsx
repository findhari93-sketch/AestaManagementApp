import { Suspense } from "react";
import { getSelectedSiteIdFromCookie } from "@/lib/cookies/site-cookie";
import { getDashboardData } from "@/lib/data/dashboard";
import DashboardContent from "./dashboard-content";
import DashboardSkeleton from "./dashboard-skeleton";

export default async function SiteDashboardPage() {
  const siteId = await getSelectedSiteIdFromCookie();

  // If no site selected, render client component without data
  // It will show "Please select a site" message
  if (!siteId) {
    return <DashboardContent serverSiteId={null} initialData={null} />;
  }

  // Fetch dashboard data on the server
  const dashboardData = await getDashboardData(siteId);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent serverSiteId={siteId} initialData={dashboardData} />
    </Suspense>
  );
}
