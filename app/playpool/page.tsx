"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from '@supabase/ssr'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Pencil, 
  X, 
  Check, 
  Plus, 
  Star, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Loader2, 
  FileText,
  HelpCircle,
  ArrowLeftRight
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getPlayPool, updatePlay, Play, testPlayPoolConnection, regeneratePlayPool, toggleFavoritePlay } from "@/lib/playpool"
import { getScoutingReport } from "@/lib/scouting"
import { load, save } from "@/lib/local"
import { checkTableAccess } from "@/lib/supabase"
import { analyzeAndUpdatePlays } from "@/app/actions/analyze-plays"

interface ExtendedPlay extends Play {
  combined_call?: string;
}

const CATEGORIES = {
  run_game: 'Run Game',
  quick_game: 'Quick Game',
  dropback_game: 'Dropback Game',
  shot_plays: 'Shot Plays',
  screen_game: 'Screen Game'
} as const

function formatPlay(play: ExtendedPlay): string {
  // First check for customized_edit
  if (play.customized_edit) {
    return play.customized_edit;
  }
  
  // If no customized_edit, use combined_call
  if (play.combined_call) {
    return play.combined_call;
  }

  // Fallback to old format method if neither exists
  const parts = [
    play.formation,
    play.tag,
    play.strength,
    play.motion_shift,
    play.concept,
    play.run_concept,
    play.run_direction,
    play.pass_screen_concept,
    play.screen_direction
  ].filter(Boolean)

  return parts.join(" ")
}

interface ScoutingOption {
  id?: string;
  name: string;
  fieldArea?: string;
  dominateDown?: string;
  notes?: string;
}

