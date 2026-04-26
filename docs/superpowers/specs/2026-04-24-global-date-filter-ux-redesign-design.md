# Global Date-Filter UX Redesign — Design Spec

- **Date:** 2026-04-24 (revised 2026-04-25)
- **Scope (this round):** `DateRangePicker` (global), `MainLayout` top-bar (global), new `ScopeChip` + page-header layout + single-scroll table region + fullscreen mode (`/site/attendance` only).
- **Deferred to follow-up:** Same `ScopeChip` / single-scroll / fullscreen treatment for `/site/expenses` and `/site/payments`. Roll out after the attendance pattern is validated.
- **Out of scope:** decoupling summary/table dates, MUI X Pro migration, fiscal-year presets, timezone changes, row-cap changes.

> **Revision note (2026-04-25):** This spec was reworked after user feedback on the attendance page. Key changes from the original draft: the `Custom` chip is dropped from the top bar; the top-bar arrows always render and use hybrid step semantics; the standalone `‹ April 2026 ›` navigator on attendance is removed; the planned `ScopePill` is replaced by a `ScopeChip` that lives in the existing `PageHeader` title row (no extra strip); the attendance page gets a single-scroll layout and a tight fullscreen mode; the `Date View / Detailed View` dropdown is removed (dead code stays for now). Expenses and Payments pages are deferred so we validate the pattern on attendance first.

---

## 1. Problem statement

Users across Expenses, Attendance and Salary Settlements pages struggle with the global date-range filter in the top bar:

1. The calendar's two-click range selection is unclear — users report it "doesn't let them select" properly.
2. The "Week" and "Month" quick chips toggle back to **All Time** on a second click, which feels like a bug rather than a feature.
3. When a range is active, the summary cards show totals for that range, but nothing on the card indicates the numbers are filtered — users can mistake them for lifetime totals.
4. The ‹ › navigation arrows change behaviour depending on whether a single day, a range, or All Time is active, creating unpredictability.

## 2. Solution overview (one filter, scope-aware)

One global date filter remains the source of truth. Default is **All Time**. Both summary KPIs and table rows react to the same filter.

A compact **`ScopeChip`** lives in each page's existing `PageHeader` title row (this round: attendance only). It always renders. When All Time is active, the chip reads `📅 All Time` with no clear button. When any other range is active, it reads `📅 <range> · <N days>` with a trailing `×` that clears back to All Time. Clicking the chip's label opens the picker.

This keeps the mental model simple (one filter), addresses the "user might think these are All-Time totals" risk by always showing the active scope at the page level, and avoids adding any new vertical strips — the chip replaces an existing informational chip already in the header.

## 3. Top-bar control (at rest)

```
[ ‹ ]  📅 All Time  ▾  [ › ]    Today   Week   Month
```

- **Primary pill** (`All Time ▾` / preset name / `March 2026` / custom range) opens the full picker.
- **Quick chips** (Today, Week, Month) are **one-tap apply** — no toggle-off behaviour. Active chip is filled + `primary` colour when the active range matches that preset's `getRange()`; otherwise outlined.
- **No `Custom` chip.** Custom ranges are reachable from the picker (opened via the primary pill). Removes redundant top-bar surface.
- **‹ › arrows always render.** Disabled state only when stepping would predate `site.start_date` or move past today. (Previous draft hid them for All Time / custom — that rule is removed.)
- **Arrow step semantics — hybrid (C):**

  | Active filter | Arrow step | Label after stepping |
  |---|---|---|
  | This Week / Last Week / a 7-day window aligned to a calendar week | 7 days | preset name preserved (Week chip stays active) |
  | This Month / Last Month / a calendar-month window | 1 month | `March 2026` etc. (Month chip de-activates once we leave "this month") |
  | Today, Yesterday, Last 7 / 14 / 30 / 90 days, custom range, All Time | 1 month | `March 2026` etc. |

- After arrow stepping, the matching quick chip (Today / Week / Month) only stays active if the new range still equals that preset's `getRange()`. Otherwise the chip de-activates and the primary pill displays the navigated month.
- To clear back to All Time, user opens the picker and selects "All Time", **or** clicks the page-level `ScopeChip` `×` (see §5) on pages that mount it.

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

## 5. ScopeChip in PageHeader (attendance only this round)

The standalone `‹ April 2026 ›` row is removed from the attendance page; the top-bar arrows do all stepping. The "Showing: …" strip planned in earlier drafts (`ScopePill`) is replaced with a chip that lives **inside the existing `PageHeader` title row**. Single source of truth for "what range am I viewing", zero extra vertical rows.

### 5.1 Component contract

New file `src/components/common/ScopeChip.tsx` (~40 LoC).

```tsx
<ScopeChip />
```

