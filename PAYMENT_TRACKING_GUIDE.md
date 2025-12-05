# Client Payment Tracking System - Implementation Guide

## Overview

This comprehensive payment tracking system allows you to:

- Define custom payment plans for each site with multiple payment phases
- Track actual client payments against planned phases
- Monitor payment progress with visual indicators
- Record payment receipts and verification status
- Handle payment disputes and issues
- Generate payment reports and analytics

## Architecture

### Database Schema

The system consists of 4 main tables:

#### 1. **client_payment_plans**

Defines the overall payment structure for a site contract.

```typescript
ClientPaymentPlan {
  id: UUID
  site_id: UUID (FK to sites)
  plan_name: string
  total_contract_amount: number
  description?: string
  notes?: string
  is_active: boolean
  created_by?: UUID
  created_at: timestamp
  updated_at: timestamp
}
```

**Example:**

- Site: "Prime Tower Construction"
- Plan Name: "Foundation Phase Payment Plan"
- Total Contract Amount: ₹5,00,000
- Status: Active

---

#### 2. **payment_phases**

Individual payment milestones within a payment plan.

```typescript
PaymentPhase {
  id: UUID
  payment_plan_id: UUID (FK to client_payment_plans)
  phase_name: string
  description?: string
  percentage: number (0-100)
  amount: number (auto-calculated)
  expected_date?: date
  sequence_order: number
  is_milestone: boolean
  construction_phase_id?: UUID (link to construction phases)
  notes?: string
  created_at: timestamp
  updated_at: timestamp
}
```

**Example Structure:**

```
Total Contract: ₹5,00,000

Phase 1: 30% Upfront
  - Amount: ₹1,50,000
  - Expected: 2025-01-15
  - Status: Pending

Phase 2: 40% After Foundation
  - Amount: ₹2,00,000
  - Expected: 2025-03-15
  - Status: Pending

Phase 3: 30% Final Settlement
  - Amount: ₹1,50,000
  - Expected: 2025-05-15
  - Status: Pending
```

---

#### 3. **client_payments**

Actual payments received from clients.

```typescript
ClientPayment {
  id: UUID
  site_id: UUID (FK to sites)
  payment_phase_id?: UUID (FK to payment_phases)
  payment_date: date
  payment_mode: enum (cash | upi | bank_transfer | cheque)
  amount: number
  transaction_reference?: string
  notes?: string
  receipt_url?: string
  is_verified: boolean
  verified_by?: UUID
  verified_at?: timestamp
  created_at: timestamp
  updated_at: timestamp
}
```

**Example:**

- Payment Date: 2025-01-20
- Mode: Bank Transfer
- Amount: ₹1,50,000
- Reference: "NEFT-TXN-20250120-001"
- Status: Verified

---

#### 4. **payment_disputes**

Track payment issues and disputes.

```typescript
PaymentDispute {
  id: UUID
  site_id: UUID
  client_payment_id?: UUID
  dispute_type: enum
  status: enum (open | in_review | resolved | rejected)
  description: string
  resolution?: string
  resolved_by?: UUID
  resolved_at?: timestamp
  created_at: timestamp
  updated_at: timestamp
}
```

**Dispute Types:**

- `wrong_amount` - Client paid wrong amount
- `duplicate` - Duplicate payment received
- `refund_request` - Client requested refund
- `bounced_cheque` - Cheque payment failed

---

## Features & Workflows

### 1. **Creating a Payment Plan**

```
Site Selection → Create Payment Plan → Define Payment Phases → Active
```

**Example Workflow:**

```
1. Navigate to Client Payments section
2. Select a site (e.g., "Prime Tower Construction")
3. Click "Create Payment Plan"
4. Fill details:
   - Plan Name: "Foundation Phase Payment Plan"
   - Total Contract Amount: ₹5,00,000
   - Description: "Payment structure for foundation work"
5. Click Create
6. Add payment phases with percentages that add up to 100%
```

---

### 2. **Recording Client Payments**

Payments can be recorded against specific phases or as general payments.

**Payment Modes:**

- **Cash**: Direct payment in hand
- **UPI**: Instant digital transfer
- **Bank Transfer**: NEFT/RTGS transfers
- **Cheque**: Cheque payments (track by number)

**Recording Steps:**

```
1. Go to "Payment Records" tab
2. Click "Record Payment"
3. Enter:
   - Payment Date
   - Payment Mode (required)
   - Amount (required)
   - Transaction Reference (for tracking)
   - Notes (optional)
4. Click "Record Payment"
5. Payment is automatically verified and added to totals
```

---

### 3. **Payment Tracking Views**

The system provides multiple views to track payment status:

**Summary Cards:**

- Total Contract Amount
- Amount Paid (with running total)
- Balance Pending
- Payment Progress (%)
- Total Payments Count

**Status Indicators:**

```
Paid      → Full phase amount received
Partial   → Part of phase amount received
Pending   → No payment yet
Overdue   → Expected date passed, no full payment
```

---

### 4. **Payment Verification**

Each payment is marked as:

- **Verified**: Confirmed and cleared by office staff
- **Pending**: Awaiting verification (awaits manager approval)

**Verification Process:**

