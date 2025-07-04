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
  ArrowLeftRight,
  Shield,
  Swords,
  Trash2
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getPlayPool, updatePlay, Play, testPlayPoolConnection, regeneratePlayPool, toggleFavoritePlay, deletePlay } from "@/lib/playpool"
import { getScoutingReport } from "@/lib/scouting"
import { load, save } from "@/lib/local"
import { checkTableAccess } from "@/lib/supabase"
import { analyzeAndUpdatePlays } from "@/app/actions/analyze-plays"
import { LoadingModal } from "../components/loading-modal"

interface ExtendedPlay extends Play {
  combined_call?: string;
  formations?: string;
}

const CATEGORIES = {
  run_game: 'Run Game',
  rpo_game: 'RPO Game',
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

// Helper function to determine if a category is a pass play category
function isPassPlayCategory(category: string): boolean {
  return ['quick_game', 'dropback_game', 'shot_plays', 'screen_game'].includes(category);
}

// Add custom event type declaration at the top of the file
interface OpponentChangedEvent extends CustomEvent<{ opponentId: string }> {
  detail: { opponentId: string };
}

declare global {
  interface WindowEventMap {
    'opponentChanged': OpponentChangedEvent;
  }
}

export default function PlayPoolPage() {
  const router = useRouter()
  const [plays, setPlays] = useState<ExtendedPlay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [clearingLocks, setClearingLocks] = useState(false)
  const [motionPercentage, setMotionPercentage] = useState<number>(() => load('motion_percentage', 25))
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
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  // Add state for showing max limit warnings
  const [showMaxWarning, setShowMaxWarning] = useState<Record<string, boolean>>({})
  // Add state for notification
  const [notification, setNotification] = useState<{message: string, type: 'info' | 'warning'} | null>(null)

  // Add state for play counts
  const [playCounts, setPlayCounts] = useState(() => ({
    run_game: load('play_counts_run_game', 15),
    quick_game: load('play_counts_quick_game', 15),
    rpo_game: load('play_counts_rpo_game', 5),
    dropback_game: load('play_counts_dropback_game', 15),
    shot_plays: load('play_counts_shot_plays', 15),
    screen_game: load('play_counts_screen_game', 15)
  }))

  // Create Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadPlays = async () => {
    try {
      setLoading(true)
      console.log('Loading plays...')
      const playData = await getPlayPool()
      console.log('Plays loaded:', playData.length)
      setPlays(playData)
    } catch (error) {
      console.error('[UI] Failed to load play pool:', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        type: typeof error
      })
      setError('Failed to load plays. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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

              // Load plays for the selected opponent
              try {
                setLoading(true)
                const playData = await getPlayPool()
                console.log('Loaded plays for initial opponent:', playData.length)
                setPlays(playData)
                setError(null)
              } catch (error) {
                console.error('[UI] Failed to load initial plays:', {
                  error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                  } : error,
                  type: typeof error
                })
                setError('Failed to load plays. Please try again.')
              } finally {
                setLoading(false)
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

  // Add effect to reload plays when team changes
  useEffect(() => {
    console.log('Team selection changed:', {
      selectedTeamId,
      selectedTeamName,
      localStorageTeam: typeof window !== 'undefined' ? localStorage.getItem('selectedTeam') : null
    });
    
    if (selectedTeamId) {
      console.log('Loading plays for team:', selectedTeamId);
      loadPlays();
    }
  }, [selectedTeamId, selectedTeamName]);

  // Handle opponent change
  useEffect(() => {
    const handleOpponentChangedEvent = (event: OpponentChangedEvent) => {
      const newOpponentId = event.detail.opponentId;
      
      // Use an async IIFE to handle the async operations
      (async () => {
        try {
          setLoading(true);
          console.log('Changing opponent to:', newOpponentId);
          
          // Save the new opponent ID to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('selectedOpponent', newOpponentId);
          }

          // Clear existing plays while loading
          setPlays([]);
          
          // Get the current team ID
          const teamId = localStorage.getItem('selectedTeam');
          if (!teamId) {
            throw new Error('No team selected');
          }

          // Load defensive info for the new opponent
          const { data: scoutingData, error: scoutingError } = await supabase
            .from('scouting_reports')
            .select('*')
            .eq('team_id', teamId)
            .eq('opponent_id', newOpponentId)
            .single();

          if (scoutingError) {
            console.error('Error loading scouting data:', scoutingError);
          } else if (scoutingData) {
            // Update defensive info
            setFronts(scoutingData.fronts || []);
            setCoverages(scoutingData.coverages || []);
            setBlitzes(scoutingData.blitzes || []);
            setFrontsPct(scoutingData.front_pct || {});
            setCoveragesPct(scoutingData.coverage_pct || {});
            setBlitzPct(scoutingData.blitz_pct || {});
            setOverallBlitzPct(scoutingData.overall_blitz_pct || 0);
          }
          
          // Reload plays with new opponent
          const playData = await getPlayPool();
          console.log('Loaded plays for new opponent:', playData.length);
          
          setPlays(playData);
          setError(null);
        } catch (error) {
          console.error('[UI] Failed to change opponent:', {
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack,
              name: error.name
            } : error,
            type: typeof error,
            newOpponentId
          });
          setError('Failed to change opponent. Please try again.');
        } finally {
          setLoading(false);
        }
      })();
    };

    // Also handle initial load
    const storedOpponentId = localStorage.getItem('selectedOpponent');
    if (storedOpponentId) {
      handleOpponentChangedEvent({ detail: { opponentId: storedOpponentId } } as OpponentChangedEvent);
    }

    window.addEventListener('opponentChanged', handleOpponentChangedEvent);

    return () => {
      window.removeEventListener('opponentChanged', handleOpponentChangedEvent);
    };
  }, []);

  // Add effect to save play counts when they change
  useEffect(() => {
    Object.entries(playCounts).forEach(([category, count]) => {
      save(`play_counts_${category}`, count)
    })
  }, [playCounts])

  const handleRebuildPlaypool = async () => {
    try {
      setIsRebuilding(true)
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
        motion_percentage: motionPercentage,
        notes: '',
        keep_locked_plays: true,
        play_counts: playCounts // Add play counts to scouting report
      }

      // Call analyze and update function
      const result = await analyzeAndUpdatePlays(scoutingReport)

      if (result.success && result.data) {
        setAnalysis(result.analysis || 'Playpool successfully rebuilt with AI')
        // Reload plays to show updates
        await loadPlays()
        
        // Clear the analysis after 3 seconds
        setTimeout(() => {
          setAnalysis(null)
        }, 3000)
      } else {
        setError(result.error || 'Failed to rebuild playpool')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to rebuild playpool')
    } finally {
      setAnalyzing(false)
      setIsRebuilding(false)
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

  const handleDeletePlay = async (play: ExtendedPlay) => {
    try {
      await deletePlay(play.id)
      // Remove the play from the local state
      setPlays(plays.filter(p => p.id !== play.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete play')
    }
  }

  const getPlaysByCategory = (category: string) => {
    const categoryPlays = plays.filter(play => play.category === category);
    const maxPlays = playCounts[category as keyof typeof playCounts];
    
      // First include all locked plays
      const lockedPlays = categoryPlays.filter(play => play.is_locked);
      
    // If we have room for more, add unlocked plays until we hit the target
    if (lockedPlays.length < maxPlays) {
        const unlockedPlays = categoryPlays.filter(play => !play.is_locked);
      // Only take enough unlocked plays to reach the target
      const unlockedPlaysToInclude = unlockedPlays.slice(0, maxPlays - lockedPlays.length);
        return [...lockedPlays, ...unlockedPlaysToInclude];
      }
      
    // If we have more locked plays than the target, just return up to the target number
    return lockedPlays.slice(0, maxPlays);
    }
    
  // Add helper function to group plays by formation
  const groupPlaysByFormation = (plays: ExtendedPlay[]) => {
    const groups: { [key: string]: ExtendedPlay[] } = {};
    plays.forEach(play => {
      const formation = play.formations || 'Other';
      if (!groups[formation]) {
        groups[formation] = [];
      }
      groups[formation].push(play);
    });
    return groups;
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
    const isPassPlay = isPassPlayCategory(play.category)

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
            {play.category === 'rpo_game' ? (
              play.front_beaters && (
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
              )
            ) : isPassPlay ? (
              play.coverage_beaters && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="ml-2 p-0 h-6 w-6">
                        <HelpCircle className="h-4 w-4 text-blue-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-normal">Coverage Beaters: {play.coverage_beaters}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            ) : (
              play.front_beaters && (
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
              )
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
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-6 w-6 text-red-500 hover:text-red-600"
            onClick={() => handleDeletePlay(play)}
          >
            <Trash2 className="h-4 w-4" />
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

  // Check if playpool is empty
  const isPlayPoolEmpty = plays.length === 0;

  // Check if we have scouting data
  const hasScoutingData = fronts.length > 0 || coverages.length > 0 || blitzes.length > 0;

  // If playpool is empty, show appropriate message
  if (isPlayPoolEmpty) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Play Pool</h1>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          {!hasScoutingData ? (
            <>
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Unfortunately, we need scouting data before building the playpool.</h2>
                <p className="text-gray-600">Please add scouting data for your opponent first.</p>
              </div>
              <Button 
                onClick={() => router.push('/scouting')}
                className="bg-blue-900 hover:bg-blue-800 text-white"
              >
                <Shield className="h-4 w-4 mr-2" />
                Scouting Data
              </Button>
            </>
          ) : (
            <>
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Let's build your playpool!</h2>
                <p className="text-gray-600">Get started by generating plays based on your scouting data.</p>
              </div>
              <Button 
                onClick={handleRebuildPlaypool}
                disabled={analyzing || !selectedTeamId || !selectedOpponentId}
                className="bg-[#0b2545] hover:bg-[#1e3a8a] text-white cursor-pointer"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Building...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Build Playpool with AI
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {isRebuilding && <LoadingModal />}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Play Pool</h1>
        <div className="flex gap-4">
          <Button 
            onClick={handleRebuildPlaypool}
            disabled={analyzing || !selectedTeamId || !selectedOpponentId}
            className="bg-[#0b2545] hover:bg-[#1e3a8a] text-white cursor-pointer"
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
          <div className="space-y-6">
            {/* Notification */}
            {notification && (
              <div className={`p-4 rounded-md ${notification.type === 'warning' ? 'bg-yellow-50 text-yellow-800' : 'bg-blue-50 text-blue-800'}`}>
                <p className="text-sm">{notification.message}</p>
              </div>
            )}

            {/* Motion Percentage Slider */}
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

            {/* Play Count Settings */}
            <div className="space-y-4">
              <Label>Number of Plays per Category</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(CATEGORIES).map(([category, title]) => (
                  <div key={category} className="space-y-2">
                    <Label className="text-sm">{title}</Label>
                    <Input
                      type="number"
                      min={category === 'rpo_game' ? 5 : 0}
                                    max={20}
              value={playCounts[category as keyof typeof playCounts] || ''}
                      onChange={(e) => {
                        const inputValue = e.target.value === '' ? null : parseInt(e.target.value);
                        let value: number | null;
                        
                        if (inputValue === null) {
                          value = null;
                        } else {
                          // For RPO, enforce minimum of 5 if a number is entered
                          if (category === 'rpo_game' && inputValue !== null) {
                            value = Math.max(5, Math.min(20, inputValue as number));
                          } else {
                            value = Math.max(0, Math.min(20, inputValue as number));
                          }
                        }
                        
                        // Show warning if user tries to exceed maximum
                        if (typeof inputValue === 'number' && inputValue > 20) {
                          setShowMaxWarning(prev => ({
                            ...prev,
                            [category]: true
                          }));
                          // Clear warning after 3 seconds
                          setTimeout(() => {
                            setShowMaxWarning(prev => ({
                              ...prev,
                              [category]: false
                            }));
                          }, 3000);
                        }

                        setPlayCounts(prev => ({
                          ...prev,
                          [category]: value
                        }));
                      }}
                      className="w-full"
                    />
                    {category === 'rpo_game' && (
                      <p className="text-xs text-gray-500">Minimum of 5 plays required</p>
                    )}
                    {showMaxWarning[category] && (
                      <p className="text-xs text-red-500">Maximum number of plays per category is 20</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                Specify how many plays you want for each category (maximum 15). The AI will try to generate exactly this many plays, keeping any locked plays.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(CATEGORIES).map(([category, title]) => {
          const categoryPlays = getPlaysByCategory(category);
          const playsByFormation = groupPlaysByFormation(categoryPlays);

        return (
            <Card key={category} className="h-[600px] flex flex-col">
              <CardHeader className="border-b flex-shrink-0">
              <CardTitle className="flex justify-between items-center">
                <span>{title}</span>
                <span className="text-sm font-normal text-gray-500">
                  {categoryPlays.length} Plays
                </span>
              </CardTitle>
            </CardHeader>
              <CardContent className="p-4 flex-1 overflow-y-auto">
                <div className="space-y-6">
                  {Object.entries(playsByFormation).map(([formation, formationPlays]) => (
                    <div key={formation}>
                      <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-3">
                        {formation}
                      </h3>
                      <div className="space-y-2">
                        {formationPlays.map((play) => (
                          <div key={play.id} className="bg-white rounded-lg shadow-sm p-2">
                        {renderPlayContent(play)}
                      </div>
                    ))}
                  </div>
                        </div>
                      ))}
                    </div>
            </CardContent>
          </Card>
          );
      })}
                </div>
    </div>
  )
} 