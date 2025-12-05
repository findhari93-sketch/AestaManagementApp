# Setup Instructions

## Phase 1 Complete! ✅

Congratulations! Phase 1 of the Aesta Construction Manager has been successfully set up with the following features:

### Completed Features
- ✅ Next.js 14+ project with TypeScript
- ✅ Material UI (MUI) theme and styling
- ✅ Supabase client configuration (browser, server, middleware)
- ✅ Complete TypeScript types for database schema
- ✅ Authentication system with login/logout
- ✅ Protected routes with middleware
- ✅ User profile management via AuthContext
- ✅ Site selection system via SiteContext
- ✅ Professional responsive layout with sidebar navigation
- ✅ Role-based navigation (admin, office, site_engineer)
- ✅ Dashboard page with placeholder stats
- ✅ Placeholder pages for all main sections

## Next Steps - Configure Supabase

Before you can run the application, you need to:

### 1. Update Environment Variables

Edit `.env.local` and replace the placeholder values with your actual Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key
```

You can find these values in your Supabase project:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Project Settings > API
4. Copy the Project URL and anon/public key

### 2. Verify Database Setup

Ensure your Supabase database has:
- All tables created as per the schema
- Database functions configured
- Views created
- Row Level Security (RLS) policies set up (if needed)

### 3. Create Your First User

1. In Supabase Dashboard, go to Authentication > Users
2. Click "Add User" and create a new user with email/password
3. Note the user's UID (auth ID)
4. In the SQL Editor, run:

```sql
INSERT INTO users (auth_id, email, name, role, status)
VALUES (
  'paste-the-auth-uid-here',
  'admin@aesta.com',
  'Admin User',
  'admin',
  'active'
);
```

### 4. Create a Test Site

```sql
INSERT INTO sites (name, address, city, site_type, status, start_date)
VALUES (
  'Test Construction Site',
  '123 Main Street',
  'Pudukkottai',
  'single_client',
  'active',
  CURRENT_DATE
);
```

## Running the Application

### Development Mode

```bash
npm run dev
```

Open http://localhost:3000 and you should see the login page.

### Production Build

**Important**: The production build requires valid Supabase credentials in `.env.local`. The placeholder values will not work for building.

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── login/             # ✅ Login page (ready)
│   ├── dashboard/         # ✅ Dashboard layout + page (ready)
│   ├── attendance/        # Placeholder
│   ├── laborers/          # Placeholder
│   ├── teams/             # Placeholder
│   ├── salary/            # Placeholder
│   ├── expenses/          # Placeholder
│   ├── contracts/         # Placeholder
│   ├── reports/           # Placeholder
│   └── settings/          # Placeholder (admin only)
├── components/
│   ├── layout/
│   │   └── SiteSelector.tsx   # ✅ Site dropdown selector
│   └── providers/
│       └── ThemeProvider.tsx  # ✅ MUI theme wrapper
├── contexts/
│   ├── AuthContext.tsx    # ✅ Authentication state
│   └── SiteContext.tsx    # ✅ Site selection state
├── lib/
│   └── supabase/
│       ├── client.ts      # ✅ Browser client
│       ├── server.ts      # ✅ Server client
│       └── middleware.ts  # ✅ Auth middleware
├── theme/
│   └── theme.ts           # ✅ MUI theme config
└── types/
    └── database.types.ts  # ✅ Complete DB types
```

## What's Working

1. **Authentication Flow**
   - Login page with email/password
   - Automatic redirect to dashboard after login
   - Protected routes (redirects to login if not authenticated)
   - User profile loaded from `users` table
   - Sign out functionality

2. **Site Selection**
   - Dropdown in header to switch between sites
   - Filters sites based on user role (admin sees all, others see assigned sites only)
   - Persists selection in localStorage
   - Auto-selects first available site

3. **Navigation**
   - Responsive sidebar with all main sections
   - Mobile-friendly hamburger menu
   - Active page highlighting
   - Role-based menu items (Settings only for admin)

4. **Layout**
   - Professional MUI design
   - Responsive breakpoints
   - User menu with profile info
   - Consistent styling across all pages

## Ready for Phase 2

You're now ready to start Phase 2: Core Data Management

### Phase 2 Tasks
1. Laborers CRUD operations
2. Teams CRUD operations
3. Site management (admin)
4. User management (admin)

See the main README.md for the complete development roadmap.

## Troubleshooting

### "Invalid supabaseUrl" error
- Make sure you've updated `.env.local` with valid Supabase credentials
- Restart the dev server after changing environment variables

### Login not working
- Check that your user exists in both Supabase Auth AND the `users` table
- Verify the `auth_id` in the `users` table matches the UID from Supabase Auth

### Site selector is empty
- Ensure you have at least one site created in the `sites` table
- Check that the user's `assigned_sites` array includes the site ID (or user is admin)

### Build errors
- Building requires valid Supabase credentials (placeholder values won't work)
- You can skip building for now and just use `npm run dev`

## Support

For questions or issues, refer to the main project documentation or contact the development team.

---

**Next Steps**: Update your `.env.local` file with real Supabase credentials and start the dev server!