- Consumes `useDateRange()` for `{ isAllTime, startDate, endDate, label, days }` and `setAllTime`, `openPicker` from actions.
- Always renders (no `null` branch). Visual changes by state:

  | State | Chip text | Trailing `×` | Click on label |
  |---|---|---|---|
  | `isAllTime === true` | `📅 All Time` | hidden | opens picker |
  | Any other filter | `📅 <range> · <N days>` (e.g. `Apr 1 – Apr 25 · 25 days`) | shown | opens picker |

- `×` click → `setAllTime()`.
- Label uses the same `getLabel()` helper from `DateRangeProvider.tsx` extended in §5.4 — top-bar pill and `ScopeChip` read identically.

### 5.2 Visual

```
[ 📅 Apr 1 – Apr 25 · 25 days  × ]
```

- MUI `<Chip>` with `icon={<CalendarMonth fontSize="small" />}`, `onDelete={...}` (only when not All Time), `clickable` for label click.
- Sits in the existing `PageHeader` `titleChip` slot (replaces the informational `15 days` / `112 days` chip — that count moves into the `· N days` portion of the chip label).

### 5.3 Label copy

| Filter state | Chip label |
|---|---|
| All Time | `All Time` |
| Single day | `Apr 24, 2026 · 1 day` |
| Week preset | `Apr 19 – Apr 25 · 7 days` |
| Calendar month (current, in progress) | `Apr 1 – Apr 25 · 25 days` |
| Calendar month (past) | `Mar 2026 · 31 days` |
| Custom range within current year | `Apr 3 – Apr 17 · 15 days` |
| Custom range crossing years | `Dec 20, 2025 – Jan 5, 2026 · 17 days` |

Label MUST match the top-bar picker button exactly, so the two places read identically.

### 5.4 Label helper — where to live

`getLabel()` in `DateRangeProvider.tsx` currently handles only This Week / This Month / custom. Extend it to recognise **Today, Yesterday, Last 7 / 14 / 30 / 90 days, Last Week, Last Month, calendar months** (`March 2026`-style) so the picker button, top-bar chips, and `ScopeChip` all share one label source. Also add `days: number | null` to context value (computed from `startDate` / `endDate`; `null` for All Time). The picker's local `getSelectionLabel` helper is deleted and replaced by the context's `label`.

### 5.5 Placement

```
[←] Attendance  [📅 Apr 1 – Apr 25 · 25 days  ×]                  [⛶ Fullscreen]
    Srinivasan House & Shop
─────────────────────────────────────────────────────────────────────────────
| Period Total | Salary | Tea Shop | Daily | Contract | Market | Paid | … |    ← summary KPIs
─────────────────────────────────────────────────────────────────────────────
| Date | Daily | Contract | Market | … |                                       ← table (scrolls)
```

`ScopeChip` mounts in `PageHeader`'s `titleChip` prop. The right-side `actions` slot now hosts the fullscreen-toggle icon button instead of the deleted `Date View` dropdown (see §5a.3).

### 5.6 Accessibility

- `role="status"` on the chip so SR users hear filter changes.
- Trailing `×` is a proper `<button>` with `aria-label="Clear date filter and show all time"` and visible focus ring.
- Label part exposes `aria-label="Open date filter"`.

## 5a. Attendance page — single-scroll layout, fullscreen, dropdown removal

### 5a.1 Single-scroll layout

The attendance content already wraps in a `Box` with `height: calc(100vh - 56px/64px)` and `flexDirection: column` (`attendance-content.tsx:2644-2652`) — the bones are there but the inner regions don't claim the remaining space, so the document itself overflows and the browser shows a global scrollbar.

Fix:

- `PageHeader` row, summary KPI row → `flexShrink: 0` (natural height).
- Table region → wrap in a `Box` with `{ flex: 1, minHeight: 0, overflow: 'auto' }` so the table scrolls inside that box and the document body does not.
- Net effect: only one vertical scrollbar — inside the table — at viewport heights ≥ 1080px.

The same restructure is the right fix for `/site/expenses` and `/site/payments` later, but **out of scope here** — only attendance changes in this round.

### 5a.2 Fullscreen mode (tight)

- New state in `attendance-content.tsx`: `const [isFullscreen, setIsFullscreen] = useState(false)`.
- Click `⛶` in `PageHeader` actions → `setIsFullscreen(true)`. Icon swaps to a collapse glyph; click it (or press `Esc`) → `setIsFullscreen(false)`.
- When `isFullscreen === true`, the entire attendance content tree mounts inside a MUI `<Portal>` attached to `document.body` with:

  ```
  position: fixed
  inset: 0
  zIndex: theme.zIndex.modal + 1
  bgcolor: background.default
  ```

  — this covers the app sidebar and top bar, achieving true viewport coverage.
