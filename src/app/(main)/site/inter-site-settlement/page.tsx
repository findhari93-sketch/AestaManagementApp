'use client'

import { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Alert,
  Tabs,
  Tab,
} from '@mui/material'
import {
  Inventory as BatchesIcon,
  AccountBalance as SettlementIcon,
} from '@mui/icons-material'
import PageHeader from '@/components/layout/PageHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import MaterialWorkflowBar from '@/components/materials/MaterialWorkflowBar'
import { useSite } from '@/contexts/SiteContext'
import { useAuth } from '@/contexts/AuthContext'
import { hasEditPermission } from '@/lib/permissions'
import { useSiteGroupMembership, useDeleteGroupStockTransaction } from '@/hooks/queries/useSiteGroups'
import {
  useInterSiteSettlements,
  useSiteSettlementSummary,
  useInterSiteBalances,
  useGenerateSettlement,
  useDeleteSettlement,
  useGroupStockTransactions,
  useCancelCompletedSettlement,
  useCancelPendingSettlement,
  useDeleteUnsettledUsage,
} from '@/hooks/queries/useInterSiteSettlements'
import { useDeleteBatchCascade } from '@/hooks/queries/useMaterialPurchases'
import { useBatchesWithUsage, useCompleteBatch } from '@/hooks/queries/useBatchUsage'
import ConvertToOwnSiteDialog from '@/components/materials/ConvertToOwnSiteDialog'
import GroupStockTransactionDrawer from '@/components/materials/GroupStockTransactionDrawer'
import EditGroupStockTransactionDialog from '@/components/materials/EditGroupStockTransactionDialog'
import InitiateBatchSettlementDialog from '@/components/materials/InitiateBatchSettlementDialog'
import RecordInterSitePaymentDialog from '@/components/materials/RecordInterSitePaymentDialog'
import BatchCompletionDialog from '@/components/materials/BatchCompletionDialog'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import SettlementSummaryCards from '@/components/materials/SettlementSummaryCards'
import SettlementLedger from '@/components/materials/SettlementLedger'
import StockBatchesTab from '@/components/materials/StockBatchesTab'
import SettlementsTab from '@/components/materials/SettlementsTab'
import type { InterSiteSettlementWithDetails, InterSiteBalance, GroupStockBatch } from '@/types/material.types'
import type { GroupStockTransaction } from '@/hooks/queries/useInterSiteSettlements'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

