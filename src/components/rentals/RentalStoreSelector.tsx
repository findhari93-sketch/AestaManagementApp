"use client";

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import {
  Store as StoreIcon,
  Phone as PhoneIcon,
} from "@mui/icons-material";
import { useRentalStores } from "@/hooks/queries/useRentals";

interface RentalStoreSelectorProps {
  value: string;
  onChange: (vendorId: string) => void;
  label?: string;
  required?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

export default function RentalStoreSelector({
  value,
  onChange,
  label = "Select Rental Store",
  required = false,
  fullWidth = true,
  size = "medium",
  disabled = false,
  error = false,
}: RentalStoreSelectorProps) {
  const { data: stores = [], isLoading } = useRentalStores();

  const selectedStore = stores.find((s) => s.id === value);

  return (
    <FormControl
      fullWidth={fullWidth}
      required={required}
      size={size}
      disabled={disabled || isLoading}
      error={error}
    >
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        label={label}
        renderValue={() => {
          if (!selectedStore) return "";
          return (
            <Box display="flex" alignItems="center" gap={1}>
              <StoreIcon fontSize="small" color="action" />
              <Typography>
                {selectedStore.shop_name || selectedStore.name}
              </Typography>
            </Box>
          );
        }}
      >
        {isLoading ? (
          <MenuItem disabled>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            Loading stores...
          </MenuItem>
        ) : stores.length === 0 ? (
          <MenuItem disabled>
            <Typography color="text.secondary">
              No rental stores found
            </Typography>
          </MenuItem>
        ) : (
          stores.map((store) => (
            <MenuItem key={store.id} value={store.id}>
              <ListItemIcon>
                <StoreIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={store.shop_name || store.name}
                secondary={
                  <Box
                    component="span"
                    display="flex"
                    alignItems="center"
                    gap={0.5}
                  >
                    {store.phone && (
                      <>
                        <PhoneIcon sx={{ fontSize: 12 }} />
                        <Typography variant="caption">{store.phone}</Typography>
                      </>
                    )}
                  </Box>
                }
              />
            </MenuItem>
          ))
        )}
      </Select>
    </FormControl>
  );
}
