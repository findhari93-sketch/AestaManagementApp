# Global Date-Filter UX Redesign — Design Spec

- **Date:** 2026-04-24
- **Scope:** `DateRangePicker`, `MainLayout` top-bar, new `ScopePill`, mounted on `/site/expenses`, `/site/payments`, `/site/attendance`
- **Out of scope:** decoupling summary/table dates, MUI X Pro migration, fiscal-year presets, timezone changes, row-cap changes

---

## 1. Problem statement

Users across Expenses, Attendance and Salary Settlements pages struggle with the global date-range filter in the top bar:

1. The calendar's two-click range selection is unclear — users report it "doesn't let them select" properly.
2. The "Week" and "Month" quick chips toggle back to **All Time** on a second click, which feels like a bug rather than a feature.
3. When a range is active, the summary cards show totals for that range, but nothing on the card indicates the numbers are filtered — users can mistake them for lifetime totals.
4. The ‹ › navigation arrows change behaviour depending on whether a single day, a range, or All Time is active, creating unpredictability.

## 2. Solution overview (one filter, scope-aware)

One global date filter remains the source of truth. Default is **All Time**. Both summary KPIs and table rows react to the same filter.

When the filter is anything other than All Time, a compact **scope pill** appears as the first strip inside the summary card, stating which range the numbers represent and offering a one-click "View All Time" shortcut. No pill is shown for All Time — the default stays visually quiet.

This keeps the mental model simple (one filter), while directly addressing the "user might think these are All-Time totals" risk.

## 3. Top-bar control (at rest)

```
[ ‹ ]  📅 All Time  ▾     ·   Today  Week  Month  Custom
```

- **Primary pill** (`All Time ▾` / preset name / custom range) opens the full picker.
- **Quick chips** (Today, Week, Month, Custom):
  - Today / Week / Month are **one-tap apply**. No toggle-off behaviour.
  - Active chip (Today / Week / Month) is filled + `primary` colour when the active range matches that preset; otherwise outlined.
  - **Custom** is always a trigger — it opens the picker with focus on the calendar (skipping presets). It never shows an "active" state, because it does not represent a specific range.
  - To clear, user uses the card's scope pill (see §5) OR opens the picker and selects "All Time".
- **‹ › arrows** only render when the active range is a symmetric window (single day, week-preset, month-preset) AND stepping back does not predate `site.start_date`. Arrow-step equals the current window's length. Hidden entirely for All Time and custom ranges.

## 4. Picker popover

### 4.1 Desktop layout

