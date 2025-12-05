# Sites Management Enhancement Guide

## Overview

This guide provides comprehensive instructions to enhance the Sites Management page with client contract tracking, payment milestones, subcontract analytics, and location features.

## Database Changes

### 1. Run Migration SQL

Execute `database/migrations/enhance_sites_for_client_contracts.sql` in your Supabase SQL Editor.

This adds:

- Client information fields (name, contact, email)
- Project contract value
- Contract document URL (for PDF storage)
- Payment tracking (total received, last payment info)
- Construction phase tracking
- Location coordinates and Google Maps URL
- New table: `site_payment_milestones` for staged payments

### 2. Create Supabase Storage Bucket

**Manual Steps in Supabase Dashboard:**

1. Go to **Storage** > **Create new bucket**
2. Configure:

   - Name: `contract-documents`
   - Public bucket: **NO** (keep private)
   - File size limit: **50 MB**
   - Allowed MIME types: `application/pdf`

3. Set up RLS Policies (already provided in `database/storage/setup_contract_documents_bucket.sql`):
   - Allow authenticated users to upload
   - Allow authenticated users to read
   - Allow admins to delete/update

## TypeScript Types Updates

✅ Already Updated: `src/types/database.types.ts`

- Added new fields to `Site` interface
- Created `SitePaymentMilestone` interface

## Key Features Implemented

### 1. Client Contract Management

- **Client Details**: Name, contact, email displayed in table
- **Contract Value**: Project value agreed with client
- **Contract Document**: PDF upload with in-app viewer
- **Progress Tracking**: Visual payment progress bars

### 2. Subcontract Analytics

- **Count**: Number of subcontracts created per site
- **Total Value**: Sum of all subcontract values
- **Quick View**: Displayed as chips in table

### 3. Payment Tracking

- **Total Received**: Cumulative amount from client
- **Payment Progress**: Visual progress bar (received/total)
- **Last Payment**: Amount and date
- **Pending Amount**: Calculated automatically

### 4. Location Features

- **Google Maps Integration**: Clickable "View Map" button
- **Coordinates**: Latitude/Longitude storage
- **Custom URL**: Option to add Google Maps share link

### 5. Construction Phase

- **Phase Tracking**: Current construction stage
- **Visual Indicator**: Chip showing phase in table

## UI/UX Enhancements

### Stats Dashboard

Five comprehensive cards showing:

1. **Total Sites** - Count of all sites (active count highlighted)
2. **Total Contract Value** - Sum of all client contracts (in millions)
3. **Amount Received** - Total payments received (in millions)
4. **Amount Pending** - Outstanding from clients (in millions)
5. **Total Subcontracts** - Count across all sites

### Table Columns

Replaced "Today" column with:

- **Client Details**: Name, phone, email
- **Contract Value**: With PDF viewer icon
- **Subcontracts**: Count + total value
- **Payment Status**: Progress bar + last payment date
- **Amount Pending**: Highlighted if pending, "Fully Paid" chip if complete
- **Location**: "View Map" button with Google Maps integration

### Form Organization

Organized into 4 color-coded sections:

1. **Basic Information** (Grey) - Name, city, status, address, phase
2. **Client Contract Details** (Blue) - Client info, contract value, document upload
3. **Payment Tracking** (Green) - Amounts received, last payment
4. **Location Information** (Light Blue) - Coordinates, Maps URL

### PDF Viewer

- **In-App Viewing**: Opens in modal dialog
- **External Link**: Button to open in new tab
- **Upload Progress**: Loading indicator during upload
- **Success Feedback**: Checkmark when uploaded

## Implementation Steps

### Step 1: Update Sites Page Component

Replace the entire content of `src/app\(main)\company\sites\page.tsx` with the new comprehensive version. The new file includes:

**Import additions:**

```typescript
import {
  Description,
  AttachMoney,
  Assignment,
  Upload,
  Visibility,
  OpenInNew,
  Payment,
  Construction,
  Phone,
  Email,
  Divider,
  LinearProgress,
  Tooltip,
  Link,
  Stack,
  Paper,
} from "@mui/icons-material";
import { useRef } from "react"; // Add to existing react import
```

**State changes:**

```typescript
// Replace SiteWithStats type
type SiteWithStats = Site & {
  subcontract_count: number;
  total_subcontract_value: number;
  amount_pending: number;
};

// Add new state variables
const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
const [currentPdfUrl, setCurrentPdfUrl] = useState("");
const [uploading, setUploading] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);

// Update form state with all new fields
const [form, setForm] = useState({
  name: "",
  address: "",
  city: "",
  status: "active" as "active" | "inactive" | "completed",
  client_name: "",
  client_contact: "",
  client_email: "",
  project_contract_value: 0,
  contract_document_url: "",
  total_amount_received: 0,
  last_payment_amount: 0,
  last_payment_date: "",
  construction_phase: "",
  location_lat: "",
  location_lng: "",
  location_google_maps_url: "",
});
```

### Step 2: Update Data Fetching

