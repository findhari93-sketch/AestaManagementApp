'use client'

export const dynamic = 'force-dynamic'

import MainLayout from '@/components/layout/MainLayout'

export default function MainAppLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>
}
