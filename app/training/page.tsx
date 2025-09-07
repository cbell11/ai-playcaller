"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TrainingPage() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState("https://www.loom.com/share/51c0ef4fbe404e3686597e530e8fee34?sid=e88193bc-e7ec-43d3-b701-40514a1be05c");
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkUserAndLoadVideo = async () => {
      try {
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          window.location.href = "/auth";
          return;
        }

        // Get user's team_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', session.user.id)
          .single();

        if (profile?.team_id) {
          setTeamId(profile.team_id);
          
          // Try to load custom training video from localStorage
          const savedFirstLoginUrl = localStorage.getItem('firstLoginVideoUrl');
          if (savedFirstLoginUrl) {
            setVideoUrl(savedFirstLoginUrl);
          }
        }
      } catch (error) {
        console.error("Error loading training video:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUserAndLoadVideo();
  }, []);

  const handleGetStarted = async () => {
    try {
      // Mark that the user has seen the training video
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && teamId) {
        // Update user profile to indicate they've completed training
        await supabase
          .from('profiles')
          .update({ has_seen_training: true })
          .eq('id', session.user.id);
      }
      
      // Redirect to scouting page
      window.location.href = "/scouting";
    } catch (error) {
      console.error("Error updating training status:", error);
      // Still redirect even if update fails
      window.location.href = "/scouting";
    }
  };

  // Convert Loom share URL to embed URL
  const getEmbedUrl = (url: string) => {
    if (url.includes('loom.com/share/')) {
      const videoId = url.split('share/')[1]?.split('?')[0];
      return `https://www.loom.com/embed/${videoId}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-lg text-gray-600 mt-4">Loading training video...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to AI Playcaller!
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Before you begin, please watch this important training video
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mx-auto max-w-2xl">
            <p className="text-amber-800 font-medium">
              ⚠️ This training video is essential for getting the most out of AI Playcaller. 
              Please watch the entire video before proceeding.
            </p>
          </div>
        </div>

        <Card className="mb-8">
          <CardContent className="p-0">
            <div className="relative aspect-video w-full">
              <iframe
                src={getEmbedUrl(videoUrl)}
                className="w-full h-full rounded-lg"
                frameBorder="0"
                allowFullScreen
                title="AI Playcaller Training Video"
              />
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Ready to Get Started?
            </h3>
            <p className="text-blue-700 mb-4">
              After watching the training video, click the button below to begin using AI Playcaller. 
              You can always revisit this training in the Help section.
            </p>
          </div>
          
          <Button 
            onClick={handleGetStarted}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
} 