"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { getPlayPool, updatePlay, Play, testPlayPoolConnection, regeneratePlayPool } from "@/lib/playpool"

const CATEGORIES = {
  run_game: "Run Game",
  quick_game: "Quick Game",
  dropback_game: "Dropback Game",
  shot_plays: "Shot Plays",
  screen_game: "Screen Game"
}

function formatPlay(play: Play): string {
  const parts = [
    play.formation,
    play.tag,
    play.strength,
    play.motion_shift,
    play.concept,
    play.run_concept,
    play.run_direction,
    play.pass_screen_concept
  ].filter(Boolean)

  return parts.join(" ")
}

export default function PlayPoolPage() {
  const router = useRouter()
  const [plays, setPlays] = useState<Play[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const loadPlays = async () => {
    try {
      setLoading(true)
      setError(null)

      // First test connection
      console.log('Testing playpool connection...')
      const isConnected = await testPlayPoolConnection()
      if (!isConnected) {
        throw new Error('Unable to connect to playpool table - please check database configuration')
      }

      // Fetch plays
      console.log('Fetching plays...')
      const playData = await getPlayPool()
      console.log('Fetched plays:', playData)
      setPlays(playData)
    } catch (error) {
      console.error('Detailed load error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRegeneratePlayPool = async () => {
    try {
      setRegenerating(true)
      setError(null)
      await regeneratePlayPool()
      await loadPlays() // Reload plays after regeneration
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate play pool')
    } finally {
      setRegenerating(false)
    }
  }

  useEffect(() => {
    loadPlays()
  }, [])

  const handleTogglePlay = async (play: Play) => {
    try {
      const updatedPlay = await updatePlay(play.id, { is_enabled: !play.is_enabled })
      setPlays(plays.map(p => p.id === updatedPlay.id ? updatedPlay : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update play')
    }
  }

  const getPlaysByCategory = (category: string) => {
    return plays.filter(play => play.category === category)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading play pool...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <div className="text-red-500 text-lg mb-4">Error Loading Play Pool</div>
        <div className="text-gray-700 whitespace-pre-wrap text-center">{error}</div>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Play Pool</h1>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={handleRegeneratePlayPool}
            disabled={regenerating}
          >
            {regenerating ? 'Regenerating...' : 'Regenerate Play Pool'}
          </Button>
          <Button 
            onClick={() => router.push('/setup')}
          >
            ← Back to Setup
          </Button>
          <Button 
            onClick={() => router.push('/scouting')}
          >
            Continue to Scouting →
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {Object.entries(CATEGORIES).map(([category, title]) => {
        const categoryPlays = getPlaysByCategory(category)
        const enabledCount = categoryPlays.filter(p => p.is_enabled).length

        return (
          <Card key={category} className="mb-8">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{title}</span>
                <span className="text-sm font-normal text-gray-500">
                  {enabledCount} / {categoryPlays.length} Enabled
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`${category === 'run_game' || category === 'quick_game' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}`}>
                {categoryPlays.map((play) => (
                  <div key={play.id} className="flex justify-between items-center">
                    <Switch
                      checked={play.is_enabled}
                      onCheckedChange={() => handleTogglePlay(play)}
                      className="mr-4"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{formatPlay(play)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
} 