import { getSelectedSiteIdFromCookie } from "@/lib/cookies/site-cookie";
import { getAttendancePageData } from "@/lib/data/attendance";
import AttendanceContent from "./attendance-content";

// Feature flag for refactored attendance component
// Set NEXT_PUBLIC_FF_ATTENDANCE_REFACTOR=true in .env to enable
const USE_REFACTORED_ATTENDANCE = process.env.NEXT_PUBLIC_FF_ATTENDANCE_REFACTOR === "true";

// Conditionally import refactored component only when enabled
// This keeps the bundle size optimal when the flag is off
const AttendanceContentRefactored = USE_REFACTORED_ATTENDANCE
  ? require("@/features/attendance/AttendanceContentRefactored").default
  : null;

export default async function AttendancePage() {
  // Get the selected site ID from cookie
  const siteId = await getSelectedSiteIdFromCookie();

  // If no site is selected, render the client component with null data
  // It will handle the "no site selected" message
  if (!siteId) {
    // Use refactored component when feature flag is enabled
    if (USE_REFACTORED_ATTENDANCE && AttendanceContentRefactored) {
      return <AttendanceContentRefactored initialData={null} />;
    }
    return <AttendanceContent initialData={null} />;
  }

  // Fetch attendance data on the server (default date range: last 7 days)
  const attendanceData = await getAttendancePageData(siteId);

  // Use refactored component when feature flag is enabled
  if (USE_REFACTORED_ATTENDANCE && AttendanceContentRefactored) {
    return <AttendanceContentRefactored initialData={attendanceData} />;
  }
  return <AttendanceContent initialData={attendanceData} />;
}
