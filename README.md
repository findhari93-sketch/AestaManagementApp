# Aesta Construction Manager

A comprehensive Construction Labor Management Web Application for Aesta Architects & Engineers, Pudukkottai, Tamil Nadu.

## Overview

This application manages daily labor attendance, weekly salary calculations, contracts, and expenses across multiple construction sites.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router)
- **UI Library**: Material UI (MUI)
- **Data Tables**: Material React Table
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Language**: TypeScript
- **Styling**: Material UI + Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account and project set up
- Database schema already created in Supabase (as per project documentation)

### Installation

1. Clone the repository or navigate to the project directory

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.local.example` to `.env.local`
   - Update with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### First Time Setup

1. Ensure your Supabase database has:
   - All tables created as per schema
   - Database functions configured
   - Views created
   - Row Level Security (RLS) policies set up

2. Create your first admin user in Supabase:
   - Go to Authentication > Users
   - Create a new user with email/password
   - Add a record in the `users` table with:
     - `auth_id`: The user's auth UID
     - `email`: User's email
     - `name`: User's name
     - `role`: 'admin'
     - `status`: 'active'

3. Create at least one site in the `sites` table to test the application

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── login/             # Login page
│   ├── dashboard/         # Main dashboard
│   ├── attendance/        # Attendance management
│   ├── laborers/          # Laborer management
│   ├── teams/             # Team management
│   ├── salary/            # Salary calculations
│   ├── expenses/          # Expense tracking
│   ├── contracts/         # Contract management
│   ├── reports/           # Reports
│   └── settings/          # Settings (admin only)
├── components/            # Reusable components
│   ├── layout/           # Layout components
│   └── providers/        # Provider components
├── contexts/             # React contexts
│   ├── AuthContext.tsx   # Authentication context
│   └── SiteContext.tsx   # Site selection context
├── lib/                  # Utility libraries
│   └── supabase/        # Supabase client configuration
├── theme/               # MUI theme configuration
└── types/               # TypeScript type definitions
    └── database.types.ts # Database schema types
```

## Features

### Phase 1 (Completed)
- ✅ Next.js project setup
- ✅ Supabase client configuration
- ✅ Authentication (login/logout)
- ✅ Protected routes with middleware
- ✅ Professional MUI theme
- ✅ Responsive layout with sidebar navigation
- ✅ Site selector in header
- ✅ User profile management
- ✅ Role-based navigation

### Phase 2 (Upcoming)
- Laborers CRUD operations
- Teams CRUD operations
- Site management (admin)
- User management (admin)

### Phase 3 (Upcoming)
- Daily attendance entry
- Attendance calendar view
- Holiday management
- Advance/Extra recording

### Phase 4-8
- Salary calculations
- Expense tracking
- Contract management
- Reports and analytics
- CSV import
- Mobile responsiveness

## Database Schema

The application uses a comprehensive database schema with the following main tables:

- **Core**: users, sites, building_sections, clients
- **Labor**: labor_categories, labor_roles, teams, laborers
- **Attendance**: daily_attendance, site_holidays, daily_logs
- **Contracts**: contracts, contract_milestones
- **Financial**: advances, expenses, salary_periods, payments
- **System**: audit_log, notifications, deletion_requests

See the project documentation for detailed schema information.

## Authentication & Authorization

### User Roles

1. **Admin**
   - Full access to all features
   - Can manage users and sites
   - Can approve deletions
   - View all sites

2. **Office Employee**
   - Can manage laborers and teams
   - Can edit past attendance
   - Can record payments
   - Access to assigned sites only

3. **Site Engineer**
   - Can add today's attendance
   - Can add expenses
   - View reports (limited)
   - Access to assigned sites only

### Protected Routes

All routes except `/login` require authentication. The middleware automatically redirects unauthenticated users to the login page.

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| NEXT_PUBLIC_SUPABASE_URL | Your Supabase project URL | Yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Your Supabase anonymous key | Yes |

## Contributing

This is a private project for Aesta Architects & Engineers.

## Support

For issues or questions, contact the development team.

## License

Private - All rights reserved by Aesta Architects & Engineers

---

**Aesta Architects & Engineers**
Pudukkottai, Tamil Nadu
