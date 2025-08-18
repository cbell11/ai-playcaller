"use client"

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Timer, Plus, Trash2, Search, Star, Image } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getScoutingReport } from '@/lib/scouting'

interface ScoutCard {
  id: string
  image_url: string
  team_id: string
  front: string
  coverage: string | null
  blitz: string | null
}

interface PracticePlay {
  id: string;
  number: number;
  dn: string;
  dist: string;
  hash: string;  // Add hash field
  play: string;
  vs_front: string;
  vs_coverage: string;
  scout_card?: ScoutCard
}

interface PracticeSection {
  id: string;
  name: string;
  type: 'Walk Through' | 'Inside Run' | 'Skelly' | 'Team';
  play_count: number;
  plays: PracticePlay[];
}

interface GamePlanPlay {
  id: string;
  play: string;
  section: string;
  position: number;
  combined_call: string;
  customized_edit?: string;
}

interface ScoutingOption {
  id?: string
  name: string
  fieldArea?: string
  dominateDown?: string
  notes?: string
}

const CATEGORIES = {
  'run_game': 'Run Game',
  'rpo_game': 'RPO Game',
  'quick_game': 'Quick Game',
  'dropback_game': 'Dropback Game',
  'screen_game': 'Screen Game',
  'shot_plays': 'Shot Plays'
} as const;

