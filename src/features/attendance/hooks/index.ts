/**
 * Attendance hooks
 * Centralized exports for all attendance state management hooks
 */

export { useAttendanceState } from "./useAttendanceState";
export type { AttendanceState, AttendanceAction } from "./attendanceState.types";
export { attendanceReducer, initialAttendanceState } from "./attendanceReducer";
