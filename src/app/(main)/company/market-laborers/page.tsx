import { Suspense } from "react";
import { getMarketLaborerRatesPageData } from "@/lib/data/market-laborers";
import MarketLaborersContent from "./market-laborers-content";
import MarketLaborersSkeleton from "./market-laborers-skeleton";

export default async function MarketLaborersPage() {
  const pageData = await getMarketLaborerRatesPageData();

  return (
    <Suspense fallback={<MarketLaborersSkeleton />}>
      <MarketLaborersContent initialData={pageData} />
    </Suspense>
  );
}
