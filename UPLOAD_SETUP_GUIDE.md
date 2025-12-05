# Fix Upload Issues

## Issue 1: Storage Bucket Not Found (400 Error)

The bucket `contract-documents` needs to be created in Supabase.

### Steps:

1. Go to [console.supabase.io](https://console.supabase.io)
2. Select your project
3. Go to **Storage** tab
4. Click **Create a new bucket**
5. Name it: `contract-documents`
6. Make it **Public** (toggle ON)
7. Click **Create bucket**

### Then Run SQL (optional, for policies):

Go to **SQL Editor** → Create a new query → Copy and paste the contents of `SUPABASE_STORAGE_SETUP.sql` → Run

## Issue 2: Upload Progress Stuck

**FIXED** - The progress simulation now:

- Starts at 10%
- Randomly increments to simulate real progress
- Reaches 100% when upload completes
- Clears after 2 seconds

## Issue 3: React Warning (Disabled button in Tooltip)

This is a non-critical warning. If you want to fix it, wrap the IconButton with a span:

```tsx
<Tooltip title="View Document">
  <span>
    <IconButton
      size="small"
      color="primary"
      onClick={(e) => {
        e.stopPropagation();
        handleViewPdf(form.contract_document_url);
      }}
    >
      <Visibility fontSize="small" />
    </IconButton>
  </span>
</Tooltip>
```

## Testing Upload

1. Edit a site in the Sites page
2. Drag and drop a PDF onto the upload area, OR click to browse
3. You should see:
   - Progress indicator with percentage
   - Success notification (Google snackbar style)
   - File info with actions (View, Change, Remove)
   - Location data should save properly with latitude/longitude
