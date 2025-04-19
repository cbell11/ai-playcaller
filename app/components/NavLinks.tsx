import Link from "next/link"

const navigation = [
  { name: "Setup", href: "/setup" },
  { name: "Scouting", href: "/scouting" },
  { name: "Game Plan", href: "/plan" },
]

export function NavLinks() {
  return (
    <nav className="flex-1 space-y-1 p-2">
      {navigation.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 hover:text-gray-900"
        >
          {item.name}
        </Link>
      ))}
    </nav>
  )
} 