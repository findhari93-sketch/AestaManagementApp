"use client";

import { useNotifications } from "@/contexts/NotificationContext";
import SettlementFormDialog from "./SettlementFormDialog";
import SettlementDetailsDialog from "./SettlementDetailsDialog";

/**
 * Component that manages settlement dialogs based on notification context state.
 * Should be placed in a layout where it can be accessed globally.
 */
export default function SettlementDialogManager() {
  const { settlementDialog, closeSettlementDialog, refreshNotifications } =
    useNotifications();

  const handleSuccess = () => {
    // Refresh notifications after successful settlement action
    refreshNotifications();
  };

  return (
    <>
      {/* Settlement Form Dialog (for site engineers) */}
      <SettlementFormDialog
        open={settlementDialog.type === "form" && !!settlementDialog.transactionId}
        onClose={closeSettlementDialog}
        transactionId={settlementDialog.transactionId || ""}
        onSuccess={handleSuccess}
      />

      {/* Settlement Details Dialog (for admin/office) */}
      <SettlementDetailsDialog
        open={
          settlementDialog.type === "details" && !!settlementDialog.transactionId
        }
        onClose={closeSettlementDialog}
        transactionId={settlementDialog.transactionId || ""}
        onSuccess={handleSuccess}
      />
    </>
  );
}
