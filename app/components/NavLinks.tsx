"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { OpponentSelect } from "./OpponentSelect"
import { createBrowserClient } from '@supabase/ssr'
import { UserCog } from 'lucide-react'

const navigation = [
  { name: "Admin", href: "/admin", icon: UserCog, adminOnly: true },
  { name: "Setup", href: "/setup" },
  { name: "Scouting", href: "/scouting" },
  { name: "Play Pool", href: "/playpool" },
  { name: "Game Plan", href: "/plan" },
]

export function NavLinks() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        setIsAdmin(profile?.role === 'admin')
      } catch (err) {
        console.error('Failed to check admin status:', err)
      }
    }

    checkAdminStatus()
  }, [])

  return (
    <nav className="flex-1 space-y-1 p-2">
      {navigation.map((item) => {
        // Skip admin items for non-admin users
        if (item.adminOnly && !isAdmin) return null
        
        const isActive = pathname === item.href
        
        // Add the OpponentSelect above Scouting
        if (item.name === "Scouting") {
          return (
            <div key={item.name}>
              <div className="py-1 px-3 mt-4 mb-1">
                <div className="text-xs font-medium text-white uppercase tracking-wider">
                  Opponent
                </div>
                <OpponentSelect />
              </div>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-white bg-opacity-10 text-white"
                    : "text-white hover:bg-white hover:bg-opacity-10"
                )}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.name}
              </Link>
            </div>
          )
        }
        
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              isActive
                ? "bg-white bg-opacity-10 text-white"
                : "text-white hover:bg-white hover:bg-opacity-10"
            )}
          >
            {item.icon && <item.icon className="h-4 w-4" />}
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
} 