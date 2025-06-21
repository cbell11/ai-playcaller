"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2, UserCog, Book, PlayCircle, Shield } from 'lucide-react'
import { cn } from "@/lib/utils"

const adminTabs = [
  {
    name: "User Management",
    href: "/admin",
    icon: UserCog
  },
  {
    name: "Master Terminology",
    href: "/admin/terminology",
    icon: Book
  },
  {
    name: "Master Play Pool",
    href: "/admin/playpool",
    icon: PlayCircle
  },
  {
    name: "Scouting Terminology",
    href: "/admin/scouting-terminology",
    icon: Shield
  }
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/auth')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          router.push('/')
          return
        }

        setLoading(false)
      } catch (err) {
        setError('Failed to check access')
        setLoading(false)
      }
    }

    checkAccess()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        <div className="border-b">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {adminTabs.map((tab) => {
              const isActive = pathname === tab.href
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={cn(
                    "group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium",
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  )}
                >
                  <tab.icon className={cn(
                    "h-5 w-5 mr-2",
                    isActive
                      ? "text-blue-500"
                      : "text-gray-400 group-hover:text-gray-500"
                  )} />
                  {tab.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  )
} 