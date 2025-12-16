import { Suspense } from "react";
import { getSelectedSiteIdFromCookie } from "@/lib/cookies/site-cookie";
import { getAttendancePageData } from "@/lib/data/attendance";
import AttendanceContent from "./attendance-content";
import AttendanceSkeleton from "./attendance-skeleton";

export default async function AttendancePage() {
  // Get the selected site ID from cookie
  const siteId = await getSelectedSiteIdFromCookie();

  // If no site is selected, render the client component with null data
  // It will handle the "no site selected" message
  if (!siteId) {
    return (
      <Suspense fallback={<AttendanceSkeleton />}>
        <AttendanceContent initialData={null} />
      </Suspense>
    );
  }

  // Fetch attendance data on the server (default date range: last 7 days)
  const attendanceData = await getAttendancePageData(siteId);

  return (
    <Suspense fallback={<AttendanceSkeleton />}>
      <AttendanceContent initialData={attendanceData} />
    </Suspense>
  );
}
