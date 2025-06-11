import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Playcaller | Login",
  description: "Login to AI Playcaller - Your football play calling assistant",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable}`}>
      <body className="bg-gray-50">
        <div className="min-h-screen flex flex-col">
          {/* Auth-only wrapper that prevents other components from rendering */}
          <main className="flex-grow flex items-center justify-center">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
} 