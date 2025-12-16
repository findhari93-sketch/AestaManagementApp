import { Suspense } from "react";
import { getLaborersPageData } from "@/lib/data/laborers";
import LaborersContent from "./laborers-content";
import LaborersSkeleton from "./laborers-skeleton";

export default async function LaborersPage() {
  // Fetch laborers data on the server
  // Note: Laborers are company-wide, not site-specific
  const laborersData = await getLaborersPageData();

  return (
    <Suspense fallback={<LaborersSkeleton />}>
      <LaborersContent initialData={laborersData} />
    </Suspense>
  );
}
