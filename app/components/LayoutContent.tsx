"use client";

import { usePathname } from 'next/navigation';
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";

export function LayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');

  if (isAuthPage) {
    return children;
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-[200px] bg-gray-100 border-r">
        <div className="h-14 flex items-center border-b bg-white px-4">
          <span className="font-semibold">AI Playcaller</span>
        </div>
        <NavLinks />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b flex items-center justify-between px-6">
          <span className="text-gray-500 text-sm">Football Strategy Assistant</span>
          <UserMenu />
        </div>
        <main className="flex-1 p-4">
          {children}
        </main>
      </div>
    </div>
  );
} 