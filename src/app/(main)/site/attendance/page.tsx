import { Suspense } from "react";
import { getSelectedSiteIdFromCookie } from "@/lib/cookies/site-cookie";
import { getAttendancePageData } from "@/lib/data/attendance";
import AttendanceContent from "./attendance-content";
import AttendanceSkeleton from "./attendance-skeleton";

// Feature flag for refactored attendance component
// Set NEXT_PUBLIC_FF_ATTENDANCE_REFACTOR=true in .env to enable
const USE_REFACTORED_ATTENDANCE = process.env.NEXT_PUBLIC_FF_ATTENDANCE_REFACTOR === "true";

// Conditionally import refactored component only when enabled
// This keeps the bundle size optimal when the flag is off
const AttendanceContentRefactored = USE_REFACTORED_ATTENDANCE
  ? require("@/features/attendance/AttendanceContentRefactored").default
  : null;

async function AttendanceData({ siteId }: { siteId: string }) {
  const attendanceData = await getAttendancePageData(siteId);

  if (USE_REFACTORED_ATTENDANCE && AttendanceContentRefactored) {
    return <AttendanceContentRefactored initialData={attendanceData} />;
  }
  return <AttendanceContent initialData={attendanceData} />;
}

export default async function AttendancePage() {
  const siteId = await getSelectedSiteIdFromCookie();

  // If no site is selected, render the client component with null data
  // It will handle the "no site selected" message
  if (!siteId) {
    if (USE_REFACTORED_ATTENDANCE && AttendanceContentRefactored) {
      return <AttendanceContentRefactored initialData={null} />;
    }
    return <AttendanceContent initialData={null} />;
  }

  // Suspense lets the RSC stream commit immediately with the skeleton,
  // so navigation transitions instantly even while the heavy fetch runs.
  return (
    <Suspense fallback={<AttendanceSkeleton />}>
      <AttendanceData siteId={siteId} />
    </Suspense>
  );
}
