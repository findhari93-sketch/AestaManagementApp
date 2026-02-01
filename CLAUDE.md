# Aesta Construction Manager

## Project Overview
Next.js construction management application with Supabase backend, MUI components, and React Query for data fetching.

## Tech Stack
- **Framework**: Next.js 15
- **UI**: MUI (Material UI) v7, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **State**: React Query (TanStack Query)
- **Testing**: Vitest, React Testing Library

## Common Commands
```bash
npm run dev          # Start dev server (default port 3000)
npm run build        # Production build
npm run test         # Run tests
npm run db:start     # Start local Supabase
npm run db:reset     # Reset local database
```

## Test Credentials (for Playwright testing)
- **Email**: Haribabu@nerasmclasses.onmicrosoft.com
- **Password**: Padma@123

## After UI Changes - REQUIRED
After making any frontend/UI changes, I must verify and fix issues automatically:

### Visual Verification
1. **Open the app** using Playwright MCP to navigate to localhost:3000 or localhost:3001 (whichever is running)
2. **Login** using the test credentials above if not already logged in
3. **Take a screenshot** to verify the changes rendered correctly
4. **Check for visual issues** - look for broken layouts, missing elements, or styling problems

### Console Error Checking
5. **Read console logs** using `playwright_console_logs` to retrieve ALL messages (logs, warnings, errors, exceptions)
6. **Analyze each issue** and categorize by type

### Automatic Issue Resolution
7. **Fix issues based on type:**

| Issue Type | Action |
|------------|--------|
| **Frontend/UI errors** | Fix React components, styling, or state management in `src/components/` |
| **Database/API errors** | Use Supabase MCP to inspect schema/data (read-only), then fix queries in `src/hooks/queries/` or create migrations |
| **Type errors** | Fix TypeScript types in `src/types/` |
| **Network/fetch errors** | Debug API calls and fix hooks in `src/hooks/queries/` |
| **React warnings** | Fix deprecated patterns, missing keys, or improper hook usage |
| **Hydration errors** | Fix server/client rendering mismatches |

8. **Re-verify after each fix** - Take new screenshot and check console again
9. **Repeat until clean** - No visual issues AND no console errors/warnings

### Important Rules
- For **Supabase production writes**: ALWAYS ask for user confirmation first
- For **local database changes**: Can make changes freely during testing
- **Don't ignore warnings**: Treat warnings as issues that need fixing

This ensures complete verification before the user manually checks.

## Project Structure
- `src/app/` - Next.js app router pages
- `src/components/` - React components
- `src/hooks/queries/` - React Query hooks
- `src/lib/` - Utilities and configurations
- `src/types/` - TypeScript type definitions
- `supabase/migrations/` - Database migrations

## Full-Stack Testing Workflow

### Database Safety Rules
- **Supabase MCP** connects to PRODUCTION (read-safe, write-requires-confirmation)
- **For testing changes**: Use local Supabase with `npm run dev:local`
- I will ALWAYS ask before any write operations to production via MCP

### Frontend Changes
1. Use Playwright to open localhost:3000 or 3001
2. Take screenshot and verify UI
3. Check browser console for errors
4. Fix and re-verify

### Backend/Database Changes
1. Use Supabase MCP to inspect current production schema/data (read-only)
2. Test changes locally with `npm run dev:local`
3. Write migrations for schema changes
4. Apply to production only after local testing passes

### Debugging Flow
1. If UI error → Check browser console via Playwright
2. If data not showing → Query Supabase via MCP (read-only)
3. If API error → Check Supabase dashboard logs
4. Fix code → Test locally → Deploy

### Refreshing Local Data from Production (On-Demand)
When you need fresh production data locally:
```bash
supabase db dump -f supabase/production_backup.sql --data-only
npm run db:reset
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/production_backup.sql
```