1. Record payment initially as unverified
2. Office staff reviews payment details
3. Verify payment if legitimate
4. Mark for disputes if issues found

---

### 5. **Payment Disputes**

Handle payment-related issues:

**Creating a Dispute:**

```
1. Click on a payment in the Payment Records table
2. If issue found, create dispute
3. Select dispute type:
   - wrong_amount: Amount doesn't match contract
   - duplicate: Same payment recorded twice
   - refund_request: Client requesting money back
   - bounced_cheque: Cheque bounced from bank
4. Add description and resolution notes
5. Track status: open → in_review → resolved/rejected
```

---

## Views & Reports

### Payment Plan Summary View

Shows aggregated data for easy tracking:

```sql
SELECT
  plan_name,
  total_contract_amount,
  total_amount_paid,
  balance_amount,
  payment_percentage,
  total_payments_received,
  last_payment_date
FROM payment_plan_summary
WHERE site_id = ?
```

### Payment Phase Status View

Tracks individual phase payment status:

```sql
SELECT
  phase_name,
  amount,
  amount_paid,
  amount_pending,
  status,
  last_payment_date,
  payment_count
FROM payment_phase_status
WHERE payment_plan_id = ?
```

---

## UI Components

### Main Page Structure

```
┌─────────────────────────────────────────┐
│      Client Payment Tracking            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Site Selector (Dropdown)               │
│  [Select Site ▼]                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Payment Overview Cards                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Total   │ │ Paid    │ │ Balance │  │
│  │ ₹500K   │ │ ₹150K   │ │ ₹350K   │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│  ┌─────────┐ ┌─────────┐             │
│  │ Progress│ │Payments │             │
│  │  30%    │ │    2    │             │
│  └─────────┘ └─────────┘             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [Payment Plan] [Phases] [Records]      │
│                                         │
│  Tab Content (changes based on tab)     │
│                                         │
└─────────────────────────────────────────┘
```

### Tab 1: Payment Plan

Shows current payment plan details with edit option.

### Tab 2: Payment Phases

Table with all payment phases:

- Order | Name | % | Amount | Expected Date | Status | Actions

### Tab 3: Payment Records

Table with actual payments received:

- Date | Mode | Amount | Reference | Verification Status | Notes | Actions

---

## Key Benefits

1. **Flexible Payment Structures**

   - Define any number of payment phases
   - Support percentage-based calculations
   - Link to construction phases if needed

2. **Transparent Tracking**

   - Real-time payment status
   - Visual progress indicators
   - Detailed payment history

3. **Audit Trail**

   - All payments recorded with timestamps
   - Payment verification status
   - Dispute resolution history

4. **Professional Reporting**

   - Summary views for management
   - Payment phase tracking
   - Dispute handling workflow

5. **Multiple Payment Modes**
   - Cash, UPI, Bank Transfers, Cheques
   - Transaction reference tracking
   - Receipt storage for documentation

---

## Setup Instructions

### 1. Run Database Migration

```sql
-- Execute PAYMENT_TRACKING_SCHEMA.sql in Supabase SQL Editor
-- This creates all tables, indexes, and views
```

### 2. Update Database Types

```bash
# Types already updated in database.types.ts
# New interfaces added:
# - ClientPaymentPlan
# - PaymentPhase
# - ClientPayment
# - PaymentDispute
# - PaymentPlanSummary
# - PaymentPhaseStatus
```

### 3. Access the Feature

```
Navigate to:
Company → Client Payment Tracking
OR
Direct URL: /company/client-payments
```

---

## Best Practices

### Creating Payment Plans

✅ Use clear, descriptive phase names
✅ Ensure percentages sum to 100%
✅ Set realistic expected dates based on project timeline
✅ Document special terms in notes

### Recording Payments

✅ Record payments immediately upon receipt
✅ Use transaction references for verification
✅ Store receipt documents for audit
✅ Verify payments within 24-48 hours

### Tracking Progress

✅ Review payment status weekly
✅ Flag overdue payments immediately
✅ Escalate disputes within 7 days
✅ Update client with payment status regularly

---

## Future Enhancements

1. **Payment Receipt Storage**

   - Store actual receipt documents in storage bucket
   - Support for photos, PDFs, scans
   - Receipt verification workflow

2. **Automated Reminders**

   - Email reminders for upcoming payment phases
   - Notifications for overdue payments
   - Payment dispute escalation alerts

3. **Payment Reports**

   - Monthly payment reconciliation reports
   - Client-wise payment summary
   - Site-wise payment analytics
   - Tax/GST compliance reports

4. **Integration with Accounting**

   - Sync with accounting software
   - Automated journal entries
   - Bank reconciliation automation

5. **Multi-Site Dashboard**
   - Compare payment progress across sites
   - Identify payment patterns
   - Forecast future cash flow

---

## Troubleshooting

### Issue: Phase percentages exceed 100%

**Solution:** Ensure all phases sum to exactly 100%

### Issue: Payment not appearing in total

**Solution:** Verify payment is linked to correct site and phase

### Issue: Status showing "Overdue" incorrectly

**Solution:** Check expected_date field is set correctly

---

## Support

For issues or questions, contact your system administrator.

Last Updated: December 5, 2025
