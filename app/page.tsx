"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      // Create Supabase client in the browser
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Use window.location for a full page redirect instead of router.push
        window.location.href = "/auth";
      } else {
        // Check if user has seen training video
        const { data: profile } = await supabase
          .from('profiles')
          .select('has_seen_training')
          .eq('id', session.user.id)
          .single();
        
        // Redirect based on training status
        if (profile?.has_seen_training) {
          window.location.href = "/setup";
        } else {
          window.location.href = "/training";
        }
      }
    };

    checkUser();
  }, [router]);

  // Display a loading state while checking authentication
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-2rem)]">
      <h1 className="text-4xl font-bold mb-4">Welcome to AI Playcaller</h1>
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-lg text-gray-600">
          Checking authentication...
        </p>
      </div>
    </div>
  );
}