export default function PlayPoolPage() {
  const router = useRouter()
  const [plays, setPlays] = useState<ExtendedPlay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [clearingLocks, setClearingLocks] = useState(false)
  const [motionPercentage, setMotionPercentage] = useState(() => load('motion_percentage', 25))
  const [editingPlay, setEditingPlay] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ExtendedPlay>>({})
  const [analysis, setAnalysis] = useState<string | null>(null)
  
  // Add state for debug info
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedTeamName, setSelectedTeamName] = useState<string | null>(null)
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null)
  const [selectedOpponentName, setSelectedOpponentName] = useState<string | null>(null)
  
  // Add state for defensive info
  const [fronts, setFronts] = useState<ScoutingOption[]>([])
  const [coverages, setCoverages] = useState<ScoutingOption[]>([])
  const [blitzes, setBlitzes] = useState<ScoutingOption[]>([])
  const [frontsPct, setFrontsPct] = useState<Record<string, number>>({})
  const [coveragesPct, setCoveragesPct] = useState<Record<string, number>>({})
  const [blitzPct, setBlitzPct] = useState<Record<string, number>>({})
  const [overallBlitzPct, setOverallBlitzPct] = useState<number>(0)

  // Create Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Add effect to load team and opponent info
  useEffect(() => {
    const loadTeamAndOpponentInfo = async () => {
      try {
        console.log('Starting to load team and opponent info...')
        
        // Check table access first
        await checkTableAccess()
        
        // Get current user and their team_id from profile
        const { data: { user } } = await supabase.auth.getUser()
        console.log('Current user:', user)
        
        if (user) {
          // Get team_id from profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('team_id')
            .eq('id', user.id)
            .single()
          
          console.log('Profile data:', profileData, 'Profile error:', profileError)
          
          if (profileData?.team_id) {
            const teamId = profileData.team_id
            console.log('DEBUG - Team ID from profile:', {
              teamId,
              type: typeof teamId,
              length: teamId.length,
              trimmed: teamId.trim(),
              expected: '2987ddc0-f8d5-4535-a389-f536d126b60e',
              matches: teamId === '2987ddc0-f8d5-4535-a389-f536d126b60e'
            })
            
            setSelectedTeamId(teamId)
            console.log('Set selected team ID:', teamId)
            
            // Get team name
            const { data: teamData } = await supabase
              .from('teams')
              .select('name')
              .eq('id', teamId)
              .single()
            
            console.log('Team data:', teamData)
            
            if (teamData) {
              setSelectedTeamName(teamData.name)
              console.log('Set selected team name:', teamData.name)
            }

            // Get opponent info from localStorage
            const opponentId = localStorage.getItem('selectedOpponent')
            console.log('DEBUG - Opponent ID from localStorage:', {
              opponentId,
              type: typeof opponentId,
              length: opponentId?.length,
              trimmed: opponentId?.trim(),
              expected: '5a372f8d-be57-4b14-919b-f9b58923d10f',
              matches: opponentId === '5a372f8d-be57-4b14-919b-f9b58923d10f'
            })
            
            if (opponentId) {
              setSelectedOpponentId(opponentId)
              
              // Get opponent name
              const { data: opponentData } = await supabase
                .from('opponents')
                .select('name')
                .eq('id', opponentId)
                .single()
              
              console.log('Opponent data:', opponentData)
              
              if (opponentData) {
                setSelectedOpponentName(opponentData.name)
                console.log('Set selected opponent name:', opponentData.name)
              }

              console.log('About to fetch scouting report with team_id:', teamId, 'and opponent_id:', opponentId)
              
              // Load scouting report data
              const scoutingReportResult = await getScoutingReport(teamId, opponentId)
              
              console.log('DEBUG: Full scouting report result:', {
                success: scoutingReportResult.success,
                data: scoutingReportResult.data,
                error: scoutingReportResult.error,
                teamId: {
                  value: teamId,
                  type: typeof teamId,
                  length: teamId.length,
                  expected: '2987ddc0-f8d5-4535-a389-f536d126b60e',
                  matches: teamId === '2987ddc0-f8d5-4535-a389-f536d126b60e'
                },
                opponentId: {
                  value: opponentId,
                  type: typeof opponentId,
                  length: opponentId.length,
                  expected: '5a372f8d-be57-4b14-919b-f9b58923d10f',
                  matches: opponentId === '5a372f8d-be57-4b14-919b-f9b58923d10f'
                }
              })
              
              if (scoutingReportResult.success && scoutingReportResult.data) {
                const reportData = scoutingReportResult.data
                console.log('DEBUG: Full scouting data before setting state:', {
                  fronts: reportData.fronts,
                  fronts_length: reportData.fronts?.length,
                  coverages: reportData.coverages,
                  coverages_length: reportData.coverages?.length,
                  blitzes: reportData.blitzes,
                  blitzes_length: reportData.blitzes?.length,
                  fronts_pct: reportData.fronts_pct,
                  coverages_pct: reportData.coverages_pct,
                  blitz_pct: reportData.blitz_pct,
                  overall_blitz_pct: reportData.overall_blitz_pct
                })
                
                // Ensure we're setting arrays even if they're empty
                setFronts(reportData.fronts || [])
                setCoverages(reportData.coverages || [])
                setBlitzes(reportData.blitzes || [])
                
                // Ensure we're setting objects even if they're empty
                setFrontsPct(reportData.fronts_pct || {})
                setCoveragesPct(reportData.coverages_pct || {})
                setBlitzPct(reportData.blitz_pct || {})
                
                // Ensure we're setting a number even if it's 0
                setOverallBlitzPct(reportData.overall_blitz_pct || 0)

                // Log state after setting
                console.log('DEBUG: State after setting:', {
                  fronts_length: reportData.fronts?.length || 0,
                  coverages_length: reportData.coverages?.length || 0,
                  blitzes_length: reportData.blitzes?.length || 0
                })
              } else {
                console.error('Failed to load scouting report:', scoutingReportResult.error)
                // Initialize with empty data but don't show an error
                setFronts([])
                setCoverages([])
                setBlitzes([])
                setFrontsPct({})
                setCoveragesPct({})
                setBlitzPct({})
                setOverallBlitzPct(0)
                console.log('DEBUG: Set empty defensive data due to failed scouting report load')
              }
            } else {
              console.log('No opponent ID found in localStorage')
            }
          } else {
            console.log('No team_id found in profile data')
          }
        } else {
          console.log('No user found')
        }
      } catch (error) {
        console.error('Error loading team/opponent info:', error)
      }
    }
    
    loadTeamAndOpponentInfo()
  }, [supabase])

  useEffect(() => {
    save('motion_percentage', motionPercentage)
  }, [motionPercentage])

  // Add effect to check localStorage on mount
  useEffect(() => {
    // Check localStorage contents
    console.log('DEBUG - Checking localStorage on mount:', {
      selectedTeam: localStorage.getItem('selectedTeam'),
      selectedOpponent: localStorage.getItem('selectedOpponent'),
      allKeys: Object.keys(localStorage)
    })
  }, [])

  useEffect(() => {
    loadPlays()
  }, [])

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
      console.error('[UI] Failed to load play pool:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        timestamp: new Date().toISOString(),
        operation: 'loadPlays'
      })
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRebuildPlaypool = async () => {
    try {
      setAnalyzing(true)
      setError(null)
      setAnalysis(null)

      if (!selectedTeamId) {
        throw new Error('No team selected')
      }

      if (!selectedOpponentId) {
        throw new Error('No opponent selected')
      }

      // Create scouting report object
      const scoutingReport = {
        team_id: selectedTeamId,
        opponent_id: selectedOpponentId,
        fronts,
        coverages,
        blitzes,
        fronts_pct: frontsPct,
        coverages_pct: coveragesPct,
        blitz_pct: blitzPct,
        overall_blitz_pct: overallBlitzPct,
        notes: '',
        keep_locked_plays: true
      }

      // Call analyze and update function
      const result = await analyzeAndUpdatePlays(scoutingReport)

      if (result.success && result.data) {
        setAnalysis(result.analysis || 'Playpool successfully rebuilt with AI')
        // Reload plays to show updates
        await loadPlays()
      } else {
        setError(result.error || 'Failed to rebuild playpool')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to rebuild playpool')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleTogglePlay = async (play: ExtendedPlay) => {
    try {
      const updatedPlay = await updatePlay(play.id, { is_enabled: !play.is_enabled })
      setPlays(plays.map(p => p.id === updatedPlay.id ? updatedPlay : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update play')
    }
  }

  const handleToggleFavorite = async (play: ExtendedPlay) => {
    try {
      const updatedPlay = await toggleFavoritePlay(play.id, !play.is_favorite)
      setPlays(plays.map(p => p.id === updatedPlay.id ? updatedPlay : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite status')
    }
  }

  const handleToggleLock = async (play: ExtendedPlay) => {
    try {
      const updatedPlay = await updatePlay(play.id, { is_locked: !play.is_locked })
      setPlays(plays.map(p => p.id === updatedPlay.id ? updatedPlay : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock status')
    }
  }

  const getPlaysByCategory = (category: string) => {
    const categoryPlays = plays.filter(play => play.category === category);
    
    // For run plays, return up to 15 plays
    if (category === 'run_game') {
      // First include all locked plays
      const lockedPlays = categoryPlays.filter(play => play.is_locked);
      
      // If we have room for more, add unlocked plays until we hit 15
      if (lockedPlays.length < 15) {
        const unlockedPlays = categoryPlays.filter(play => !play.is_locked);
        // Only take enough unlocked plays to reach a total of 15
        const unlockedPlaysToInclude = unlockedPlays.slice(0, 15 - lockedPlays.length);
        return [...lockedPlays, ...unlockedPlaysToInclude];
      }
      
      // If we have more than 15 locked plays, just return the first 15
      return lockedPlays.slice(0, 15);
    }
    
    // For other categories, keep the original logic of 20 plays max
    if (categoryPlays.length > 20) {
      const lockedPlays = categoryPlays.filter(play => play.is_locked);
      
      if (lockedPlays.length < 20) {
        const unlockedPlays = categoryPlays.filter(play => !play.is_locked);
        const unlockedPlaysToInclude = unlockedPlays.slice(0, 20 - lockedPlays.length);
        return [...lockedPlays, ...unlockedPlaysToInclude];
      }
      
      return lockedPlays.slice(0, 20);
    }
    
    return categoryPlays;
  }

  const handleStartEdit = (play: ExtendedPlay) => {
    setEditingPlay(play.id)
    setEditForm({
      customized_edit: play.customized_edit || formatPlay(play)
    })
  }

  const handleCancelEdit = () => {
    setEditingPlay(null)
    setEditForm({})
  }

  const handleSaveEdit = async (play: ExtendedPlay) => {
    try {
      const updatedPlay = await updatePlay(play.id, editForm)
      setPlays(plays.map(p => p.id === updatedPlay.id ? updatedPlay : p))
      setEditingPlay(null)
      setEditForm({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update play')
    }
  }

  const renderPlayContent = (play: ExtendedPlay) => {
    if (editingPlay === play.id) {
      return (
        <div className="flex flex-col gap-2 w-full">
          <div>
            <Label>Play</Label>
            <div className="flex gap-2">
              <Input
                value={editForm.customized_edit || formatPlay(play)}
                onChange={(e) => setEditForm({ customized_edit: e.target.value })}
                placeholder="Enter play"
                className="flex-grow font-mono"
              />
            </div>
          </div>
          
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

    return (
      <div className="flex items-center justify-between w-full gap-2">
        <div className="flex items-center gap-2 flex-grow">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`p-0 h-6 w-6 ${isFavorite ? 'text-yellow-500' : 'text-gray-400'}`}
              onClick={() => handleToggleFavorite(play)}
            >
              <Star className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`p-0 h-6 w-6 ${isLocked ? 'text-blue-500' : 'text-gray-400'}`}
              onClick={() => handleToggleLock(play)}
            >
              {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
          </div>
          <span className="flex-grow font-mono text-sm">
            {play.customized_edit || formatPlay(play)}
            {play.front_beaters && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="ml-2 p-0 h-6 w-6">
                      <HelpCircle className="h-4 w-4 text-blue-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-normal">Front Beaters: {play.front_beaters}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-6 w-6"
            onClick={() => handleStartEdit(play)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-red-500 text-center">{error}</div>
        <Button onClick={loadPlays}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Play Pool</h1>
        <div className="flex gap-4">
          <Button 
            onClick={handleRebuildPlaypool}
            disabled={analyzing || !selectedTeamId || !selectedOpponentId}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rebuilding...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Rebuild Playpool with AI
              </>
            )}
          </Button>
        </div>
      </div>

      {analysis && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{analysis}</p>
          </CardContent>
        </Card>
      )}

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
                  {categoryPlays.length} Plays
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

      {/* Debug Info Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-sm">Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs space-y-1">
            <div><strong>Team ID:</strong> {selectedTeamId || 'null'}</div>
            <div><strong>Team Name:</strong> {selectedTeamName || 'null'}</div>
            <div><strong>Opponent ID:</strong> {selectedOpponentId || 'null'}</div>
            <div><strong>Opponent Name:</strong> {selectedOpponentName || 'null'}</div>
            <div><strong>LocalStorage Team ID:</strong> {typeof window !== 'undefined' ? localStorage.getItem('selectedTeam') || 'null' : 'unknown'}</div>
            <div><strong>LocalStorage Opponent ID:</strong> {typeof window !== 'undefined' ? localStorage.getItem('selectedOpponent') || 'null' : 'unknown'}</div>
            <div className="mt-2 pt-2 border-t border-gray-300"><strong>Loading Status:</strong> {loading ? 'Loading' : 'Ready'}</div>
            <div><strong>Play Count:</strong> {plays.length}</div>
            <div><strong>Motion Percentage:</strong> {motionPercentage}%</div>
            
            {/* Defensive Info */}
            <div className="mt-2 pt-2 border-t border-gray-300">
              <div><strong>Fronts Count:</strong> {fronts.length}</div>
              <div><strong>Coverages Count:</strong> {coverages.length}</div>
              <div><strong>Blitzes Count:</strong> {blitzes.length}</div>
              <div><strong>Overall Blitz %:</strong> {overallBlitzPct}%</div>
              
              <div className="mt-2">
                <details>
                  <summary className="text-blue-500 cursor-pointer">Show Fronts Data</summary>
                  <div className="mt-1 bg-gray-100 p-2 rounded overflow-auto max-h-48">
                    {fronts.map((front, idx) => (
                      <div key={idx} className="mb-2">
                        <div><strong>{front.name}</strong> ({frontsPct[front.name] || 0}%)</div>
                        {front.fieldArea && <div className="text-gray-600 pl-2">Field Area: {front.fieldArea}</div>}
                        {front.dominateDown && <div className="text-gray-600 pl-2">Down: {front.dominateDown}</div>}
                        {front.notes && <div className="text-gray-600 pl-2">Notes: {front.notes}</div>}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
              
              <div className="mt-2">
                <details>
                  <summary className="text-blue-500 cursor-pointer">Show Coverages Data</summary>
                  <div className="mt-1 bg-gray-100 p-2 rounded overflow-auto max-h-48">
                    {coverages.map((coverage, idx) => (
                      <div key={idx} className="mb-2">
                        <div><strong>{coverage.name}</strong> ({coveragesPct[coverage.name] || 0}%)</div>
                        {coverage.fieldArea && <div className="text-gray-600 pl-2">Field Area: {coverage.fieldArea}</div>}
                        {coverage.dominateDown && <div className="text-gray-600 pl-2">Down: {coverage.dominateDown}</div>}
                        {coverage.notes && <div className="text-gray-600 pl-2">Notes: {coverage.notes}</div>}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
              
              <div className="mt-2">
                <details>
                  <summary className="text-blue-500 cursor-pointer">Show Blitzes Data</summary>
                  <div className="mt-1 bg-gray-100 p-2 rounded overflow-auto max-h-48">
                    {blitzes.map((blitz, idx) => (
                      <div key={idx} className="mb-2">
                        <div><strong>{blitz.name}</strong> ({blitzPct[blitz.name] || 0}%)</div>
                        {blitz.fieldArea && <div className="text-gray-600 pl-2">Field Area: {blitz.fieldArea}</div>}
                        {blitz.dominateDown && <div className="text-gray-600 pl-2">Down: {blitz.dominateDown}</div>}
                        {blitz.notes && <div className="text-gray-600 pl-2">Notes: {blitz.notes}</div>}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
            
            {error && (
              <div className="mt-2 pt-2 border-t border-gray-300 text-red-500">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 