```
┌────────────────────────────────┬─────────────────────────────────────┐
│  QUICK                         │  [ Apr 17, 2026 ] → [ Apr 24, 2026 ]│
│  • Today                       │                                     │
│  • Yesterday                   │   ◀  April 2026          May 2026 ▶ │
│  • This Week                   │                                     │
│  • This Month                  │   (two months side-by-side)         │
│                                │                                     │
│  ROLLING                       │                                     │
│  • Last 7 days                 │                                     │
│  • Last 14 days                │                                     │
│  • Last 30 days                │                                     │
│  • Last 90 days                │                                     │
│                                │                                     │
│  PREVIOUS                      │                                     │
│  • Last Week                   │                                     │
│  • Last Month                  │                                     │
│                                │                                     │
│  ─────────────                 │                                     │
│  ★ All Time (site start →)    │                                     │
├────────────────────────────────┴─────────────────────────────────────┤
│  Tip: click a start date, then an end date       [Cancel]  [Apply]   │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Four concrete calendar fixes

1. **Two editable date inputs at the top**, always visible on desktop. Typed values update the picker's draft range on blur (invalid dates revert to the last valid value); the user still clicks **Apply** to commit — same as preset clicks on desktop. This gives users a typed-input fallback and removes most of the "can't select" frustration.
2. **Two months side-by-side** (today there is one). Cross-month ranges stop requiring page-flipping.
3. **Active-state hint**: the input that expects the next click is outlined in `primary.main`, and helper text below the calendar updates: "Click start date" → after first click → "Now pick end date".
4. **All Time is visually distinct** — sits at the bottom with a divider and a ★ icon, reads as the "reset / everything" option, not a neutral preset.

### 4.3 Preset groups (left rail)

| Group | Items |
|---|---|
| Quick | Today, Yesterday, This Week, This Month |
| Rolling | Last 7 days, Last 14 days, Last 30 days, Last 90 days |
| Previous | Last Week, Last Month |
| Special | ★ All Time |

`Last 90 days` is new. Group headers are small-caps labels, not clickable.

### 4.4 Mobile layout

- Horizontal preset chip row (as today) — tap auto-applies + closes.
- Single calendar month (as today).
- Two text inputs above the calendar (new; currently buried).
- `Apply` / `Close` buttons at the bottom (as today).

## 5. Scope pill on summary cards

### 5.1 Component contract

New file `src/components/common/ScopePill.tsx`.

```tsx
<ScopePill />
```

- Consumes `useDateRange()` for `{ isAllTime, startDate, endDate, label }` and `setAllTime` from actions.
- When `isAllTime === true` → returns `null`.
- Otherwise → renders the horizontal strip (see §5.2).

### 5.2 Visual

```
┌────────────────────────────────────────────────────────────────────┐
│ 📅  Showing: Last 7 days · Apr 17 – Apr 24       ✕ View All Time  │
└────────────────────────────────────────────────────────────────────┘
```

- ~32 px tall, full width of the parent `<CardContent>`.
- Background `primary.50`; bottom border `1px solid primary.100`; sits flush above the existing KPIs.
- Left: `CalendarMonth` icon (16 px) + `"Showing: {label} · {range}"`.
- Right: link-style `<button>` reading `✕ View All Time` — this is the accessibility anchor (focusable, keyboard-activatable, screen-reader-announced).
- Hovering anywhere on the strip deepens background to `primary.100`. Click events on the strip delegate to the same handler as the button (so the whole strip is a pointer target for mouse users), but the button remains the single focusable element.

### 5.3 Label copy

| Filter state | Pill label |
|---|---|
| Recognised preset | `Showing: Last 7 days · Apr 17 – Apr 24` |
| Single-day | `Showing: Apr 24, 2026` |
| Custom range within current year | `Showing: Custom range · Apr 3 – Apr 17` |
| Custom range crossing years | `Showing: Custom range · Dec 20, 2025 – Jan 5, 2026` |

Range label MUST match the top-bar picker button exactly, so the two places read identically.

### 5.4 Label helper — where to live

`getLabel()` in `DateRangeProvider.tsx` currently handles only This Week / This Month / custom. Extend it to recognise **Today, Yesterday, Last 7 / 14 / 30 / 90 days, Last Week, Last Month** so the picker button, chips, and scope pill all share one label source. The picker's local `getSelectionLabel` helper is deleted and replaced by the context's `label`.

### 5.5 Placement

First child of `<CardContent>` on each page's primary summary card:

```
┌──────────────────────────────────────────────────────────────────┐
│ 📅 Last 7 days · Apr 17 – Apr 24           ✕ View All Time      │ ← ScopePill
├──────────────────────────────────────────────────────────────────┤
│  TOTAL EXPENSES   │  BREAKDOWN BY TYPE   │  SUBCONTRACTS         │ ← existing
│  ₹3,53,274        │  Daily Salary ₹...   │  Value · Paid · Bal   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.6 Accessibility

- `role="status"` on the strip (so SR users hear filter changes).
- `✕ View All Time` is a proper `<button>` with visible focus ring and `aria-label="Clear date filter and show all time"`.

## 6. Files changed