export default function InterSiteSettlementPage() {
  const { selectedSite } = useSite()
  const [tabValue, setTabValue] = useState(0)

  // Dialog states for batch management
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [batchCompletionOpen, setBatchCompletionOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<GroupStockBatch | null>(null)

  // Transaction action states
  const [viewTransaction, setViewTransaction] = useState<GroupStockTransaction | null>(null)
  const [editTransaction, setEditTransaction] = useState<GroupStockTransaction | null>(null)
  const [deleteTransaction, setDeleteTransaction] = useState<GroupStockTransaction | null>(null)
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Settlement dialog states
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false)
  const [settlementData, setSettlementData] = useState<{
    batchRefCode: string
    debtorSiteId: string
    debtorSiteName: string
    creditorSiteId: string
    creditorSiteName: string
    amount: number
    settlementId?: string
  } | null>(null)

  // Settlement delete states
  const [deleteSettlementId, setDeleteSettlementId] = useState<string | null>(null)
  const [deleteSettlementConfirmOpen, setDeleteSettlementConfirmOpen] = useState(false)

  // Cancel settlement states
  const [cancelSettlementId, setCancelSettlementId] = useState<string | null>(null)
  const [cancelSettlementType, setCancelSettlementType] = useState<'completed' | 'pending' | null>(null)
  const [cancelSettlementConfirmOpen, setCancelSettlementConfirmOpen] = useState(false)

  // Delete unsettled balance states
  const [deleteUnsettledBalance, setDeleteUnsettledBalance] = useState<InterSiteBalance | null>(null)
  const [deleteUnsettledConfirmOpen, setDeleteUnsettledConfirmOpen] = useState(false)

  // Data hooks
  const { data: groupMembership, isLoading: membershipLoading } = useSiteGroupMembership(
    selectedSite?.id
  )
  const { data: summary, isLoading: summaryLoading } = useSiteSettlementSummary(
    selectedSite?.id
  )
  const { data: balances = [], isLoading: balancesLoading } = useInterSiteBalances(
    groupMembership?.groupId
  )
  const { data: settlements = [], isLoading: settlementsLoading } = useInterSiteSettlements(
    selectedSite?.id
  )
  // Transactions still needed for list view in StockBatchesTab
  const { data: transactions = [], isLoading: transactionsLoading } = useGroupStockTransactions(
    groupMembership?.groupId,
    { limit: 100 }
  )
  const { data: batchesWithUsage = [], isLoading: batchesLoading } = useBatchesWithUsage(groupMembership?.groupId)

  // Mutation hooks
  const generateSettlement = useGenerateSettlement()
  const deleteSettlement = useDeleteSettlement()
  const deleteTransactionMutation = useDeleteGroupStockTransaction()
  const deleteBatchMutation = useDeleteBatchCascade()
  const completeBatchMutation = useCompleteBatch()
  const cancelCompletedSettlement = useCancelCompletedSettlement()
  const cancelPendingSettlement = useCancelPendingSettlement()
  const deleteUnsettledUsage = useDeleteUnsettledUsage()

  // Auth and permissions
  const { userProfile } = useAuth()
  const canEdit = hasEditPermission(userProfile?.role)

  const isLoading = membershipLoading || summaryLoading || balancesLoading || settlementsLoading || transactionsLoading || batchesLoading

  // Filter settlements for the ledger
  const pendingSettlements = settlements.filter(
    (s) => s.status === 'pending' || s.status === 'approved'
  )

  // --- Handler functions ---

  const handleConvertBatch = (batch: GroupStockBatch) => {
    setSelectedBatch(batch)
    setConvertDialogOpen(true)
  }

  const handleCompleteBatch = (batch: GroupStockBatch) => {
    setSelectedBatch(batch)
    setBatchCompletionOpen(true)
  }

  const handleConfirmBatchCompletion = async (batchRefCode: string, allocations: any[]) => {
    await completeBatchMutation.mutateAsync({
      batchRefCode,
      allocations,
    })
  }

  const handleSettleUsage = (
    batchRefCode: string,
    creditorSiteId: string,
    creditorSiteName: string,
    debtorSiteId: string,
    debtorSiteName: string,
    amount: number
  ) => {
    setSettlementData({
      batchRefCode,
      debtorSiteId,
      debtorSiteName,
      creditorSiteId,
      creditorSiteName,
      amount,
    })
    setSettlementDialogOpen(true)
  }

  const handleViewTransaction = (tx: GroupStockTransaction) => {
    setViewTransaction(tx)
    setViewDrawerOpen(true)
  }

  const handleEditTransaction = (tx: GroupStockTransaction) => {
    setEditTransaction(tx)
    setEditDialogOpen(true)
  }

  const handleDeleteTransaction = (tx: GroupStockTransaction) => {
    setDeleteTransaction(tx)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTransaction || !groupMembership?.groupId) return
    try {
      const isBatchFallback = (deleteTransaction as any)._isBatchFallback
      const batchRefCode = (deleteTransaction as any)._batchRefCode || deleteTransaction.batch_ref_code

      if (isBatchFallback && batchRefCode) {
        await deleteBatchMutation.mutateAsync(batchRefCode)
      } else {
        await deleteTransactionMutation.mutateAsync({
          transactionId: deleteTransaction.id,
          groupId: groupMembership.groupId,
        })
      }
      setDeleteConfirmOpen(false)
      setDeleteTransaction(null)
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleGenerateSettlement = async (balance: InterSiteBalance) => {
    if (!groupMembership?.groupId) return
    try {
      await generateSettlement.mutateAsync({
        siteGroupId: balance.site_group_id,
        fromSiteId: balance.creditor_site_id,
        toSiteId: balance.debtor_site_id,
        year: balance.year,
        weekNumber: balance.week_number,
      })
    } catch (error) {
      console.error('Failed to generate settlement:', error)
    }
  }

  const handleSettlePayment = (settlement: InterSiteSettlementWithDetails) => {
    if (!settlement.from_site || !settlement.to_site) {
      console.error('Settlement missing site details')
      return
    }

    let batchRefCode = settlement.batch_ref_code
    if (!batchRefCode) {
      batchRefCode = `SETTLEMENT-${settlement.id.slice(0, 8)}`
    }

    setSettlementData({
      batchRefCode,
      debtorSiteId: settlement.to_site_id,
      debtorSiteName: settlement.to_site.name,
      creditorSiteId: settlement.from_site_id,
      creditorSiteName: settlement.from_site.name,
      amount: Number(settlement.total_amount),
      settlementId: settlement.id,
    })
    setSettlementDialogOpen(true)
  }

  const handleDeleteSettlement = async () => {
    if (!deleteSettlementId) return
    try {
      await deleteSettlement.mutateAsync(deleteSettlementId)
      setDeleteSettlementConfirmOpen(false)
      setDeleteSettlementId(null)
    } catch (error) {
      console.error('Failed to delete settlement:', error)
    }
  }

  const handleCancelSettlement = async () => {
    if (!cancelSettlementId || !cancelSettlementType) return
    try {
      if (cancelSettlementType === 'completed') {
        await cancelCompletedSettlement.mutateAsync({
          settlementId: cancelSettlementId,
          reason: 'Cancelled by user',
        })
      } else {
        await cancelPendingSettlement.mutateAsync({
          settlementId: cancelSettlementId,
          reason: 'Cancelled by user',
        })
      }
      setCancelSettlementConfirmOpen(false)
      setCancelSettlementId(null)
      setCancelSettlementType(null)
    } catch (error) {
      console.error('Failed to cancel settlement:', error)
    }
  }

  const handleDeleteUnsettledBalance = async () => {
    if (!deleteUnsettledBalance || !groupMembership?.groupId) return
    try {
      await deleteUnsettledUsage.mutateAsync({
        groupId: groupMembership.groupId,
        creditorSiteId: deleteUnsettledBalance.creditor_site_id,
        debtorSiteId: deleteUnsettledBalance.debtor_site_id,
      })
      setDeleteUnsettledConfirmOpen(false)
      setDeleteUnsettledBalance(null)
    } catch (error) {
      console.error('Failed to delete unsettled balance:', error)
    }
  }

  // Not in a group - show message
  if (!membershipLoading && !groupMembership?.isInGroup) {
    return (
      <Box>
        <Breadcrumbs />
        <PageHeader
          title="Inter-Site Settlement"
          subtitle="Track and settle material costs between sites"
        />
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Site Not in a Group
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            This feature is only available for sites that are part of a site group.
            Site groups allow multiple nearby sites to share materials and track costs between them.
          </Typography>
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Inter-Site Settlement"
        subtitle={
          groupMembership?.groupName
            ? `Track and settle material costs in ${groupMembership.groupName}`
            : 'Track and settle material costs between sites'
        }
      />

      <MaterialWorkflowBar currentStep="interSite" />

      {/* Summary Cards (3 cards) */}
      <SettlementSummaryCards summary={summary} isLoading={summaryLoading} />

      {/* Settlement Ledger - "Who Owes Whom" */}
      <SettlementLedger
        balances={balances}
        pendingSettlements={pendingSettlements}
        currentSiteId={selectedSite?.id}
        isLoading={balancesLoading || settlementsLoading}
        onGenerateSettlement={handleGenerateSettlement}
        onSettlePayment={handleSettlePayment}
        generatePending={generateSettlement.isPending}
      />

      {/* Tabs: Stock & Batches | Settlements */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Stock & Batches" icon={<BatchesIcon />} iconPosition="start" />
          <Tab label="Settlements" icon={<SettlementIcon />} iconPosition="start" />
        </Tabs>

        {/* Tab 0: Stock & Batches */}
        <TabPanel value={tabValue} index={0}>
          <StockBatchesTab
            batches={batchesWithUsage}
            batchesWithUsage={batchesWithUsage}
            transactions={transactions}
            isLoading={isLoading}
            currentSiteId={selectedSite?.id}
            allSites={groupMembership?.allSites}
            groupName={groupMembership?.groupName}
            canEdit={canEdit}
            onConvertToOwnSite={handleConvertBatch}
            onCompleteBatch={handleCompleteBatch}
            onSettleUsage={handleSettleUsage}
            onViewTransaction={handleViewTransaction}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        </TabPanel>

        {/* Tab 1: Settlements */}
        <TabPanel value={tabValue} index={1}>
          <SettlementsTab
            balances={balances}
            settlements={settlements}
            currentSiteId={selectedSite?.id}
            isLoading={isLoading}
            canEdit={canEdit}
            onGenerateSettlement={handleGenerateSettlement}
            onSettlePayment={handleSettlePayment}
            onDeleteSettlement={(id) => {
              setDeleteSettlementId(id)
              setDeleteSettlementConfirmOpen(true)
            }}
            onCancelSettlement={(id, type) => {
              setCancelSettlementId(id)
              setCancelSettlementType(type)
              setCancelSettlementConfirmOpen(true)
            }}
            onDeleteUnsettledBalance={(balance) => {
              setDeleteUnsettledBalance(balance)
              setDeleteUnsettledConfirmOpen(true)
            }}
            generatePending={generateSettlement.isPending}
            cancelPending={cancelCompletedSettlement.isPending || cancelPendingSettlement.isPending}
            deletePending={deleteSettlement.isPending}
            deleteUnsettledPending={deleteUnsettledUsage.isPending}
          />
        </TabPanel>
      </Paper>

      {/* Info Box */}
      <Alert severity="info">
        <Typography variant="subtitle2" fontWeight={600}>
          How Inter-Site Settlement Works
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          When sites share materials:
        </Typography>
        <Box component="ul" sx={{ mt: 0.5, pl: 2, mb: 0 }}>
          <li>
            <Typography variant="body2">
              Site A pays for materials (e.g., 1000 bricks at Rs.10 = Rs.10,000)
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Site B uses 300 bricks from shared stock
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Weekly settlement shows Site B owes Site A Rs.3,000
            </Typography>
          </li>
        </Box>
      </Alert>

      {/* Dialogs */}
      {selectedSite?.id && (
        <ConvertToOwnSiteDialog
          open={convertDialogOpen}
          onClose={() => {
            setConvertDialogOpen(false)
            setSelectedBatch(null)
          }}
          batch={selectedBatch}
          siteId={selectedSite.id}
        />
      )}

      <GroupStockTransactionDrawer
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false)
          setViewTransaction(null)
        }}
        transaction={viewTransaction}
      />

      <EditGroupStockTransactionDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false)
          setEditTransaction(null)
        }}
        transaction={editTransaction}
        groupId={groupMembership?.groupId}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={(deleteTransaction as any)?._isBatchFallback ? "Delete Purchase Batch" : "Delete Transaction"}
        message={(deleteTransaction as any)?._isBatchFallback
          ? "Are you sure you want to delete this purchase batch? This will also delete all related usage records, settlements, and transactions."
          : "Are you sure you want to delete this transaction? This will also update the inventory balance."
        }
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteTransactionMutation.isPending || deleteBatchMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setDeleteTransaction(null)
        }}
      />

      <ConfirmDialog
        open={deleteSettlementConfirmOpen}
        title="Delete Settlement"
        message="Are you sure you want to delete this settlement record? The balance will move back to 'Unsettled Balances' and you can regenerate the settlement later."
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteSettlement.isPending}
        onConfirm={handleDeleteSettlement}
        onCancel={() => {
          setDeleteSettlementConfirmOpen(false)
          setDeleteSettlementId(null)
        }}
      />

      <ConfirmDialog
        open={cancelSettlementConfirmOpen}
        title={cancelSettlementType === 'completed' ? 'Cancel Completed Settlement' : 'Cancel Pending Settlement'}
        message={
          cancelSettlementType === 'completed'
            ? 'Are you sure you want to cancel this completed settlement? It will be moved back to Pending status and payment records will be deleted.'
            : 'Are you sure you want to cancel this pending settlement? The usage records will be returned to Unsettled Balances.'
        }
        confirmText="Cancel Settlement"
        confirmColor="warning"
        isLoading={cancelCompletedSettlement.isPending || cancelPendingSettlement.isPending}
        onConfirm={handleCancelSettlement}
        onCancel={() => {
          setCancelSettlementConfirmOpen(false)
          setCancelSettlementId(null)
          setCancelSettlementType(null)
        }}
      />

      <ConfirmDialog
        open={deleteUnsettledConfirmOpen}
        title="Delete Usage Records"
        message={`Are you sure you want to permanently delete the usage records between ${deleteUnsettledBalance?.creditor_site_name || 'Creditor'} and ${deleteUnsettledBalance?.debtor_site_name || 'Debtor'}? This will restore the inventory and remove all usage history. This action cannot be undone.`}
        confirmText="Delete Permanently"
        confirmColor="error"
        isLoading={deleteUnsettledUsage.isPending}
        onConfirm={handleDeleteUnsettledBalance}
        onCancel={() => {
          setDeleteUnsettledConfirmOpen(false)
          setDeleteUnsettledBalance(null)
        }}
      />

      {settlementData && !settlementData.settlementId && (
        <InitiateBatchSettlementDialog
          open={settlementDialogOpen}
          onClose={() => {
            setSettlementDialogOpen(false)
            setSettlementData(null)
          }}
          batchRefCode={settlementData.batchRefCode}
          debtorSiteId={settlementData.debtorSiteId}
          debtorSiteName={settlementData.debtorSiteName}
          creditorSiteId={settlementData.creditorSiteId}
          creditorSiteName={settlementData.creditorSiteName}
          amount={settlementData.amount}
        />
      )}

      {settlementData && settlementData.settlementId && (
        <RecordInterSitePaymentDialog
          open={settlementDialogOpen}
          onClose={() => {
            setSettlementDialogOpen(false)
            setSettlementData(null)
          }}
          settlementId={settlementData.settlementId}
          debtorSiteId={settlementData.debtorSiteId}
          debtorSiteName={settlementData.debtorSiteName}
          creditorSiteId={settlementData.creditorSiteId}
          creditorSiteName={settlementData.creditorSiteName}
          amount={settlementData.amount}
        />
      )}

      <BatchCompletionDialog
        open={batchCompletionOpen}
        onClose={() => {
          setBatchCompletionOpen(false)
          setSelectedBatch(null)
        }}
        batch={selectedBatch}
        onComplete={handleConfirmBatchCompletion}
      />
    </Box>
  )
}
