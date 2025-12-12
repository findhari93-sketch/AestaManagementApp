// Supabase Edge Function: Generate Attendance Notifications
// Runs daily at 10:00 AM IST (04:30 UTC) via cron
// Creates notifications for sites with no attendance and no holiday marked

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for potential manual invocations
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Site {
  id: string;
  name: string;
  status: string;
}

interface User {
  id: string;
  role: string;
  assigned_sites: string[] | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    console.log(`[Notification Cron] Starting for date: ${today}`);

    // 1. Get all active sites
    const { data: sites, error: sitesError } = await supabase
      .from("sites")
      .select("id, name, status")
      .eq("status", "active");

    if (sitesError) {
      throw new Error(`Failed to fetch sites: ${sitesError.message}`);
    }

    if (!sites || sites.length === 0) {
      console.log("[Notification Cron] No active sites found");
      return new Response(
        JSON.stringify({ message: "No active sites", notificationsCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Notification Cron] Found ${sites.length} active sites`);

    // 2. Get all sites with attendance today
    const { data: sitesWithAttendance, error: attendanceError } = await supabase
      .from("daily_attendance")
      .select("site_id")
      .eq("date", today)
      .eq("is_deleted", false);

    if (attendanceError) {
      console.error("Error fetching attendance:", attendanceError);
    }

    const sitesWithAttendanceIds = new Set(
      (sitesWithAttendance || []).map((a) => a.site_id)
    );

    // 3. Get all sites with holiday today
    const { data: sitesWithHoliday, error: holidayError } = await supabase
      .from("site_holidays")
      .select("site_id")
      .eq("date", today);

    if (holidayError) {
      console.error("Error fetching holidays:", holidayError);
    }

    const sitesWithHolidayIds = new Set(
      (sitesWithHoliday || []).map((h) => h.site_id)
    );

    // 4. Find sites that need notifications (no attendance AND no holiday)
    const sitesNeedingNotification = sites.filter(
      (site: Site) =>
        !sitesWithAttendanceIds.has(site.id) &&
        !sitesWithHolidayIds.has(site.id)
    );

    console.log(
      `[Notification Cron] ${sitesNeedingNotification.length} sites need notifications`
    );

    if (sitesNeedingNotification.length === 0) {
      return new Response(
        JSON.stringify({
          message: "All sites have attendance or are marked as holiday",
          notificationsCreated: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Get all active users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, role, assigned_sites")
      .eq("status", "active");

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // 6. Check for existing notifications to avoid duplicates
    const { data: existingNotifications, error: existingError } = await supabase
      .from("notifications")
      .select("user_id, related_id")
      .eq("notification_type", "attendance_reminder")
      .eq("related_table", "sites")
      .gte("created_at", `${today}T00:00:00Z`);

    if (existingError) {
      console.error("Error checking existing notifications:", existingError);
    }

    // Create a set of existing notification keys (user_id:site_id)
    const existingNotificationKeys = new Set(
      (existingNotifications || []).map((n) => `${n.user_id}:${n.related_id}`)
    );

    // 7. Create notifications
    const notifications: Array<{
      user_id: string;
      title: string;
      message: string;
      notification_type: string;
      related_id: string;
      related_table: string;
      action_url: string;
    }> = [];

    for (const site of sitesNeedingNotification) {
      // Find users who should receive notification for this site
      const eligibleUsers = (users || []).filter((user: User) => {
        // Admin gets notifications for all sites
        if (user.role === "admin") return true;

        // Other users only if this site is in their assigned_sites
        if (user.assigned_sites && user.assigned_sites.includes(site.id)) {
          return true;
        }

        // If no assigned_sites, they have access to all sites
        if (!user.assigned_sites || user.assigned_sites.length === 0) {
          return true;
        }

        return false;
      });

      for (const user of eligibleUsers) {
        // Skip if notification already exists for this user and site today
        const key = `${user.id}:${site.id}`;
        if (existingNotificationKeys.has(key)) {
          continue;
        }

        notifications.push({
          user_id: user.id,
          title: `No attendance for ${site.name}`,
          message: `Attendance has not been recorded for ${site.name} today. Please update the attendance or mark as holiday.`,
          notification_type: "attendance_reminder",
          related_id: site.id,
          related_table: "sites",
          action_url: `/site/attendance?autoOpen=true`,
        });
      }
    }

    console.log(
      `[Notification Cron] Creating ${notifications.length} notifications`
    );

    // 8. Insert notifications in batches
    if (notifications.length > 0) {
      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("notifications")
          .insert(batch);

        if (insertError) {
          console.error(`Error inserting batch ${i / batchSize}:`, insertError);
        } else {
          insertedCount += batch.length;
        }
      }

      console.log(
        `[Notification Cron] Successfully created ${insertedCount} notifications`
      );

      // 9. Send push notifications (if configured)
      // This would require web-push library and VAPID keys
      // For now, we rely on in-app notifications

      return new Response(
        JSON.stringify({
          message: "Notifications created successfully",
          notificationsCreated: insertedCount,
          sitesChecked: sites.length,
          sitesNeedingAction: sitesNeedingNotification.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        message: "No new notifications needed",
        notificationsCreated: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Notification Cron] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
