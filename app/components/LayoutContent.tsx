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
      <div className="w-[200px]" style={{ backgroundColor: '#0b2545' }}>
        <div className="h-14 flex items-center px-4 border-r border-gray-200" style={{ backgroundColor: '#ffffff' }}>
          <span className="font-semibold" style={{ color: '#222222' }}>AI Playcaller</span>
        </div>
        <NavLinks />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-14 flex items-center justify-end px-6">
          <UserMenu />
        </div>
        <main className="flex-1 p-4">
          {children}
        </main>
      </div>
    </div>
  );
} 