import { cookies } from "next/headers";

export const SELECTED_SITE_COOKIE = "selectedSiteId";

/**
 * Server-side function to read the selected site ID from cookies.
 * Use this in Server Components and Route Handlers.
 */
export async function getSelectedSiteIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SELECTED_SITE_COOKIE)?.value || null;
}