- The top-bar date filter is *not* visible in fullscreen, but the `ScopeChip` in the page header still is — clicking it opens the picker so users can change range without exiting fullscreen.
- `Esc` keyboard listener registered only while `isFullscreen === true`.
- No URL or localStorage persistence — fullscreen is ephemeral, like Excel's "present" toggle.

### 5a.3 Date View / Detailed View dropdown

Removed from the `PageHeader` `actions` slot (currently lines 2671–2687 of `attendance-content.tsx`). The `viewMode === "detailed"` JSX branch (around line 3156) **stays in the file as dead code** for now — no users currently use detailed view; we'll delete the branch in a follow-up if no one revives it within a release. This avoids deleting code that may be wanted later.

## 6. Files changed

| Path | Nature | Notes |
|---|---|---|
| `src/components/common/DateRangePicker.tsx` | Rework | Two-month calendar, text inputs, preset groups, no toggle-off |
| `src/components/common/ScopeChip.tsx` | **New** | ~40 LoC. Replaces the earlier `ScopePill` plan. |
| `src/components/layout/MainLayout.tsx` | Edit | Top bar: drop `Custom` chip; arrows always render; hybrid step semantics; label updates after arrow nav. |
| `src/contexts/DateRangeContext/DateRangeProvider.tsx` | Edit | Extend `getLabel()` to cover all presets + calendar-month labels (`March 2026`); add `days: number \| null` to context value; add hybrid-step helper used by the top-bar arrows. |
| `src/app/(main)/site/attendance/attendance-content.tsx` | Edit | Replace `Date View` `<Select>` and standalone month navigator (lines 339–352, 2654–2720) with `ScopeChip` + fullscreen toggle in `PageHeader`. Wrap table region in `{ flex: 1, minHeight: 0, overflow: 'auto' }`. Add fullscreen state + `<Portal>` mount + `Esc` listener. |
| `src/app/(main)/site/expenses/page.tsx` | **Deferred** | No change this round; gets `ScopeChip` / single-scroll / fullscreen in follow-up. |
| `src/app/(main)/site/payments/page.tsx` | **Deferred** | Same. |

## 7. Non-functional requirements

- **Mobile**: `ScopeChip` truncates the range portion with ellipsis when the title row would overflow; the `· N days` suffix and `×` button stay visible. Top-bar arrows remain visible on mobile.
- **Keyboard**:
  - Picker popover reachable via Tab; first element is the first text input; `Esc` closes without applying.
  - `ScopeChip` label and `×` are both Tab-reachable.
  - In fullscreen mode, `Esc` exits fullscreen (only when no picker is open — picker `Esc` takes precedence).
- **Persistence**: Unchanged. `ALL_TIME` marker in localStorage continues to work. Fullscreen state is **not** persisted.
- **Minimum date**: Unchanged. `minDate = site.start_date` (or `2020-01-01` fallback) is passed to the calendar and to the "All Time" preset's `getRange()`. Top-bar `‹` arrow is disabled when the next step would predate `minDate`.
- **Row cap**: Unchanged. The 2,000-row cap and timeout protection in `fetchExpenses` still apply.

## 8. Testing plan

Per `CLAUDE.md` UI-change workflow — Playwright MCP on `localhost:3000`, auto-login via `/dev-login`. All scenarios on `/site/attendance`.

**Top-bar / picker (global behaviour, verified on attendance):**

1. **Default state**: top bar reads "All Time", `ScopeChip` reads `All Time` (no `×`), table sorted most-recent first.
2. **Preset apply**: click "Week" chip → filter applies → `ScopeChip` updates to `<range> · 7 days` with `×` → KPIs and table update.
3. **Clear via chip**: click `ScopeChip` `×` → filter cleared → `ScopeChip` returns to `All Time` → top-bar pill reads "All Time".
4. **Picker apply (custom)**: open picker via `ScopeChip` → type dates / pick on calendar → Apply → both top-bar pill and `ScopeChip` read `<range> · <N days>`.
5. **No `Custom` chip in top bar**: visual confirmation that the top bar shows only Today / Week / Month chips next to the pill.
6. **Arrow stepping — week-aligned window**: select "Week" → click `‹` → window slides 7 days back → top-bar Week chip stays active → label preserved.
7. **Arrow stepping — month-aligned window**: select "Month" → click `‹` → label becomes `March 2026` → Month chip de-activates → KPIs/table update.
8. **Arrow stepping — non-aligned window (hybrid C)**: select "Last 7 days" → click `‹` → label becomes `March 2026` (steps by 1 month, not by 7 days, because window is not week-aligned).
9. **Arrow stepping — All Time**: from All Time → click `‹` → label becomes the previous calendar month.
10. **Arrow disabled bounds**: stepping forward past today is disabled; stepping back before `site.start_date` is disabled.

