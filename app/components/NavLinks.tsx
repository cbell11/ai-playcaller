"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { OpponentSelect } from "./OpponentSelect"

const navigation = [
  { name: "Setup", href: "/setup" },
  { name: "Scouting", href: "/scouting" },
  { name: "Play Pool", href: "/playpool" },
  { name: "Game Plan", href: "/plan" },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1 p-2">
      {navigation.map((item) => {
        const isActive = pathname === item.href
        
        // Add the OpponentSelect above Scouting
        if (item.name === "Scouting") {
          return (
            <div key={item.name}>
              <div className="py-1 px-3 mt-4 mb-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opponent
                </div>
                <OpponentSelect />
              </div>
              <Link
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