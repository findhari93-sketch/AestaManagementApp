'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  Chip,
  FormControl,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Collapse,
} from '@mui/material'
import {
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useSite } from '@/contexts/SiteContext'
import PageHeader from '@/components/layout/PageHeader'
import type { Laborer, BuildingSection } from '@/types/database.types'
import dayjs from 'dayjs'

interface AttendanceEntry {
  laborer_id: string
  laborer_name: string
  category_name: string
  role_name: string
  team_name: string | null
  daily_rate: number
  work_days: number
  section_id: string
  section_name: string
  hours_worked: number
  advance_given: number
  extra_given: number
  notes: string
  isExpanded: boolean
}

interface DailySummary {
  category: string
  count: number
  workDays: number
  totalAmount: number
}

export default function AttendancePage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [laborers, setLaborers] = useState<any[]>([])
  const [sections, setSections] = useState<BuildingSection[]>([])
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [existingAttendance, setExistingAttendance] = useState<Set<string>>(new Set())
  const [showSummary, setShowSummary] = useState(false)

  const { userProfile } = useAuth()
  const { selectedSite } = useSite()
  const supabase = createClient()

  const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'office' || userProfile?.role === 'site_engineer'

  const fetchData = async () => {
    if (!selectedSite) return

    try {
      setLoading(true)
      setError('')

      // Fetch active laborers with category and role info
      const { data: laborersData, error: laborersError } = await supabase
        .from('laborers')
        .select(`
          *,
          teams:team_id (name),
          labor_categories:category_id (name),
          labor_roles:role_id (name)
        `)
        .eq('status', 'active')
        .order('name')

      if (laborersError) throw laborersError

      // Fetch sections for the site
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('building_sections')
        .select('*')
        .eq('site_id', selectedSite.id)
        .order('name')

      if (sectionsError) throw sectionsError

      setLaborers(laborersData || [])
      setSections(sectionsData || [])

      // Fetch existing attendance for the date
      const { data: existingData, error: existingError } = await supabase
        .from('daily_attendance')
        .select('laborer_id')
        .eq('site_id', selectedSite.id)
        .eq('date', date)

      if (existingError) throw existingError

      const existingSet = new Set(existingData?.map(a => a.laborer_id) || [])
      setExistingAttendance(existingSet)

      // Initialize attendance entries
      if (laborersData && sectionsData && sectionsData.length > 0) {
        const defaultSection = sectionsData[0]
        const entries: AttendanceEntry[] = laborersData.map((laborer) => ({
          laborer_id: laborer.id,
          laborer_name: laborer.name,
          category_name: laborer.labor_categories?.name || 'Unknown',
          role_name: laborer.labor_roles?.name || 'Unknown',
          team_name: laborer.teams?.name || null,
          daily_rate: laborer.daily_rate || 0,
          work_days: existingSet.has(laborer.id) ? 0 : 1,
          section_id: defaultSection.id,
          section_name: defaultSection.name,
          hours_worked: 8,
          advance_given: 0,
          extra_given: 0,
          notes: '',
          isExpanded: false,
        }))
        setAttendanceEntries(entries)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedSite, date])

  const handleWorkDaysChange = (laborerId: string, value: number) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? {
              ...entry,
              work_days: value,
              hours_worked: value === 0.5 ? 4 : value === 1 ? 8 : value === 1.5 ? 12 : 16,
            }
          : entry
      )
    )
  }

  const handleSectionChange = (laborerId: string, sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId)
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? { ...entry, section_id: sectionId, section_name: section?.name || '' }
          : entry
      )
    )
  }

  const handleAdvanceChange = (laborerId: string, value: number) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId ? { ...entry, advance_given: value } : entry
      )
    )
  }

  const handleExtraChange = (laborerId: string, value: number) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId ? { ...entry, extra_given: value } : entry
      )
    )
  }

  const handleNotesChange = (laborerId: string, value: string) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId ? { ...entry, notes: value } : entry
      )
    )
  }

  const toggleExpanded = (laborerId: string) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId ? { ...entry, isExpanded: !entry.isExpanded } : entry
      )
    )
  }

  const calculateDailyEarnings = (workDays: number, dailyRate: number) => {
    return workDays * dailyRate
  }

  const handleSubmit = async () => {
    if (!selectedSite) {
      setError('Please select a site')
      return
    }

    if (!canEdit) {
      setError('You do not have permission to record attendance')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const activeEntries = attendanceEntries.filter((entry) => entry.work_days > 0)

      if (activeEntries.length === 0) {
        setError('No attendance entries to save')
        return
      }

      const attendanceRecords = activeEntries.map((entry) => ({
        site_id: selectedSite.id,
        laborer_id: entry.laborer_id,
        date: date,
        section_id: entry.section_id,
        work_days: entry.work_days,
        hours_worked: entry.hours_worked,
        daily_rate_applied: entry.daily_rate,
        daily_earnings: calculateDailyEarnings(entry.work_days, entry.daily_rate),
        entered_by: userProfile?.id,
      }))

      const laborerIds = activeEntries.map((e) => e.laborer_id)
      const { error: deleteError } = await supabase
        .from('daily_attendance')
        .delete()
        .eq('site_id', selectedSite.id)
        .eq('date', date)
        .in('laborer_id', laborerIds)

      if (deleteError) throw deleteError

      const { error: insertError } = await supabase
        .from('daily_attendance')
        .insert(attendanceRecords)

      if (insertError) throw insertError

      // Handle advances and extras
      const advanceRecords = activeEntries
        .filter((entry) => entry.advance_given > 0 || entry.extra_given > 0)
        .flatMap((entry) => {
          const records = []
          if (entry.advance_given > 0) {
            records.push({
              laborer_id: entry.laborer_id,
              date: date,
              amount: entry.advance_given,
              transaction_type: 'advance' as const,
              payment_mode: 'cash' as const,
              reason: entry.notes || null,
              given_by: userProfile?.id,
              deduction_status: 'pending' as const,
              deducted_amount: 0,
            })
          }
          if (entry.extra_given > 0) {
            records.push({
              laborer_id: entry.laborer_id,
              date: date,
              amount: entry.extra_given,
              transaction_type: 'extra' as const,
              payment_mode: 'cash' as const,
              reason: entry.notes || null,
              given_by: userProfile?.id,
              deduction_status: 'deducted' as const,
              deducted_amount: entry.extra_given,
            })
          }
          return records
        })

      if (advanceRecords.length > 0) {
        const { error: advanceError } = await supabase
          .from('advances')
          .insert(advanceRecords)

        if (advanceError) throw advanceError
      }

      setSuccess(`Attendance saved successfully for ${activeEntries.length} laborer(s)`)
      setShowSummary(true)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const stats = useMemo(() => {
    const present = attendanceEntries.filter((e) => e.work_days > 0).length
    const totalEarnings = attendanceEntries.reduce(
      (sum, e) => sum + calculateDailyEarnings(e.work_days, e.daily_rate),
      0
    )
    const totalAdvance = attendanceEntries.reduce((sum, e) => sum + (e.advance_given || 0), 0)
    const totalExtra = attendanceEntries.reduce((sum, e) => sum + (e.extra_given || 0), 0)

    return { present, totalEarnings, totalAdvance, totalExtra }
  }, [attendanceEntries])

  // Calculate daily summary by category
  const dailySummary = useMemo<DailySummary[]>(() => {
    const summaryMap = new Map<string, DailySummary>()

    attendanceEntries
      .filter((e) => e.work_days > 0)
      .forEach((entry) => {
        const category = entry.category_name
        const existing = summaryMap.get(category) || {
          category,
          count: 0,
          workDays: 0,
          totalAmount: 0,
        }
        existing.count += 1
        existing.workDays += entry.work_days
        existing.totalAmount += calculateDailyEarnings(entry.work_days, entry.daily_rate)
        summaryMap.set(category, existing)
      })

    return Array.from(summaryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [attendanceEntries])

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Attendance Entry" showBack={true} />
        <Alert severity="warning">Please select a site to record attendance</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Attendance Entry"
        subtitle={`Record daily attendance for ${selectedSite.name}`}
        onRefresh={fetchData}
        isLoading={loading}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Date and Stats Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Attendance Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Present
                </Typography>
                <Typography variant="h5" fontWeight={600} color="primary">
                  {stats.present}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Earnings
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  ₹{stats.totalEarnings.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Advance
                </Typography>
                <Typography variant="h5" fontWeight={600} color="warning.main">
                  ₹{stats.totalAdvance.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Extra
                </Typography>
                <Typography variant="h5" fontWeight={600} color="success.main">
                  ₹{stats.totalExtra.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell width={40}></TableCell>
                <TableCell>Laborer</TableCell>
                <TableCell>Category / Role</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Rate</TableCell>
                <TableCell>Work Days</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Earnings</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : attendanceEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No laborers found
                  </TableCell>
                </TableRow>
              ) : (
                attendanceEntries.map((entry) => (
                  <React.Fragment key={entry.laborer_id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleExpanded(entry.laborer_id)}>
                          {entry.isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {entry.laborer_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.category_name}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {entry.role_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.team_name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">₹{entry.daily_rate}</Typography>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={entry.work_days}
                            onChange={(e) =>
                              handleWorkDaysChange(entry.laborer_id, Number(e.target.value))
                            }
                            disabled={!canEdit}
                          >
                            <MenuItem value={0}>Absent</MenuItem>
                            <MenuItem value={0.5}>Half Day</MenuItem>
                            <MenuItem value={1}>Full Day</MenuItem>
                            <MenuItem value={1.5}>1.5 Days</MenuItem>
                            <MenuItem value={2}>2 Days</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={entry.section_id}
                            onChange={(e) =>
                              handleSectionChange(entry.laborer_id, e.target.value)
                            }
                            disabled={!canEdit || entry.work_days === 0}
                          >
                            {sections.map((section) => (
                              <MenuItem key={section.id} value={section.id}>
                                {section.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          ₹{calculateDailyEarnings(entry.work_days, entry.daily_rate)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {existingAttendance.has(entry.laborer_id) && (
                          <Chip
                            label="Recorded"
                            size="small"
                            color="success"
                            icon={<CheckCircleIcon />}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={9} sx={{ py: 0, borderBottom: 0 }}>
                        <Collapse in={entry.isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                  fullWidth
                                  label="Advance Given"
                                  type="number"
                                  size="small"
                                  value={entry.advance_given}
                                  onChange={(e) =>
                                    handleAdvanceChange(entry.laborer_id, Number(e.target.value))
                                  }
                                  disabled={!canEdit || entry.work_days === 0}
                                  slotProps={{ input: { startAdornment: '₹' } }}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                  fullWidth
                                  label="Extra Payment"
                                  type="number"
                                  size="small"
                                  value={entry.extra_given}
                                  onChange={(e) =>
                                    handleExtraChange(entry.laborer_id, Number(e.target.value))
                                  }
                                  disabled={!canEdit || entry.work_days === 0}
                                  slotProps={{ input: { startAdornment: '₹' } }}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  label="Notes"
                                  size="small"
                                  value={entry.notes}
                                  onChange={(e) =>
                                    handleNotesChange(entry.laborer_id, e.target.value)
                                  }
                                  disabled={!canEdit || entry.work_days === 0}
                                  placeholder="Optional notes"
                                />
                              </Grid>
                            </Grid>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {canEdit && attendanceEntries.length > 0 && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              disabled={saving || loading}
            >
              {saving ? 'Saving...' : 'Save Attendance'}
            </Button>
          </Box>
        )}
      </Paper>

      {/* Daily Summary Table */}
      {(showSummary || dailySummary.length > 0) && stats.present > 0 && (
        <Paper sx={{ borderRadius: 3, p: 3 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Daily Summary - {dayjs(date).format('DD MMM YYYY')}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>Category</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Count</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Work Days</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Total Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailySummary.map((row) => (
                  <TableRow key={row.category} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {row.category}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{row.count}</TableCell>
                    <TableCell align="center">{row.workDays}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        ₹{row.totalAmount.toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      TOTAL
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700}>
                      {dailySummary.reduce((sum, r) => sum + r.count, 0)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700}>
                      {dailySummary.reduce((sum, r) => sum + r.workDays, 0)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700} color="primary.main">
                      ₹{dailySummary.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  )
}