Replace `fetchSites` function to calculate subcontract statistics:

```typescript
const fetchSites = async () => {
  try {
    setLoading(true);
    const { data: sitesData, error } = await supabase
      .from("sites")
      .select("*")
      .order("name");
    if (error) throw error;

    const sitesWithStats = await Promise.all(
      (sitesData || []).map(async (site) => {
        // Count subcontracts
        const { count: subcontractCount } = await supabase
          .from("contracts")
          .select("*", { count: "exact", head: true })
          .eq("site_id", site.id);

        // Calculate total subcontract value
        const { data: contracts } = await supabase
          .from("contracts")
          .select("total_value")
          .eq("site_id", site.id);

        const totalSubcontractValue =
          contracts?.reduce((sum, c) => sum + (c.total_value || 0), 0) || 0;

        // Calculate pending amount
        const amountPending =
          (site.project_contract_value || 0) -
          (site.total_amount_received || 0);

        return {
          ...site,
          subcontract_count: subcontractCount || 0,
          total_subcontract_value: totalSubcontractValue,
          amount_pending: amountPending,
        };
      })
    );
    setSites(sitesWithStats);
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Step 3: Add File Upload Handler

```typescript
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    setError("Only PDF files are allowed");
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    setError("File size must be less than 50MB");
    return;
  }

  try {
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${
      editingSite?.id || "new"
    }_client_contract_${Date.now()}.${fileExt}`;
    const filePath = `${editingSite?.id || "temp"}/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from("contract-documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("contract-documents").getPublicUrl(data.path);

    setForm({ ...form, contract_document_url: publicUrl });
    setError("");
  } catch (err: any) {
    setError(`Upload failed: ${err.message}`);
  } finally {
    setUploading(false);
  }
};

const handleViewPdf = (url: string) => {
  setCurrentPdfUrl(url);
  setPdfViewerOpen(true);
};
```

### Step 4: Update Table Columns

Key columns to update/add:

1. **Name column** - Add construction phase chip
2. **Client Details column** (NEW) - Replaces contact_person
3. **Contract Value column** (NEW) - With PDF viewer
4. **Subcontracts column** (NEW) - Count + value
5. **Payment Status column** (NEW) - Progress bar
6. **Amount Pending column** (NEW)
7. **Location column** (UPDATED) - Google Maps button
8. **Remove**: today_attendance, week_expenses columns

### Step 5: Update Stats Cards

Replace existing stats with new comprehensive dashboard showing:

- Total Sites / Active
- Total Contract Value (in millions)
- Amount Received (in millions)
- Amount Pending (in millions)
- Total Subcontracts

### Step 6: Update Form Dialog

Organize into 4 sections with `Paper` components:

1. Basic Information
2. Client Contract Details (with file upload)
3. Payment Tracking
4. Location Information

### Step 7: Add PDF Viewer Dialog

Add at the end before closing `</Box>`:

```tsx
<Dialog
  open={pdfViewerOpen}
  onClose={() => setPdfViewerOpen(false)}
  maxWidth="lg"
  fullWidth
>
  <DialogTitle>
    Contract Document
    <IconButton
      onClick={() => window.open(currentPdfUrl, "_blank")}
      sx={{ position: "absolute", right: 8, top: 8 }}
    >
      <OpenInNew />
    </IconButton>
  </DialogTitle>
  <DialogContent>
    <Box sx={{ width: "100%", height: "70vh" }}>
      <iframe
        src={currentPdfUrl}
        width="100%"
        height="100%"
        style={{ border: "none" }}
        title="Contract Document"
      />
    </Box>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setPdfViewerOpen(false)}>Close</Button>
  </DialogActions>
</Dialog>
```

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Create Supabase storage bucket with policies
- [ ] Sites table loads with new columns
- [ ] Stats dashboard shows correct calculations
- [ ] Can create new site with all fields
- [ ] PDF upload works and stores in Supabase Storage
- [ ] PDF viewer opens in modal
- [ ] Google Maps "View Map" button works
- [ ] Subcontract count/value calculated correctly
- [ ] Payment progress bar displays correctly
- [ ] Edit existing site preserves all fields
- [ ] Delete site works
- [ ] Amount pending calculated correctly
- [ ] Construction phase chip displays

## Future Enhancements

### Payment Milestones Feature

The `site_payment_milestones` table is ready for future implementation:

- Add milestone management UI
- Track staged payments (30% advance, 30% foundation, etc.)
- Automate payment reminders
- Update site's `total_amount_received` when milestone marked as paid

### Advanced Features

- Document version control for contracts
- Payment receipt attachments
- Client portal for payment tracking
- Automated payment reminders
- Contract renewal notifications
- Site progress photos linked to milestones

## Support

For questions or issues, refer to:

- Database migration file: `database/migrations/enhance_sites_for_client_contracts.sql`
- Storage setup: `database/storage/setup_contract_documents_bucket.sql`
- TypeScript types: `src/types/database.types.ts`
- Main component: `src/app/(main)/company/sites/page.tsx`