export default function PracticePage() {
  const [sections, setSections] = useState<PracticeSection[]>([])
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false)
  const [newSectionType, setNewSectionType] = useState<'Walk Through' | 'Inside Run' | 'Skelly' | 'Team'>('Walk Through')
  const [teamId, setTeamId] = useState<string | null>(null)
  const [opponentId, setOpponentId] = useState<string | null>(null)
  const [gameplanPlays, setGameplanPlays] = useState<GamePlanPlay[]>([])
  const [scoutingFronts, setScoutingFronts] = useState<ScoutingOption[]>([])
  const [scoutingCoverages, setScoutingCoverages] = useState<ScoutingOption[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isSelectPlayOpen, setIsSelectPlayOpen] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [selectedPlayIndex, setSelectedPlayIndex] = useState<number | null>(null)
  const [gameplanSections, setGameplanSections] = useState<Record<string, GamePlanPlay[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredPlays, setFilteredPlays] = useState<GamePlanPlay[]>([])
  const [playPoolFilterType, setPlayPoolFilterType] = useState<'category' | 'search'>('category')
  const [playPoolCategory, setPlayPoolCategory] = useState<keyof typeof CATEGORIES>('run_game')
  const [searchResults, setSearchResults] = useState<GamePlanPlay[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const selectedTeam = localStorage.getItem('selectedTeam')
    const selectedOpponent = localStorage.getItem('selectedOpponent')
    
    setTeamId(selectedTeam)
    setOpponentId(selectedOpponent)
  }, []) // Run once on mount

  // Add a listener for opponent changes
  useEffect(() => {
    const handleStorageChange = async (event: StorageEvent) => {
      if (event.key === 'selectedOpponent' && event.newValue) {
        console.log('Storage event: Opponent changed to:', event.newValue);
        if (event.newValue !== opponentId) {
          setOpponentId(event.newValue);
          
          // Clear all current scout cards and sections
          setSections([]);

          // Load practice plan for new opponent
          if (teamId && event.newValue) {
            console.log('Loading practice plan for new opponent:', event.newValue);
            try {
              const { data, error } = await supabase
                .from('practice_plans')
                .select('*')
                .eq('team_id', teamId)
                .eq('opponent_id', event.newValue)
                .single();

              if (error) {
                if (error.code === 'PGRST116') { // No data found
                  console.log('No existing practice plan found for new opponent');
                } else {
                  console.error('Error loading practice plan:', error);
                }
              } else if (data?.sections) {
                console.log('Found existing practice plan:', data);
                setSections(data.sections);
              }
            } catch (err) {
              console.error('Error in loadExistingPracticePlan:', err);
            }
          }

          // Fetch scouting data for new opponent
          fetchScoutingData();
        }
      }
      if (event.key === 'selectedTeam') {
        setTeamId(event.newValue);
      }
    }

    // Fix the CustomEvent type
    const handleOpponentChangeEvent = async (event: Event) => {
      const customEvent = event as CustomEvent<{ opponentId: string }>;
      const newOpponentId = customEvent.detail?.opponentId;
      if (newOpponentId && newOpponentId !== opponentId) {
        console.log('Custom event: Opponent changed to:', newOpponentId);
        
        // Clear all current scout cards and sections
        setSections([]);

        // Update state and localStorage
        setOpponentId(newOpponentId);
        localStorage.setItem('selectedOpponent', newOpponentId);

        // Load practice plan for new opponent
        if (teamId && newOpponentId) {
          console.log('Loading practice plan for new opponent:', newOpponentId);
          try {
            const { data, error } = await supabase
              .from('practice_plans')
              .select('*')
              .eq('team_id', teamId)
              .eq('opponent_id', newOpponentId)
              .single();

            if (error) {
              if (error.code === 'PGRST116') { // No data found
                console.log('No existing practice plan found for new opponent');
              } else {
                console.error('Error loading practice plan:', error);
              }
            } else if (data?.sections) {
              console.log('Found existing practice plan:', data);
              setSections(data.sections);
            }
          } catch (err) {
            console.error('Error in loadExistingPracticePlan:', err);
          }
        }

        // Fetch scouting data for new opponent
        fetchScoutingData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('opponentChanged', handleOpponentChangeEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('opponentChanged', handleOpponentChangeEvent);
    };
  }, [opponentId, teamId]);

  // Also update when opponent changes directly (not through storage event)
  useEffect(() => {
    const refreshScoutCards = async () => {
      if (!opponentId) return

      console.log('Refreshing scout cards for new opponent:', opponentId)
      
      const updatedSections = await Promise.all(sections.map(async (section) => {
        const updatedPlays = await Promise.all(section.plays.map(async (play) => {
          // Only search if there's a front selected
          if (play.vs_front && play.vs_front !== 'none' && play.vs_front !== '-') {
            console.log('Refreshing scout card for play:', {
              front: play.vs_front,
              coverage: play.vs_coverage
            })
            const matchingCard = await findMatchingScoutCard(play.vs_front, play.vs_coverage)
            return { ...play, scout_card: matchingCard || undefined }
          }
          return play
        }))
        return { ...section, plays: updatedPlays }
      }))
      setSections(updatedSections)
    }

    refreshScoutCards()
  }, [opponentId]) // Run when opponentId changes

  // Update the fetchGamePlanPlays to use the correct IDs
  useEffect(() => {
    if (teamId && opponentId) {
      fetchGamePlanPlays()
    }
  }, [teamId, opponentId]) // Re-fetch when either ID changes

  const fetchGamePlanPlays = async () => {
    if (!teamId || !opponentId) return

    try {
      console.log('Fetching game plan with:', { teamId, opponentId })
      
      // Fetch all plays for this team and opponent
      const { data: gamePlanData, error } = await supabase
        .from('game_plan')
        .select('*')
        .eq('team_id', teamId)
        .eq('opponent_id', opponentId)
        .order('position', { ascending: true })

      if (error) {
        console.error('Error fetching game plan:', error)
        return
      }

      console.log('Raw game plan data:', gamePlanData)

      // Transform the plays into our format
      const plays: GamePlanPlay[] = []
      let totalPlaysInGamePlan = 0
      const categoryCounts: Record<string, number> = {}

      gamePlanData?.forEach((entry) => {
        totalPlaysInGamePlan++
        
        // Track category counts
        if (entry.category) {
          categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1
        }

        if (entry.combined_call || entry.customized_edit) {
          plays.push({
            id: entry.id,
            play: entry.customized_edit || entry.combined_call,
            section: entry.category || '', // Use category instead of section
            position: entry.position,
            combined_call: entry.combined_call,
            customized_edit: entry.customized_edit
          })
        }
      })

      console.log('Play categories found:', categoryCounts)
      console.log('Processed plays:', plays)
      console.log('Total plays found:', { totalPlaysInGamePlan, validPlays: plays.length })

      setGameplanPlays(plays)
    } catch (err) {
      console.error('Error processing game plan data:', err)
    }
  }

  const fetchScoutingData = async () => {
    if (!teamId || !opponentId) {
      console.log('No team or opponent selected for scouting data')
      return
    }

    try {
      console.log('Loading scouting data for:', { teamId, opponentId })

      const scoutingReportResult = await getScoutingReport(teamId, opponentId)

      if (scoutingReportResult.success && scoutingReportResult.data) {
        const reportData = scoutingReportResult.data
        
        // Log the exact terminology we're getting
        console.log('Loaded scouting fronts:', reportData.fronts?.map(f => f.name))
        console.log('Loaded scouting coverages:', reportData.coverages?.map(c => c.name))

        // Set the scouting data state
        setScoutingFronts(reportData.fronts || [])
        setScoutingCoverages(reportData.coverages || [])
      } else {
        console.error('Failed to load scouting report:', scoutingReportResult.error)
        setScoutingFronts([])
        setScoutingCoverages([])
      }
    } catch (error) {
      console.error('Error loading scouting data:', error)
      setScoutingFronts([])
      setScoutingCoverages([])
    }
  }

  // Add effect to load scouting data when team/opponent changes
  useEffect(() => {
    if (teamId && opponentId) {
      fetchScoutingData()
    }
  }, [teamId, opponentId])

  const fetchGamePlanSections = async () => {
    if (!teamId || !opponentId) return

    const { data, error } = await supabase
      .from('game_plan')
      .select('game_plan_plays')
      .eq('team_id', teamId)
      .eq('opponent_id', opponentId)
      .single()

    if (error) {
      console.error('Error fetching game plan sections:', error)
      return
    }

    // Transform the data into our desired format
    const sections: Record<string, GamePlanPlay[]> = {}
    Object.entries(data.game_plan_plays).forEach(([section, plays]) => {
      sections[section] = (plays as any[]).map((p: any) => ({
        id: crypto.randomUUID(), // Generate a unique ID for each play
        play: p.play,
        section,
        position: p.position,
        combined_call: p.combined_call || p.play,
        customized_edit: p.customized_edit
      }))
    })

    setGameplanSections(sections)
  }

  const handleSearchPlays = (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setFilteredPlays([])
      return
    }

    // Search through all sections
    const allPlays = Object.values(gameplanSections).flat()
    const filtered = allPlays.filter(play => 
      play.combined_call.toLowerCase().includes(query.toLowerCase()) ||
      (play.customized_edit?.toLowerCase() || '').includes(query.toLowerCase())
    )
    setFilteredPlays(filtered)
  }

  const handleSelectPlay = (play: GamePlanPlay) => {
    if (selectedSectionId === null || selectedPlayIndex === null) return

    // Find the section and play
    const section = sections.find(s => s.id === selectedSectionId)
    if (!section) return

    const playText = play.customized_edit || play.combined_call
    handlePlayChange(selectedSectionId, section.plays[selectedPlayIndex].id, 'play', playText)
    setIsSelectPlayOpen(false)
    setSelectedSectionId(null)
    setSelectedPlayIndex(null)
  }

  // Add effect to load existing practice plan
  useEffect(() => {
    if (teamId && opponentId) {
      loadExistingPracticePlan()
    }
  }, [teamId, opponentId])

  const loadExistingPracticePlan = async () => {
    try {
      console.log('Checking for existing practice plan:', { teamId, opponentId })
      
      const { data, error } = await supabase
        .from('practice_plans')
        .select('*')
        .eq('team_id', teamId)
        .eq('opponent_id', opponentId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // No data found
          console.log('No existing practice plan found')
          return
        }
        console.error('Error loading practice plan:', error)
        return
      }

      console.log('Found existing practice plan:', data)

      if (data?.sections) {
        setSections(data.sections)
      }
    } catch (err) {
      console.error('Error in loadExistingPracticePlan:', err)
    }
  }

  // Update the save function to use upsert
  const handleSavePracticePlan = async () => {
    if (!teamId || !opponentId) return
    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('practice_plans')
        .upsert({
          team_id: teamId,
          opponent_id: opponentId,
          sections: sections,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'team_id,opponent_id'
        })

      setIsSaving(false)
      if (error) {
        console.error('Error saving practice plan:', error)
      } else {
        // Show success message
        console.log('Practice plan saved successfully')
      }
    } catch (err) {
      console.error('Error in handleSavePracticePlan:', err)
      setIsSaving(false)
    }
  }

  // Add auto-save when sections change
  useEffect(() => {
    if (sections.length > 0) {
      handleSavePracticePlan()
    }
  }, [sections])
  
  const handlePlayCountChange = (sectionId: string, newCount: number) => {
    const newSections = sections.map(section => {
      if (section.id === sectionId) {
        const currentCount = section.plays.length
        let newPlays = [...section.plays]
        if (newCount > currentCount) {
          // Add new empty plays
          for (let i = currentCount; i < newCount; i++) {
            newPlays.push({
              id: crypto.randomUUID(),
              number: i + 1,
              dn: '',
              dist: '',
              hash: 'none',
              play: '',
              vs_front: '',
              vs_coverage: ''
            })
          }
        } else {
          // Remove plays
          newPlays = newPlays.slice(0, newCount)
        }
        return { ...section, play_count: newCount, plays: newPlays }
      }
      return section
    })
    setSections(newSections)
  }

  const handlePlayChange = (sectionId: string, playId: string, field: keyof PracticePlay, value: string) => {
    const newSections = sections.map(section => {
      if (section.id === sectionId) {
        const newPlays = section.plays.map(play => {
          if (play.id === playId) {
            return { ...play, [field]: value }
          }
          return play
        })
        return { ...section, plays: newPlays }
      }
      return section
    })
    setSections(newSections)
  }

  const handleAddSection = () => {
    const existingSectionsOfType = sections.filter(s => s.type === newSectionType)
    const newSection: PracticeSection = {
      id: crypto.randomUUID(),
      name: `${newSectionType} ${existingSectionsOfType.length + 1}`,
      type: newSectionType,
      play_count: 10, // Default play count
      plays: Array.from({ length: 10 }, (_, i) => ({
        id: crypto.randomUUID(),
        number: i + 1,
        dn: '',
        dist: '',
        hash: 'none',
        play: '',
        vs_front: '',
        vs_coverage: '',
      }))
    }
    setSections([...sections, newSection])
    setIsAddSectionOpen(false)
  }

  const renderPlayCell = (section: PracticeSection, play: PracticePlay, playIndex: number) => (
    <td className="p-2">
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          className="h-8 w-full justify-start font-normal"
          onClick={() => {
            setSelectedSectionId(section.id)
            setSelectedPlayIndex(playIndex)
          }}
        >
          {play.play || "Select a play"}
        </Button>
      </div>
    </td>
  )

  const sectionNames: Record<string, string> = {
    openingScript: "Opening Script",
    basePackage1: "Base Package 1",
    basePackage2: "Base Package 2",
    basePackage3: "Base Package 3",
    firstDowns: "First Downs",
    secondAndShort: "Second & Short",
    secondAndLong: "Second & Long",
    shortYardage: "Short Yardage",
    thirdAndShort: "Third & Short",
    thirdAndMedium: "Third & Medium",
    thirdAndLong: "Third & Long",
    highRedZone: "High Red Zone",
    lowRedZone: "Low Red Zone",
    goalline: "Goalline",
    backedUp: "Backed Up",
    screens: "Screens",
    playAction: "Play Action",
    deepShots: "Deep Shots",
    twoMinuteDrill: "Two Minute",
    twoPointPlays: "Two Point Plays",
    firstSecondCombos: "First & Second Combos"
  }

  const getFilteredSections = () => {
    if (!searchQuery.trim()) {
      return gameplanSections
    }

    const query = searchQuery.toLowerCase()
    const filtered: Record<string, GamePlanPlay[]> = {}

    Object.entries(gameplanSections).forEach(([section, plays]) => {
      const matchingPlays = plays.filter(play => 
        (play.customized_edit?.toLowerCase() || '').includes(query) ||
        play.combined_call.toLowerCase().includes(query)
      )

      if (matchingPlays.length > 0) {
        filtered[section] = matchingPlays
      }
    })

    return filtered
  }

  // Update the handleSearch function to be more responsive
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    
    // Always show all plays if query is empty
    if (!query.trim()) {
      setSearchResults(gameplanPlays)
      return
    }

    // Search through all plays
    const searchTerms = query.toLowerCase().split(' ')
    const filtered = gameplanPlays.filter(play => {
      const playText = (play.customized_edit || play.combined_call).toLowerCase()
      return searchTerms.every(term => playText.includes(term))
    })
    setSearchResults(filtered)
  }

  // Add this effect at the component level
  useEffect(() => {
    if (selectedSectionId && selectedPlayIndex !== null) {
      // Initialize search results with all plays when opening selector
      setSearchResults(gameplanPlays)
    } else {
      // Clear search when closing selector
      setSearchQuery('')
      setSearchResults([])
    }
  }, [selectedSectionId, selectedPlayIndex, gameplanPlays])

  const renderPlaySelector = (section: PracticeSection, play: PracticePlay, playIndex: number) => {
    // Filter plays based on current mode
    const filteredPlays = playPoolFilterType === 'search' 
      ? searchResults 
      : gameplanPlays.filter(p => p.section === playPoolCategory)

    return (
      <Card className="absolute z-50 bg-white rounded shadow-lg w-[600px] max-h-[600px] flex flex-col">
        <CardHeader className="bg-gray-100 border-b flex flex-row justify-between items-center p-3">
          <CardTitle className="text-sm font-semibold">Select a Play</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setSelectedSectionId(null)
              setSelectedPlayIndex(null)
            }}
            className="text-xs"
          >
            Close
          </Button>
        </CardHeader>
        <CardContent className="p-3 flex flex-col overflow-hidden">
          {/* Filter type selector */}
          <div className="flex justify-center mb-2 border-b pb-1">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                className={`px-4 py-1 text-xs font-medium rounded-l-lg cursor-pointer ${
                  playPoolFilterType === 'category' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => {
                  setPlayPoolFilterType('category')
                  setSearchQuery('')
                  setSearchResults([])
                }}
              >
                By Category
              </button>
              <button
                type="button"
                className={`px-4 py-1 text-xs font-medium rounded-r-lg cursor-pointer ${
                  playPoolFilterType === 'search' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => {
                  setPlayPoolFilterType('search')
                  setSearchResults(gameplanPlays)
                }}
              >
                Search
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Category tabs */}
            {playPoolFilterType === 'category' && (
              <div className="w-1/3 border-r pr-1 overflow-y-auto">
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <button 
                    key={key}
                    className={`w-full text-left py-1 px-2 mb-1 text-xs rounded cursor-pointer ${
                      playPoolCategory === key ? 'bg-blue-100 font-medium' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setPlayPoolCategory(key as keyof typeof CATEGORIES)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Play list */}
            <div className={playPoolFilterType === 'category' ? 'w-2/3 pl-2' : 'w-full'}>
              {playPoolFilterType === 'search' && (
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Search plays..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {filteredPlays.length} {filteredPlays.length === 1 ? 'play' : 'plays'} found
                  </div>
                </div>
              )}

              <div className="space-y-1 overflow-y-auto" style={{ maxHeight: playPoolFilterType === 'search' ? '400px' : '450px' }}>
                {filteredPlays.map((play) => {
                  // Highlight matching text in search mode
                  let displayText = play.customized_edit || play.combined_call
                  if (playPoolFilterType === 'search' && searchQuery) {
                    const searchTerms = searchQuery.toLowerCase().split(' ')
                    searchTerms.forEach(term => {
                      const regex = new RegExp(`(${term})`, 'gi')
                      displayText = displayText.replace(regex, '<mark>$1</mark>')
                    })
                  }

                  return (
                    <div 
                      key={play.id}
                      className="p-2 border rounded flex justify-between items-center bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        if (selectedSectionId && selectedPlayIndex !== null) {
                          const section = sections.find(s => s.id === selectedSectionId)
                          if (section) {
                            handlePlayChange(selectedSectionId, section.plays[selectedPlayIndex].id, 'play', play.customized_edit || play.combined_call)
                            setSelectedSectionId(null)
                            setSelectedPlayIndex(null)
                          }
                        }
                      }}
                    >
                      <div 
                        className="text-xs font-mono truncate flex-1"
                        dangerouslySetInnerHTML={{ __html: displayText }}
                      />
                    </div>
                  )
                })}
                {filteredPlays.length === 0 && (
                  <p className="text-gray-500 italic text-xs text-center p-4">
                    {playPoolFilterType === 'search' 
                      ? searchQuery 
                        ? 'No plays match your search' 
                        : 'Type to search plays'
                      : 'No plays available in this category'
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const DEFAULT_TEAM_ID = '8feef3dc-942f-4bc5-b526-0b39e14cb683'

  const findMatchingScoutCard = async (front: string, coverage: string) => {
    try {
      console.log('Starting scout card search with inputs:', { 
        front, 
        coverage, 
        teamId, 
        DEFAULT_TEAM_ID,
        frontType: typeof front,
        coverageType: typeof coverage
      })
      
      // Handle 'none' or '-' as null for coverage
      const coverageValue = coverage === 'none' || coverage === '-' ? null : coverage.toLowerCase()
      const frontValue = front.toLowerCase()
      
      console.log('Processed values:', { 
        frontValue, 
        coverageValue,
        isNullCoverage: coverageValue === null
      })

      // First try with team's cards
      if (teamId) {
        let query = supabase
          .from('scout_cards')
          .select('*')
          .eq('team_id', teamId)
          .eq('front', frontValue)

        // If coverage is null (user selected '-'), match cards with null OR empty coverage
        if (coverageValue === null) {
          query = query.or('coverage.is.null,coverage.eq.')
        } else {
          query = query.eq('coverage', coverageValue)
        }

        const { data: teamCard, error: teamError } = await query

        console.log('Team search results:', {
          found: !!teamCard?.length,
          count: teamCard?.length || 0,
          error: teamError?.message,
          data: teamCard
        })

        if (!teamError && teamCard?.[0]) {
          console.log('Found team scout card:', teamCard[0])
          return teamCard[0]
        }
      }

      // Then try with default team's cards
      let defaultQuery = supabase
        .from('scout_cards')
        .select('*')
        .eq('team_id', DEFAULT_TEAM_ID)
        .eq('front', frontValue)

      // If coverage is null (user selected '-'), match cards with null OR empty coverage
      if (coverageValue === null) {
        defaultQuery = defaultQuery.or('coverage.is.null,coverage.eq.')
      } else {
        defaultQuery = defaultQuery.eq('coverage', coverageValue)
      }

      const { data: defaultCard, error: defaultError } = await defaultQuery

      console.log('Default team search results:', {
        found: !!defaultCard?.length,
        count: defaultCard?.length || 0,
        error: defaultError?.message,
        data: defaultCard
      })

      if (!defaultError && defaultCard?.[0]) {
        console.log('Found default scout card:', defaultCard[0])
        return defaultCard[0]
      }

      // For debugging, show all scout cards that match the front
      const { data: allMatchingFront } = await supabase
        .from('scout_cards')
        .select('*')
        .eq('team_id', DEFAULT_TEAM_ID)
        .eq('front', frontValue)

      console.log('All cards matching front:', {
        front: frontValue,
        count: allMatchingFront?.length || 0,
        cards: allMatchingFront?.map(card => ({
          front: card.front,
          coverage: card.coverage,
          coverageType: typeof card.coverage,
          isEmpty: card.coverage === '',
          isNull: card.coverage === null
        }))
      })

      console.log('No matching scout card found')
      return null
    } catch (err) {
      console.error('Error finding scout card:', err)
      return null
    }
  }

  const handleFrontCoverageChange = async (sectionId: string, playId: string, field: 'vs_front' | 'vs_coverage', value: string) => {
    console.log('Handling change:', { field, value })

    // Find the section and play first
    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    const playIndex = section.plays.findIndex(p => p.id === playId)
    if (playIndex === -1) return

    // Create new play with updated value
    const updatedPlay = {
      ...section.plays[playIndex],
      [field]: value === 'none' || value === '-' ? '' : value
    }

    // Create new sections array with the updated play
    const newSections = sections.map(s => {
      if (s.id === sectionId) {
        const newPlays = [...s.plays]
        newPlays[playIndex] = updatedPlay
        return { ...s, plays: newPlays }
      }
      return s
    })

    // Update state with the new value
    setSections(newSections)

    // Always search if we have a front value, regardless of which field changed
    if (updatedPlay.vs_front && updatedPlay.vs_front !== 'none' && updatedPlay.vs_front !== '-') {
      console.log('Searching for scout card with:', {
        front: updatedPlay.vs_front,
        coverage: updatedPlay.vs_coverage
      })

      const matchingCard = await findMatchingScoutCard(updatedPlay.vs_front, updatedPlay.vs_coverage)
      
      // Always update the section, either with the new card or removing the existing one
      const sectionsWithCardUpdate = newSections.map(s => {
        if (s.id === sectionId) {
          const playsWithCardUpdate = s.plays.map((p, idx) => {
            if (idx === playIndex) {
              // If we found a match, use it; otherwise, remove any existing scout_card
              return { ...p, scout_card: matchingCard || undefined }
            }
            return p
          })
          return { ...s, plays: playsWithCardUpdate }
        }
        return s
      })
      setSections(sectionsWithCardUpdate)
    } else {
      // If front is cleared or set to none/-, remove any existing scout card
      const sectionsWithoutCard = newSections.map(s => {
        if (s.id === sectionId) {
          const playsWithoutCard = s.plays.map((p, idx) => {
            if (idx === playIndex) {
              // Remove the scout_card property
              const { scout_card, ...playWithoutCard } = p
              return playWithoutCard
            }
            return p
          })
          return { ...s, plays: playsWithoutCard }
        }
        return s
      })
      setSections(sectionsWithoutCard)
    }
  }

  const renderFrontDropdown = (sectionId: string, playId: string, currentValue: string) => (
    <Select 
      value={currentValue || "none"}
      onValueChange={(value) => handleFrontCoverageChange(sectionId, playId, 'vs_front', value)}
    >
      <SelectTrigger className="h-8">
        <SelectValue placeholder="Select front" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">-</SelectItem>
        {scoutingFronts.map((front) => (
          <SelectItem key={front.id || front.name} value={front.name.toLowerCase()}>
            {front.name.toLowerCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const renderCoverageDropdown = (sectionId: string, playId: string, currentValue: string) => (
    <Select 
      value={currentValue || "none"}
      onValueChange={(value) => handleFrontCoverageChange(sectionId, playId, 'vs_coverage', value)}
    >
      <SelectTrigger className="h-8">
        <SelectValue placeholder="Select coverage" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">-</SelectItem>
        {scoutingCoverages.map((coverage) => (
          <SelectItem key={coverage.id || coverage.name} value={coverage.name.toLowerCase()}>
            {coverage.name.toLowerCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-6 w-6" />
            Practice Plan
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsAddSectionOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
            <Button onClick={handleSavePracticePlan} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Practice Plan'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle>{section.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor={`play-count-${section.id}`} className="text-sm font-medium">Plays:</Label>
                <Input
                  id={`play-count-${section.id}`}
                  type="number"
                  value={section.play_count}
                  onChange={(e) => handlePlayCountChange(section.id, parseInt(e.target.value, 10))}
                  className="w-16 h-8"
                />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              setSections(sections.filter(s => s.id !== section.id))
            }}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left w-8">#</th>
                  <th className="p-2 text-left w-16">Dn</th>
                  <th className="p-2 text-left w-16">Dist</th>
                  <th className="p-2 text-left w-16">Hash</th>
                  <th className="p-2 text-left">Play</th>
                  <th className="p-2 text-left w-4"></th>
                  <th className="p-2 text-left w-40">Front</th>
                  <th className="p-2 text-left w-40">Coverage</th>
                  <th className="p-2 text-center w-8">Card</th>
                  <th className="p-2 text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {section.plays.map((play, playIndex) => (
                  <tr key={play.id} className="border-b">
                    <td className="p-2">{play.number}</td>
                    <td className="p-2">
                      <Input
                        type="text"
                        value={play.dn}
                        className="h-8"
                        onChange={(e) => handlePlayChange(section.id, play.id, 'dn', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="text"
                        value={play.dist}
                        className="h-8"
                        onChange={(e) => handlePlayChange(section.id, play.id, 'dist', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Select
                        value={play.hash || "none"}
                        onValueChange={(value) => handlePlayChange(section.id, play.id, 'hash', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Hash" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="M">M</SelectItem>
                          <SelectItem value="R">R</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {renderPlayCell(section, play, playIndex)}
                    <td className="p-2 text-center">vs</td>
                    <td className="p-2">
                      {renderFrontDropdown(section.id, play.id, play.vs_front)}
                    </td>
                    <td className="p-2">
                      {renderCoverageDropdown(section.id, play.id, play.vs_coverage)}
                    </td>
                    <td className="p-2 text-center">
                      {play.scout_card ? (
                        <img
                          src={play.scout_card.image_url}
                          alt="Scout card thumbnail"
                          className="h-8 w-8 object-cover rounded cursor-pointer mx-auto"
                          onClick={() => play.scout_card?.image_url && setSelectedImage(play.scout_card.image_url)}
                        />
                      ) : (
                        <Image className="h-4 w-4 text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => {
                        const newPlays = [...section.plays]
                        newPlays.splice(playIndex, 1)
                        const newSections = sections.map(s => 
                          s.id === section.id ? { ...s, plays: newPlays } : s
                        )
                        setSections(newSections)
                      }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <Dialog open={isAddSectionOpen} onOpenChange={setIsAddSectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Practice Section</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="section-type">Section Type</Label>
            <Select
              value={newSectionType}
              onValueChange={(value: 'Walk Through' | 'Inside Run' | 'Skelly' | 'Team') => setNewSectionType(value)}
            >
              <SelectTrigger id="section-type">
                <SelectValue placeholder="Select a section type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Walk Through">Walk Through</SelectItem>
                <SelectItem value="Inside Run">Inside Run</SelectItem>
                <SelectItem value="Skelly">Skelly</SelectItem>
                <SelectItem value="Team">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSectionOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSection}>Add Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove the Dialog component and only keep the play selector */}
      {selectedSectionId !== null && selectedPlayIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          {renderPlaySelector(
            sections.find(s => s.id === selectedSectionId)!,
            sections.find(s => s.id === selectedSectionId)!.plays[selectedPlayIndex],
            selectedPlayIndex
          )}
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Scout card"
              className="w-full h-auto"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
} 