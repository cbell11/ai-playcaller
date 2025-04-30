"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, X, Check, Plus, Star, Lock, Unlock } from "lucide-react"
import { getPlayPool, updatePlay, Play, testPlayPoolConnection, regeneratePlayPool, toggleFavoritePlay } from "@/lib/playpool"
import { load, save } from "@/lib/local"

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
    play.pass_screen_concept,
    play.category === 'screen_game' ? play.screen_direction : null
  ].filter(Boolean)

  return parts.join(" ")
}

export default function PlayPoolPage() {
  const router = useRouter()
  const [plays, setPlays] = useState<Play[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [motionPercentage, setMotionPercentage] = useState(() => load('motion_percentage', 25))
  const [editingPlay, setEditingPlay] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Play>>({})
  const [showCustomInput, setShowCustomInput] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    save('motion_percentage', motionPercentage)
  }, [motionPercentage])

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

  const handleToggleFavorite = async (play: Play) => {
    try {
      const updatedPlay = await toggleFavoritePlay(play.id, !play.is_favorite)
      setPlays(plays.map(p => p.id === updatedPlay.id ? updatedPlay : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite status')
    }
  }

  const handleToggleLock = async (play: Play) => {
    try {
      const updatedPlay = await updatePlay(play.id, { is_locked: !play.is_locked })
      setPlays(plays.map(p => p.id === updatedPlay.id ? updatedPlay : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock status')
    }
  }

  const getPlaysByCategory = (category: string) => {
    const categoryPlays = plays.filter(play => play.category === category);
    
    // If we have more than 20 plays, prioritize locked plays
    if (categoryPlays.length > 20) {
      // First include all locked plays
      const lockedPlays = categoryPlays.filter(play => play.is_locked);
      
      // If we have room for more, add unlocked plays until we hit 20
      if (lockedPlays.length < 20) {
        const unlockedPlays = categoryPlays.filter(play => !play.is_locked);
        // Only take enough unlocked plays to reach a total of 20
        const unlockedPlaysToInclude = unlockedPlays.slice(0, 20 - lockedPlays.length);
        return [...lockedPlays, ...unlockedPlaysToInclude];
      }
      
      // If we have more than 20 locked plays, just return the first 20
      return lockedPlays.slice(0, 20);
    }
    
    // If we have 20 or fewer plays, return all of them
    return categoryPlays;
  }

  const handleStartEdit = (play: Play) => {
    setEditingPlay(play.id)
    setEditForm(play)
  }

  const handleCancelEdit = () => {
    setEditingPlay(null)
    setEditForm({})
  }

  const handleSaveEdit = async (play: Play) => {
    try {
      const updatedPlay = await updatePlay(play.id, editForm)
      setPlays(plays.map(p => p.id === updatedPlay.id ? updatedPlay : p))
      setEditingPlay(null)
      setEditForm({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update play')
    }
  }

  // Helper functions to get unique values for each field
  const getUniqueValues = (field: keyof Play) => {
    return Array.from(new Set(plays.map(play => play[field]).filter(Boolean))) as string[]
  }

  const handleCustomInputChange = (field: keyof Play, value: string) => {
    setEditForm({ ...editForm, [field]: value })
  }

  const handleFieldChange = (field: keyof Play, value: string) => {
    if (value === 'custom') {
      setShowCustomInput({ ...showCustomInput, [field]: true })
      return
    }
    setEditForm({ ...editForm, [field]: value })
    setShowCustomInput({ ...showCustomInput, [field]: false })
  }

  const renderFieldSelect = (field: keyof Play, label: string, customPlaceholder: string) => {
    const uniqueValues = getUniqueValues(field)
    const currentValue = editForm[field] as string

    if (showCustomInput[field]) {
      return (
        <div>
          <Label>{label}</Label>
          <div className="flex gap-2">
            <Input
              value={currentValue || ''}
              placeholder={customPlaceholder}
              onChange={(e) => handleCustomInputChange(field, e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCustomInput({ ...showCustomInput, [field]: false })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div>
        <Label>{label}</Label>
        <Select
          value={currentValue || ''}
          onValueChange={(value) => handleFieldChange(field, value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {uniqueValues.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
            <SelectItem value="custom" className="text-blue-600">
              <Plus className="h-4 w-4 mr-2 inline-block" />
              Add Custom {label}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    )
  }

  const renderPlayContent = (play: Play) => {
    if (editingPlay === play.id) {
      return (
        <div className="flex flex-col gap-2 w-full">
          <div className="grid grid-cols-2 gap-2">
            {renderFieldSelect('formation', 'Formation', 'Enter custom formation')}
            {renderFieldSelect('tag', 'Tag', 'Enter custom tag')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Strength</Label>
              <Select 
                value={editForm.strength || ''} 
                onValueChange={(value) => setEditForm({...editForm, strength: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strength" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+">+</SelectItem>
                  <SelectItem value="-">-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderFieldSelect('motion_shift', 'Motion/Shift', 'Enter custom motion/shift')}
          </div>
          {renderFieldSelect('concept', 'Concept', 'Enter custom concept')}
          {play.category === 'run_game' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Run Direction</Label>
                <Select 
                  value={editForm.run_direction || ''} 
                  onValueChange={(value) => setEditForm({...editForm, run_direction: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+">+</SelectItem>
                    <SelectItem value="-">-</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {play.category === 'screen_game' && (
            <div>
              <Label>Screen Direction</Label>
              <Select 
                value={editForm.screen_direction || ''} 
                onValueChange={(value) => setEditForm({...editForm, screen_direction: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+">+</SelectItem>
                  <SelectItem value="-">-</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={() => handleSaveEdit(play)}>
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      )
    }

    // Handle case where is_favorite and is_locked might be undefined
    const isFavorite = play.is_favorite || false
    const isLocked = play.is_locked || false

    // Custom lock icon with only body filled
    const CustomLock = () => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-lock h-4 w-4"
      >
        {/* Shackle (not filled) */}
        <path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z" fill="currentColor" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );

    return (
      <>
        <div className="flex-1">
          <div className="font-medium">{formatPlay(play)}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleStartEdit(play)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleFavorite(play)}
            className={isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-600'}
          >
            <Star className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleLock(play)}
            className={isLocked ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}
            title={isLocked ? "Play will be preserved when regenerating" : "Lock to preserve when regenerating"}
          >
            {isLocked ? <CustomLock /> : <Unlock className="h-4 w-4" />}
          </Button>
        </div>
      </>
    )
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

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Play Pool Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Motion Percentage</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[motionPercentage]}
                onValueChange={(value: number[]) => setMotionPercentage(value[0])}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="w-12 text-right">{motionPercentage}%</span>
            </div>
            <p className="text-sm text-gray-500">
              Percentage of plays that will include motion
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {Object.entries(CATEGORIES).map(([category, title]) => {
        const categoryPlays = getPlaysByCategory(category)
        const enabledCount = categoryPlays.filter(p => p.is_enabled).length

        // Split plays into locked and unlocked
        const lockedPlays = categoryPlays.filter(p => p.is_locked)
        const unlockedPlays = categoryPlays.filter(p => !p.is_locked)
        
        // Create ordered array with locked plays first, then unlocked plays
        const orderedPlays = [...lockedPlays, ...unlockedPlays]
        
        // Determine if we need a grid layout
        const useGridLayout = category === 'run_game' || category === 'quick_game' || 
                              category === 'dropback_game' || category === 'shot_plays' || 
                              category === 'screen_game'
        
        // Calculate how many plays to put in each column
        const totalPlays = orderedPlays.length
        const firstColumnCount = Math.ceil(totalPlays / 2)
        
        // Split into left and right columns
        const leftColumnPlays = orderedPlays.slice(0, firstColumnCount)
        const rightColumnPlays = orderedPlays.slice(firstColumnCount)

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
              {useGridLayout ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    {leftColumnPlays.map((play) => (
                      <div key={play.id} className="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm">
                        {renderPlayContent(play)}
                      </div>
                    ))}
                  </div>
                  {rightColumnPlays.length > 0 && (
                    <div className="space-y-4">
                      {rightColumnPlays.map((play) => (
                        <div key={play.id} className="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm">
                          {renderPlayContent(play)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {orderedPlays.map((play) => (
                    <div key={play.id} className="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm">
                      {renderPlayContent(play)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
} 