"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { OpponentSelect } from "./OpponentSelect"
import { createBrowserClient } from '@supabase/ssr'
import { UserCog, HelpCircle, Wrench, Binoculars, ClipboardList, Timer } from 'lucide-react'

const navigation = [
  { name: "Admin", href: "/admin", icon: UserCog, adminOnly: true },
  { name: "Setup", href: "/setup", icon: Wrench },
  { name: "Scouting", href: "/scouting", icon: Binoculars },
  { name: "Play Pool", href: "/playpool", adminOnly: true },
  { name: "Game Plan", href: "/plan", icon: ClipboardList },
  { name: "Practice", href: "/practice", icon: Timer, beta: true },
]

export function NavLinks() {
  const pathname = usePathname()
  const router = useRouter()
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

  // Handle navigation with auto-save for setup page
  const handleNavigation = async (href: string, e: React.MouseEvent) => {
    e.preventDefault()
    
    // If we're on the setup page, trigger save before navigation
    if (pathname === '/setup') {
      // Dispatch a custom event to trigger save on setup page
      const saveEvent = new CustomEvent('saveTerminologyBeforeNavigation', { 
        detail: { targetUrl: href }
      })
      window.dispatchEvent(saveEvent)
    } else {
      // Direct navigation if not on setup page
      router.push(href)
    }
  }

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
              <button
                onClick={(e) => handleNavigation(item.href, e)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium w-full text-left",
                  isActive
                    ? "bg-white bg-opacity-10 text-white"
                    : "text-white hover:bg-white hover:bg-opacity-10"
                )}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.name}
              </button>
            </div>
          )
        }
        
        return (
          <button
            key={item.name}
            onClick={(e) => handleNavigation(item.href, e)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium w-full text-left",
              isActive
                ? "bg-white bg-opacity-10 text-white"
                : "text-white hover:bg-white hover:bg-opacity-10"
            )}
          >
            {item.icon && <item.icon className="h-4 w-4" />}
            <span className="flex items-center gap-2">
              {item.name}
              {item.beta && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white bg-opacity-20 rounded text-black">
                  BETA
                </span>
              )}
            </span>
          </button>
        )
      })}
      <button
        onClick={(e) => handleNavigation("/help", e)}
        className={cn(
          "group flex items-center rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-[#0B2545]/90 w-full text-left",
          pathname === "/help" ? "bg-[#0B2545]" : "transparent"
        )}
      >
        <HelpCircle className="mr-2 h-4 w-4" />
        <span>Help</span>
      </button>
    </nav>
  )
} 