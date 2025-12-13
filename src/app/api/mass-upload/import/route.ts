import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canPerformMassUpload } from "@/lib/permissions";
import { MassUploadTableName, ImportRequest, ImportResult } from "@/types/mass-upload.types";
import { getTableConfig } from "@/lib/mass-upload/tableConfigs";
import {
  prepareBatchForInsert,
  getUpsertConfig,
  splitIntoBatches,
} from "@/lib/mass-upload/transformers";

const BATCH_SIZE = 50; // Process 50 rows at a time

/**
 * Verify mass upload access
 */
async function verifyMassUploadAccess(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      error: "You must be logged in to perform this action.",
      user: null,
      userProfile: null,
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, name")
    .eq("auth_id", user.id)
    .single();

  const userProfile = profile as { role: string; name: string } | null;

  if (!userProfile || !canPerformMassUpload(userProfile.role)) {
    return {
      authorized: false,
      error: "Only Admin and Office staff can perform mass uploads.",
      user: null,
      userProfile: null,
    };
  }

  return { authorized: true, error: null, user, userProfile };
}

/**
 * POST /api/mass-upload/import
 * Batch import data to database
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify access
    const { authorized, error: authError, user, userProfile } =
      await verifyMassUploadAccess(supabase);
    if (!authorized || !user || !userProfile) {
      return NextResponse.json(
        { success: false, error: authError },
        { status: 403 }
      );
    }

    const body: ImportRequest = await request.json();
    const { tableName, siteId, rows, userId, userName } = body;

    if (!tableName || !rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Table name and rows are required" },
        { status: 400 }
      );
    }

    const config = getTableConfig(tableName);
    if (!config || config.fields.length === 0) {
      return NextResponse.json(
        { success: false, error: `No configuration found for table: ${tableName}` },
        { status: 400 }
      );
    }

    // Validate site requirement
    if (config.requiredContext.includes("site_id") && !siteId) {
      return NextResponse.json(
        { success: false, error: "Site ID is required for this table" },
        { status: 400 }
      );
    }

    // Prepare rows for insert
    const preparedRows = prepareBatchForInsert(rows, tableName, {
      siteId,
      userId: userId || user.id,
      userName: userName || userProfile.name,
    });

    // Split into batches
    const batches = splitIntoBatches(preparedRows, BATCH_SIZE);
    const upsertConfig = getUpsertConfig(tableName);

    const result: ImportResult = {
      success: true,
      summary: {
        total: rows.length,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      },
      errors: [],
    };

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const startRow = batchIndex * BATCH_SIZE + 2; // +2 for header and 1-based

      try {
        if (upsertConfig.canUpsert) {
          // Use upsert if table supports it
          const { data, error } = await (supabase.from(tableName) as any)
            .upsert(batch, {
              onConflict: upsertConfig.conflictColumns.join(","),
            })
            .select();

          if (error) {
            throw error;
          }

          // For upsert, we count all as inserted (Supabase doesn't distinguish)
          result.summary.inserted += batch.length;
        } else {
          // Use insert for tables without upsert
          const { data, error } = await (supabase.from(tableName) as any)
            .insert(batch)
            .select();

          if (error) {
            throw error;
          }

          result.summary.inserted += batch.length;
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Batch ${batchIndex + 1} error:`, err);

        // Try inserting rows one by one to identify which ones failed
        for (let i = 0; i < batch.length; i++) {
          try {
            if (upsertConfig.canUpsert) {
              await (supabase.from(tableName) as any)
                .upsert([batch[i]], {
                  onConflict: upsertConfig.conflictColumns.join(","),
                });
            } else {
              await (supabase.from(tableName) as any).insert([batch[i]]);
            }
            result.summary.inserted += 1;
          } catch (rowErr: unknown) {
            const rowErrorMessage = rowErr instanceof Error ? rowErr.message : String(rowErr);
            result.summary.errors += 1;
            result.errors.push({
              rowNumber: startRow + i,
              error: rowErrorMessage,
            });
          }
        }
      }
    }

    // Determine overall success
    result.success = result.summary.errors === 0;

    // Log the import (optional - could add import_logs table later)
    console.log(
      `Mass upload completed: ${tableName}, ` +
        `${result.summary.inserted} inserted, ${result.summary.errors} errors`
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Import error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        summary: {
          total: 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: 0,
        },
        errors: [],
      },
      { status: 500 }
    );
  }
}
