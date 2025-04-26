"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Setup", href: "/setup" },
  { name: "Play Pool", href: "/playpool" },
  { name: "Scouting", href: "/scouting" },
  { name: "Game Plan", href: "/plan" },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1 p-2">
      {navigation.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              isActive
                ? "bg-gray-200 text-gray-900"
                : "text-gray-700 hover:bg-gray-200 hover:text-gray-900"
            )}
          >
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
} 