| Path | Nature | Notes |
|---|---|---|
| `src/components/common/DateRangePicker.tsx` | Rework | Two-month calendar, text inputs, preset groups, no toggle-off, Custom chip support |
| `src/components/common/ScopePill.tsx` | **New** | ~60 LoC |
| `src/components/layout/MainLayout.tsx` | Edit | Lines ~1080–1123: chip behaviour (no toggle-off), add Today + Custom chips, active-state via `dateRangeLabel` |
| `src/contexts/DateRangeContext/DateRangeProvider.tsx` | Edit | Extend `getLabel()` to cover all presets |
| `src/app/(main)/site/expenses/page.tsx` | Edit | Mount `<ScopePill />` at top of summary `<CardContent>` (line ~782) |
| `src/app/(main)/site/payments/page.tsx` | Edit | Same pattern; audit summary card existence |
| `src/app/(main)/site/attendance/page.tsx` | Edit | Same pattern; audit summary layout |

## 7. Non-functional requirements

- **Mobile**: Pill wraps to two lines gracefully (`flex-wrap`); "View All Time" label shortens to `✕ All Time` below 400 px.
- **Keyboard**: Picker popover reachable via Tab; first element is the first text input; `Esc` closes without applying.
- **Persistence**: Unchanged. `ALL_TIME` marker in localStorage continues to work.
- **Minimum date**: Unchanged. `minDate = site.start_date` (or `2020-01-01` fallback) is passed to the calendar and to the "All Time" preset's `getRange()`.
- **Row cap**: Unchanged. The 2,000-row cap and timeout protection in `fetchExpenses` still apply.

## 8. Testing plan

Per `CLAUDE.md` UI-change workflow — Playwright MCP on `localhost:3000`, auto-login via `/dev-login`.

For each of **Expenses, Attendance, Salary Settlements**:

1. **Default state**: top bar reads "All Time", scope pill absent, table DESC with most-recent row on top.
2. **Preset apply**: click "Week" chip → filter applies → pill appears with `Last 7 days · <dates>` → KPIs update → table filtered.
3. **Clear via pill**: click `✕ View All Time` → filter cleared → pill disappears → top-bar returns to "All Time".
4. **Custom range via input**: open picker → type dates in the two inputs → Apply → pill reads `Custom range · …`.
5. **Custom range via calendar**: open picker → click start date → verify the "end" input highlights and the hint updates → click end date → Apply.
6. **Arrow shift**: set "Last 7 days" → click `‹` → window shifts 7 days earlier; verify `›` disabled when end = today.
7. **Arrow hidden**: verify arrows don't render on All Time or custom ranges.
8. **Cross-month range**: pick Apr 20 → May 5 in the two-pane calendar, confirm pill and button labels render year-agnostic within the same year.
9. **Cross-year range**: pick Dec 20 → Jan 5 (next year), confirm labels show full years on both ends.
10. **Console clean**: `playwright_console_logs` shows zero errors/warnings after every interaction.

Screenshot each major state. `playwright_close` at the end.

## 9. Risks & edge cases

| Risk | Mitigation |
|---|---|
| Site has no `start_date` | Fall back to `2020-01-01` (already in `DateRangePicker`). Preserved. |
| Mobile viewport | Pill wraps; "View All Time" abbreviates. |
| Single-day range | Pill shows `Apr 24, 2026` (no range dash). |
| Cross-year custom range | Both ends get year suffix. |
| Existing summary card layout on small screens | Pill sits above the existing vertical/horizontal stack — no layout break. |
| Two-click selection still unclear for first-time users | The typed date inputs + the helper text underneath the calendar ("Now pick end date") cover this. |

## 10. Explicitly out of scope

- Decoupling summary vs. table dates.
- Migrating to MUI X Pro `DateRangePicker`.
- Adding fiscal-year / quarter / YTD presets.
- Dashboard or pages other than the three above.
- Timezone handling (IST assumed).
- Changing the 2,000-row cap or timeout protection.

## 11. Success criteria

- On first load, Expenses / Attendance / Salary Settlements show All Time, no scope pill, and a table sorted most-recent-first.
- Applying any preset or custom range produces a visible scope pill on the summary card within the same render cycle.
- Clicking the scope pill clears the filter and re-fetches in one interaction.
- Week/Month chip no longer toggles back to All Time on a second click.
- The calendar is usable via typed input in addition to click-click selection.
- The ten Playwright scenarios in §8 pass cleanly with no console errors across all three pages.
