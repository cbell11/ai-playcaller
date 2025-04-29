import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavLinks } from "./components/NavLinks"

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
          <main className="flex-1 p-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
