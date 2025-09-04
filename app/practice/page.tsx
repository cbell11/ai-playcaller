"use client"

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Timer, Plus, Trash2, Search, Star, Image, Loader2, Printer, Wand2, Save } from 'lucide-react'
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
  set: string;
  personnel: string;
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
  'moving_pocket': 'Moving Pocket',
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
  const [scoutingFrontsPercentages, setScoutingFrontsPercentages] = useState<Record<string, number>>({})
  const [scoutingCoveragesPercentages, setScoutingCoveragesPercentages] = useState<Record<string, number>>({})
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
  const [showAddScoutCardModal, setShowAddScoutCardModal] = useState(false)
  const [newScoutCardUrl, setNewScoutCardUrl] = useState('')
  const [isSubmittingNewCard, setIsSubmittingNewCard] = useState(false)
  const [selectedPlayForCard, setSelectedPlayForCard] = useState<{
    sectionId: string;
    playId: string;
    front: string;
    coverage: string | null;
  } | null>(null)

  // Add error state for the modal
  const [addCardError, setAddCardError] = useState<string | null>(null);

  // Add state for tracking which play's scout card is being viewed
  const [selectedScoutCardPlay, setSelectedScoutCardPlay] = useState<{
    sectionId: string;
    playId: string;
    front: string;
    coverage: string | null;
    currentCard: ScoutCard;
  } | null>(null);

  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  // Add state for upload success message
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Add state to track if Cloudinary widget is open
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  // Add state for template saving
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [selectedSectionForTemplate, setSelectedSectionForTemplate] = useState<PracticeSection | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState<string | null>(null)

  // Add state for template loading
  const [availableTemplates, setAvailableTemplates] = useState<Array<{
    id: string;
    template_name: string;
    section_type: string;
    section_name: string;
    sections: any;
  }>>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

  // Add state for clear practice plan
  const [showClearPlanDialog, setShowClearPlanDialog] = useState(false)

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
              coverage: play.vs_coverage,
              playId: play.id,
              sectionId: section.id
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
  }, [opponentId, teamId]) // Add teamId to dependencies

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
        setScoutingFrontsPercentages(reportData.fronts_pct || {})
        setScoutingCoveragesPercentages(reportData.coverages_pct || {})
        
        // Log percentage data for debugging
        console.log('Fronts percentages:', reportData.fronts_pct)
        console.log('Coverages percentages:', reportData.coverages_pct)
      } else {
        console.error('Failed to load scouting report:', scoutingReportResult.error)
        setScoutingFronts([])
        setScoutingCoverages([])
        setScoutingFrontsPercentages({})
        setScoutingCoveragesPercentages({})
      }
    } catch (error) {
      console.error('Error loading scouting data:', error)
      setScoutingFronts([])
      setScoutingCoverages([])
      setScoutingFrontsPercentages({})
      setScoutingCoveragesPercentages({})
    }
  }

  // Add effect to load scouting data when team/opponent changes
  useEffect(() => {
    if (teamId && opponentId) {
      fetchScoutingData()
    }
  }, [teamId, opponentId])

  // Add effect to load templates when teamId becomes available
  useEffect(() => {
    if (teamId) {
      console.log('TeamId changed, fetching templates:', teamId)
      fetchTemplates()
    }
  }, [teamId])

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

  const saveAsTemplate = async () => {
    if (!selectedSectionForTemplate || !templateName.trim() || !teamId) {
      return
    }

    setIsSavingTemplate(true)

    try {
      // Create a clean version of the section with blank play, vs_front, and vs_coverage
      const cleanSection = {
        ...selectedSectionForTemplate,
        plays: selectedSectionForTemplate.plays.map(play => ({
          ...play,
          play: '', // Clear play content
          vs_front: '', // Clear front
          vs_coverage: '', // Clear coverage
          scout_card: undefined // Remove scout card
        }))
      }

      const { error } = await supabase
        .from('practice_section_templates')
        .insert({
          team_id: teamId,
          template_name: templateName.trim(),
          section_type: selectedSectionForTemplate.type,
          section_name: selectedSectionForTemplate.name,
          sections: cleanSection
        })

      if (error) {
        console.error('Error saving template:', error)
        alert('Failed to save template. Please try again.')
      } else {
        console.log('Template saved successfully')
        // Show success message
        setTemplateSaveSuccess(`Template "${templateName}" saved successfully!`)
        
        // Refresh templates to include the newly created one
        await fetchTemplates()
        
        // Reset state
        setShowSaveTemplateModal(false)
        setSelectedSectionForTemplate(null)
        setTemplateName('')
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setTemplateSaveSuccess(null)
        }, 5000)
      }
    } catch (err) {
      console.error('Error in saveAsTemplate:', err)
      setTemplateSaveSuccess('Failed to save template. Please try again.')
      setTimeout(() => {
        setTemplateSaveSuccess(null)
      }, 5000)
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const fetchTemplates = async () => {
    if (!teamId) {
      console.log('No teamId available for fetching templates')
      return
    }

    setIsLoadingTemplates(true)
    try {
      console.log('Fetching templates for team:', teamId)
      
      const { data, error } = await supabase
        .from('practice_section_templates')
        .select('id, template_name, section_type, section_name, sections')
        .eq('team_id', teamId)
        .order('template_name', { ascending: true })

      if (error) {
        console.error('Error fetching templates:', error)
        setAvailableTemplates([])
      } else {
        console.log('Fetched templates:', data)
        setAvailableTemplates(data || [])
      }
    } catch (err) {
      console.error('Error in fetchTemplates:', err)
      setAvailableTemplates([])
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const handleClearPracticePlan = async () => {
    if (!teamId || !opponentId) {
      console.error('Missing teamId or opponentId for clearing practice plan')
      setShowClearPlanDialog(false)
      return
    }

    try {
      console.log('Clearing practice plan for:', { teamId, opponentId })
      
      // Delete the practice plan from the database
      const { error } = await supabase
        .from('practice_plans')
        .delete()
        .eq('team_id', teamId)
        .eq('opponent_id', opponentId)

      if (error) {
        console.error('Error clearing practice plan from database:', error)
        alert('Failed to clear practice plan from database. Please try again.')
      } else {
        console.log('Practice plan cleared from database successfully')
        // Clear sections from UI
        setSections([])
      }
    } catch (err) {
      console.error('Error in handleClearPracticePlan:', err)
      alert('Failed to clear practice plan. Please try again.')
    } finally {
      setShowClearPlanDialog(false)
    }
  }

  // Weighted random selection based on percentages
  const selectWeightedOption = (options: ScoutingOption[], percentages: Record<string, number>): string => {
    if (options.length === 0) return ''
    
    // If no percentage data, fall back to random selection
    if (Object.keys(percentages).length === 0) {
      return options[Math.floor(Math.random() * options.length)].name.toLowerCase()
    }

    // Create weighted array based on percentages
    const weightedOptions: string[] = []
    options.forEach(option => {
      const percentage = percentages[option.name] || 0
      // Add option multiple times based on percentage (scaled to reasonable numbers)
      const weight = Math.max(1, Math.round(percentage))
      for (let i = 0; i < weight; i++) {
        weightedOptions.push(option.name.toLowerCase())
      }
    })

    if (weightedOptions.length === 0) {
      // Fallback to random if no weights
      return options[Math.floor(Math.random() * options.length)].name.toLowerCase()
    }

    return weightedOptions[Math.floor(Math.random() * weightedOptions.length)]
  }

  const generatePlaysForSection = async (section: PracticeSection) => {
    let allPlays: GamePlanPlay[] = []

    if (section.type === 'Inside Run') {
      // Filter gameplan plays for Run Game and RPO Game
      const runGamePlays = gameplanPlays.filter(play => play.section === 'run_game')
      const rpoGamePlays = gameplanPlays.filter(play => play.section === 'rpo_game')
      
      if (runGamePlays.length === 0 && rpoGamePlays.length === 0) {
        console.log('No Run Game or RPO Game plays available in gameplan')
        return
      }

      // Combine all available plays
      allPlays = [...runGamePlays, ...rpoGamePlays]
    } else if (section.type === 'Skelly') {
      // Filter gameplan plays for Quick Game, Dropback Game, and Shot Plays
      const quickGamePlays = gameplanPlays.filter(play => play.section === 'quick_game')
      const dropbackGamePlays = gameplanPlays.filter(play => play.section === 'dropback_game')
      const shotPlays = gameplanPlays.filter(play => play.section === 'shot_plays')
      
      if (quickGamePlays.length === 0 && dropbackGamePlays.length === 0 && shotPlays.length === 0) {
        console.log('No Quick Game, Dropback Game, or Shot Plays available in gameplan')
        return
      }

      // Combine all available plays
      allPlays = [...quickGamePlays, ...dropbackGamePlays, ...shotPlays]
    } else if (section.type === 'Team') {
      // Filter gameplan plays from all categories
      const runGamePlays = gameplanPlays.filter(play => play.section === 'run_game')
      const rpoGamePlays = gameplanPlays.filter(play => play.section === 'rpo_game')
      const quickGamePlays = gameplanPlays.filter(play => play.section === 'quick_game')
      const dropbackGamePlays = gameplanPlays.filter(play => play.section === 'dropback_game')
      const screenGamePlays = gameplanPlays.filter(play => play.section === 'screen_game')
      const movingPocketPlays = gameplanPlays.filter(play => play.section === 'moving_pocket')
      const shotPlays = gameplanPlays.filter(play => play.section === 'shot_plays')
      
      // Combine all available plays from every category
      allPlays = [...runGamePlays, ...rpoGamePlays, ...quickGamePlays, ...dropbackGamePlays, ...screenGamePlays, ...movingPocketPlays, ...shotPlays]
      
      if (allPlays.length === 0) {
        console.log('No plays available in gameplan for Team sections')
        return
      }
    } else {
      console.log('Auto-generation not yet implemented for:', section.type)
      return
    }
    
        // Generate new plays with scout cards
    const newPlays = await Promise.all(section.plays.map(async (play, index) => {
      // Select random play
      const randomPlay = allPlays[Math.floor(Math.random() * allPlays.length)]
      
      // Calculate set ratio (3:2 for Set 1:Set 2)
      const set = (index % 5) < 3 ? '1' : '2'
      
      // Hash pattern: L -> M -> R -> M -> L (repeating every 4)
      const hashPattern = ['L', 'M', 'R', 'M']
      const hash = hashPattern[index % 4]
      
      // Generate distance from 10 down to 1, distributed across the section length
      const totalPlays = section.plays.length
      const distanceRange = Math.max(10 - totalPlays + 1, 1) // Ensure we don't go below 1
      const minDistance = Math.max(1, 11 - totalPlays) // Start distance based on section length
      const maxDistance = 10
      
      // Random distance between minDistance and maxDistance
      const randomDistance = Math.floor(Math.random() * (maxDistance - minDistance + 1)) + minDistance
      
      // Random down and distance combinations
      const downDistOptions = [
        { dn: '1', dist: randomDistance.toString() },
        { dn: '2', dist: Math.max(1, randomDistance - 2).toString() },
        { dn: '2', dist: Math.max(1, randomDistance - 1).toString() },
        { dn: '3', dist: Math.max(1, randomDistance - 3).toString() },
        { dn: '3', dist: Math.max(1, randomDistance - 2).toString() },
        { dn: '3', dist: Math.max(1, randomDistance - 1).toString() }
      ]
      const randomDownDist = downDistOptions[Math.floor(Math.random() * downDistOptions.length)]
      
      // Select weighted front and coverage based on scouting percentages
      const weightedFront = selectWeightedOption(scoutingFronts, scoutingFrontsPercentages)
      const weightedCoverage = selectWeightedOption(scoutingCoverages, scoutingCoveragesPercentages)

      // Find matching scout card
      const scoutCard = weightedFront ? await findMatchingScoutCard(weightedFront, weightedCoverage) : undefined

      return {
        ...play,
        set,
        personnel: '', // Leave blank as requested
        dn: randomDownDist.dn,
        dist: randomDownDist.dist,
        hash,
        play: randomPlay?.customized_edit || randomPlay?.combined_call || '',
        vs_front: weightedFront,
        vs_coverage: weightedCoverage,
        scout_card: scoutCard || undefined
      }
    }))

    // Update the section with generated plays
    const newSections = sections.map(s => 
      s.id === section.id ? { ...s, plays: newPlays } : s
    )
    setSections(newSections)
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
              set: '1',
              personnel: '',
              dn: '',
              dist: '',
              hash: 'none',
              play: '',
              vs_front: '',
              vs_coverage: ''
            })
          }
        } else {
          // Remove plays and renumber remaining ones
          newPlays = newPlays.slice(0, newCount)
          newPlays.forEach((play, index) => {
            play.number = index + 1
          })
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
    if (selectedTemplateId && selectedTemplateId !== "") {
      // Create section from template
      const template = availableTemplates.find(t => t.id === selectedTemplateId)
      if (template) {
        const templateSection = template.sections
        const existingSectionsOfType = sections.filter(s => s.type === templateSection.type)
        
        const newSection: PracticeSection = {
          ...templateSection,
          id: crypto.randomUUID(), // Generate new ID
          name: existingSectionsOfType.length > 0 
            ? `${templateSection.name} ${existingSectionsOfType.length + 1}`
            : templateSection.name,
          plays: templateSection.plays.map((play: any, i: number) => ({
            ...play,
            id: crypto.randomUUID(), // Generate new ID for each play
            number: i + 1
          }))
        }
        setSections([...sections, newSection])
      }
    } else {
      // Create new section from scratch
      const existingSectionsOfType = sections.filter(s => s.type === newSectionType)
      const newSection: PracticeSection = {
        id: crypto.randomUUID(),
        name: `${newSectionType} ${existingSectionsOfType.length + 1}`,
        type: newSectionType,
        play_count: 10, // Default play count
        plays: Array.from({ length: 10 }, (_, i) => ({
          id: crypto.randomUUID(),
          number: i + 1,
          set: '1',
          personnel: '',
          dn: '',
          dist: '',
          hash: 'none',
          play: '',
          vs_front: '',
          vs_coverage: '',
        }))
      }
      setSections([...sections, newSection])
    }
    
    setIsAddSectionOpen(false)
    setSelectedTemplateId('')
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
                  const originalText = play.customized_edit || play.combined_call
                  
                  // Create highlighted version only for display
                  let displayContent = originalText
                  if (playPoolFilterType === 'search' && searchQuery.trim()) {
                    const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0)
                    searchTerms.forEach(term => {
                      // Escape special regex characters
                      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                      const regex = new RegExp(`(${escapedTerm})`, 'gi')
                      displayContent = displayContent.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
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
                            // Always use the original text, not the highlighted version
                            handlePlayChange(selectedSectionId, section.plays[selectedPlayIndex].id, 'play', originalText)
                            setSelectedSectionId(null)
                            setSelectedPlayIndex(null)
                          }
                        }
                      }}
                    >
                      {playPoolFilterType === 'search' && searchQuery.trim() ? (
                        <div 
                          className="text-xs font-mono truncate flex-1"
                          dangerouslySetInnerHTML={{ __html: displayContent }}
                        />
                      ) : (
                        <div className="text-xs font-mono truncate flex-1">
                          {originalText}
                        </div>
                      )}
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
          teamId,
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
        DEFAULT_TEAM_ID,
        found: !!defaultCard?.length,
        count: defaultCard?.length || 0,
        error: defaultError?.message,
        data: defaultCard
      })

      if (!defaultError && defaultCard?.[0]) {
        console.log('Found default scout card:', defaultCard[0])
        return defaultCard[0]
      }

      console.log('No matching scout card found for:', {
        front: frontValue,
        coverage: coverageValue,
        teamId,
        defaultTeamId: DEFAULT_TEAM_ID
      })
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

  // Add function to handle new scout card submission
  const handleSubmitNewScoutCard = async () => {
    if (!selectedPlayForCard || !newScoutCardUrl || !teamId) {
      setAddCardError('Missing required information');
      return;
    }

    setIsSubmittingNewCard(true);
    setAddCardError(null);

    try {
      console.log('Creating new scout card:', {
        team_id: DEFAULT_TEAM_ID, // Always save to default team
        front: selectedPlayForCard.front.toLowerCase(),
        coverage: selectedPlayForCard.coverage?.toLowerCase() || null,
        image_url: newScoutCardUrl
      });

      // Insert new scout card with default team_id
      const { data, error } = await supabase
        .from('scout_cards')
        .insert({
          team_id: DEFAULT_TEAM_ID, // Always save to default team
          front: selectedPlayForCard.front.toLowerCase(),
          coverage: selectedPlayForCard.coverage?.toLowerCase() || null,
          image_url: newScoutCardUrl
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating scout card:', error);
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('Successfully created scout card:', data);

      // Update the play with the new scout card
      const newSections = sections.map(section => {
        if (section.id === selectedPlayForCard.sectionId) {
          const newPlays = section.plays.map(play => {
            if (play.id === selectedPlayForCard.playId) {
              return { ...play, scout_card: data };
            }
            return play;
          });
          return { ...section, plays: newPlays };
        }
        return section;
      });
      setSections(newSections);

      // Reset state
      setShowAddScoutCardModal(false);
      setNewScoutCardUrl('');
      setSelectedPlayForCard(null);
      setAddCardError(null);

    } catch (err) {
      console.error('Error creating new scout card:', err);
      setAddCardError(err instanceof Error ? err.message : 'Failed to create scout card');
    } finally {
      setIsSubmittingNewCard(false);
    }
  };

  // Function to handle replacing existing scout card
  const handleReplaceScoutCard = async () => {
    if (!selectedScoutCardPlay || !newScoutCardUrl || !teamId) {
      setAddCardError('Missing required information');
      return;
    }

    setIsSubmittingNewCard(true);
    setAddCardError(null);

    try {
      // First check if this team already has a card for this combination
      const { data: existingCard } = await supabase
        .from('scout_cards')
        .select('*')
        .eq('team_id', DEFAULT_TEAM_ID) // Check default team instead of user's team
        .eq('front', selectedScoutCardPlay.front.toLowerCase())
        .eq('coverage', selectedScoutCardPlay.coverage?.toLowerCase() || null)
        .single();

      if (existingCard) {
        // Update existing card
        const { data, error } = await supabase
          .from('scout_cards')
          .update({
            image_url: newScoutCardUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCard.id)
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('No data returned from update');

        console.log('Successfully updated scout card:', data);
        
        // Update the play with the new card
        const newSections = sections.map(section => {
          if (section.id === selectedScoutCardPlay.sectionId) {
            const newPlays = section.plays.map(play => {
              if (play.id === selectedScoutCardPlay.playId) {
                return { ...play, scout_card: data };
              }
              return play;
            });
            return { ...section, plays: newPlays };
          }
          return section;
        });
        setSections(newSections);
      } else {
        // Create new card for default team
        const { data, error } = await supabase
          .from('scout_cards')
          .insert({
            team_id: DEFAULT_TEAM_ID, // Always save to default team
            front: selectedScoutCardPlay.front.toLowerCase(),
            coverage: selectedScoutCardPlay.coverage?.toLowerCase() || null,
            image_url: newScoutCardUrl
          })
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('No data returned from insert');

        console.log('Successfully created new scout card:', data);

        // Update the play with the new card
        const newSections = sections.map(section => {
          if (section.id === selectedScoutCardPlay.sectionId) {
            const newPlays = section.plays.map(play => {
              if (play.id === selectedScoutCardPlay.playId) {
                return { ...play, scout_card: data };
              }
              return play;
            });
            return { ...section, plays: newPlays };
          }
          return section;
        });
        setSections(newSections);
      }

      // Reset states
      setShowAddScoutCardModal(false);
      setNewScoutCardUrl('');
      setSelectedScoutCardPlay(null);
      setSelectedImage(null);
      setAddCardError(null);

    } catch (err) {
      console.error('Error replacing scout card:', err);
      setAddCardError(err instanceof Error ? err.message : 'Failed to replace scout card');
    } finally {
      setIsSubmittingNewCard(false);
    }
  };

  // Update the renderScoutCardCell to include play info when showing image
  const renderScoutCardCell = (play: PracticePlay, sectionId: string, playId: string) => {
    if (!play.vs_front) {
      return <Image className="h-4 w-4 text-gray-600 mx-auto" />;
    }

    if (play.scout_card) {
      return (
        <img
          src={play.scout_card.image_url}
          alt="Scout card thumbnail"
          className="h-8 w-8 object-cover rounded cursor-pointer mx-auto"
          onClick={() => {
            if (play.scout_card?.image_url) {
              setSelectedImage(play.scout_card.image_url);
              setSelectedScoutCardPlay({
                sectionId,
                playId,
                front: play.vs_front,
                coverage: play.vs_coverage === '-' ? null : play.vs_coverage,
                currentCard: play.scout_card
              });
            }
          }}
        />
      );
    }

    // Only show Add button if we have a teamId (user is logged in)
    if (teamId) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
          onClick={() => {
            setAddCardError(null);
            setSelectedPlayForCard({
              sectionId,
              playId,
              front: play.vs_front,
              coverage: play.vs_coverage === '-' ? null : play.vs_coverage
            });
            setShowAddScoutCardModal(true);
          }}
        >
          Add
        </Button>
      );
    }

    return <Image className="h-4 w-4 text-gray-600 mx-auto" />;
  };

  // Update the modal to handle overlay differently when widget is open
  const renderAddScoutCardModal = () => (
    <Dialog 
      open={showAddScoutCardModal} 
      onOpenChange={(open) => {
        if (!isWidgetOpen) {
          if (!open) {
            setNewScoutCardUrl('');
            setSelectedPlayForCard(null);
            setSelectedScoutCardPlay(null);
            setUploadSuccess(false);
          }
          setShowAddScoutCardModal(open);
        }
      }}
      modal={!isWidgetOpen} // Make dialog non-modal when widget is open
    >
      <DialogContent 
        className={`z-[100] ${isWidgetOpen ? 'pointer-events-none opacity-50' : ''}`}
        onPointerDownOutside={(e) => {
          // Prevent closing when widget is open
          if (isWidgetOpen) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {selectedScoutCardPlay ? 'Replace Scout Card' : 'Add New Scout Card'}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-2">
            {selectedScoutCardPlay 
              ? "Replace this scout card with your team's own version"
              : "Add a custom scout card image for your team"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-2 block">Option 1: Upload Image</Label>
              <Button
                variant="outline"
                onClick={initializeWidget}
                className="bg-blue-500 hover:bg-blue-600 text-white hover:text-white border-blue-500 w-full"
                disabled={isWidgetOpen}
              >
                Upload Files
              </Button>
              {uploadSuccess && (
                <div className="mt-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Upload successful! Click 'Save Scout Card' to confirm.
                </div>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">or</span>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Option 2: Enter Image URL</Label>
              <Input
                type="url"
                placeholder="Enter image URL or upload above"
                value={newScoutCardUrl}
                onChange={(e) => {
                  setNewScoutCardUrl(e.target.value);
                  setAddCardError(null);
                  setUploadSuccess(false);
                }}
              />
            </div>
          </div>

          {addCardError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {addCardError}
            </div>
          )}

          {newScoutCardUrl && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={newScoutCardUrl}
                  alt="Scout card preview"
                  className="w-full h-auto max-h-[300px] object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
                    e.currentTarget.className = 'w-full h-[300px] object-contain p-4 bg-gray-100';
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowAddScoutCardModal(false);
              setNewScoutCardUrl('');
              setSelectedPlayForCard(null);
              setSelectedScoutCardPlay(null);
              setUploadSuccess(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={selectedScoutCardPlay ? handleReplaceScoutCard : handleSubmitNewScoutCard}
            disabled={!newScoutCardUrl || isSubmittingNewCard}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {isSubmittingNewCard ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              selectedScoutCardPlay ? 'Replace Scout Card' : 'Save Scout Card'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Add back the Cloudinary script initialization
  useEffect(() => {
    // Add Cloudinary script
    const script = document.createElement('script');
    script.src = 'https://upload-widget.cloudinary.com/latest/global/all.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Only remove the script if it exists
      const existingScript = document.querySelector(`script[src="${script.src}"]`);
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, []);

  // Update the widget initialization with z-index configuration
  const initializeWidget = useCallback(() => {
    if ((window as any).cloudinary) {
      setIsWidgetOpen(true); // Set widget as open
      const myWidget = (window as any).cloudinary.createUploadWidget({
        cloudName: 'dfvzvbygc',
        uploadPreset: 'AIPlaycallerScoutCards',
        sources: ['local', 'url', 'camera'],
        multiple: false,
        maxFiles: 1,
        styles: {
          frame: {
            zIndex: 2147483647 // Maximum z-index value
          }
        }
      }, (error: any, result: any) => {
        if (!error && result) {
          if (result.event === "success") {
            console.log('Done! Here is the image info: ', result.info);
            const imageUrl = result.info.secure_url;
            setNewScoutCardUrl(imageUrl);
            setUploadSuccess(true);
            setIsWidgetOpen(false); // Set widget as closed
            myWidget.close();
          } else if (result.event === "close") {
            setIsWidgetOpen(false); // Set widget as closed when user closes it
          }
        }
      });

      myWidget.open();
    } else {
      console.error('Cloudinary widget script not loaded');
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Template Save Success Message */}
      {templateSaveSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{templateSaveSuccess}</span>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-6 w-6" />
            Practice Plan
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                const printWindow = window.open('', '_blank');
                if (!printWindow) return;

                const content = `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Practice Script</title>
                      <style>
                        body { 
                          font-family: Arial, sans-serif;
                          margin: 0;
                          padding: 20px;
                        }
                        table { 
                          width: 100%; 
                          border-collapse: collapse; 
                          margin-bottom: 10px;
                          font-size: 12px;
                        }
                        th, td { 
                          border: 1px solid #ddd; 
                          padding: 4px 8px; 
                          text-align: left; 
                        }
                        th { 
                          background-color: #f5f5f5; 
                          font-size: 12px;
                        }
                        h2 { 
                          margin: 10px 0;
                          font-size: 14px;
                          page-break-before: auto;
                        }
                        @media print {
                          .no-print { display: none; }
                          @page { 
                            margin: 1cm;
                            size: portrait;
                          }
                          body {
                            padding: 0;
                          }
                          table {
                            page-break-inside: avoid;
                          }
                        }
                      </style>
                    </head>
                    <body>
                      <div class="no-print">
                        <button onclick="window.print()">Print</button>
                        <hr>
                      </div>
                      ${sections.map((section: PracticeSection) => `
                        <h2>${section.name}</h2>
                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Set</th>
                              <th>Personnel</th>
                              <th>Dn</th>
                              <th>Dist</th>
                              <th>Hash</th>
                              <th>Play</th>
                              <th>Front</th>
                              <th>Coverage</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${section.plays.map((play: PracticePlay) => `
                              <tr>
                                <td>${play.number}</td>
                                <td>${play.set || '1'}</td>
                                <td>${play.personnel || ''}</td>
                                <td>${play.dn || ''}</td>
                                <td>${play.dist || ''}</td>
                                <td>${play.hash === 'none' ? '' : play.hash}</td>
                                <td>${play.play || ''}</td>
                                <td>${play.vs_front === 'none' ? '' : play.vs_front}</td>
                                <td>${play.vs_coverage === 'none' ? '' : play.vs_coverage}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      `).join('')}
                    </body>
                  </html>
                `;

                printWindow.document.write(content);
                printWindow.document.close();
              }}
              className="gap-2 bg-[#2ECC70] hover:bg-[#27AE60] text-white hover:text-white border-[#2ECC70] cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print Script
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                const printWindow = window.open('', '_blank');
                if (!printWindow) return;

                // Collect cards with their context (section and play info)
                const cardsWithContext: Array<{
                  imageUrl: string;
                  sectionName: string;
                  playNumber: number;
                  playId: string;
                }> = [];

                sections.forEach((section: PracticeSection) => {
                  section.plays.forEach((play: PracticePlay) => {
                    if (play.scout_card) {
                      cardsWithContext.push({
                        imageUrl: play.scout_card.image_url,
                        sectionName: section.name,
                        playNumber: play.number,
                        playId: play.id
                      });
                    }
                  });
                });

                const content = `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Scout Cards</title>
                      <style>
                        body { 
                          font-family: Arial, sans-serif;
                          margin: 0;
                          padding: 20px;
                        }
                        .card-container {
                          width: 100%;
                          height: 100vh;
                          display: flex;
                          flex-direction: column;
                          justify-content: center;
                          align-items: center;
                          page-break-after: always;
                        }
                        .card-container:last-child {
                          page-break-after: avoid;
                        }
                        .card-header {
                          text-align: center;
                          margin-bottom: 20px;
                        }
                        .section-title {
                          font-size: 24px;
                          font-weight: bold;
                          margin-bottom: 5px;
                        }
                        .play-number {
                          font-size: 18px;
                          color: #666;
                        }
                        img {
                          max-width: 100%;
                          max-height: 80vh;
                          object-fit: contain;
                        }
                        @media print {
                          .no-print { display: none; }
                          @page { 
                            margin: 1cm;
                            size: portrait;
                          }
                          body {
                            padding: 0;
                          }
                          .card-container {
                            page-break-after: always;
                            margin: 0;
                            height: 100vh;
                          }
                        }
                      </style>
                    </head>
                    <body>
                      <div class="no-print">
                        <button onclick="window.print()">Print</button>
                        <hr>
                      </div>
                      ${cardsWithContext.map(card => `
                        <div class="card-container">
                          <div class="card-header">
                            <div class="section-title">${card.sectionName}</div>
                            <div class="play-number">Play #${card.playNumber}</div>
                          </div>
                          <img src="${card.imageUrl}" alt="Scout card">
                        </div>
                      `).join('')}
                    </body>
                  </html>
                `;

                printWindow.document.write(content);
                printWindow.document.close();
              }}
              className="gap-2 bg-[#2ECC70] hover:bg-[#27AE60] text-white hover:text-white border-[#2ECC70] cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print Cards
            </Button>
            <Button onClick={() => setIsAddSectionOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
            <Button onClick={handleSavePracticePlan} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Practice Plan'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowClearPlanDialog(true)}
              className="bg-red-500 hover:bg-red-600 text-white hover:text-white border-red-500"
              disabled={sections.length === 0}
            >
              Clear Practice Plan
            </Button>
          </div>
        </CardHeader>
      </Card>

      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <Input
                  type="text"
                  value={section.name}
                  onChange={(e) => {
                    const newSections = sections.map(s => 
                      s.id === section.id ? { ...s, name: e.target.value } : s
                    )
                    setSections(newSections)
                  }}
                  className="text-lg font-semibold border-none p-0 h-auto bg-transparent focus:bg-white focus:border focus:px-2 focus:py-1"
                />
                {section.name !== `${section.type} ${sections.filter(s => s.type === section.type).findIndex(s => s.id === section.id) + 1}` && (
                  <span className="text-sm text-gray-500 mt-1">Section Type: {section.type}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`play-count-${section.id}`} className="text-sm font-medium">Plays:</Label>
                <Input
                  id={`play-count-${section.id}`}
                  type="number"
                  min="1"
                  max="50"
                  value={section.play_count}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    if (value >= 1 && value <= 50) {
                      handlePlayCountChange(section.id, value)
                    }
                  }}
                  className="w-16 h-8"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => generatePlaysForSection(section)}
                className="text-blue-500 hover:text-blue-600"
                title="Auto-generate plays"
              >
                <Wand2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSelectedSectionForTemplate(section)
                  setShowSaveTemplateModal(true)
                }}
                className="text-green-500 hover:text-green-600"
                title="Save as template"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                setSections(sections.filter(s => s.id !== section.id))
              }}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left w-8">#</th>
                  <th className="p-2 text-left w-16">Set</th>
                  <th className="p-2 text-left w-20">Personnel</th>
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
                      <Select
                        value={play.set || "1"}
                        onValueChange={(value) => handlePlayChange(section.id, play.id, 'set', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Set" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Input
                        type="text"
                        value={play.personnel || ''}
                        className="h-8"
                        placeholder="11"
                        maxLength={8}
                        onChange={(e) => handlePlayChange(section.id, play.id, 'personnel', e.target.value)}
                      />
                    </td>
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
                      {renderScoutCardCell(play, section.id, play.id)}
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => {
                        const newPlays = [...section.plays]
                        newPlays.splice(playIndex, 1)
                        // Renumber remaining plays
                        newPlays.forEach((play, index) => {
                          play.number = index + 1
                        })
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

      <Dialog open={isAddSectionOpen} onOpenChange={(open) => {
        if (open) {
          fetchTemplates() // Load templates when dialog opens
        } else {
          setSelectedTemplateId('')
        }
        setIsAddSectionOpen(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Practice Section</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="section-type">Section Type</Label>
              <Select
                value={newSectionType}
                onValueChange={(value: 'Walk Through' | 'Inside Run' | 'Skelly' | 'Team') => {
                  setNewSectionType(value)
                  setSelectedTemplateId('') // Clear template selection when type changes
                }}
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
            
            <div>
              <Label htmlFor="template-select">Your Templates (Optional)</Label>
              {availableTemplates.length > 0 ? (
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger id="template-select">
                    <SelectValue placeholder={isLoadingTemplates ? "Loading templates..." : "Select a template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.template_name}
                        <span className="text-xs text-gray-500 ml-2">({template.section_type})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center justify-center p-3 border border-dashed border-gray-300 rounded-md bg-gray-50">
                  <span className="text-sm text-gray-500">No templates found - save a section to create your first template</span>
                </div>
              )}
              <p className="text-sm text-gray-500 mt-1">
                {selectedTemplateId ? "Using template structure with blank plays, fronts, and coverages" : "Create a new section from scratch"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddSectionOpen(false)
              setSelectedTemplateId('')
            }}>Cancel</Button>
            <Button onClick={handleAddSection}>
              {selectedTemplateId ? "Add From Template" : "Add New Section"}
            </Button>
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

      {/* Image Preview Dialog with Replace button */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => {
        if (!open) {
          setSelectedImage(null);
          setSelectedScoutCardPlay(null);
        }
      }}>
        <DialogContent 
          className="max-w-4xl w-[90vw] max-h-[90vh] flex flex-col p-0 overflow-hidden"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 50,
            margin: 0
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Scout Card Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Scout card"
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
          {/* Always show Replace button for scout cards */}
          {selectedImage && (
            <div className="p-4 bg-white border-t flex justify-center flex-shrink-0">
              <Button
                variant="outline"
                className="bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
                onClick={() => {
                  setShowAddScoutCardModal(true);
                  setSelectedImage(null); // Close the preview dialog
                }}
              >
                Replace
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Scout Card Modal */}
      {renderAddScoutCardModal()}

      {/* Save Template Modal */}
      <Dialog open={showSaveTemplateModal} onOpenChange={(open) => {
        if (!open) {
          setShowSaveTemplateModal(false)
          setSelectedSectionForTemplate(null)
          setTemplateName('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Section as Template</DialogTitle>
            <DialogDescription>
              Save this section as a reusable template. The template will include the section structure, down/distance, hash, set, and personnel, but plays, fronts, and coverages will be left blank for future customization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name..."
                maxLength={50}
              />
              <p className="text-sm text-gray-500">
                Choose a descriptive name for this template (e.g., "Red Zone Inside Run", "3rd Down Skelly")
              </p>
            </div>
            {selectedSectionForTemplate && (
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm font-medium">Section Details:</p>
                <p className="text-sm text-gray-600">Type: {selectedSectionForTemplate.type}</p>
                <p className="text-sm text-gray-600">Name: {selectedSectionForTemplate.name}</p>
                <p className="text-sm text-gray-600">Plays: {selectedSectionForTemplate.plays.length}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveTemplateModal(false)
                setSelectedSectionForTemplate(null)
                setTemplateName('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={saveAsTemplate}
              disabled={!templateName.trim() || isSavingTemplate}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {isSavingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Practice Plan Confirmation Dialog */}
      <AlertDialog open={showClearPlanDialog} onOpenChange={setShowClearPlanDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Entire Practice Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear your entire practice plan? This will remove all sections and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearPracticePlan}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Yes, Clear Practice Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
} 