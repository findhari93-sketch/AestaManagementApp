'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Skeleton,
  Alert,
  Grid,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import {
  AccountBalance as SettlementIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as ApproveIcon,
  Visibility as ViewIcon,
  Schedule as PendingIcon,
  Done as DoneIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as TransactionsIcon,
  ShoppingCart as PurchaseIcon,
  LocalShipping as UsageIcon,
  Inventory as BatchesIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import PageHeader from '@/components/layout/PageHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import RelatedPages from '@/components/layout/RelatedPages'
import { useSite } from '@/contexts/SiteContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { hasEditPermission } from '@/lib/permissions'
import { useSiteGroupMembership, useUpdateGroupStockTransaction, useDeleteGroupStockTransaction } from '@/hooks/queries/useSiteGroups'
import {
  useInterSiteSettlements,
  useSiteSettlementSummary,
  useInterSiteBalances,
  useGenerateSettlement,
  useApproveSettlement,
  useDeleteSettlement,
  useGroupStockTransactions,
  useCancelCompletedSettlement,
  useCancelPendingSettlement,
  useDeleteUnsettledUsage,
} from '@/hooks/queries/useInterSiteSettlements'
import { useGroupStockBatches, useDeleteBatchCascade } from '@/hooks/queries/useMaterialPurchases'
import { useBatchesWithUsage, useCompleteBatch } from '@/hooks/queries/useBatchUsage'
import GroupStockBatchCard from '@/components/materials/GroupStockBatchCard'
import EditMaterialPurchaseDialog from '@/components/materials/EditMaterialPurchaseDialog'
import ConvertToOwnSiteDialog from '@/components/materials/ConvertToOwnSiteDialog'
import GroupStockTransactionDrawer from '@/components/materials/GroupStockTransactionDrawer'
import EditGroupStockTransactionDialog from '@/components/materials/EditGroupStockTransactionDialog'
import RecordBatchUsageDialog from '@/components/materials/RecordBatchUsageDialog'
import InitiateBatchSettlementDialog from '@/components/materials/InitiateBatchSettlementDialog'
import RecordInterSitePaymentDialog from '@/components/materials/RecordInterSitePaymentDialog'
import BatchCompletionDialog from '@/components/materials/BatchCompletionDialog'
import PurchaseBatchRow from '@/components/materials/PurchaseBatchRow'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import type { InterSiteSettlementWithDetails, InterSiteBalance, GroupStockBatch, MaterialPurchaseExpenseWithDetails } from '@/types/material.types'
import type { GroupStockTransaction } from '@/hooks/queries/useInterSiteSettlements'
import { SETTLEMENT_STATUS_COLORS, SETTLEMENT_STATUS_LABELS } from '@/types/material.types'

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
  const [editPurchaseOpen, setEditPurchaseOpen] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [batchCompletionOpen, setBatchCompletionOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<GroupStockBatch | null>(null)

  // Filters for transactions tab
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'purchase' | 'usage'>('all')

  // Filter for batches tab
  const [batchStatusFilter, setBatchStatusFilter] = useState<'all' | 'in_stock' | 'partial_used' | 'completed'>('all')

  // Transaction action states
  const [viewTransaction, setViewTransaction] = useState<GroupStockTransaction | null>(null)
  const [editTransaction, setEditTransaction] = useState<GroupStockTransaction | null>(null)
  const [deleteTransaction, setDeleteTransaction] = useState<GroupStockTransaction | null>(null)
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Batch usage dialog states
  const [recordUsageOpen, setRecordUsageOpen] = useState(false)
  const [selectedBatchForUsage, setSelectedBatchForUsage] = useState<string | undefined>(undefined)

  // Settlement dialog states
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false)
  const [settlementData, setSettlementData] = useState<{
    batchRefCode: string
    debtorSiteId: string
    debtorSiteName: string
    creditorSiteId: string
    creditorSiteName: string
    amount: number
    settlementId?: string  // For settling existing pending settlements
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

  // Hooks
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
  const { data: transactions = [], isLoading: transactionsLoading } = useGroupStockTransactions(
    groupMembership?.groupId,
    { limit: 100 }
  )
  const { data: batches = [], isLoading: batchesLoading } = useGroupStockBatches(
    groupMembership?.groupId,
    { enabled: !!groupMembership?.groupId }
  )

  // Fetch batches with usage breakdown for enhanced display
  const { data: batchesWithUsage = [] } = useBatchesWithUsage(groupMembership?.groupId)

  const generateSettlement = useGenerateSettlement()
  const approveSettlement = useApproveSettlement()
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

  // Filter settlements by status
  const pendingSettlements = settlements.filter(
    (s) => s.status === 'pending' || s.status === 'approved'
  )
  const completedSettlements = settlements.filter(
    (s) => s.status === 'settled' || s.status === 'cancelled'
  )

  // Filter transactions based on selected filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== 'all' && tx.transaction_type !== typeFilter) {
        return false
      }
      // Site filter
      if (siteFilter !== 'all') {
        if (tx.transaction_type === 'purchase') {
          return tx.payment_source_site_id === siteFilter
        } else if (tx.transaction_type === 'usage') {
          return tx.usage_site_id === siteFilter
        }
      }
      return true
    })
  }, [transactions, siteFilter, typeFilter])

  // Filter batches based on status - prefer batchesWithUsage for enhanced display
  // Note: "recorded" status batches are shown based on their actual usage:
  // - If no usage: show under "In Stock"
  // - If some usage: show under "Partial Used"
  const filteredBatches = useMemo(() => {
    const sourceBatches = batchesWithUsage.length > 0 ? batchesWithUsage : batches
    if (batchStatusFilter === 'all') return sourceBatches

    return sourceBatches.filter((batch: any) => {
      const hasUsage = (batch.site_allocations?.length || 0) > 0 ||
        (batch.original_quantity !== batch.remaining_quantity)

      // For "recorded" batches, determine effective status based on usage
      if (batch.status === 'recorded') {
        if (batchStatusFilter === 'in_stock' && !hasUsage) return true
        if (batchStatusFilter === 'partial_used' && hasUsage) return true
        return false
      }

      return batch.status === batchStatusFilter
    })
  }, [batches, batchesWithUsage, batchStatusFilter])

  // Group transactions by batch for collapsible view (only used when typeFilter === 'all')
  const groupedTransactions = useMemo(() => {
    const sourceBatches = batchesWithUsage.length > 0 ? batchesWithUsage : batches

    return sourceBatches.map((batch: any) => ({
      batch,
      transactions: transactions.filter(tx => {
        // Match by batch_ref_code (most common)
        if (tx.batch_ref_code === batch.ref_code) return true

        // Match by reference_id
        if (tx.reference_id === batch.id) return true

        // Match by inventory_id (for purchase transactions)
        if (tx.inventory_id === batch.inventory_id) return true

        // Match purchase transactions by material and date (fallback)
        if (tx.transaction_type === 'purchase' &&
            tx.material_id === batch.material_id &&
            tx.transaction_date === batch.purchase_date) {
          return true
        }

        return false
      })
    }))
  }, [batches, batchesWithUsage, transactions])

  // Filter grouped transactions for "All" view
  const filteredGroupedTransactions = useMemo(() => {
    return groupedTransactions.filter((group: any) => {
      const { batch } = group

      // Site filter
      if (siteFilter !== 'all') {
        const hasMatchingSite =
          batch.payment_source_site_id === siteFilter ||
          batch.payment_source_site_id === siteFilter ||
          (batch.site_allocations && batch.site_allocations.some((alloc: any) =>
            alloc.site_id === siteFilter
          ))
        if (!hasMatchingSite) return false
      }

      return true
    })
  }, [groupedTransactions, siteFilter])

  // Batch action handlers
  const handleEditBatch = (batch: GroupStockBatch) => {
    setSelectedBatch(batch)
    setEditPurchaseOpen(true)
  }

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

  // Batch usage handlers
  const handleRecordUsage = (batchRefCode?: string) => {
    setSelectedBatchForUsage(batchRefCode)
    setRecordUsageOpen(true)
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

  // Transaction action handlers
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
      // Check if this is a batch fallback (not a real transaction)
      const isBatchFallback = (deleteTransaction as any)._isBatchFallback
      const batchRefCode = (deleteTransaction as any)._batchRefCode || deleteTransaction.batch_ref_code

      if (isBatchFallback && batchRefCode) {
        // Delete the batch using cascade delete
        await deleteBatchMutation.mutateAsync(batchRefCode)
      } else {
        // Delete the transaction
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

  // Calculate per-site summaries from transactions and settlements
  const siteSummaries = useMemo(() => {
    const summaryMap = new Map<string, {
      siteId: string
      siteName: string
      totalPaid: number
      totalUsed: number
      settlementPaid: number
      settlementReceived: number
      purchaseCount: number
      usageCount: number
      materialBreakdown: Array<{
        materialId: string
        materialName: string
        quantityUsed: number
        unit: string
        batchTotal: number
      }>
    }>()

    // Initialize with all sites from group membership
    groupMembership?.allSites?.forEach((site) => {
      summaryMap.set(site.id, {
        siteId: site.id,
        siteName: site.name,
        totalPaid: 0,
        totalUsed: 0,
        settlementPaid: 0,
        settlementReceived: 0,
        purchaseCount: 0,
        usageCount: 0,
        materialBreakdown: [],
      })
    })

    // Track material usage per site
    const materialUsageMap = new Map<string, Map<string, {
      materialId: string
      materialName: string
      quantityUsed: number
      unit: string
      batchTotal: number
    }>>()

    // Calculate totals from transactions (vendor payments and material usage)
    // First, process usage transactions to track what each site used
    transactions.forEach((tx) => {
      if (tx.transaction_type === 'purchase' && tx.payment_source_site_id) {
        const existing = summaryMap.get(tx.payment_source_site_id)
        if (existing) {
          // Use amount_paid from batch if available (bargained amount), otherwise use total_cost
          const matchingBatch = batches.find(b => b.ref_code === tx.batch_ref_code)
          const paidAmount = matchingBatch?.amount_paid ?? matchingBatch?.total_amount ?? tx.total_cost ?? 0
          existing.totalPaid += Math.abs(paidAmount)
          existing.purchaseCount += 1
        }
      } else if (tx.transaction_type === 'usage' && tx.usage_site_id) {
        const existing = summaryMap.get(tx.usage_site_id)
        if (existing) {
          existing.totalUsed += Math.abs(tx.total_cost || 0)
          existing.usageCount += 1

          // Track material breakdown
          const siteKey = tx.usage_site_id
          if (!materialUsageMap.has(siteKey)) {
            materialUsageMap.set(siteKey, new Map())
          }
          const siteMaterials = materialUsageMap.get(siteKey)!
          const materialKey = tx.material_id

          if (siteMaterials.has(materialKey)) {
            const mat = siteMaterials.get(materialKey)!
            mat.quantityUsed += Math.abs(tx.quantity || 0)
          } else {
            // Find the batch total for this material
            const batchForMaterial = batches.find(b =>
              b.ref_code === tx.batch_ref_code ||
              (b.items && b.items.some(item => item.material_id === tx.material_id))
            )
            const batchItem = batchForMaterial?.items?.find(item => item.material_id === tx.material_id)

            siteMaterials.set(materialKey, {
              materialId: tx.material_id,
              materialName: tx.material?.name || 'Unknown Material',
              quantityUsed: Math.abs(tx.quantity || 0),
              unit: tx.material?.unit || 'nos',
              batchTotal: batchItem?.quantity || batchForMaterial?.original_quantity || 0,
            })
          }
        }
      }
    })

    // Auto-allocate remaining materials to paying sites
    // Use batchesWithUsage which has site_allocations from batch_usage_records
    // Note: batchesWithUsage uses paying_site_id (raw field from DB)
    batchesWithUsage.forEach((batch: any) => {
      const payingSiteId = batch.paying_site_id
      if (payingSiteId) {
        const payerSummary = summaryMap.get(payingSiteId)
        if (payerSummary) {
          const totalPaid = batch.amount_paid ?? batch.total_amount ?? 0

          // Calculate usage by OTHER sites from site_allocations
          // site_allocations is populated from batch_usage_records which has correct amounts
          const usedByOthers = (batch.site_allocations || [])
            .filter((alloc: any) =>
              alloc.site_id !== payingSiteId && !alloc.is_payer
            )
            .reduce((sum: number, alloc: any) => sum + Math.abs(alloc.amount || 0), 0)

          // Debug logging
          if (process.env.NODE_ENV === 'development') {
            console.log('SiteSummaries Debug:', {
              batchRefCode: batch.ref_code,
              payingSiteId,
              totalPaid,
              siteAllocations: batch.site_allocations,
              usedByOthersAmount: usedByOthers,
            })
          }

          const remaining = totalPaid - usedByOthers

          // Add remaining as "used" by the paying site (their allocation)
          if (remaining > 0) {
            payerSummary.totalUsed += remaining
          }

          // Add material breakdown for paying site's remaining allocation
          if (remaining > 0 && batch.items && batch.items.length > 0) {
            const siteKey = payingSiteId
            if (!materialUsageMap.has(siteKey)) {
              materialUsageMap.set(siteKey, new Map())
            }
            const siteMaterials = materialUsageMap.get(siteKey)!

            // Calculate remaining quantity directly: total - used by others
            // Get quantity used by other sites from site_allocations
            const quantityUsedByOthers = (batch.site_allocations || [])
              .filter((alloc: any) => alloc.site_id !== payingSiteId && !alloc.is_payer)
              .reduce((sum: number, alloc: any) => sum + (alloc.quantity_used || 0), 0)

            batch.items.forEach((item: any) => {
              const materialKey = item.material_id
              const totalQty = item.quantity || 0
              // Remaining = total - used by others
              const remainingQty = totalQty - quantityUsedByOthers

              if (siteMaterials.has(materialKey)) {
                const mat = siteMaterials.get(materialKey)!
                mat.quantityUsed += remainingQty
              } else {
                siteMaterials.set(materialKey, {
                  materialId: item.material_id,
                  materialName: item.material_name || item.material?.name || 'Unknown Material',
                  quantityUsed: remainingQty > 0 ? remainingQty : 0,
                  unit: item.unit || item.material?.unit || 'nos',
                  batchTotal: totalQty,
                })
              }
            })
          }
        }
      }
    })

    // Include completed settlement payments
    // - Debtor (to_site_id) paid the settlement amount
    // - Creditor (from_site_id) received the settlement amount
    settlements.forEach((settlement) => {
      if (settlement.status === 'settled') {
        const amount = Number(settlement.paid_amount || settlement.total_amount || 0)

        // Debtor paid this amount (track separately, don't mix with vendor purchases)
        const debtorSummary = summaryMap.get(settlement.to_site_id)
        if (debtorSummary) {
          debtorSummary.settlementPaid += amount
        }

        // Creditor received this amount
        const creditorSummary = summaryMap.get(settlement.from_site_id)
        if (creditorSummary) {
          creditorSummary.settlementReceived += amount
        }
      }
    })

    // Merge material breakdown into summaries
    summaryMap.forEach((summary, siteId) => {
      const siteMaterials = materialUsageMap.get(siteId)
      if (siteMaterials) {
        summary.materialBreakdown = Array.from(siteMaterials.values())
      }
    })

    return Array.from(summaryMap.values())
  }, [transactions, settlements, groupMembership?.allSites, batches, batchesWithUsage])

  // Handle generate settlement from balance
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

  // Handle approve settlement (DEPRECATED - use handleSettlePayment instead)
  const handleApproveSettlement = async (settlementId: string) => {
    try {
      await approveSettlement.mutateAsync({ settlementId })
    } catch (error) {
      console.error('Failed to approve settlement:', error)
    }
  }

  // Handle settle payment from pending settlement
  const handleSettlePayment = (settlement: InterSiteSettlementWithDetails) => {
    if (!settlement.from_site || !settlement.to_site) {
      console.error('Settlement missing site details')
      return
    }

    // Get batch ref code from settlement - try settlement.batch_ref_code first,
    // then try to find from items if available
    let batchRefCode = settlement.batch_ref_code

    // If no batch_ref_code on settlement, try to find from items
    if (!batchRefCode && settlement.items && settlement.items.length > 0) {
      // Items might have transaction_id that links to a batch
      // For now, we'll use a fallback approach
      console.log('Settlement has items but no batch_ref_code, items:', settlement.items)
    }

    // If still no batch_ref_code, we can still settle using just settlement data
    // The dialog will work with limited info
    if (!batchRefCode) {
      // Use settlement ID as a fallback reference
      batchRefCode = `SETTLEMENT-${settlement.id.slice(0, 8)}`
      console.log('Using fallback batch ref code:', batchRefCode)
    }

    setSettlementData({
      batchRefCode: batchRefCode,
      debtorSiteId: settlement.to_site_id,
      debtorSiteName: settlement.to_site.name,
      creditorSiteId: settlement.from_site_id,
      creditorSiteName: settlement.from_site.name,
      amount: Number(settlement.total_amount),
      settlementId: settlement.id, // Pass settlement ID for direct settlement
    })
    setSettlementDialogOpen(true)
  }

  // Handle settle now from unsettled balances (direct settlement)
  const handleSettleNow = (balance: InterSiteBalance) => {
    if (!groupMembership?.allSites) return

    const creditorSite = groupMembership.allSites.find((s: any) => s.id === balance.creditor_site_id)
    const debtorSite = groupMembership.allSites.find((s: any) => s.id === balance.debtor_site_id)

    if (!creditorSite || !debtorSite) {
      console.error('Could not find site details')
      return
    }

    // Find batch_ref_code from the balance
    // The balance already has this information from the unsettled balances query
    const batchRefCode = (balance as any).batch_ref_code || null

    if (!batchRefCode) {
      console.error('Balance missing batch_ref_code')
      alert('Cannot settle: batch information missing.')
      return
    }

    setSettlementData({
      batchRefCode: batchRefCode,
      debtorSiteId: balance.debtor_site_id,
      debtorSiteName: debtorSite.name,
      creditorSiteId: balance.creditor_site_id,
      creditorSiteName: creditorSite.name,
      amount: Number(balance.total_amount_owed),
    })
    setSettlementDialogOpen(true)
  }

  // Handle delete settlement
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

  // Handle cancel settlement (from completed or pending)
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

  // Handle delete unsettled balance (permanently removes usage records)
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

      <RelatedPages />

      {/* Balance Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUpIcon color="success" />
                <Typography variant="subtitle2" color="text.secondary">
                  You Are Owed
                </Typography>
              </Box>
              {summaryLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h4" fontWeight={600} color="success.main">
                    {formatCurrency(summary?.total_owed_to_you || 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    From other sites using your materials
                    {(summary?.owed_to_you_count || 0) > 0 && (
                      <Typography component="span" variant="caption" sx={{ ml: 0.5, fontWeight: 600 }}>
                        ({summary?.owed_to_you_count} transactions)
                      </Typography>
                    )}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingDownIcon color="error" />
                <Typography variant="subtitle2" color="text.secondary">
                  You Owe
                </Typography>
              </Box>
              {summaryLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h4" fontWeight={600} color="error.main">
                    {formatCurrency(summary?.total_you_owe || 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    For using materials paid by others
                    {(summary?.you_owe_count || 0) > 0 && (
                      <Typography component="span" variant="caption" sx={{ ml: 0.5, fontWeight: 600 }}>
                        ({summary?.you_owe_count} transactions)
                      </Typography>
                    )}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <SettlementIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Net Balance
                </Typography>
              </Box>
              {summaryLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography
                    variant="h4"
                    fontWeight={600}
                    color={(summary?.net_balance || 0) >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(summary?.net_balance || 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Overall settlement position
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PendingIcon color="warning" />
                <Typography variant="subtitle2" color="text.secondary">
                  Pending
                </Typography>
              </Box>
              {summaryLoading ? (
                <Skeleton variant="text" width={60} height={40} />
              ) : (
                <>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'baseline' }}>
                    <Box>
                      <Typography variant="h4" fontWeight={600} color="warning.main">
                        {summary?.unsettled_count || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Unsettled
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={600} color="info.main">
                        {summary?.pending_settlements_count || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Settlements
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Per-Site Expense Summary */}
      {siteSummaries.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
            Expense Breakdown by Site
          </Typography>
          <Grid container spacing={2}>
            {siteSummaries.map((site) => (
              <Grid key={site.siteId} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor: site.siteId === selectedSite?.id ? 'primary.50' : 'transparent',
                    borderColor: site.siteId === selectedSite?.id ? 'primary.main' : 'divider',
                  }}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {site.siteName}
                        {site.siteId === selectedSite?.id && (
                          <Chip label="Current" size="small" color="primary" sx={{ ml: 1, height: 20 }} />
                        )}
                      </Typography>
                    </Box>
                    <Grid container spacing={1}>
                      <Grid size={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PurchaseIcon sx={{ fontSize: 16, color: 'success.main' }} />
                          <Typography variant="caption" color="text.secondary">Paid</Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="success.main">
                          {formatCurrency(site.totalPaid)}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {site.purchaseCount} purchases
                        </Typography>
                      </Grid>
                      <Grid size={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <UsageIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                          <Typography variant="caption" color="text.secondary">Used</Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="warning.main">
                          {formatCurrency(site.totalUsed)}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {site.usageCount} usages
                        </Typography>
                      </Grid>
                    </Grid>
                    {/* Material Breakdown */}
                    {site.materialBreakdown.length > 0 && (
                      <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          Materials Used:
                        </Typography>
                        {site.materialBreakdown.slice(0, 3).map((mat) => (
                          <Typography key={mat.materialId} variant="caption" display="block" color="text.secondary">
                            {mat.materialName} - {mat.quantityUsed} {mat.unit}
                            {mat.batchTotal > 0 && ` (from ${mat.batchTotal})`}
                          </Typography>
                        ))}
                        {site.materialBreakdown.length > 3 && (
                          <Typography variant="caption" color="primary.main">
                            +{site.materialBreakdown.length - 3} more materials
                          </Typography>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Transactions" icon={<TransactionsIcon />} iconPosition="start" />
          <Tab label="Batches" icon={<BatchesIcon />} iconPosition="start" />
          <Tab label="Unsettled Balances" icon={<PendingIcon />} iconPosition="start" />
          <Tab label="Pending Settlements" icon={<SettlementIcon />} iconPosition="start" />
          <Tab label="Completed" icon={<DoneIcon />} iconPosition="start" />
        </Tabs>

        {/* Tab 0: Transactions */}
        <TabPanel value={tabValue} index={0}>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label="Filter by Site"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">All Sites</MenuItem>
              {groupMembership?.allSites?.map((site) => (
                <MenuItem key={site.id} value={site.id}>
                  {site.name}
                  {site.id === selectedSite?.id && ' (Current)'}
                </MenuItem>
              ))}
            </TextField>

            <ToggleButtonGroup
              value={typeFilter}
              exclusive
              onChange={(_, value) => value && setTypeFilter(value)}
              size="small"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="purchase" sx={{ color: 'success.main' }}>
                <PurchaseIcon sx={{ mr: 0.5, fontSize: 18 }} /> Purchases
              </ToggleButton>
              <ToggleButton value="usage" sx={{ color: 'warning.main' }}>
                <UsageIcon sx={{ mr: 0.5, fontSize: 18 }} /> Usage
              </ToggleButton>
            </ToggleButtonGroup>

            {(siteFilter !== 'all' || typeFilter !== 'all') && (
              <Button
                size="small"
                onClick={() => {
                  setSiteFilter('all')
                  setTypeFilter('all')
                }}
              >
                Clear Filters
              </Button>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              {typeFilter === 'all' || typeFilter === 'purchase'
                ? `Showing ${filteredGroupedTransactions.length} purchases`
                : `Showing ${filteredTransactions.length} of ${transactions.length} transactions`}
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {typeFilter === 'all' && <TableCell sx={{ width: 48 }}></TableCell>}
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Material</TableCell>
                  <TableCell align="right">{typeFilter === 'all' ? 'Quantity & Usage' : 'Quantity'}</TableCell>
                  <TableCell align="right">Unit Cost</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>{typeFilter === 'all' ? 'Paid By' : 'Paid By / Used By'}</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {typeFilter === 'all' && <TableCell><Skeleton /></TableCell>}
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                    </TableRow>
                  ))
                ) : typeFilter === 'all' || typeFilter === 'purchase' ? (
                  // Grouped collapsible view for "All" and "Purchases" filter
                  // For "Purchases", we show batches (which are purchases) - same as "All" but focuses on the purchase row
                  filteredGroupedTransactions.length > 0 ? (
                    filteredGroupedTransactions.map((group: any) => (
                      <PurchaseBatchRow
                        key={group.batch.ref_code}
                        batch={group.batch}
                        transactions={group.transactions}
                        currentSiteId={selectedSite?.id}
                        onViewTransaction={handleViewTransaction}
                        onEditTransaction={handleEditTransaction}
                        onDeleteTransaction={handleDeleteTransaction}
                        canEdit={canEdit}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <TransactionsIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              No transactions yet
                            </Typography>
                            <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                              Transactions will appear here when you:
                            </Typography>
                            <Box component="ul" sx={{ textAlign: 'left', display: 'inline-block', pl: 3 }}>
                              <Typography component="li" variant="body2" color="text.secondary">
                                Create a Group Stock Purchase Order (Group PO)
                              </Typography>
                              <Typography component="li" variant="body2" color="text.secondary">
                                Record delivery for the purchase
                              </Typography>
                              <Typography component="li" variant="body2" color="text.secondary">
                                Record batch usage by sites
                              </Typography>
                            </Box>
                          </Box>
                          {groupMembership?.groupId && (
                            <Alert severity="info" sx={{ maxWidth: 500 }}>
                              <Typography variant="body2">
                                You&apos;re in the group <strong>{groupMembership.groupName}</strong>.
                                {batches.length === 0 ? (
                                  <> Go to the <strong>Batches</strong> tab to create your first group stock purchase.</>
                                ) : (
                                  <> Switch to the <strong>Batches</strong> tab to view existing batches.</>
                                )}
                              </Typography>
                            </Alert>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                ) : filteredTransactions.length > 0 ? (
                  // Flat view for "Usage" filter only
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(tx.transaction_date)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={tx.transaction_type === 'purchase' ? <PurchaseIcon /> : <UsageIcon />}
                          label={tx.transaction_type.charAt(0).toUpperCase() + tx.transaction_type.slice(1)}
                          size="small"
                          color={tx.transaction_type === 'purchase' ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {tx.material?.name || 'Unknown'}
                        </Typography>
                        {tx.brand?.brand_name && (
                          <Typography variant="caption" color="text.secondary">
                            {tx.brand.brand_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={tx.quantity > 0 ? 'success.main' : 'error.main'}
                        >
                          {tx.quantity > 0 ? '+' : ''}{tx.quantity} {tx.material?.unit || ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(tx.unit_cost || 0)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={500}>
                          {formatCurrency(Math.abs(tx.total_cost || 0))}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {tx.transaction_type === 'purchase' && tx.payment_source_site && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Paid by:</Typography>
                            <Chip label={tx.payment_source_site.name} size="small" color="success" variant="outlined" />
                          </Box>
                        )}
                        {tx.transaction_type === 'usage' && tx.usage_site && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Used by:</Typography>
                            <Chip label={tx.usage_site.name} size="small" color="warning" variant="outlined" />
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 150, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.notes || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => handleViewTransaction(tx)}>
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {canEdit && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => handleEditTransaction(tx)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDeleteTransaction(tx)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <TransactionsIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No transactions yet
                          </Typography>
                          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                            Transactions will appear here when you:
                          </Typography>
                          <Box component="ul" sx={{ textAlign: 'left', display: 'inline-block', pl: 3 }}>
                            <Typography component="li" variant="body2" color="text.secondary">
                              Create a Group Stock Purchase Order (Group PO)
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                              Record delivery for the purchase
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                              Record batch usage by sites
                            </Typography>
                          </Box>
                        </Box>
                        {groupMembership?.groupId && (
                          <Alert severity="info" sx={{ maxWidth: 500 }}>
                            <Typography variant="body2">
                              You&apos;re in the group <strong>{groupMembership.groupName}</strong>.
                              {batches.length === 0 ? (
                                <> Go to the <strong>Batches</strong> tab to create your first group stock purchase.</>
                              ) : (
                                <> Switch to the <strong>Batches</strong> tab to view existing batches.</>
                              )}
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 1: Batches */}
        <TabPanel value={tabValue} index={1}>
          {/* Status Filter */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <ToggleButtonGroup
              value={batchStatusFilter}
              exclusive
              onChange={(_, value) => value && setBatchStatusFilter(value)}
              size="small"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="in_stock">In Stock</ToggleButton>
              <ToggleButton value="partial_used">Partial Used</ToggleButton>
              <ToggleButton value="completed">Completed</ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              Showing {filteredBatches.length} of {batches.length} batches
            </Typography>
          </Box>

          {/* Batch Cards Grid */}
          {batchesLoading ? (
            <Grid container spacing={2}>
              {[...Array(4)].map((_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
                </Grid>
              ))}
            </Grid>
          ) : filteredBatches.length > 0 ? (
            <Grid container spacing={2}>
              {filteredBatches.map((batch: any) => (
                <Grid key={batch.ref_code} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <GroupStockBatchCard
                    batch={batch}
                    // TODO: Edit requires fetching MaterialPurchaseExpenseWithDetails by ref_code
                    // onEdit={() => handleEditBatch(batch)}
                    onConvertToOwnSite={() => handleConvertBatch(batch)}
                    onComplete={() => handleCompleteBatch(batch)}
                    onRecordUsage={() => handleRecordUsage(batch.ref_code)}
                    onSettleUsage={(siteId, siteName, amount) =>
                      handleSettleUsage(
                        batch.ref_code,
                        batch.payment_source_site_id || batch.payment_source_site_id,
                        batch.paying_site?.name || batch.payment_source_site_name || 'Paying Site',
                        siteId,
                        siteName,
                        amount
                      )
                    }
                    currentSiteId={selectedSite?.id}
                    showActions
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
              <BatchesIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary" variant="h6">
                No group stock batches
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2, textAlign: 'center' }}>
                Create a Purchase Order with &quot;Group Stock&quot; enabled and record delivery.
                <br />
                Batches are automatically created when Group POs are delivered.
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Tab 2: Unsettled Balances */}
        <TabPanel value={tabValue} index={2}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell>Creditor (Paid)</TableCell>
                  <TableCell></TableCell>
                  <TableCell>Debtor (Used)</TableCell>
                  <TableCell align="right">Amount Owed</TableCell>
                  <TableCell align="right">Transactions</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton width={24} /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                    </TableRow>
                  ))
                ) : balances.length > 0 ? (
                  balances.map((balance, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography variant="body2">
                          Week {balance.week_number}, {balance.year}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {balance.week_start} to {balance.week_end}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={balance.creditor_site_name}
                          size="small"
                          color={balance.creditor_site_id === selectedSite?.id ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <ArrowForwardIcon fontSize="small" color="action" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={balance.debtor_site_name}
                          size="small"
                          color={balance.debtor_site_id === selectedSite?.id ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(balance.total_amount_owed)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {balance.transaction_count}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="Generate Settlement">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleGenerateSettlement(balance)}
                              disabled={generateSettlement.isPending}
                            >
                              Generate
                            </Button>
                          </Tooltip>
                          <Tooltip title="Delete Usage Records">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setDeleteUnsettledBalance(balance)
                                setDeleteUnsettledConfirmOpen(true)
                              }}
                              disabled={deleteUnsettledUsage.isPending}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <DoneIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Typography color="text.secondary">
                          No unsettled balances
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          Record material usage to create settlement entries
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 3: Pending Settlements */}
        <TabPanel value={tabValue} index={3}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Settlement Code</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>From Site</TableCell>
                  <TableCell></TableCell>
                  <TableCell>To Site</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton width={24} /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                    </TableRow>
                  ))
                ) : pendingSettlements.length > 0 ? (
                  pendingSettlements.map((settlement) => (
                    <TableRow key={settlement.id} hover>
                      <TableCell>
                        <Typography fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                          {settlement.settlement_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          Week {settlement.week_number}, {settlement.year}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.from_site?.name || 'Unknown'} size="small" />
                      </TableCell>
                      <TableCell>
                        <ArrowForwardIcon fontSize="small" color="action" />
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.to_site?.name || 'Unknown'} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(settlement.total_amount)}
                        </Typography>
                        {settlement.paid_amount > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Paid: {formatCurrency(settlement.paid_amount)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={SETTLEMENT_STATUS_LABELS[settlement.status]}
                          size="small"
                          color={SETTLEMENT_STATUS_COLORS[settlement.status]}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton size="small">
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {(settlement.status === 'pending' || settlement.status === 'approved') &&
                            (settlement.to_site_id === selectedSite?.id || settlement.from_site_id === selectedSite?.id) && (
                              <Tooltip title={settlement.to_site_id === selectedSite?.id ? "Record Payment (You Owe)" : "Record Payment Received"}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  onClick={() => handleSettlePayment(settlement)}
                                >
                                  Settle
                                </Button>
                              </Tooltip>
                            )}
                          {canEdit && (
                            <Tooltip title="Cancel Settlement (Return to Unsettled)">
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                onClick={() => {
                                  setCancelSettlementId(settlement.id)
                                  setCancelSettlementType('pending')
                                  setCancelSettlementConfirmOpen(true)
                                }}
                                disabled={cancelPendingSettlement.isPending}
                              >
                                Cancel
                              </Button>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <SettlementIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Typography color="text.secondary">
                          No pending settlements
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          Generate settlements from unsettled balances
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 4: Completed */}
        <TabPanel value={tabValue} index={4}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Settlement Code</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>From Site</TableCell>
                  <TableCell></TableCell>
                  <TableCell>To Site</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Settled Date</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {completedSettlements.length > 0 ? (
                  completedSettlements.map((settlement) => (
                    <TableRow key={settlement.id} hover>
                      <TableCell>
                        <Typography fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                          {settlement.settlement_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          Week {settlement.week_number}, {settlement.year}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.from_site?.name || 'Unknown'} size="small" />
                      </TableCell>
                      <TableCell>
                        <ArrowForwardIcon fontSize="small" color="action" />
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.to_site?.name || 'Unknown'} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(settlement.total_amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={SETTLEMENT_STATUS_LABELS[settlement.status]}
                          size="small"
                          color={SETTLEMENT_STATUS_COLORS[settlement.status]}
                        />
                      </TableCell>
                      <TableCell>
                        {settlement.settled_at
                          ? formatDate(settlement.settled_at)
                          : settlement.cancelled_at
                          ? formatDate(settlement.cancelled_at)
                          : '-'}
                      </TableCell>
                      <TableCell align="center">
                        {settlement.status === 'settled' && canEdit && (
                          <Tooltip title="Cancel Settlement (Return to Pending)">
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => {
                                setCancelSettlementId(settlement.id)
                                setCancelSettlementType('completed')
                                setCancelSettlementConfirmOpen(true)
                              }}
                              disabled={cancelCompletedSettlement.isPending}
                            >
                              Cancel
                            </Button>
                          </Tooltip>
                        )}
                        {settlement.status === 'cancelled' && canEdit && (
                          <Tooltip title="Delete Cancelled Settlement">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setDeleteSettlementId(settlement.id)
                                setDeleteSettlementConfirmOpen(true)
                              }}
                              disabled={deleteSettlement.isPending}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <DoneIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Typography color="text.secondary">
                          No completed settlements yet
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
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

      {/* Transaction Action Dialogs */}
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

      {/* Settlement Delete Confirmation Dialog */}
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

      {/* Settlement Cancel Confirmation Dialog */}
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

      {/* Delete Unsettled Balance Confirmation Dialog */}
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

      {/* Batch Usage Dialog */}
      {selectedSite?.id && (
        <RecordBatchUsageDialog
          open={recordUsageOpen}
          onClose={() => {
            setRecordUsageOpen(false)
            setSelectedBatchForUsage(undefined)
          }}
          siteId={selectedSite.id}
          preselectedBatchRefCode={selectedBatchForUsage}
        />
      )}

      {/* Batch Settlement Dialog - for direct batch settlements */}
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

      {/* Inter-Site Payment Dialog - for pending settlement payments */}
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

      {/* Batch Completion Dialog */}
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
