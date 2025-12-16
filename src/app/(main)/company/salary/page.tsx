import { Suspense } from "react";
import { getSalaryPageData } from "@/lib/data/salary";
import SalaryContent from "./salary-content";
import SalarySkeleton from "./salary-skeleton";

export default async function CompanySalaryPage() {
  // Fetch salary data on the server
  // Note: Salary data is company-wide, not site-specific
  const salaryData = await getSalaryPageData();

  return (
    <Suspense fallback={<SalarySkeleton />}>
      <SalaryContent initialData={salaryData} />
    </Suspense>
  );
}
