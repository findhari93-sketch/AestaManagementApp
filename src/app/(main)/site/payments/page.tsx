import { getSelectedSiteIdFromCookie } from "@/lib/cookies/site-cookie";
import { getPaymentPageData } from "@/lib/data/payments";
import PaymentsContent from "./payments-content";

export default async function PaymentsPage() {
  // Get the selected site ID from cookie
  const siteId = await getSelectedSiteIdFromCookie();

  // If no site is selected, render the client component with null data
  // It will handle the "no site selected" message
  if (!siteId) {
    return <PaymentsContent initialData={null} />;
  }

  // Fetch payment data on the server (default date range: last 30 days)
  const paymentData = await getPaymentPageData(siteId);

  return <PaymentsContent initialData={paymentData} />;
}
