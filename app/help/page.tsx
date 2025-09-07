"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getHelpVideos, HelpVideo } from '@/app/actions/help-videos'
import { convertToEmbedUrl } from '@/lib/utils'
import { Loader2, Play } from 'lucide-react'

export default function HelpPage() {
  const [videos, setVideos] = useState<HelpVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const result = await getHelpVideos()
        if (result.success && result.data) {
          setVideos(result.data)
        } else {
          setError('Failed to load help videos')
        }
      } catch (err) {
        setError('Error loading videos')
        console.error('Error fetching help videos:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchVideos()
  }, [])

  const showcaseVideos = videos.filter(v => v.video_type === 'showcase')
  const tutorialVideos = videos.filter(v => v.video_type === 'tutorial')
  const tipsVideos = videos.filter(v => v.video_type === 'tips')

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Help & Documentation</h1>

      {/* Video Section */}
      <div className="mb-12">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading videos...</span>
          </div>
        ) : error ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        ) : (
          <>
            {/* Showcase Video - Prominent at top */}
            {showcaseVideos.length > 0 && (
              <div className="mb-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2">{showcaseVideos[0].title}</h2>
                  <p className="text-gray-600">Get a complete overview of the AI Playcaller platform</p>
                </div>
                <div className="flex justify-center">
                  <div className="w-full max-w-4xl">
                    <div className="relative w-full pb-[56.25%] h-0 rounded-lg overflow-hidden shadow-lg">
                      <iframe
                        src={convertToEmbedUrl(showcaseVideos[0].loom_url)}
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        className="absolute top-0 left-0 w-full h-full"
                        title={showcaseVideos[0].title}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tutorial Videos Grid */}
            {tutorialVideos.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">Tutorial Videos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {tutorialVideos.map((video) => (
                    <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Play className="h-5 w-5 text-blue-500" />
                          {video.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="relative w-full pb-[56.25%] h-0 rounded overflow-hidden">
                          <iframe
                            src={convertToEmbedUrl(video.loom_url)}
                            frameBorder="0"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                            className="absolute top-0 left-0 w-full h-full"
                            title={video.title}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Tips and Tricks Videos Grid */}
            {tipsVideos.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">Tips & Tricks</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {tipsVideos.map((video) => (
                    <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Play className="h-5 w-5 text-purple-500" />
                          {video.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="relative w-full pb-[56.25%] h-0 rounded overflow-hidden">
                          <iframe
                            src={convertToEmbedUrl(video.loom_url)}
                            frameBorder="0"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                            className="absolute top-0 left-0 w-full h-full"
                            title={video.title}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Basic setup and navigation</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-4 space-y-2">
              <li>Select your team and opponent from the sidebar</li>
              <li>Build your play pool with opponent-specific plays</li>
              <li>Generate or manually build your game plan</li>
              <li>Print or export your game plan when ready</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Play Pool Management</CardTitle>
            <CardDescription>Working with your play pool</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 space-y-2">
              <li>Add plays to your pool using the "Add Play" button</li>
              <li>Customize plays with specific formations, motions, and concepts</li>
              <li>Star your favorite plays for quick access</li>
              <li>Filter plays by category or search for specific plays</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Game Plan Features</CardTitle>
            <CardDescription>Building and managing your game plan</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 space-y-2">
              <li>Use AI to generate a complete game plan based on your play pool</li>
              <li>Manually add plays from your pool to specific sections</li>
              <li>Lock important plays to prevent accidental changes</li>
              <li>Customize section names and adjust section sizes</li>
              <li>Regenerate individual sections while keeping locked plays</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tips & Tricks</CardTitle>
            <CardDescription>Advanced features and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 space-y-2">
              <li>Use the search function to quickly find specific plays</li>
              <li>Customize the color coding for different play categories</li>
              <li>Lock critical plays before regenerating sections</li>
              <li>Use the visibility settings to hide unused sections</li>
              <li>Adjust print orientation for optimal game plan layout</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 