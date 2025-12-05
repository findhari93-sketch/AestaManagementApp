# Quick Start Guide

Get your Aesta Construction Manager running in 5 minutes!

## Step 1: Configure Supabase (2 minutes)

1. Open `.env.local` in your editor
2. Replace these lines:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Get your credentials from:
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Settings > API
   - Copy "Project URL" and "anon public" key

## Step 2: Create First User (1 minute)

### In Supabase Dashboard

1. **Create Auth User:**
   - Go to Authentication > Users
   - Click "Add User"
   - Email: `admin@aesta.com`
   - Password: Choose a password
   - Click "Create User"
   - **Copy the User UID** (you'll need it next)

2. **Create User Profile:**
   - Go to Table Editor > users table
   - Click "Insert row"
   - Fill in:
     ```
     auth_id: [paste the UID you copied]
     email: admin@aesta.com
     name: Admin User
     role: admin
     status: active
     ```
   - Click "Save"

## Step 3: Create Test Site (1 minute)

### In Supabase SQL Editor

Run this query:

```sql
INSERT INTO sites (name, address, city, site_type, status, start_date)
VALUES (
  'Sample Construction Site',
  '123 Main Street',
  'Pudukkottai',
  'single_client',
  'active',
  CURRENT_DATE
);
```

## Step 4: Run the App! (30 seconds)

```bash
npm run dev
```

Open http://localhost:3000

## Step 5: Login

- Email: `admin@aesta.com`
- Password: [the password you created]

**You're in!** 🎉

## What You'll See

1. **Login Page** - Professional login interface
2. **Dashboard** - After login, you'll see:
   - Site selector dropdown (showing your test site)
   - Sidebar navigation
   - Dashboard with placeholder statistics
   - Your user profile in the top right

## Try These Things

### Navigation
- Click through all the menu items (Attendance, Laborers, Teams, etc.)
- They're placeholder pages for now - you'll build them in Phase 2!

### Site Selector
- Click the site dropdown in the header
- You'll see "Sample Construction Site"
- Status badge shows "active" in green

### User Menu
- Click your avatar (top right)
- See your name and role
- Sign Out option

### Mobile View
- Resize your browser to mobile width
- Sidebar becomes a hamburger menu
- Everything is responsive!

## Troubleshooting

### Can't Login?
- Check that you created BOTH:
  1. User in Authentication section (Auth User)
  2. Row in users table (User Profile)
- The `auth_id` must match the Auth User's UID

### Site Selector Empty?
- Make sure you ran the SQL query to create a site
- Refresh the page after creating the site

### Environment Variables Not Working?
- Restart the dev server after changing `.env.local`
- Make sure the file is named `.env.local` (not `.env`)

## Next: Add Real Data

Want to test with real laborers and attendance? Create some seed data:

### Sample Labor Categories
```sql
INSERT INTO labor_categories (name, display_order) VALUES
('Civil', 1),
('Electrical', 2),
('Plumbing', 3),
('Carpentry', 4);
```

### Sample Labor Roles
```sql
-- Get the Civil category ID first
SELECT id FROM labor_categories WHERE name = 'Civil';

-- Then insert (replace 'civil-category-id' with actual ID)
INSERT INTO labor_roles (category_id, name, default_daily_rate, display_order) VALUES
('civil-category-id', 'Mason', 800, 1),
('civil-category-id', 'Helper', 500, 2);
```

### Sample Team
```sql
INSERT INTO teams (name, leader_name, leader_phone, status) VALUES
('Team A', 'Ravi Kumar', '9876543210', 'active');
```

### Sample Laborer
```sql
-- Get IDs first
SELECT id FROM labor_categories WHERE name = 'Civil';
SELECT id FROM labor_roles WHERE name = 'Mason';
SELECT id FROM teams WHERE name = 'Team A';

-- Then insert (replace IDs)
INSERT INTO laborers (
  name, phone, category_id, role_id, employment_type,
  daily_rate, team_id, status, joining_date
) VALUES (
  'Murugan', '9876543210', 'category-id', 'role-id',
  'daily_wage', 800, 'team-id', 'active', CURRENT_DATE
);
```

## Ready for Development?

See **PHASE1_COMPLETE.md** for what was built and **README.md** for the full development roadmap.

Ready to start Phase 2? Let's build the Laborers management page! 🚀
