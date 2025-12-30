'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
} from '@mui/material'
import {
  Close as CloseIcon,
  Domain as SiteIcon,
} from '@mui/icons-material'
import { useCreateSiteGroup, useAddSiteToGroup } from '@/hooks/queries/useSiteGroups'
import { createClient } from '@/lib/supabase/client'

interface Site {
  id: string
  name: string
  address?: string | null
  city?: string | null
}

interface CreateSiteGroupDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function CreateSiteGroupDialog({
  open,
  onClose,
  onSuccess,
}: CreateSiteGroupDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])
  const [availableSites, setAvailableSites] = useState<Site[]>([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createGroupMutation = useCreateSiteGroup()
  const addSiteToGroupMutation = useAddSiteToGroup()

  // Fetch ungrouped sites when dialog opens
  useEffect(() => {
    if (open) {
      fetchUngroupedSites()
    }
  }, [open])

  const fetchUngroupedSites = async () => {
    setLoadingSites(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, address, city')
        .is('site_group_id', null)
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setAvailableSites(data || [])
    } catch (err) {
      console.error('Failed to fetch sites:', err)
      setAvailableSites([])
    } finally {
      setLoadingSites(false)
    }
  }

  const handleToggleSite = (siteId: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId)
        ? prev.filter((id) => id !== siteId)
        : [...prev, siteId]
    )
  }

  const handleSelectAll = () => {
    if (selectedSiteIds.length === availableSites.length) {
      setSelectedSiteIds([])
    } else {
      setSelectedSiteIds(availableSites.map((s) => s.id))
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Group name is required')
      return
    }

    setError(null)

    try {
      // Create the group
      const group = await createGroupMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      })

      // Add selected sites to the group
      if (selectedSiteIds.length > 0) {
        await Promise.all(
          selectedSiteIds.map((siteId) =>
            addSiteToGroupMutation.mutateAsync({
              siteId,
              groupId: group.id,
            })
          )
        )
      }

      // Reset form and close
      handleClose()
      onSuccess?.()
    } catch (err: any) {
      setError(err.message || 'Failed to create site group')
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setSelectedSiteIds([])
    setError(null)
    onClose()
  }

  const isSubmitting = createGroupMutation.isPending || addSiteToGroupMutation.isPending

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Create Site Group
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Group Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            placeholder="e.g., Chennai Projects"
            autoFocus
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Optional description for this group"
          />

          <Divider sx={{ my: 1 }} />

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Add Sites to Group (Optional)
              </Typography>
              {availableSites.length > 0 && (
                <Button size="small" onClick={handleSelectAll}>
                  {selectedSiteIds.length === availableSites.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </Box>

            {loadingSites ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : availableSites.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>
                No ungrouped sites available. All sites are already assigned to groups.
              </Typography>
            ) : (
              <List dense sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {availableSites.map((site) => (
                  <ListItem key={site.id} disablePadding>
                    <ListItemButton onClick={() => handleToggleSite(site.id)} dense>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={selectedSiteIds.includes(site.id)}
                          disableRipple
                          size="small"
                        />
                      </ListItemIcon>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <SiteIcon fontSize="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={site.name}
                        secondary={site.city || site.address}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}

            {selectedSiteIds.length > 0 && (
              <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                {selectedSiteIds.length} site{selectedSiteIds.length > 1 ? 's' : ''} selected
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || !name.trim()}
        >
          {isSubmitting ? <CircularProgress size={20} /> : 'Create Group'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
