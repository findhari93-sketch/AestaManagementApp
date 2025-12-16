import { Suspense } from "react";
import { getSelectedSiteIdFromCookie } from "@/lib/cookies/site-cookie";
import { getPaymentPageData } from "@/lib/data/payments";
import PaymentsContent from "./payments-content";
import PaymentsSkeleton from "./payments-skeleton";

export default async function PaymentsPage() {
  // Get the selected site ID from cookie
  const siteId = await getSelectedSiteIdFromCookie();

  // If no site is selected, render the client component with null data
  // It will handle the "no site selected" message
  if (!siteId) {
    return (
      <Suspense fallback={<PaymentsSkeleton />}>
        <PaymentsContent initialData={null} />
      </Suspense>
    );
  }

  // Fetch payment data on the server (default date range: last 30 days)
  const paymentData = await getPaymentPageData(siteId);

  return (
    <Suspense fallback={<PaymentsSkeleton />}>
      <PaymentsContent initialData={paymentData} />
    </Suspense>
  );
}
