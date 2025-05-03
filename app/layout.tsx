import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavLinks } from "./components/NavLinks"
import { UserMenu } from "./components/UserMenu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Playcaller",
  description: "AI-powered football play calling assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
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
      </body>
    </html>
  )
}
