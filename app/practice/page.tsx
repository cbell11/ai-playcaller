"use client"

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Timer, Plus, Trash2, Search, Star } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Define interfaces for our data structures
interface PracticePlay {
  id: string;
  number: number;
  dn: string;
  dist: string;
  hash: string;  // Add hash field
  play: string;
  vs_front: string;
  vs_coverage: string;
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
  const [scoutingFronts, setScoutingFronts] = useState<string[]>([])
  const [scoutingCoverages, setScoutingCoverages] = useState<string[]>([])
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
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedOpponent') {
        setOpponentId(e.newValue)
      }
      if (e.key === 'selectedTeam') {
        setTeamId(e.newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

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

  const fetchScoutingData = async (opponentId: string) => {
    const { data, error } = await supabase
      .from('scouting_reports')
      .select('fronts, coverages')
      .eq('opponent_id', opponentId)
      .single()
    
    if (error) {
      console.error('Error fetching scouting data:', error)
      return
    }

    setScoutingFronts(data.fronts?.map((f: any) => f.name) || [])
    setScoutingCoverages(data.coverages?.map((c: any) => c.name) || [])
  }

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

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    // Search through all sections
    const allPlays = Object.values(gameplanSections).flat()
    const filtered = allPlays.filter(play => {
      const searchTerms = query.toLowerCase().split(' ')
      const playText = (play.customized_edit || play.combined_call).toLowerCase()
      
      return searchTerms.every(term => playText.includes(term))
    })
    setSearchResults(filtered)
  }

  const renderPlaySelector = (section: PracticeSection, play: PracticePlay, playIndex: number) => {
    // Update the filtering logic
    const filteredPlays = playPoolFilterType === 'search' 
      ? searchResults 
      : gameplanPlays.filter(p => {
          // Add debug logging
          console.log('Filtering play:', {
            play: p,
            category: playPoolCategory,
            section: p.section,
            matches: p.section === playPoolCategory
          })
          return p.section === playPoolCategory
        })

    console.log('Filtered plays:', {
      total: gameplanPlays.length,
      filtered: filteredPlays.length,
      category: playPoolCategory,
      filterType: playPoolFilterType
    })

    return (
      <Card className="absolute z-50 bg-white rounded shadow-lg w-96 max-h-[500px] flex flex-col">
        <CardHeader className="bg-gray-100 border-b flex flex-row justify-between items-center p-3">
          <CardTitle className="text-sm font-semibold">Select Play</CardTitle>
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
                onClick={() => setPlayPoolFilterType('category')}
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
                onClick={() => setPlayPoolFilterType('search')}
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
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1 overflow-y-auto" style={{ maxHeight: playPoolFilterType === 'search' ? '400px' : '450px' }}>
                {filteredPlays.map((play) => (
                  <div 
                    key={play.id}
                    className="p-1 border rounded flex justify-between items-center bg-gray-50 border-gray-200 hover:bg-gray-100"
                  >
                    <div className="text-xs font-mono truncate flex-1">
                      {play.customized_edit || play.combined_call}
                    </div>
                    <button
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
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 ml-1 rounded flex-shrink-0 cursor-pointer"
                    >
                      Select
                    </button>
                  </div>
                ))}
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
                      {/* Dropdown for fronts will go here */}
                      <Select onValueChange={(value) => handlePlayChange(section.id, play.id, 'vs_front', value)}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select a front" />
                        </SelectTrigger>
                        <SelectContent>
                          {scoutingFronts.map((front, i) => (
                            <SelectItem key={i} value={front}>{front}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      {/* Dropdown for coverages will go here */}
                      <Select onValueChange={(value) => handlePlayChange(section.id, play.id, 'vs_coverage', value)}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select a coverage" />
                        </SelectTrigger>
                        <SelectContent>
                          {scoutingCoverages.map((coverage, i) => (
                            <SelectItem key={i} value={coverage}>{coverage}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

      {/* Add debugging console */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-2 text-xs font-mono z-50">
        <div>Debug Info:</div>
        <div>team_id: {teamId || 'null'}</div>
        <div>opponent_id: {opponentId || 'null'}</div>
        <div>gameplanPlays loaded: {gameplanPlays.length}</div>
        <div>filtered plays: {
          playPoolFilterType === 'search' 
            ? searchResults.length 
            : gameplanPlays.filter(p => p.section === playPoolCategory).length
        }</div>
        <div>current category: {playPoolCategory}</div>
        <div>current filter type: {playPoolFilterType}</div>
        <div className="mt-1 text-green-400">Game Plan Data:</div>
        <div>- Total sections: {Object.keys(gameplanSections).length}</div>
        <div>- Total plays in sections: {
          Object.values(gameplanSections)
            .reduce((total, plays) => total + plays.length, 0)
        }</div>
        <div>- Available categories: {
          Array.from(new Set(gameplanPlays.map(p => p.section))).join(', ')
        }</div>
        <div className="mt-1 text-blue-400">Practice Plan Data:</div>
        <div>- Total practice sections: {sections.length}</div>
        <div>- Total practice plays: {
          sections.reduce((total, section) => total + section.plays.length, 0)
        }</div>
      </div>
    </div>
  )
} 