**Attendance-specific layout:**

11. **No global scrollbar at 1920×1080**: the document body has no vertical scrollbar — only the table region scrolls.
12. **Fullscreen toggle**: click `⛶` → app sidebar + top bar disappear, attendance content covers viewport. Click collapse icon → restore.
13. **`Esc` exits fullscreen**: in fullscreen, press `Esc` → restore.
14. **`ScopeChip` works in fullscreen**: in fullscreen, click `ScopeChip` → picker opens above the fullscreen layer; apply a range → range applies and chip updates, still in fullscreen.
15. **Date View dropdown is gone**: confirm no `<Select>` in `PageHeader` actions; only the fullscreen icon.
16. **Cross-month range**: pick Apr 20 → May 5 in the picker, confirm `ScopeChip` and top-bar pill render correctly within same year.
17. **Cross-year range**: pick Dec 20, 2025 → Jan 5, 2026, confirm labels show full years on both ends.
18. **Console clean**: `playwright_console_logs` shows zero errors/warnings after every interaction in scenarios 1–17.

Screenshot each major state. `playwright_close` at the end.

## 9. Risks & edge cases

| Risk | Mitigation |
|---|---|
| Site has no `start_date` | Fall back to `2020-01-01` (already in `DateRangePicker`). Preserved. |
| Mobile viewport, narrow `PageHeader` | `ScopeChip` truncates the range portion with ellipsis; `· N days` and `×` stay visible. |
| Single-day range | Chip shows `Apr 24, 2026 · 1 day` (no range dash). |
| Cross-year custom range | Both ends get year suffix. |
| Two-click calendar selection still unclear for first-time users | The typed date inputs + the helper text underneath the calendar ("Now pick end date") cover this. |
| Hybrid arrow stepping confusion (user expects "Last 7 days" → click `‹` to give previous 7 days) | Documented behaviour: only week-aligned and month-aligned windows preserve their step length; everything else is a generic month-stepper. The chip + pill labels both update visibly so the user sees the new range. |
| Fullscreen mode hides the global top bar; user can't switch sites or open notifications without exiting | Acceptable — fullscreen is an explicit opt-in. Exit is one click on the collapse icon or one `Esc` press. |
| Fullscreen `Portal` unmounts/remounts the attendance content tree, losing local component state | Mount the same component subtree once, and toggle the `Portal` wrapper around it via conditional render only — keep React tree identity stable. (Implementation note for the plan.) |
| Removed dead `viewMode === "detailed"` JSX still imports unused symbols | Acceptable for one release; clean up in the follow-up that deletes the branch entirely. |

## 10. Explicitly out of scope

- Decoupling summary vs. table dates.
- Migrating to MUI X Pro `DateRangePicker`.
- Adding fiscal-year / quarter / YTD presets.
- Dashboard pages.
- Same `ScopeChip` / single-scroll / fullscreen treatment for `/site/expenses` and `/site/payments` (deferred to follow-up after the attendance pattern is validated).
- Deleting the `viewMode === "detailed"` JSX branch (the dropdown is removed; dead code stays for now).
- Timezone handling (IST assumed).
- Changing the 2,000-row cap or timeout protection.
- Animating the fullscreen transition.

## 11. Success criteria

- On first load, `/site/attendance` shows the user's last-saved range or — for a first-time visitor — defaults to `This Month` (a deliberate `DateRangeProvider` perf default that avoids pulling all rows from heavy views like `v_all_expenses` on the very first page load). `ScopeChip` reflects whichever range is active and includes a `×` to clear back to `All Time`. Table is sorted most-recent first.
- Applying any preset or custom range updates the `ScopeChip` to `<range> · <N days>` with `×` within the same render cycle, and the top-bar pill matches.
- Clicking `ScopeChip` `×` clears the filter and re-fetches in one interaction.
- Week / Month chip no longer toggles back to All Time on a second click.
- Top-bar `‹ ›` arrows are always visible (subject only to site-start / today bounds) and step using hybrid C semantics.
- The `Custom` chip is no longer in the top bar.
- The standalone `‹ April 2026 ›` row is no longer rendered on attendance.
- The Date View / Detailed View dropdown is no longer rendered on attendance.
- At ≥1080p viewport height, attendance has only one vertical scrollbar — inside the table.
- Clicking the fullscreen icon covers the entire viewport (sidebar + top bar hidden); clicking it again or pressing `Esc` exits.
- The calendar in the picker is usable via typed input in addition to click-click selection.
- All Playwright scenarios in §8 pass cleanly with zero console errors.
