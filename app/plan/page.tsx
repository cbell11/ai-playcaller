"use client"

import { useState, useEffect, useRef, MouseEventHandler, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, ArrowLeft, Trash2, GripVertical, Plus, Star, Check, Printer, Wand2, RefreshCw, Loader2, Search, Eye, Settings, Lock, LockOpen, Pencil } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { load, save } from "@/lib/local"
import { getPlayPool, Play } from "@/lib/playpool"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import Image from "next/image"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import React from "react"
import { Input } from "@/components/ui/input"

// Add this helper function near the top of the file
const isBrowser = typeof window !== 'undefined';

// Create Supabase browser client
const browserClient = createPagesBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper component for displaying a dragging item - currently unused but may be needed in future
function DragItem({ play }: { play: Play, snapshot: any }) {
  return (
    <div
      className={`p-2 rounded text-sm font-mono bg-blue-100 shadow-md border border-blue-300`}
      style={{
        // Add some shadow and rotation for better drag experience
        transform: 'rotate(2deg)',
        boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
        width: '300px',
        padding: '10px',
      }}
    >
      <span>{formatPlayFromPool(play)}</span>
    </div>
  );
}

// Add a global drag layer component
function DragLayer({ isDragging, play }: { isDragging: boolean, play: ExtendedPlay | null }) {
  if (!isDragging || !play) return null;
  
  return (
    <div 
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-50"
    >
      <div 
        className="absolute p-4 rounded bg-blue-100 shadow-lg border border-blue-300 font-mono text-sm"
        style={{ 
          transform: 'translate(-50%, -50%) rotate(3deg)',
          left: window.innerWidth / 2,
          top: window.innerHeight / 2,
          width: '300px',
          maxWidth: '90vw',
          zIndex: 9999,
          opacity: 0.9
        }}
      >
        <div className="font-bold mb-1">Adding to Game Plan:</div>
        {formatPlayFromPool(play)}
      </div>
    </div>
  );
}

// Define types for our plan structure
interface PlayCall {
  formation: string
  fieldAlignment: "+" | "-"  // + for field, - for boundary
  motion?: string  // optional motion
  play: string
  runDirection?: "+" | "-"  // + for field, - for boundary (only for run plays)
  category?: string  // Add this line
  is_locked?: boolean  // Add this line for tracking lock state
  customized_edit?: string  // Add this line for custom edits
}

// Add new types for the cascading dropdowns - currently unused but may be used in future versions
type ConceptCategory = 'run' | 'pass' | 'screen'

interface ConceptOption {
  category: ConceptCategory
  value: string
  label: string
}

interface GamePlan {
  openingScript: PlayCall[]; // Now can hold up to 10 plays
  basePackage1: PlayCall[]
  basePackage2: PlayCall[]
  basePackage3: PlayCall[]
  firstDowns: PlayCall[]
  secondAndShort: PlayCall[]
  secondAndLong: PlayCall[]
  shortYardage: PlayCall[]
  thirdAndShort: PlayCall[]
  thirdAndMedium: PlayCall[]
  thirdAndLong: PlayCall[]
  highRedZone: PlayCall[]
  lowRedZone: PlayCall[]
  goalline: PlayCall[]
  backedUp: PlayCall[]
  screens: PlayCall[]
  playAction: PlayCall[]
  deepShots: PlayCall[]
  twoMinuteDrill: PlayCall[]
  twoPointPlays: PlayCall[]
  firstSecondCombos: PlayCall[]
  coverage0Beaters: PlayCall[]
}

interface ExtendedPlay extends Play {
  combined_call?: string;
}

// Add new utility function to format a play from the play pool
function formatPlayFromPool(play: ExtendedPlay): string {
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

// Add categories for filtering
const CATEGORIES = {
  run_game: 'Run Game',
  rpo_game: 'RPO Game',
  quick_game: 'Quick Game',
  dropback_game: 'Dropback Game',
  shot_plays: 'Shot Plays',
  screen_game: 'Screen Game'
} as const

// Helper function to determine if a category is a pass play category
function isPassPlayCategory(category: string): boolean {
  return ['quick_game', 'dropback_game', 'shot_plays', 'rpo_game', 'screen_game'].includes(category);
}

// Add a helper function to convert Play type to PlayCall for the formatter
const playToPlayCall = (play: Play): PlayCall => {
  return {
    formation: play.formation || '',
    fieldAlignment: (play.strength as "+" | "-") || '+',
    motion: play.motion_shift || '',
    play: play.concept || play.pass_screen_concept || '',
    runDirection: (play.run_direction as "+" | "-") || '+'
  };
};

// Add a mapping of database section names to GamePlan keys
const sectionMapping: Record<string, keyof GamePlan> = {
  'openingscript': 'openingScript',
  'basepackage1': 'basePackage1',
  'basepackage2': 'basePackage2',
  'basepackage3': 'basePackage3',
  'firstdowns': 'firstDowns',
  'secondandshort': 'secondAndShort',
  'secondandlong': 'secondAndLong',
  'shortyardage': 'shortYardage',
  'thirdandshort': 'thirdAndShort',
  'thirdandmedium': 'thirdAndMedium',
  'shortyardage': 'shortYardage',
  'thirdandshort': 'thirdAndShort',
  'thirdandmedium': 'thirdAndMedium',
  'thirdandlong': 'thirdAndLong',
  'highredzone': 'highRedZone',
  'lowredzone': 'lowRedZone',
  'goalline': 'goalline',
  'backedup': 'backedUp',
  'screens': 'screens',
  'playaction': 'playAction',
  'deepshots': 'deepShots',
  'twominutedrill': 'twoMinuteDrill',
  'twopointplays': 'twoPointPlays',
  'firstsecondcombos': 'firstSecondCombos',
  'coverage0beaters': 'coverage0Beaters'
};

// Add initial section sizes configuration
const initialSectionSizes: Record<keyof GamePlan, number> = {
  openingScript: 10,
  basePackage1: 8,
  basePackage2: 8,
  basePackage3: 8,
  firstDowns: 8,
  secondAndShort: 5,
  secondAndLong: 5,
  shortYardage: 5,
  thirdAndShort: 5,
  thirdAndMedium: 5,
  thirdAndLong: 5,
  highRedZone: 5,
  lowRedZone: 5,
  goalline: 5,
  backedUp: 5,
  screens: 5,
  playAction: 5,
  deepShots: 5,
  twoMinuteDrill: 10,
  twoPointPlays: 4,
  firstSecondCombos: 4,
  coverage0Beaters: 5
};

// Add helper function to create empty plans
const createEmptyPlan = (sizes: Record<keyof GamePlan, number>): GamePlan => {
  const emptySlot = {
    formation: '',
    fieldAlignment: '+',
    motion: '',
    play: '',
    runDirection: '+',
    category: ''  // Add this line
  };

  return {
    openingScript: Array(sizes.openingScript).fill(emptySlot),
    basePackage1: Array(sizes.basePackage1).fill(emptySlot),
    basePackage2: Array(sizes.basePackage2).fill(emptySlot),
    basePackage3: Array(sizes.basePackage3).fill(emptySlot),
    firstDowns: Array(sizes.firstDowns).fill(emptySlot),
    secondAndShort: Array(sizes.secondAndShort).fill(emptySlot),
    secondAndLong: Array(sizes.secondAndLong).fill(emptySlot),
    shortYardage: Array(sizes.shortYardage).fill(emptySlot),
    thirdAndShort: Array(sizes.thirdAndShort).fill(emptySlot),
    thirdAndMedium: Array(sizes.thirdAndMedium).fill(emptySlot),
    thirdAndLong: Array(sizes.thirdAndLong).fill(emptySlot),
    redZone: Array(sizes.redZone).fill(emptySlot),
    goalline: Array(sizes.goalline).fill(emptySlot),
    backedUp: Array(sizes.backedUp).fill(emptySlot),
    screens: Array(sizes.screens).fill(emptySlot),
    playAction: Array(sizes.playAction).fill(emptySlot),
    deepShots: Array(sizes.deepShots).fill(emptySlot),
    twoMinuteDrill: Array(sizes.twoMinuteDrill).fill(emptySlot),
    twoPointPlays: Array(sizes.twoPointPlays).fill(emptySlot),
    firstSecondCombos: Array(sizes.firstSecondCombos * 2).fill(emptySlot), // 8 combos = 16 individual plays
    coverage0Beaters: Array(sizes.coverage0Beaters).fill(emptySlot)
  };
};

// Modify savePlayToGamePlan function to handle sequential positions
async function savePlayToGamePlan(
  play: ExtendedPlay,
  section: keyof GamePlan,
  position: number
): Promise<void> {
  try {
    // Get team_id and opponent_id from localStorage
    const team_id = isBrowser ? localStorage.getItem('selectedTeam') : null;
    const opponent_id = isBrowser ? localStorage.getItem('selectedOpponent') : null;

    if (!team_id || !opponent_id) {
      throw new Error('Please select both a team and opponent in the sidebar first');
    }

    // First, get the current highest position for this section
    const { data: existingPlays, error: queryError } = await browserClient
      .from('game_plan')
      .select('position')
      .eq('team_id', team_id)
      .eq('opponent_id', opponent_id)
      .eq('section', section.toLowerCase())
      .order('position', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error('Error querying current positions:', queryError);
      throw queryError;
    }

    // Calculate the next position (if no plays exist, start at 0)
    const nextPosition = existingPlays && existingPlays.length > 0 ? 
      existingPlays[0].position + 1 : 0;

    console.log('Saving play to game plan:', {
      team_id,
      opponent_id,
      play_id: play.id,
      section: section.toLowerCase(),
      position: nextPosition,
      combined_call: formatPlayFromPool(play),
      customized_edit: play.customized_edit
    });

    // Create the game plan entry with team and opponent IDs
    const { data, error } = await browserClient
      .from('game_plan')
      .insert({
        team_id,
        opponent_id,
        play_id: play.id,
        section: section.toLowerCase(),
        position: nextPosition,
        combined_call: formatPlayFromPool(play),
        customized_edit: play.customized_edit
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      throw new Error(`Database error: ${error.message}`);
    }

    console.log('Successfully saved play to game plan:', data);
  } catch (error) {
    console.error('Error saving play to game plan:', error);
    throw error;
  }
}

// Simplify validateTeamIds to just return the IDs without validation
async function validateTeamIds(): Promise<{ team_id: string | null; opponent_id: string | null }> {
  const team_id = isBrowser ? localStorage.getItem('selectedTeam') : null;
  const opponent_id = isBrowser ? localStorage.getItem('selectedOpponent') : null;
  return { team_id, opponent_id };
}

// Add this function to create a play if it doesn't exist
async function ensurePlayExists(play: ExtendedPlay): Promise<{ id: string | null; error: string | null }> {
  try {
    // If play doesn't exist, create it
    const { data, error } = await browserClient
      .from('plays')
      .insert({
        id: play.id,
        play_id: play.play_id,
        team_id: play.team_id,
        category: play.category,
        formation: play.formation,
        tag: play.tag,
        strength: play.strength,
        motion_shift: play.motion_shift,
        concept: play.concept,
        run_concept: play.run_concept,
        run_direction: play.run_direction,
        pass_screen_concept: play.pass_screen_concept,
        screen_direction: play.screen_direction,
        front_beaters: play.front_beaters,
        coverage_beaters: play.coverage_beaters,
        blitz_beaters: play.blitz_beaters,
        is_enabled: play.is_enabled,
        is_locked: play.is_locked,
        is_favorite: play.is_favorite,
        customized_edit: play.customized_edit,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating play:', error);
      return { id: null, error: `Failed to create play: ${error.message}` };
    }

    return { id: data.id, error: null };
  } catch (error) {
    console.error('Error in ensurePlayExists:', error);
    return { 
      id: null, 
      error: error instanceof Error ? error.message : 'Unknown error creating play' 
    };
  }
}

// Add this function after savePlayToGamePlan
async function deletePlayFromGamePlan(
  section: keyof GamePlan,
  position: number
): Promise<void> {
  try {
    // Get team_id and opponent_id from localStorage
    const team_id = typeof window !== 'undefined' ? localStorage.getItem('selectedTeam') : null
    const opponent_id = typeof window !== 'undefined' ? localStorage.getItem('selectedOpponent') : null

    if (!team_id || !opponent_id) {
      throw new Error('Team or opponent not selected')
    }

    // Delete the game plan entry
    const { error } = await browserClient
      .from('game_plan')
      .delete()
      .eq('team_id', team_id)
      .eq('opponent_id', opponent_id)
      .eq('section', section.toLowerCase())
      .eq('position', position)

    if (error) {
      console.error('Error deleting play from game plan:', error)
      throw error
    }
  } catch (error) {
    console.error('Failed to delete play from game plan:', error)
    throw error
  }
}

// Add this function after deletePlayFromGamePlan
async function updatePlayPosition(
  section: keyof GamePlan,
  oldPosition: number,
  newPosition: number
): Promise<void> {
  try {
    // Get team_id and opponent_id from localStorage
    const team_id = typeof window !== 'undefined' ? localStorage.getItem('selectedTeam') : null
    const opponent_id = typeof window !== 'undefined' ? localStorage.getItem('selectedOpponent') : null

    if (!team_id || !opponent_id) {
      throw new Error('Team or opponent not selected')
    }

    // First, get the play at the old position
    const { data: play, error: fetchError } = await browserClient
      .from('game_plan')
      .select('*')
      .eq('team_id', team_id)
      .eq('opponent_id', opponent_id)
      .eq('section', section.toLowerCase())
      .eq('position', oldPosition)
      .single()

    if (fetchError) {
      console.error('Error fetching play for position update:', fetchError)
      throw fetchError
    }

    if (!play) {
      console.log('No play found at position to update')
      return
    }

    // Update the position
    const { error: updateError } = await browserClient
      .from('game_plan')
      .update({ position: newPosition })
      .eq('id', play.id)

    if (updateError) {
      console.error('Error updating play position:', updateError)
      throw updateError
    }
  } catch (error) {
    console.error('Failed to update play position:', error)
    throw error
  }
}

// Add this function after the other async functions
async function fetchGamePlanFromDatabase(currentSectionSizes: Record<keyof GamePlan, number>): Promise<GamePlan | null> {
  try {
    const team_id = isBrowser ? localStorage.getItem('selectedTeam') : null;
    const opponent_id = isBrowser ? localStorage.getItem('selectedOpponent') : null;

    if (!team_id || !opponent_id) {
      console.log('Team or opponent not selected');
      return null;
    }

    console.log('Fetching game plan for:', { team_id, opponent_id });

    // Fetch all plays for this team and opponent
    const { data: gamePlanData, error } = await browserClient
      .from('game_plan')
      .select(`
        *,
        play:play_id (
          category
        )
      `)
      .eq('team_id', team_id)
      .eq('opponent_id', opponent_id)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching game plan:', error.message, error.details);
      return null;
    }

    // Create an empty game plan using current section sizes
    const emptyPlan = createEmptyPlan(currentSectionSizes);

    // Group plays by section while maintaining their order
    const sectionPlays: Record<keyof GamePlan, PlayCall[]> = {} as Record<keyof GamePlan, PlayCall[]>;

    // Initialize empty arrays for each section
    Object.keys(currentSectionSizes).forEach((section) => {
      sectionPlays[section as keyof GamePlan] = [];
    });

    // Group plays by section
    gamePlanData?.forEach((entry) => {
        const dbSection = entry.section.toLowerCase();
        const section = sectionMapping[dbSection];
      
        if (!section) {
          console.warn(`No mapping found for database section "${dbSection}"`);
          return;
        }

        // Create PlayCall object from the entry data
        const playCall: PlayCall = {
          formation: '',
          fieldAlignment: '+',
          motion: '',
          play: entry.customized_edit || entry.combined_call || '',
          runDirection: '+',
          category: entry.play?.category || entry.category,
          is_locked: entry.is_locked || false // Add this line to include lock state
        };

      // Add the play to its section array
      sectionPlays[section].push(playCall);
    });

    // Now populate each section in the plan with the correct number of plays
    Object.entries(currentSectionSizes).forEach(([section, size]) => {
      const sectionKey = section as keyof GamePlan;
      const plays = sectionPlays[sectionKey];
      
      // Take only as many plays as will fit in the section
      const filledPlays = plays.slice(0, size);

      // Create empty slots for the remaining positions
      const emptySlots = Array(size - filledPlays.length).fill({
        formation: '',
        fieldAlignment: '+',
        motion: '',
        play: '',
        runDirection: '+',
        category: ''  // Add this line
      });

      // Update the plan with filled plays followed by empty slots
      emptyPlan[sectionKey] = [...filledPlays, ...emptySlots];
    });

    return emptyPlan;
  } catch (error) {
    console.error('Error in fetchGamePlanFromDatabase:', error instanceof Error ? error.message : error);
    return null;
  }
}

// Modify the updatePlayPositionsInDatabase function with better error handling
async function updatePlayPositionsInDatabase(
  section: string,
  team_id: string,
  opponent_id: string,
  updates: { play: PlayCall; oldPosition: number; newPosition: number }[]
): Promise<void> {
  try {
    console.log('Attempting to update positions in database:', {
      section,
      team_id,
      opponent_id,
      updates: updates.map(u => ({
        oldPos: u.oldPosition,
        newPos: u.newPosition,
        play: u.play.play
      }))
    });

    // First verify we have the function available
    const { data: functions, error: functionError } = await browserClient
      .rpc('update_game_plan_positions', {
        p_team_id: team_id,
        p_opponent_id: opponent_id,
        p_section: section.toLowerCase(),
        p_old_positions: updates.map(u => u.oldPosition),
        p_new_positions: updates.map(u => u.newPosition)
      });

    if (functionError) {
      console.error('Detailed error from Supabase:', {
        message: functionError.message,
        details: functionError.details,
        hint: functionError.hint,
        code: functionError.code
      });
      throw new Error(`Database error: ${functionError.message}`);
    }

    console.log('Successfully updated positions in database');
  } catch (error) {
    console.error('Failed to update positions:', error);
    if (error instanceof Error) {
      throw new Error(`Position update failed: ${error.message}`);
    } else {
      throw new Error('Position update failed: Unknown error');
    }
  }
}

// Add this near the top with other interfaces
interface CategoryColors {
  run_game: string;
  rpo_game: string;
  quick_game: string;
  dropback_game: string;
  screen_game: string;
  shot_plays: string;
}

interface MasterPlay {
  formations: string;
  to_motions: string;
  concept: string;
  category: string;
  coverage_beaters: string | null;
}

export default function PlanPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<GamePlan | null>(() => load('plan', null))
  const [loading, setLoading] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [selectedSection, setSelectedSection] = useState<keyof GamePlan | null>(null)
  const [draggingPlay, setDraggingPlay] = useState<ExtendedPlay | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isManualBuildMode, setIsManualBuildMode] = useState(false)
  const [playPool, setPlayPool] = useState<ExtendedPlay[]>([])
  const [showPlayPool, setShowPlayPool] = useState(false)
  const [playPoolCategory, setPlayPoolCategory] = useState<'run_game' | 'rpo_game' | 'quick_game' | 'dropback_game' | 'shot_plays' | 'screen_game'>('run_game')
  const [playPoolSection, setPlayPoolSection] = useState<keyof GamePlan | null>(null)
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null)
  const [playPoolFilterType, setPlayPoolFilterType] = useState<'category' | 'favorites' | 'search'>('category')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ExtendedPlay[]>([])
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('landscape')
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [sectionSizes, setSectionSizes] = useState<Record<keyof GamePlan, number>>(initialSectionSizes)
  const [selectedOpponentName, setSelectedOpponentName] = useState<string | null>(null)
  const [sectionVisibility, setSectionVisibility] = useState<Record<keyof GamePlan, boolean>>(() => {
    const initialVisibility: Record<keyof GamePlan, boolean> = {} as Record<keyof GamePlan, boolean>
    Object.keys(initialSectionSizes).forEach((key) => {
      initialVisibility[key as keyof GamePlan] = true
    })
    return initialVisibility
  })
  const [showVisibilitySettings, setShowVisibilitySettings] = useState(false)
  const [showColorSettings, setShowColorSettings] = useState(false)
  const [categoryColors, setCategoryColors] = useState<CategoryColors>(() => {
    if (!isBrowser) return {
      run_game: 'bg-green-100',
      rpo_game: 'bg-red-100',
      quick_game: 'bg-blue-100',
      dropback_game: 'bg-orange-100',
      screen_game: 'bg-purple-100',
      shot_plays: 'bg-yellow-200'
    };
    
    const savedColors = localStorage.getItem('categoryColors');
    return savedColors ? JSON.parse(savedColors) : {
      run_game: 'bg-green-100',
      rpo_game: 'bg-red-100',
      quick_game: 'bg-blue-100',
      dropback_game: 'bg-orange-100',
      screen_game: 'bg-purple-100',
      shot_plays: 'bg-yellow-200'
    };
  })

  // Add this near other state declarations
  const [customSectionNames, setCustomSectionNames] = useState<Record<string, string>>(() => {
    if (!isBrowser) return {};
    const saved = localStorage.getItem('customSectionNames');
    return saved ? JSON.parse(saved) : {
      basePackage1: 'Base Package 1',
      basePackage2: 'Base Package 2',
      basePackage3: 'Base Package 3'
    };
  });

  // Add this near other state declarations
  const [basePackageConcepts, setBasePackageConcepts] = useState<Record<string, string>>(() => {
    if (!isBrowser) return {
      basePackage1: '',
      basePackage2: '',
      basePackage3: ''
    };
    
    const saved = localStorage.getItem('basePackageConcepts');
    return saved ? JSON.parse(saved) : {
      basePackage1: '',
      basePackage2: '',
      basePackage3: ''
    };
  });

  // Add this near other state declarations
  const [uniqueConcepts, setUniqueConcepts] = useState<string[]>([]);

  // Add new state for edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlay, setEditingPlay] = useState<{ section: keyof GamePlan; index: number; text: string } | null>(null);

  // Replace handleEditPlay with this new version
  const handleEditPlay = (section: keyof GamePlan, index: number) => {
    if (!plan) return;
    
    const currentPlay = plan[section][index];
    if (!currentPlay || !currentPlay.play) return;
    
    setEditingPlay({
      section,
      index,
      text: currentPlay.customized_edit || currentPlay.play
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPlay || !plan) return;
    
    try {
      const team_id = localStorage.getItem('selectedTeam');
      const opponent_id = localStorage.getItem('selectedOpponent');
      
      if (!team_id || !opponent_id) {
        throw new Error('Team or opponent not selected');
      }
      
      const { section, index, text } = editingPlay;
      
      // Update the customized_edit in the database
      const { error } = await browserClient
        .from('game_plan')
        .update({ customized_edit: text })
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id)
        .eq('section', section.toLowerCase())
        .eq('position', index);
        
      if (error) throw error;
      
      // Update local state
      const updatedPlan = { ...plan };
      updatedPlan[section][index] = {
        ...updatedPlan[section][index],
        customized_edit: text
      };
      setPlan(updatedPlan);
      
      setNotification({
        message: 'Play updated successfully',
        type: 'success'
      });
      
    } catch (error) {
      console.error('Error editing play:', error);
      setNotification({
        message: 'Failed to save edited play',
        type: 'error'
      });
    } finally {
      setEditDialogOpen(false);
      setEditingPlay(null);
    }
  };

  const handleResetEdit = async () => {
    if (!editingPlay || !plan) return;
    
    try {
      const team_id = localStorage.getItem('selectedTeam');
      const opponent_id = localStorage.getItem('selectedOpponent');
      
      if (!team_id || !opponent_id) {
        throw new Error('Team or opponent not selected');
      }
      
      const { section, index } = editingPlay;
      const currentPlay = plan[section][index];
      
      // Reset the customized_edit to null in the database
      const { error } = await browserClient
        .from('game_plan')
        .update({ customized_edit: null })
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id)
        .eq('section', section.toLowerCase())
        .eq('position', index);
        
      if (error) throw error;
      
      // Update local state
      const updatedPlan = { ...plan };
      updatedPlan[section][index] = {
        ...updatedPlan[section][index],
        customized_edit: undefined // Use undefined instead of null to match the type
      };
      setPlan(updatedPlan);
      
      // Close the dialog
      setEditDialogOpen(false);
      setEditingPlay(null);
      
      setNotification({
        message: 'Play reset to default. Refresh the page to see default plays.',
        type: 'success'
      });
      
    } catch (error) {
      console.error('Error resetting play:', error);
      setNotification({
        message: 'Failed to reset play',
        type: 'error'
      });
    }
  };

  const handleToggleLock = async (section: keyof GamePlan, index: number) => {
    if (!plan) return;
    
    const currentPlay = plan[section][index];
    if (!currentPlay || !currentPlay.play) return; // Don't toggle empty slots
    
    const newLockedState = !currentPlay.is_locked;
    
    try {
      const team_id = localStorage.getItem('selectedTeam');
      const opponent_id = localStorage.getItem('selectedOpponent');
      
      if (!team_id || !opponent_id) {
        throw new Error('Team or opponent not selected');
      }
      
      // Update the lock state in the database
      const { error } = await browserClient
        .from('game_plan')
        .update({ is_locked: newLockedState })
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id)
        .eq('section', section.toLowerCase())
        .eq('position', index);
        
      if (error) throw error;
      
      // Update local state
      const updatedPlan = { ...plan };
      updatedPlan[section][index] = {
        ...currentPlay,
        is_locked: newLockedState
      };
      setPlan(updatedPlan);
      
    } catch (error) {
      console.error('Error toggling lock:', error);
      setNotification({
        message: 'Failed to toggle lock state',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Add state declarations at the top with other states
  const [basePackageFormations, setBasePackageFormations] = useState<Record<string, string>>(() => {
    if (!isBrowser) return {
      basePackage1: '',
      basePackage2: '',
      basePackage3: ''
    };
    
    const saved = localStorage.getItem('basePackageFormations');
    return saved ? JSON.parse(saved) : {
      basePackage1: '',
      basePackage2: '',
      basePackage3: ''
    };
  });
  const [uniqueFormations, setUniqueFormations] = useState<string[]>([]);

  // Add this function to handle name updates
  const handleSectionNameChange = (section: string, newName: string) => {
    const updated = { ...customSectionNames, [section]: newName };
    setCustomSectionNames(updated);
    if (isBrowser) {
      localStorage.setItem('customSectionNames', JSON.stringify(updated));
    }
  };

  // Add this function to handle concept changes
  const handleConceptChange = (section: string, concept: string) => {
    // If selecting a concept and there's already a formation selected
    if (concept && basePackageFormations[section]) {
      setNotification({
        message: 'Please clear formation focus before selecting a concept focus',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const updated = { ...basePackageConcepts, [section]: concept };
    setBasePackageConcepts(updated);
    if (isBrowser) {
      localStorage.setItem('basePackageConcepts', JSON.stringify(updated));
    }
  };

  // Add this function to handle formation changes
  const handleFormationChange = (section: string, formation: string) => {
    // If selecting a formation and there's already a concept selected
    if (formation && basePackageConcepts[section]) {
      setNotification({
        message: 'Please clear concept focus before selecting a formation focus',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const updated = { ...basePackageFormations, [section]: formation };
    setBasePackageFormations(updated);
    if (isBrowser) {
      localStorage.setItem('basePackageFormations', JSON.stringify(updated));
    }
  };

  const componentRef = useRef<HTMLDivElement>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // Add section-specific loading state
  const [generatingSection, setGeneratingSection] = useState<keyof GamePlan | null>(null)

  // Add state for dialog open state
  const [dialogOpen, setDialogOpen] = useState<Record<string, boolean>>({});

  // Add this near other state declarations
  const handleDialogOpenChange = (section: string, open: boolean) => {
    setDialogOpen(prev => ({ ...prev, [section]: open }));
  };

  useEffect(() => {
    const fetchOpponentName = async () => {
      if (selectedOpponent) {
        const { data, error } = await browserClient
          .from('opponents')
          .select('name')
          .eq('id', selectedOpponent)
          .single()

        if (error) {
          console.error('Error fetching opponent name:', error)
          setSelectedOpponentName(null)
        } else if (data) {
          setSelectedOpponentName(data.name)
        }
      } else {
        setSelectedOpponentName(null)
      }
    }

    fetchOpponentName()
  }, [selectedOpponent])

  const printHandler = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Game Plan',
    onAfterPrint: () => {
      console.log('Print completed');
      setShowPrintDialog(false);
    },
    pageStyle: `
      @page {
        size: ${printOrientation};
        margin: 10mm;
      }
    `
  })

  const handlePrint: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.preventDefault();
    setShowPrintDialog(true);
  };

  // Helper function to format a play call using labels instead of concepts
  const formatPlayCall = (play: PlayCall) => {
    // If the play field already contains spaces, it's likely a full formatted string
    if (play.play && play.play.includes(' ')) {
      return play.play;
    }
    
    // Otherwise, use the existing formatting logic
    // Convert full formation name to abbreviated format
    let formationLabel = play.formation;
    if (play.formation === 'Trips') formationLabel = 'trps';
    if (play.formation === 'Deuce') formationLabel = 'duce';
    if (play.formation === 'Trey') formationLabel = 'trey';
    if (play.formation === 'Empty') formationLabel = 'mt';
    if (play.formation === 'Queen') formationLabel = 'q';
    if (play.formation === 'Sam') formationLabel = 'sam';
    if (play.formation === 'Will') formationLabel = 'will';
    if (play.formation === 'Bunch') formationLabel = 'bunch';
    
    // Find the label for the motion if it exists
    let motionLabel = play.motion;
    if (play.motion === 'Jet') motionLabel = 'jet';
    if (play.motion === 'Orbit') motionLabel = 'orb';
    if (play.motion === 'Shift') motionLabel = 'zm';
    
    // Convert full concept name to abbreviated format
    let playLabel = play.play;
    // Run concepts
    if (play.play === 'Inside Zone') playLabel = 'iz';
    if (play.play === 'Outside Zone') playLabel = 'oz';
    if (play.play === 'Power') playLabel = 'pwr';
    if (play.play === 'Counter') playLabel = 'ctr';
    if (play.play === 'Draw') playLabel = 'drw';
    // Pass concepts
    if (play.play === 'Hoss') playLabel = 'hoss';
    if (play.play === 'Stick') playLabel = 'stick';
    if (play.play === 'Quick Out') playLabel = 'qo';
    if (play.play === 'Slot Fade') playLabel = 'slfade';
    if (play.play === 'Snag') playLabel = 'snag';
    // Screen concepts
    if (play.play === 'Bubble') playLabel = 'bub';
    if (play.play === 'Tunnel') playLabel = 'tnl';
    if (play.play === 'Quick') playLabel = 'qck';
    
    // Check if it's a run play and add direction if needed
    const runConcepts = ['Inside Zone', 'Outside Zone', 'Power', 'Counter', 'Draw'];
    const isRunPlay = runConcepts.includes(play.play);
    const runDirectionText = isRunPlay && play.runDirection ? ` ${play.runDirection}` : '';
    
    return `${formationLabel} ${play.fieldAlignment}${motionLabel ? ` ${motionLabel}` : ''} ${playLabel}${runDirectionText}`;
  }

  // Load saved section sizes on mount
  useEffect(() => {
    if (!isBrowser) return;
    
    const savedSizes = localStorage.getItem('sectionSizes');
    if (savedSizes) {
      try {
        const parsed = JSON.parse(savedSizes);
        // Validate that all required sections are present
        const isValid = Object.keys(initialSectionSizes).every(key => 
          typeof parsed[key] === 'number' && parsed[key] >= 1 && parsed[key] <= 20
        );
        
        if (isValid) {
          setSectionSizes(parsed);
        } else {
          console.warn('Invalid saved section sizes, using defaults');
          if (isBrowser) {
          localStorage.setItem('sectionSizes', JSON.stringify(initialSectionSizes));
          }
        }
      } catch (error) {
        console.error('Error loading saved section sizes:', error);
        if (isBrowser) {
        localStorage.setItem('sectionSizes', JSON.stringify(initialSectionSizes));
        }
      }
    } else {
      // If no saved sizes exist, save the initial sizes
      if (isBrowser) {
      localStorage.setItem('sectionSizes', JSON.stringify(initialSectionSizes));
      }
    }
  }, []);

  // Add effect to load initial data
  const loadInitialData = useCallback(async () => {
      try {
        setLoading(true);
        console.log('Loading initial data...');

        // Get team and opponent IDs from localStorage
      const teamId = isBrowser ? localStorage.getItem('selectedTeam') : null;
      const opponentId = isBrowser ? localStorage.getItem('selectedOpponent') : null;

        if (!teamId || !opponentId) {
          console.log('No team or opponent selected');
        setLoading(false);
        return;
      }

        setSelectedTeam(teamId);
        setSelectedOpponent(opponentId);

      // Get saved section sizes
      const savedSizes = isBrowser ? localStorage.getItem('sectionSizes') : null;
      const currentSizes = savedSizes ? JSON.parse(savedSizes) : initialSectionSizes;

      // Load game plan with current sizes
      const initialPlan = await fetchGamePlanFromDatabase(currentSizes);
        if (initialPlan) {
          console.log('Loaded initial game plan');
          setPlan(initialPlan);
        if (isBrowser) {
          save('plan', initialPlan);
        }
        }

        // Load play pool
        console.log('Loading initial plays...');
        const playData = await getPlayPool();
        console.log('Initial plays loaded:', playData.length);
        setPlayPool(playData);
        
        // Reset play pool related states
        setShowPlayPool(false);
        setPlayPoolSection(null);
        setPlayPoolCategory('run_game');
        setPlayPoolFilterType('category');

        // Set up real-time subscription
        console.log('Setting up real-time subscription for:', { teamId, opponentId });
        
        const subscription = browserClient
          .channel('game_plan_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'game_plan',
              filter: `team_id=eq.${teamId}&opponent_id=eq.${opponentId}`
            },
            async (payload) => {
              console.log('Received database change:', payload);
              try {
              // Get current section sizes for the update
              const currentSizes = isBrowser ? 
                JSON.parse(localStorage.getItem('sectionSizes') || JSON.stringify(initialSectionSizes)) :
                initialSectionSizes;
              const updatedPlan = await fetchGamePlanFromDatabase(currentSizes);
                if (updatedPlan) {
                  console.log('Updating plan from real-time change');
                  setPlan(updatedPlan);
                if (isBrowser) {
                  save('plan', updatedPlan);
                }
        }
        } catch (error) {
                console.error('Error handling real-time update:', error);
              }
            }
          )
          .subscribe((status) => {
            console.log('Subscription status:', status);
          });

        return () => {
          console.log('Cleaning up subscription');
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError('Failed to load game plan. Please try again.');
        } finally {
        setLoading(false);
      }
  }, [setLoading, setSelectedTeam, setSelectedOpponent, setPlan, setPlayPool, setShowPlayPool, setPlayPoolSection, setPlayPoolCategory, setPlayPoolFilterType, setError]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Update the opponent change effect to load data
  const handleOpponentChange = useCallback(async (event: Event) => {
      const customEvent = event as CustomEvent<{ opponentId: string }>;
      console.log('Opponent changed from sidebar, updating state...');
      const opponentId = customEvent.detail.opponentId;
      setSelectedOpponent(opponentId);

      // Load game plan data
      try {
        setLoading(true);
      const teamId = isBrowser ? localStorage.getItem('selectedTeam') : null;
        if (!teamId) {
          throw new Error('No team selected');
        }

        // Load game plan
      const updatedPlan = await fetchGamePlanFromDatabase(sectionSizes);
        if (updatedPlan) {
          console.log('Updating plan from opponent change');
          setPlan(updatedPlan);
        if (isBrowser) {
          save('plan', updatedPlan);
        }
        }

        // Load play pool
        console.log('Loading plays for new opponent...');
        const playData = await getPlayPool();
        console.log('Plays loaded:', playData.length);
        setPlayPool(playData);
        
        // Reset play pool related states
        setShowPlayPool(false);
        setPlayPoolSection(null);
        setPlayPoolCategory('run_game');
        setPlayPoolFilterType('category');
      } catch (error) {
        console.error('Failed to load data for new opponent:', error);
      } finally {
        setLoading(false);
      }
  }, [setSelectedOpponent, setLoading, setPlan, setPlayPool, setShowPlayPool, setPlayPoolSection, setPlayPoolCategory, setPlayPoolFilterType]);

  useEffect(() => {
    window.addEventListener('opponentChanged', handleOpponentChange);
    return () => {
      window.removeEventListener('opponentChanged', handleOpponentChange);
    };
  }, [handleOpponentChange]);

  // Update the storage change handler
  const handleStorageChange = useCallback(async (e: StorageEvent) => {
    if (!isBrowser) return;
    
    if (e.key === 'selectedOpponent' && e.newValue !== e.oldValue) {
      console.log('Opponent changed in storage, updating state...');
      setSelectedOpponent(e.newValue);

      // Load game plan data
      try {
        setLoading(true);
        const teamId = isBrowser ? localStorage.getItem('selectedTeam') : null;
        if (!teamId) {
          throw new Error('No team selected');
        }

        // Load game plan
        const updatedPlan = await fetchGamePlanFromDatabase(sectionSizes);
        if (updatedPlan) {
          console.log('Updating plan from storage change');
          setPlan(updatedPlan);
          if (isBrowser) {
          save('plan', updatedPlan);
          }
        }

        // Load play pool
        console.log('Loading plays for new opponent...');
        const playData = await getPlayPool();
        console.log('Plays loaded:', playData.length);
        setPlayPool(playData);
        
        // Reset play pool related states
        setShowPlayPool(false);
        setPlayPoolSection(null);
        setPlayPoolCategory('run_game');
        setPlayPoolFilterType('category');
      } catch (error) {
        console.error('Failed to load data for new opponent:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [setSelectedOpponent, setLoading, setPlan, setPlayPool, setShowPlayPool, setPlayPoolSection, setPlayPoolCategory, setPlayPoolFilterType]);

  // Update the main team/opponent effect
  useEffect(() => {
    if (!isBrowser) return;
    
    const team = localStorage.getItem('selectedTeam');
    const opponent = localStorage.getItem('selectedOpponent');
    
    setSelectedTeam(team);
    setSelectedOpponent(opponent);
    
    window.addEventListener('storage', handleStorageChange);
    
    if (team && opponent) {
      console.log('Setting up real-time subscription for:', { team, opponent });
      
      const subscription = browserClient
        .channel('game_plan_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_plan',
            filter: `team_id=eq.${team}&opponent_id=eq.${opponent}`
          },
          async (payload) => {
            console.log('Received database change:', payload);
            try {
              const updatedPlan = await fetchGamePlanFromDatabase(sectionSizes);
              if (updatedPlan) {
                console.log('Updating plan from real-time change');
                setPlan(updatedPlan);
                save('plan', updatedPlan);
              }
      } catch (error) {
              console.error('Error handling real-time update:', error);
            }
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
        });

      return () => {
        console.log('Cleaning up subscription and storage listener');
        subscription.unsubscribe();
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [handleStorageChange, setSelectedTeam, setSelectedOpponent, setPlan]); // Remove sectionSizes from dependencies

  // Update the play pool loading effect to depend on selectedOpponent only
  useEffect(() => {
    async function loadPlays() {
      if (!selectedOpponent) {
        setPlayPool([]);
        return;
      }

      try {
        setLoading(true);
        console.log('Loading plays for new opponent...');
        const playData = await getPlayPool();
        console.log('Plays loaded:', playData.length);
        setPlayPool(playData);
        
        // Reset play pool related states
        setShowPlayPool(false);
        setPlayPoolSection(null);
        setPlayPoolCategory('run_game');
        setPlayPoolFilterType('category');
      } catch (error) {
        console.error('Failed to load play pool:', error);
        setPlayPool([]);
      } finally {
        setLoading(false);
      }
    }
    loadPlays();
  }, [selectedOpponent]); // Remove sectionSizes from dependencies

  // Add effect to populate unique concepts and formations from playpool
  useEffect(() => {
    if (!playPool.length) return;

    // Get unique concepts from the playpool using Object.keys and reduce
    const uniqueConceptsMap = playPool.reduce((acc, play) => {
      if (play.concept) {
        acc[play.concept] = true;
      }
      return acc;
    }, {} as Record<string, boolean>);

    // Get unique formations from the playpool
    const uniqueFormationsMap = playPool.reduce((acc, play) => {
      console.log('Processing play for formations:', { 
        playId: play.id,
        formation: play.formation,
        category: play.category 
      });
      if (play.formations) {
        acc[play.formations] = true;
      }
      return acc;
    }, {} as Record<string, boolean>);

    const concepts = Object.keys(uniqueConceptsMap).sort();
    const formations = Object.keys(uniqueFormationsMap).sort();
    console.log('Found formations:', formations);
    
    console.log('Setting concepts:', concepts);
    console.log('Setting formations:', formations);
    setUniqueConcepts(concepts);
    setUniqueFormations(formations);
  }, [playPool]);

  // Handle before drag start
  const handleBeforeDragStart = (start: any) => {
    console.log("Drag start:", JSON.stringify(start, null, 2));
    setIsDragging(true);
    
    // Check if dragging from play pool
    if (start.source.droppableId === 'pool-plays') {
      console.log("Dragging from play pool");
      const playId = start.draggableId.split('-')[1];
      console.log("Trying to find play with ID:", playId);
      console.log("Available play IDs:", playPool.map(p => p.id));
      
      const play = playPool.find(p => p.id === playId);
      if (play) {
        console.log("Found dragging play:", play);
        setDraggingPlay(play);
      } else {
        console.log("Play not found for ID:", playId);
        setDraggingPlay(null);
      }
    } else {
      setDraggingPlay(null);
    }
  };

  // Modify handleDragEnd to update positions in database
  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    setDraggingPlay(null);
    
    console.log("Drag end result:", JSON.stringify(result, null, 2));
    
    if (!result.destination) {
      console.log("No destination");
      return;
    }
    
    try {
      // Handle reordering within a section
      if (result.source.droppableId === result.destination.droppableId) {
        const sectionId = result.source.droppableId.split('-')[1] as keyof GamePlan;
        
        if (!plan || !plan[sectionId]) {
          throw new Error('Invalid plan or section');
        }

        const team_id = localStorage.getItem('selectedTeam');
        const opponent_id = localStorage.getItem('selectedOpponent');

        if (!team_id || !opponent_id) {
          throw new Error('Team or opponent not selected');
        }
        
        // Make a copy of the current plan
        const updatedPlan = { ...plan };
        const updatedPlays = [...updatedPlan[sectionId]];
        
        // Get the play being moved
        const [movedPlay] = updatedPlays.splice(result.source.index, 1);
        
        // Only proceed with database update if it's not an empty play
        if (movedPlay.play) {
          const sourceIdx = result.source.index;
          const destIdx = result.destination.index;
          
          console.log('Attempting to reorder play:', {
            section: sectionId,
            play: movedPlay.play,
            from: sourceIdx,
            to: destIdx,
            team_id,
            opponent_id
          });

          // First, get all plays in this section
          const { data: sectionPlays, error: fetchError } = await browserClient
            .from('game_plan')
            .select('*')
            .eq('team_id', team_id)
            .eq('opponent_id', opponent_id)
            .eq('section', sectionId.toLowerCase())
            .order('position', { ascending: true });

          if (fetchError) {
            throw new Error(`Failed to fetch section plays: ${fetchError.message}`);
          }

          // Create an array of updates for all affected plays
          const updates = [];
          
          // Moving down
          if (sourceIdx < destIdx) {
            for (let i = sourceIdx + 1; i <= destIdx; i++) {
              const play = sectionPlays[i];
              if (play) {
                updates.push({
                  id: play.id,
                  position: i - 1
                });
              }
            }
          }
          // Moving up
          else if (sourceIdx > destIdx) {
            for (let i = destIdx; i < sourceIdx; i++) {
              const play = sectionPlays[i];
              if (play) {
                updates.push({
                  id: play.id,
                  position: i + 1
                });
              }
            }
          }
          
          // Add the moved play's position update
          const movedPlayData = sectionPlays[sourceIdx];
          if (movedPlayData) {
          updates.push({
              id: movedPlayData.id,
              position: destIdx
          });
          }

          // Update all positions in a single transaction
          for (const update of updates) {
            const { error: updateError } = await browserClient
              .from('game_plan')
              .update({ position: update.position })
              .eq('id', update.id);

            if (updateError) {
              throw new Error(`Failed to update position: ${updateError.message}`);
            }
          }

          // Update local state
      updatedPlays.splice(result.destination.index, 0, movedPlay);
          updatedPlan[sectionId] = updatedPlays;
          setPlan(updatedPlan);
          save('plan', updatedPlan);

          setNotification({
            message: 'Play order updated successfully',
            type: 'success'
          });
        } else {
          // If it's an empty play, just update the local state
          updatedPlays.splice(result.destination.index, 0, movedPlay);
      updatedPlan[sectionId] = updatedPlays;
      setPlan(updatedPlan);
      save('plan', updatedPlan);
        }
      }
    } catch (error) {
      console.error("Error in handleDragEnd:", error);
      
      setNotification({
        message: error instanceof Error ? 
          `Failed to update play positions: ${error.message}` : 
          "Failed to update play positions",
        type: 'error'
      });
    } finally {
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  // Add function to handle section size changes
  const handleSectionSizeChange = useCallback((section: keyof GamePlan, newSize: number) => {
    if (newSize < 1 || newSize > 20) return; // Don't allow sizes less than 1 or greater than 20
    
    try {
      // First check if we can make this change
      if (plan) {
        const currentPlays = plan[section];
        const filledSlots = currentPlays.filter(p => p.play);
        
        // If decreasing size, check if we would lose any plays
        if (newSize < currentPlays.length && filledSlots.length > newSize) {
          setNotification({
            message: `Cannot reduce size: ${filledSlots.length} plays already in use`,
            type: 'error'
          });
          setTimeout(() => setNotification(null), 3000);
          return;
        }

        // Create empty slot template
        const emptySlot = {
          formation: '',
          fieldAlignment: '+',
          motion: '',
          play: '',
          runDirection: '+'
        };

        // Update both states in one batch to prevent multiple re-renders
        const batchUpdate = () => {
          setSectionSizes(prev => {
            const updated = {
              ...prev,
              [section]: newSize
            };
            if (isBrowser) {
            localStorage.setItem('sectionSizes', JSON.stringify(updated));
            }
            return updated;
          });

          setPlan(prev => {
            if (!prev) return prev;
            const updatedPlan = { ...prev };
            const filledSlots = updatedPlan[section].filter(p => p.play);
            
            updatedPlan[section] = [
              ...filledSlots,
              ...Array(newSize - filledSlots.length).fill(emptySlot)
            ];
            
            if (isBrowser) {
            save('plan', updatedPlan);
            }
            return updatedPlan;
          });
        };

        // Execute the batch update
        batchUpdate();
      }
    } catch (error) {
      console.error('Error updating section size:', error);
      setNotification({
        message: 'Failed to update section size',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  }, [plan, setPlan, setSectionSizes, setNotification]);

  // Helper function to render a play list card with drag and drop
  const renderPlayListCard = (
    title: string,
    plays: PlayCall[] | undefined,
    expectedLength: number,
    bgColor: string = "bg-blue-100",
    section: keyof GamePlan
  ) => {
    if (!sectionVisibility[section]) return null;
    
    // Add safety check for undefined
    const safetyPlays = plays || [];
    
    console.log(`Rendering ${title} card:`, {
      plays: safetyPlays,
      expectedLength,
      section
    });
    
    const filledPlays = [...safetyPlays];
    
    // Ensure the array has exactly expectedLength items
    while (filledPlays.length < expectedLength) {
      filledPlays.push({
        formation: '',
        fieldAlignment: '+',
        motion: '',
        play: '',
        runDirection: '+'
      });
    }

    console.log(`Filled plays for ${title}:`, filledPlays);
    
    // Check if this is a Base Package section
    const isBasePackage = section.startsWith('basePackage');
    const displayTitle = isBasePackage ? customSectionNames[section] || title : title;
    
    return (
      <Card className="bg-white rounded shadow h-full relative">
        {renderSectionLoadingModal(section)}
        <CardHeader className="bg-white border-b p-4">
          <div className="mb-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div>
                <CardTitle className="font-bold text-black">{displayTitle}</CardTitle>
                {isBasePackage && (basePackageConcepts[section] || basePackageFormations[section]) && (
                  <div className="flex gap-2 text-sm text-gray-500">
                    {basePackageConcepts[section] && (
                      <span>Focus: {basePackageConcepts[section]}</span>
                    )}
                    {basePackageFormations[section] && (
                      <span>Formation: {basePackageFormations[section]}</span>
                    )}
                  </div>
                )}
              </div>
              {isBasePackage && (
                <Dialog open={dialogOpen[section]} onOpenChange={(open) => handleDialogOpenChange(section, open)}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                    >
                      <Settings className="h-4 w-4 text-gray-500" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Customize Section</DialogTitle>
                      <DialogDescription>
                        Customize the name and focus concept for this section
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div>
                        <Label htmlFor="sectionName">Section Name</Label>
                        <input
                          id="sectionName"
                          className="w-full px-3 py-2 border rounded mt-2"
                          defaultValue={displayTitle}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSectionNameChange(section, e.currentTarget.value);
                              handleDialogOpenChange(section, false);
                            }
                          }}
                          onBlur={(e) => {
                            handleSectionNameChange(section, e.target.value);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="concept">Focus Concept</Label>
                        <Select
                          value={basePackageConcepts[section] || 'any'}
                          onValueChange={(value) => handleConceptChange(section, value === 'any' ? '' : value)}
                          disabled={!!basePackageFormations[section]}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a concept" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px] overflow-y-auto">
                            <SelectItem value="any">Any Concept</SelectItem>
                            {uniqueConcepts.map((concept) => (
                              <SelectItem key={concept} value={concept}>
                                {concept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {basePackageFormations[section] && (
                          <p className="text-sm text-red-500 mt-1">
                            You can only select a focus formation or concept but not both. To select this, please reset your formation focus to its default value.
                          </p>
                        )}
                        {!basePackageFormations[section] && (
                          <p className="text-sm text-gray-500 mt-1">
                            Select a concept to focus on for this package
                          </p>
                        )}

                        <div className="mt-4">
                          <Label htmlFor="formation">Focus Formation</Label>
                          <Select
                            value={basePackageFormations[section] || 'any'}
                            onValueChange={(value) => handleFormationChange(section, value === 'any' ? '' : value)}
                            disabled={!!basePackageConcepts[section]}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a formation" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto">
                              <SelectItem value="any">Any Formation</SelectItem>
                              {uniqueFormations.map((formation) => (
                                <SelectItem key={formation} value={formation}>
                                  {formation}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {basePackageConcepts[section] && (
                            <p className="text-sm text-red-500 mt-1">
                              You can only select a focus formation or concept but not both. To select this, please reset your concept focus to its default value.
                            </p>
                          )}
                          {!basePackageConcepts[section] && (
                            <p className="text-sm text-gray-500 mt-1">
                              Select a formation to focus on for this package
                            </p>
                          )}
                        </div>

                        {(basePackageConcepts[section] || basePackageFormations[section]) && (
                          <div className="mt-6 flex justify-end">
                            <Button 
                              onClick={() => {
                                handleRegenerateSection(section);
                                handleDialogOpenChange(section, false);
                              }}
                              className="bg-[#2ECC70] hover:bg-[#27AE60] text-white flex items-center gap-2"
                            >
                              <Wand2 className="h-4 w-4" />
                              Regenerate with Focus
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                if (section === 'coverage0Beaters') {
                  handleRefreshCoverage0Beaters();
                } else {
                  handleRegenerateSection(section);
                }
              }}
              className="flex items-center gap-1 hover:bg-transparent"
              disabled={generating}
            >
                              {section === 'coverage0Beaters' ? (
                <RefreshCw className="h-4 w-4 text-[#0B2545]" />
              ) : (
                <Wand2 className="h-4 w-4 text-[#0B2545]" />
              )}
            </Button>
          </div>
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => {
                  const isComboSection = section === 'firstSecondCombos';
                  const decrementAmount = isComboSection ? 2 : 1;
                  handleSectionSizeChange(section, sectionSizes[section] - decrementAmount);
                }}
                disabled={sectionSizes[section] <= (section === 'firstSecondCombos' ? 2 : 1)}
              >
                <span className="sr-only">Decrease size</span>
                -
              </Button>
              <span className="text-sm font-medium w-6 text-center">
                {section === 'firstSecondCombos' ? sectionSizes[section] / 2 : sectionSizes[section]}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => {
                  const isComboSection = section === 'firstSecondCombos';
                  const incrementAmount = isComboSection ? 2 : 1;
                  handleSectionSizeChange(section, sectionSizes[section] + incrementAmount);
                }}
                disabled={sectionSizes[section] >= (section === 'firstSecondCombos' ? 40 : 20)}
              >
                <span className="sr-only">Increase size</span>
                +
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs flex items-center gap-1 bg-[#0B2545] hover:bg-[#0B2545]/90 text-white"
                onClick={() => handleLockSection(section)}
              >
                <Lock className="h-3 w-3" />
                Lock Section
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (showPlayPool && playPoolSection === section) {
                    setShowPlayPool(false);
                    setPlayPoolSection(null);
                  } else {
                    setShowPlayPool(true);
                    setPlayPoolSection(section);
                  }
                }}
                className="text-xs"
              >
                {showPlayPool && playPoolSection === section ? "Hide" : "Add a Play"}
              </Button>
            </div>
          </div>
          {isBasePackage && basePackageConcepts[section] && (
            <div className="mt-2 text-xs text-gray-600">
              Focus: {basePackageConcepts[section]}
            </div>
          )}
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto" style={{ maxHeight: 'calc(100% - 56px)' }}>
          <Droppable 
            droppableId={`section-${section}`} 
            type="PLAY" 
            direction="vertical"
          >
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`divide-y ${
                  snapshot.isDraggingOver 
                    ? 'bg-blue-100 border-2 border-dashed border-blue-400 rounded' 
                    : ''
                }`}
              >
                {filledPlays.map((play, index) => {
                const hasContent = !!play.play;
                const isComboSection = section === 'firstSecondCombos';
                  
                  if (!hasContent) {
                    if (isComboSection && index % 2 === 0) {
                      // For combo section, show combo pairs
                      const nextPlay = filledPlays[index + 1];
                      const hasNextContent = nextPlay && !!nextPlay.play;
                      
                      return (
                        <div key={`${section}-${index}-combo-empty`} className="px-4 py-2 bg-white border border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Combo {Math.floor(index / 2) + 1}</div>
                          <div className="space-y-1">
                            <div className="flex items-center p-2 rounded bg-gray-50">
                              <span className="w-8 text-slate-500 text-xs font-bold">1st:</span>
                              <span className="text-gray-300 italic flex-1 text-xs">Empty</span>
                            </div>
                            <div className="flex items-center p-2 rounded bg-gray-50">
                              <span className="w-8 text-slate-500 text-xs font-bold">2nd:</span>
                              <span className="text-gray-300 italic flex-1 text-xs">Empty</span>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (isComboSection && index % 2 === 1) {
                      // Skip odd indices in combo section as they're handled by the even index
                      return null;
                    } else {
                    return (
                      <div key={`${section}-${index}-empty`} className="px-4 py-1 flex items-center">
                        <span className="w-6 text-slate-500">{index + 1}.</span>
                        <span className="text-gray-300 italic flex-1 text-center text-xs">
                          {/* Empty space for vacant slot */}
                        </span>
                      </div>
                    );
                    }
                  }

                  if (isComboSection && index % 2 === 0) {
                    // Render combo pairs for firstSecondCombos
                    const nextPlay = filledPlays[index + 1];
                    const hasNextContent = nextPlay && !!nextPlay.play;
                    
                    // Get background colors for each play based on category
                    const firstPlayBgColor = play.category ? categoryColors[play.category as keyof CategoryColors] : '';
                    const secondPlayBgColor = hasNextContent && nextPlay.category ? categoryColors[nextPlay.category as keyof CategoryColors] : '';
                    
                    return (
                      <Draggable 
                        key={`combo-${section}-${index}`} 
                        draggableId={`combo-${section}-${index}`} 
                        index={Math.floor(index / 2)}
                      >
                        {(providedDrag, snapshotDrag) => (
                          <div
                            ref={providedDrag.innerRef}
                            {...providedDrag.draggableProps}
                            className={`px-4 py-2 bg-white border border-gray-200 ${
                              snapshotDrag.isDragging ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="flex items-center mb-2">
                              <div 
                                {...providedDrag.dragHandleProps}
                                className="mr-2 cursor-grab"
                              >
                                <GripVertical className="h-4 w-4 text-gray-400" />
                              </div>
                              <span className="text-xs font-semibold text-gray-700">Combo {Math.floor(index / 2) + 1}</span>
                              <div className="flex items-center gap-1 ml-auto">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-gray-500"
                                  onClick={() => handleDeletePlay(section, index)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className={`flex items-center text-sm font-mono p-2 rounded ${firstPlayBgColor}`}>
                                <span className="w-8 text-slate-500 text-xs font-bold">1st:</span>
                                <span className="flex-1">{play.play || 'Empty'}</span>
                              </div>
                              <div className={`flex items-center text-sm font-mono p-2 rounded ${secondPlayBgColor}`}>
                                <span className="w-8 text-slate-500 text-xs font-bold">2nd:</span>
                                <span className="flex-1">{hasNextContent ? nextPlay.play : 'Empty'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  } else if (isComboSection && index % 2 === 1) {
                    // Skip odd indices in combo section as they're handled by the even index
                    return null;
                  }
                
                let playBgColor = play.category ? categoryColors[play.category as keyof CategoryColors] : '';
                  
                  return (
                    <Draggable 
                      key={`play-${section}-${index}`} 
                      draggableId={`play-${section}-${index}`} 
                      index={index}
                    >
                      {(providedDrag, snapshotDrag) => (
                        <div
                          ref={providedDrag.innerRef}
                          {...providedDrag.draggableProps}
                          className={`px-4 py-2 flex items-center justify-between text-sm font-mono ${
                          snapshotDrag.isDragging ? 'opacity-50' : ''
                        } ${playBgColor}`}
                        style={{
                          ...providedDrag.draggableProps.style,
                          backgroundColor: playBgColor ? undefined : 'inherit'
                        }}
                        >
                          <div className="flex items-center flex-1">
                            <div 
                              {...providedDrag.dragHandleProps}
                              className="mr-2 cursor-grab"
                            >
                              <GripVertical className="h-4 w-4 text-gray-400" />
                            </div>
                            <span className="w-6 text-slate-500">{index + 1}.</span>
                            <span>{play.customized_edit || play.play}</span>
                          </div>
                          
                          {hasContent && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleToggleLock(section, index)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                {play.is_locked ? (
                                  <Lock className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <LockOpen className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                              <button
                                onClick={() => handleEditPlay(section, index)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <Pencil className="h-4 w-4 text-gray-400" />
                              </button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-gray-500"
                                onClick={() => handleDeletePlay(section, index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
            </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
        </div>
            )}
          </Droppable>
      </CardContent>
    </Card>
    );
  };

  // Modify the handleDeletePlay function
  const handleDeletePlay = async (section: keyof GamePlan, index: number) => {
    if (!plan) return;
    
    try {
      // Delete from Supabase first
      await deletePlayFromGamePlan(section, index);
      
      // Then update local state
    const updatedPlan = { ...plan };
    const updatedPlays = [...updatedPlan[section]];
    updatedPlays[index] = {
      formation: '',
      fieldAlignment: '+',
      motion: '',
      play: '',
      runDirection: '+'
    };
    updatedPlan[section] = updatedPlays;
    
    setPlan(updatedPlan);
    save('plan', updatedPlan);

      // Show success notification
      setNotification({
        message: 'Play removed successfully',
        type: 'success'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error('Error deleting play:', error);
      
      // Show error notification
      setNotification({
        message: error instanceof Error ? error.message : 'Failed to remove play',
        type: 'error'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };
  // Modify the handleAddPlayToSection function
  const handleAddPlayToSection = async (play: ExtendedPlay) => {
    if (!plan || !playPoolSection) return;
    
    try {
      console.log("Adding play to section:", {
        section: playPoolSection,
        play: {
          id: play.id,
          formation: play.formation,
          strength: play.strength,
          motion_shift: play.motion_shift,
          concept: play.concept,
          customized_edit: play.customized_edit
        }
      });
      
      // Create a PlayCall object with the play details
      const newPlay: PlayCall = {
        formation: play.formation || '',
        fieldAlignment: (play.strength as "+" | "-") || '+',
        motion: play.motion_shift || '',
        play: formatPlayFromPool(play),
        runDirection: (play.run_direction as "+" | "-") || '+',
        category: play.category || '' // Add the category
      };
      
      // Make a copy of the current plan
      const updatedPlan = { ...plan };
      const sectionPlays = [...updatedPlan[playPoolSection]];
      
      // Get the maximum plays allowed for this section
      const maxPlays = sectionSizes[playPoolSection];
      
      // Count existing non-empty plays
      const nonEmptyPlays = sectionPlays.filter(p => p.play);
      const currentPosition = nonEmptyPlays.length;
      
      // Check if we've reached the maximum
      if (currentPosition >= maxPlays) {
        setNotification({
          message: `Maximum plays (${maxPlays}) reached for this section`,
          type: 'error'
        });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      
      // Save to database first
      try {
        // Get the current highest position for this section
        const { data: existingPlays, error: queryError } = await browserClient
          .from('game_plan')
          .select('position')
          .eq('team_id', localStorage.getItem('selectedTeam'))
          .eq('opponent_id', localStorage.getItem('selectedOpponent'))
          .eq('section', playPoolSection.toLowerCase())
          .order('position', { ascending: false })
          .limit(1);

        if (queryError) {
          throw queryError;
        }

        // Calculate the next position (if no plays exist, start at 0)
        const nextPosition = existingPlays && existingPlays.length > 0 ? 
          existingPlays[0].position + 1 : 0;

        await savePlayToGamePlan(play, playPoolSection, nextPosition);
        console.log("Successfully saved to game plan table");
        
        // Only update UI if database save was successful
        sectionPlays[nextPosition] = newPlay;
        updatedPlan[playPoolSection] = sectionPlays;
      setPlan(updatedPlan);
      save('plan', updatedPlan);
      
        // Show success notification with the correct 1-based position
      setNotification({
        message: `Added to ${playPoolSection === 'openingScript' ? 'Opening Script' : 
                 playPoolSection === 'basePackage1' ? 'Base Package 1' : 
                 playPoolSection === 'basePackage2' ? 'Base Package 2' : 
                 playPoolSection === 'basePackage3' ? 'Base Package 3' : 
                   playPoolSection} (Position ${nextPosition + 1})`,
        type: 'success'
      });
      } catch (saveError) {
        console.error("Failed to save to game plan table:", saveError);
        throw saveError;
      }
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
      
    } catch (error) {
      console.error("Error adding play:", error);
      
      // Show error notification
      setNotification({
        message: error instanceof Error ? error.message : "Failed to add play",
        type: 'error'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  // Function to check if a play is already in a section
  const isPlayInSection = (play: ExtendedPlay, sectionPlays: PlayCall[] | undefined): boolean => {
    if (!playPoolSection) return false;
    
    // Add safety check for undefined
    const safetyPlays = sectionPlays || [];
    
    const playText = formatPlayFromPool(play);
    
    return safetyPlays.some(sectionPlay => {
      // If the play field directly contains the formatted play
      if (sectionPlay.play === playText) return true;
      
      // Otherwise check if the combination of fields matches
      const sectionPlayFormatted = formatPlayCall(sectionPlay);
      return sectionPlayFormatted === playText;
    });
  };

  // Add the search handler function
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Filter plays based on the search query
    const results = playPool.filter(play => {
      const formattedPlay = formatPlayFromPool(play).toLowerCase();
      const searchTerms = query.toLowerCase().split(' ');
      
      // Check if any part of the play matches all search terms
      return searchTerms.every(term => 
        formattedPlay.includes(term) ||
        play.formation?.toLowerCase().includes(term) ||
        play.tag?.toLowerCase().includes(term) ||
        play.strength?.toLowerCase().includes(term) ||
        play.motion_shift?.toLowerCase().includes(term) ||
        play.concept?.toLowerCase().includes(term) ||
        play.run_concept?.toLowerCase().includes(term) ||
        play.pass_screen_concept?.toLowerCase().includes(term)
      );
    });

    setSearchResults(results);
  };

  // Update the renderPlayPool function to include the category play list
  const renderPlayPool = () => {
    if (!plan || !playPoolSection) return null;
    
    
    let filteredPlays = playPool;
    
      if (playPoolFilterType === 'favorites') {
        // Filter by favorited plays
      filteredPlays = playPool.filter(play => play.is_favorite === true);
    } else if (playPoolFilterType === 'category') {
        // Filter by category (existing logic)
      filteredPlays = playPool.filter(play => {
        if (playPoolCategory === 'run_game') {
          return play.category === 'run_game';
        } else if (playPoolCategory === 'rpo_game') {
          return play.category === 'rpo_game';
        } else if (playPoolCategory === 'quick_game') {
          return play.category === 'quick_game';
        } else if (playPoolCategory === 'dropback_game') {
          return play.category === 'dropback_game';
        } else if (playPoolCategory === 'shot_plays') {
          return play.category === 'shot_plays';
        } else if (playPoolCategory === 'screen_game') {
          return play.category === 'screen_game';
        }
        return play.category === Object.keys(CATEGORIES)[0];
    });
    } else if (playPoolFilterType === 'search') {
      // Use search results
      filteredPlays = searchResults;
    }

    return (
      <Card className="bg-white rounded shadow-md w-full h-full">
        <CardHeader className="bg-gray-100 border-b flex flex-row justify-between items-center p-3">
          <CardTitle className="text-sm font-semibold">Play Pool</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setShowPlayPool(false);
              setPlayPoolSection(null);
            }}
            className="text-xs"
          >
            Hide
          </Button>
        </CardHeader>
        <CardContent className="p-3 flex flex-col overflow-hidden" style={{ height: 'calc(100% - 56px)' }}>
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
                className={`px-4 py-1 text-xs font-medium cursor-pointer ${
                  playPoolFilterType === 'favorites' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setPlayPoolFilterType('favorites')}
              >
                Favorites
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
          
          <div className="flex flex-1 min-h-0 overflow-hidden" style={{ height: 'calc(100% - 40px)' }}>
            {/* Category tabs - only show if in category mode */}
            {playPoolFilterType === 'category' && (
              <div className="w-1/3 border-r pr-1 overflow-y-auto">
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <button 
                    key={key}
                    className={`w-full text-left py-1 px-2 mb-1 text-xs rounded cursor-pointer ${playPoolCategory === key ? 'bg-blue-100 font-medium' : 'hover:bg-gray-100'}`}
                    onClick={() => setPlayPoolCategory(key as any)}
                  >
                    {label}
                  </button>
                ))}
            </div>
            )}
            
            {/* Category view - show plays for selected category */}
            {playPoolFilterType === 'category' && (
              <div className="w-2/3 pl-2 overflow-y-auto">
                <div className="space-y-1">
                  {filteredPlays.length > 0 ? (
                    filteredPlays.map((play, index) => {
                      const alreadyInSection = isPlayInSection(play, plan[playPoolSection]);
                      return (
                        <div 
                          key={index}
                          className={`p-1 border rounded flex justify-between items-center ${
                            alreadyInSection ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className={`text-xs font-mono ${alreadyInSection ? 'text-gray-500' : ''} truncate flex-1`}>
                            {play.is_favorite && (
                              <Star className="inline-block h-3 w-3 mr-0.5 fill-yellow-400 text-yellow-400" />
                            )}
                            {formatPlayFromPool(play)}
                          </div>
                          {alreadyInSection ? (
                            <div className="text-xs text-gray-500 ml-1 px-2 py-0.5 border border-gray-300 rounded flex-shrink-0">
                              In Script
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddPlayToSection(play)}
                              className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 ml-1 rounded flex-shrink-0 cursor-pointer"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-500 italic text-xs text-center p-4">
                      No plays available in this category
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Search view - updated layout */}
            {playPoolFilterType === 'search' && (
              <div className="w-full flex flex-col h-full">
                <div className="flex-shrink-0 mb-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Search plays..."
                      className="w-full pl-8 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-1">
                    {filteredPlays.length > 0 ? (
                      filteredPlays.map((play, index) => {
                        const alreadyInSection = isPlayInSection(play, plan[playPoolSection]);
                        return (
                          <div 
                            key={index}
                            className={`p-1 border rounded flex justify-between items-center ${
                              alreadyInSection ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className={`text-xs font-mono ${alreadyInSection ? 'text-gray-500' : ''} truncate flex-1`}>
                              {play.is_favorite && (
                                <Star className="inline-block h-3 w-3 mr-0.5 fill-yellow-400 text-yellow-400" />
                              )}
                              {formatPlayFromPool(play)}
                            </div>
                            {alreadyInSection ? (
                              <div className="text-xs text-gray-500 ml-1 px-2 py-0.5 border border-gray-300 rounded flex-shrink-0">
                                In Script
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddPlayToSection(play)}
                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 ml-1 rounded flex-shrink-0 cursor-pointer"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 italic text-xs text-center p-4">
                        {searchQuery
                          ? "No plays found matching your search"
                          : "Type to search for plays"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Play list area - only show for favorites mode */}
              {playPoolFilterType === 'favorites' && (
              <div className="w-full pl-1 flex-1 min-h-0">
                <div className="mb-2 text-sm font-medium text-center text-yellow-600">
                  <Star className="inline-block h-4 w-4 mr-1 fill-yellow-400" />
                  Favorite Plays
                </div>
              <div className="h-full overflow-y-auto space-y-1 pr-1">
                {filteredPlays.length > 0 ? (
                  filteredPlays.map((play, index) => {
                    const alreadyInSection = isPlayInSection(play, plan[playPoolSection]);
                    return (
                      <div 
                        key={index}
                        className={`p-1 border rounded flex justify-between items-center ${
                          alreadyInSection ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className={`text-xs font-mono ${alreadyInSection ? 'text-gray-500' : ''} truncate flex-1`}>
                          {play.is_favorite && (
                            <Star className="inline-block h-3 w-3 mr-0.5 fill-yellow-400 text-yellow-400" />
                          )}
                          {formatPlayFromPool(play)}
                        </div>
                        {alreadyInSection ? (
                          <div className="text-xs text-gray-500 ml-1 px-2 py-0.5 border border-gray-300 rounded flex-shrink-0">
                            In Script
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddPlayToSection(play)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 ml-1 rounded flex-shrink-0 cursor-pointer"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 italic text-xs text-center p-4">
                      No favorite plays yet. Star plays in the Play Pool page.
                  </p>
                )}
              </div>
            </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Update the renderPrintableList function to use custom names
  const renderPrintableList = (
    title: string,
    plays: PlayCall[] | undefined,
    bgColor: string = "bg-blue-100",
    maxLength: number = 0,
    section?: keyof GamePlan // Add section parameter
  ) => {
    // Check if plays is undefined and provide an empty array as fallback
    const safetyPlays = plays || [];
    
    // Filter only non-empty plays
    const filledPlays = safetyPlays.filter(p => p.play);
    
    // If no plays and no padding needed, don't render
    if (filledPlays.length === 0 && maxLength === 0) {
      return null;
    }

    // Get custom title for base packages
    const isBasePackage = section?.startsWith('basePackage');
    const displayTitle = isBasePackage && section ? customSectionNames[section] || title : title;

    const emptyRowsCount = maxLength > filledPlays.length ? maxLength - filledPlays.length : 0;

    // Special handling for First and Second Combos
    if (section === 'firstSecondCombos') {
      return (
        <div className="break-inside-avoid h-full border border-black">
          <div className="bg-white p-0.5 font-bold border-b text-xxs flex items-center">
            <span className="text-black">{displayTitle}</span>
          </div>
          <table className="w-full border-collapse text-xxs">
            <tbody>
              {/* Group plays in pairs */}
              {Array.from({ length: Math.ceil(filledPlays.length / 2) }).map((_, comboIndex) => {
                const firstPlay = filledPlays[comboIndex * 2];
                const secondPlay = filledPlays[comboIndex * 2 + 1];
                const firstPlayBgColor = firstPlay?.category ? categoryColors[firstPlay.category as keyof CategoryColors] : '';
                const secondPlayBgColor = secondPlay?.category ? categoryColors[secondPlay.category as keyof CategoryColors] : '';

                return (
                  <React.Fragment key={comboIndex}>
                    {/* First Down Play */}
                    {firstPlay && (
                      <tr className={`border-b ${firstPlayBgColor}`} style={{ borderTop: comboIndex > 0 ? '2px solid black' : '' }}>
                        <td className="py-0 px-0.5 border-r w-4">□</td>
                        <td className="py-0 px-0.5 border-r w-4">□</td>
                        <td className="py-0 px-0.5 border-r w-12 font-bold">1st</td>
                        <td className="py-0 px-0.5 font-mono text-xxs whitespace-nowrap overflow-hidden text-ellipsis">
                          {firstPlay.play}
                        </td>
                      </tr>
                    )}
                    {/* Second Down Play */}
                    {secondPlay && (
                      <tr className={`border-b ${secondPlayBgColor}`} style={{ borderBottom: '2px solid black' }}>
                        <td className="py-0 px-0.5 border-r w-4">□</td>
                        <td className="py-0 px-0.5 border-r w-4">□</td>
                        <td className="py-0 px-0.5 border-r w-12 font-bold">2nd</td>
                        <td className="py-0 px-0.5 font-mono text-xxs whitespace-nowrap overflow-hidden text-ellipsis">
                          {secondPlay.play}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {/* Add empty rows if needed */}
              {Array.from({ length: Math.floor(emptyRowsCount / 2) }).map((_, idx) => (
                <React.Fragment key={`empty-${idx}`}>
                  <tr className="border-b" style={{ borderTop: idx === 0 && filledPlays.length > 0 ? '2px solid black' : '' }}>
                    <td className="py-0 px-0.5 border-r w-4" style={{ color: 'transparent' }}>□</td>
                    <td className="py-0 px-0.5 border-r w-4" style={{ color: 'transparent' }}>□</td>
                    <td className="py-0 px-0.5 border-r w-12 font-bold">1st</td>
                    <td className="py-0 px-0.5 font-mono text-xxs whitespace-nowrap overflow-hidden text-ellipsis">&nbsp;</td>
                  </tr>
                  <tr className="border-b" style={{ borderBottom: '2px solid black' }}>
                    <td className="py-0 px-0.5 border-r w-4" style={{ color: 'transparent' }}>□</td>
                    <td className="py-0 px-0.5 border-r w-4" style={{ color: 'transparent' }}>□</td>
                    <td className="py-0 px-0.5 border-r w-12 font-bold">2nd</td>
                    <td className="py-0 px-0.5 font-mono text-xxs whitespace-nowrap overflow-hidden text-ellipsis">&nbsp;</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    // Regular section rendering
    return (
      <div className="break-inside-avoid h-full border border-black">
        <div className="bg-white p-0.5 font-bold border-b text-xxs flex items-center">
          <span className="text-black">{displayTitle}</span>
        </div>
        <table className="w-full border-collapse text-xxs">
          <tbody>
            {filledPlays.map((play, idx) => {
              const playBgColor = play.category ? categoryColors[play.category as keyof CategoryColors] : '';
              return (
                <tr key={idx} className={`border-b ${playBgColor}`}>
                  <td className="py-0 px-0.5 border-r w-4">□</td>
                  <td className="py-0 px-0.5 border-r w-4">□</td>
                  <td className="py-0 px-0.5 border-r w-4">{idx + 1}</td>
                  <td className="py-0 px-0.5 font-mono text-xxs whitespace-nowrap overflow-hidden text-ellipsis">
                    {play.play}
                  </td>
                </tr>
              );
            })}
            {Array.from({ length: emptyRowsCount }).map((_, idx) => (
              <tr key={`empty-${idx}`} className="border-b">
                <td className="py-0 px-0.5 border-r w-4" style={{ color: 'transparent' }}>□</td>
                <td className="py-0 px-0.5 border-r w-4" style={{ color: 'transparent' }}>□</td>
                <td className="py-0 px-0.5 border-r w-4">&nbsp;</td>
                <td className="py-0 px-0.5 font-mono text-xxs whitespace-nowrap overflow-hidden text-ellipsis">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Function to render play pool in absolute position with responsive positioning
  const renderPlayPoolAbsolute = (section: keyof GamePlan) => {
    if (showPlayPool && playPoolSection === section) {
      return (
        <div className="absolute z-10 md:right-[-105%] md:w-[100%] md:top-0 md:h-full left-0 top-full w-full mt-2 md:mt-0">
          {renderPlayPool()}
        </div>
      );
    }
    return null;
  };

  // Add the generation handler
  const handleGenerateGamePlan = async () => {
    if (!selectedOpponent || !playPool.length) {
      setNotification({
        message: 'Please select an opponent and ensure plays are loaded first',
        type: 'error'
      });
      return;
    }

    setGenerating(true);
    setIsGenerating(true);
    
    try {
      // First, clear the existing game plan from the database
      const team_id = isBrowser ? localStorage.getItem('selectedTeam') : null;
      const opponent_id = isBrowser ? localStorage.getItem('selectedOpponent') : null;

      if (!team_id || !opponent_id) {
        throw new Error('Team or opponent not selected');
      }

      // Delete all existing plays for this game plan
      const { error: deleteError } = await browserClient
        .from('game_plan')
        .delete()
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id);

      if (deleteError) {
        throw new Error('Failed to clear existing game plan');
      }

      // Define the order of sections to regenerate
      const sectionsToGenerate: (keyof GamePlan)[] = [
        'openingScript',
        'basePackage1', 
        'basePackage2',
        'basePackage3',
        'firstDowns',
        'shortYardage',
        'thirdAndShort',
        'thirdAndMedium',
        'thirdAndLong',
        'redZone',
        'goalline',
        'backedUp',
        'screens',
        'playAction',
        'deepShots',
        'twoMinuteDrill',
        'twoPointPlays',
        'firstSecondCombos',
        'coverage0Beaters'
      ];

      // Filter sections based on visibility
      const visibleSections = sectionsToGenerate.filter(section => sectionVisibility[section]);

      // Regenerate each section sequentially
      for (const section of visibleSections) {
        try {
          if (section === 'coverage0Beaters') {
            await handleRefreshCoverage0Beaters();
          } else {
            await handleRegenerateSection(section);
          }
          
          // Add a small delay between sections for better UX
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (sectionError) {
          console.error(`Error regenerating ${section}:`, sectionError);
          // Continue with other sections even if one fails
          setNotification({
            message: `Failed to generate ${section}, continuing with other sections...`,
            type: 'error'
          });
          setTimeout(() => setNotification(null), 3000);
        }
      }

      // Set manual build mode to true to show the game plan interface
      setIsManualBuildMode(true);

      // Show success message
      setNotification({
        message: 'Game plan generated successfully!',
        type: 'success'
      });

    } catch (error) {
      console.error('Error generating game plan:', error);
      setNotification({
        message: error instanceof Error ? error.message : 'Failed to generate game plan',
        type: 'error'
      });
    } finally {
      setGenerating(false);
      setIsGenerating(false);
    }
  };

  // Modify handleBuildManually function
  const handleBuildManually = () => {
    const emptyPlan = createEmptyPlan(sectionSizes);
    setPlan(emptyPlan);
    save('plan', emptyPlan);
    setIsManualBuildMode(true);
    
    setNotification({
      message: 'Ready to build your game plan manually',
      type: 'success'
    });
  };
  // Modify handleDeleteGamePlan function
  const handleDeleteGamePlan = async () => {
    if (!selectedTeam || !selectedOpponent) {
      setNotification({
        message: 'No game plan to delete',
        type: 'error'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Delete all plays from the game plan
      const { error: deleteError } = await browserClient
        .from('game_plan')
        .delete()
        .eq('team_id', selectedTeam)
        .eq('opponent_id', selectedOpponent);

      if (deleteError) {
        throw new Error('Failed to delete game plan');
      }

      // Reset the plan state to empty using current section sizes
      const emptyPlan = createEmptyPlan(sectionSizes);
      setPlan(emptyPlan);
      if (isBrowser) {
      save('plan', emptyPlan);
      }

      setNotification({
        message: 'Game plan deleted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting game plan:', error);
      setNotification({
        message: error instanceof Error ? error.message : 'Failed to delete game plan',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Add this function to save colors to localStorage
  const handleColorChange = (category: keyof CategoryColors, color: string) => {
    if (!isBrowser) return;
    
    const newColors = { ...categoryColors, [category]: color };
    setCategoryColors(newColors);
    localStorage.setItem('categoryColors', JSON.stringify(newColors));
  };

  // Add function to load Cover 0 Beaters from master_play_pool
  const loadCoverage0Beaters = async (count: number = 5) => {
    console.log('Starting Cover 0 Beaters query...');
    try {
      // Get plays that have '0' in coverage_beaters from playpool
      const team_id = isBrowser ? localStorage.getItem('selectedTeam') : null;
      const opponent_id = isBrowser ? localStorage.getItem('selectedOpponent') : null;

      if (!team_id || !opponent_id) {
        throw new Error('Team or opponent not selected for Cover 0 Beaters');
      }

      // Get plays from playpool that have '0' in coverage_beaters
      const { data: plays, error } = await supabase
        .from('playpool')
        .select('*')
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id)
        .not('coverage_beaters', 'is', null)
        .ilike('coverage_beaters', '%0%');

      console.log('Query result:', { playsCount: plays?.length, error });

      if (error) {
        console.error('Error fetching plays:', error);
        throw error;
      }

      if (!plays || plays.length === 0) {
        throw new Error('No Cover 0 Beaters found in play pool for this opponent');
      }

      console.log('Found Cover 0 plays:', plays.length);

      // Take random plays up to the count
      const shuffled = plays.sort(() => 0.5 - Math.random());
      const selectedPlays = shuffled.slice(0, Math.min(count, shuffled.length));

      // Convert to PlayCall format
      const playCallsArray = selectedPlays.map(play => ({
        id: play.id, // Preserve the UUID from playpool
        formation: play.formations || '',
        fieldAlignment: '+',
        motion: play.to_motions || '',
        play: play.combined_call || play.concept || '',
        runDirection: '+',
        category: play.category || ''
      }));

      console.log('Final plays returned:', playCallsArray);
      return playCallsArray;
    } catch (error) {
      console.error('Error loading Cover 0 Beaters:', error);
      throw error;
    }
  };

  // Add handler for refreshing Cover 0 Beaters
  const handleRefreshCoverage0Beaters = async () => {
    const team_id = isBrowser ? localStorage.getItem('selectedTeam') : null;
    const opponent_id = isBrowser ? localStorage.getItem('selectedOpponent') : null;

    if (!team_id || !opponent_id) {
      setNotification({
        message: 'Please select a team and opponent first',
        type: 'error'
      });
      return;
    }

    setGeneratingSection('coverage0Beaters');
    try {
      // Clear existing plays for this section
      const { error: deleteError } = await browserClient
        .from('game_plan')
        .delete()
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id)
        .eq('section', 'coverage0beaters');

      if (deleteError) {
        throw new Error('Failed to clear section');
      }

      // Load new random Cover 0 Beaters
      const newPlays = await loadCoverage0Beaters(sectionSizes.coverage0Beaters);

      // Save new plays to database
      const insertData = newPlays.map((play, index) => ({
        team_id,
        opponent_id,
        play_id: play.id, // Use the actual UUID from the playpool
        section: 'coverage0beaters',
        position: index,
        combined_call: play.play,
        customized_edit: null
      }));

      if (insertData.length > 0) {
        const { error: insertError } = await browserClient
          .from('game_plan')
          .insert(insertData);

        if (insertError) {
          throw new Error(`Failed to save plays: ${insertError.message}`);
        }
      }

      // Update local state
      const updatedPlan = await fetchGamePlanFromDatabase(sectionSizes);
      if (updatedPlan) {
        setPlan(updatedPlan);
        if (isBrowser) {
          save('plan', updatedPlan);
        }
      }

      setNotification({
        message: 'Cover 0 Beaters refreshed successfully!',
        type: 'success'
      });

    } catch (error) {
      console.error('Error refreshing Cover 0 Beaters:', error);
      setNotification({
        message: error instanceof Error ? error.message : 'Failed to refresh Cover 0 Beaters',
        type: 'error'
      });
    } finally {
      setGeneratingSection(null);
    }
  };

      // Add this function after handleColorChange
    const handleRegenerateSection = async (section: keyof GamePlan) => {
    if (!selectedOpponent || !playPool.length) {
      setNotification({
        message: 'Please select an opponent and ensure plays are loaded first',
        type: 'error'
      });
      return;
    }

    // Check if all plays in the section are locked
    if (plan && plan[section]) {
      const playsInSection = plan[section].filter(play => play.play); // Only consider non-empty plays
      if (playsInSection.length > 0) { // Only check if there are actual plays
        const allPlaysLocked = playsInSection.every(play => play.is_locked);
        
        if (allPlaysLocked) {
          setNotification({
            message: 'Unable to use AI as all plays are already locked',
            type: 'error'
          });
          setTimeout(() => setNotification(null), 3000);
          return;
        }
      }
    }

    setGeneratingSection(section);
    try {
      // Get team and opponent IDs
      const team_id = isBrowser ? localStorage.getItem('selectedTeam') : null;
      const opponent_id = isBrowser ? localStorage.getItem('selectedOpponent') : null;

      if (!team_id || !opponent_id) {
        throw new Error('Team or opponent not selected');
      }

      // Step 1: Save all locked plays and their positions
      const { data: lockedPlays, error: lockedError } = await browserClient
        .from('game_plan')
        .select('*')
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id)
        .eq('section', section.toLowerCase())
        .eq('is_locked', true);

      if (lockedError) throw lockedError;

      // Calculate how many new plays we need (section size minus locked plays)
      const neededPlays = sectionSizes[section] - (lockedPlays?.length || 0);

      // Format plays for the API - use only plays that match this section's typical category
      // and selected concept if it's a base package
      const isBasePackage = section.startsWith('basePackage');
      const selectedConcept = isBasePackage ? basePackageConcepts[section] : null;
      const selectedFormation = isBasePackage ? basePackageFormations[section] : null;
      
      const filteredPlays = playPool
        .filter(p => {
          // For First and Second Combos, include all plays (no filtering)
          if (section === 'firstSecondCombos') {
            return true; // Allow all play types
          }
          // If this is a base package with a selected concept, filter by it
          if (isBasePackage && selectedConcept && p.concept !== selectedConcept) {
            return false;
          }
          // If this is a base package with a selected formation, filter by it
          if (isBasePackage && selectedFormation && p.formations !== selectedFormation) {
            return false;
          }
          // For screens section, only include screen_game plays
          if (section === 'screens') {
            return p.category === 'screen_game';
          }
          // For Deep Shots section, only include shot_plays and dropback_game
          if (section === 'deepShots') {
            return p.category === 'shot_plays' || p.category === 'dropback_game';
          }
          // For Third and Short, exclude shot plays
          if (section === 'thirdAndShort') {
            return p.category !== 'shot_plays';
          }
          // For Third and Medium, exclude shot plays
          if (section === 'thirdAndMedium') {
            return p.category !== 'shot_plays';
          }
          return true;
        })
        .map(p => ({
          name: formatPlayFromPool(p),
          category: p.category
        }));

      console.log('Sending to API:', {
        section,
        playCount: filteredPlays.length,
        screenPlays: filteredPlays.filter(p => p.category === 'screen_game').length,
        neededPlays
      });

      // Create a minimal section-specific size object for faster processing
      const sectionSizeObj = {
        [section]: neededPlays
      };

      // Call our API route with optimized parameters for single section
      const response = await fetch('/api/generate-gameplan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playPool: filteredPlays,
          sectionSizes: sectionSizeObj,
          singleSection: true, // Flag for faster processing
          targetSection: section,
          selectedConcept: selectedConcept // Pass the selected concept to the API
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate plays');
      }

      const gamePlan = await response.json();
      console.log('API Response:', {
        section,
        plays: gamePlan[section]
      });
      
      // Helper function to find a play in the pool by its formatted name
      const findPlayByName = (name: string) => {
        const play = playPool.find(p => formatPlayFromPool(p) === name);
        if (!play) {
          console.log('Failed to find play:', {
            searchName: name,
            availableNames: playPool.map(p => formatPlayFromPool(p))
          });
        }
        return play;
      };

      // Step 2: Delete only unlocked plays
      const { error: deleteError } = await browserClient
        .from('game_plan')
        .delete()
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id)
        .eq('section', section.toLowerCase())
        .eq('is_locked', false);

      if (deleteError) {
        throw new Error('Failed to clear unlocked plays');
      }

      // Batch insert new plays for available positions
      const plays = gamePlan[section] || [];
      console.log('Preparing to insert plays:', {
        section,
        receivedPlays: plays.length,
        neededPlays: neededPlays,
        lockedPlays: lockedPlays?.length || 0
      });

      const insertData = [];
      const lockedPositions = new Set(lockedPlays?.map(p => p.position) || []);
      let playIndex = 0;
      
      // Insert new plays into available (non-locked) positions
      for (let i = 0; i < sectionSizes[section] && playIndex < plays.length; i++) {
        if (!lockedPositions.has(i)) {
          const playName = plays[playIndex];
          const play = findPlayByName(playName);
          if (play) {
            insertData.push({
              team_id,
              opponent_id,
              play_id: play.id,
              section: section.toLowerCase(),
              position: i,
              combined_call: formatPlayFromPool(play),
              customized_edit: play.customized_edit,
              is_locked: false
            });
            playIndex++;
          }
        }
      }

      console.log('Inserting plays:', {
        section,
        foundPlays: insertData.length,
        expectedPlays: Math.min(plays.length, sectionSizes[section])
      });

      // Single batch insert for maximum speed
      if (insertData.length > 0) {
        // Special handling for firstSecondCombos to ensure we have enough plays
        if (section === 'firstSecondCombos' && insertData.length < sectionSizes[section] / 2) {
          console.log('Not enough plays for First and Second Combos, attempting additional generation...');
          
          // Make up to 3 additional attempts to get more plays
          for (let attempt = 0; attempt < 3 && insertData.length < sectionSizes[section]; attempt++) {
            const additionalResponse = await fetch('/api/generate-gameplan', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                playPool: filteredPlays,
                sectionSizes: { [section]: sectionSizes[section] - insertData.length },
                singleSection: true,
                targetSection: section
              })
            });

            if (additionalResponse.ok) {
              const additionalGamePlan = await additionalResponse.json();
              const additionalPlays = additionalGamePlan[section] || [];
              
              // Process additional plays in pairs for firstSecondCombos
              let currentPosition = insertData.length;
              
              // For firstSecondCombos, process plays in pairs
              if (section === 'firstSecondCombos') {
                for (let i = 0; i < additionalPlays.length - 1; i += 2) {
                  if (currentPosition >= sectionSizes[section] - 1) break; // Need space for both plays
                  
                  const firstPlay = findPlayByName(additionalPlays[i]);
                  const secondPlay = findPlayByName(additionalPlays[i + 1]);
                  
                  // Only add if we have both plays and positions are available
                  if (firstPlay && secondPlay && 
                      !lockedPositions.has(currentPosition) && 
                      !lockedPositions.has(currentPosition + 1)) {
                    
                    // Add first down play
                    insertData.push({
                      team_id,
                      opponent_id,
                      play_id: firstPlay.id,
                      section: section.toLowerCase(),
                      position: currentPosition,
                      combined_call: formatPlayFromPool(firstPlay),
                      customized_edit: firstPlay.customized_edit,
                      is_locked: false
                    });
                    
                    // Add second down play
                    insertData.push({
                      team_id,
                      opponent_id,
                      play_id: secondPlay.id,
                      section: section.toLowerCase(),
                      position: currentPosition + 1,
                      combined_call: formatPlayFromPool(secondPlay),
                      customized_edit: secondPlay.customized_edit,
                      is_locked: false
                    });
                    
                    currentPosition += 2;
                  }
                }
              } else {
                // Normal processing for other sections
                for (const playName of additionalPlays) {
                  if (currentPosition >= sectionSizes[section]) break;
                  
                  const play = findPlayByName(playName);
                  if (play && !lockedPositions.has(currentPosition)) {
                    insertData.push({
                      team_id,
                      opponent_id,
                      play_id: play.id,
                      section: section.toLowerCase(),
                      position: currentPosition,
                      combined_call: formatPlayFromPool(play),
                      customized_edit: play.customized_edit,
                      is_locked: false
                    });
                    currentPosition++;
                  }
                }
              }

              if (insertData.length >= sectionSizes[section] / 2) {
                console.log(`Got enough plays after attempt ${attempt + 1}`);
                break;
              }
            }
          }
        }

        const { error: insertError } = await browserClient
          .from('game_plan')
          .insert(insertData);

        if (insertError) {
          console.error('Insert error:', insertError);
          throw new Error(`Failed to save plays: ${insertError.message}`);
        }

        // Show success message with count if we got fewer plays than requested
        const expectedPairs = section === 'firstSecondCombos' ? sectionSizes[section] / 2 : sectionSizes[section];
        const actualPairs = section === 'firstSecondCombos' ? Math.floor(insertData.length / 2) : insertData.length;
        
        const successMessage = insertData.length < sectionSizes[section] 
          ? `${section} regenerated with ${actualPairs} ${section === 'firstSecondCombos' ? 'pairs' : 'plays'} (limited by available plays)`
          : `${section} regenerated successfully!`;

        setNotification({
          message: successMessage,
          type: 'success'
        });
      } else {
        // Try one more time if no valid plays were found
        console.log('No valid plays found, attempting second try...');
        
        // Call our API route again
        const secondResponse = await fetch('/api/generate-gameplan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playPool: filteredPlays,
            sectionSizes: sectionSizeObj,
            singleSection: true,
            targetSection: section,
            selectedConcept: selectedConcept
          })
        });

        if (!secondResponse.ok) {
          const error = await secondResponse.json();
          throw new Error(error.error || 'Failed to generate plays on second attempt');
        }

        const secondGamePlan = await secondResponse.json();
        const secondPlays = secondGamePlan[section] || [];
        
        if (secondPlays.length > 0) {
          // Process and insert the plays from second attempt
          const secondInsertData = [];
          let playIndex = 0;
          
          for (let i = 0; i < sectionSizes[section] && playIndex < secondPlays.length; i++) {
            if (!lockedPositions.has(i)) {
              const playName = secondPlays[playIndex];
              const play = findPlayByName(playName);
              if (play) {
                secondInsertData.push({
                  team_id,
                  opponent_id,
                  play_id: play.id,
                  section: section.toLowerCase(),
                  position: i,
                  combined_call: formatPlayFromPool(play),
                  customized_edit: play.customized_edit,
                  is_locked: false
                });
                playIndex++;
              }
            }
          }

          if (secondInsertData.length > 0) {
            const { error: insertError } = await browserClient
              .from('game_plan')
              .insert(secondInsertData);

            if (insertError) {
              throw new Error(`Failed to save plays on second attempt: ${insertError.message}`);
            }

            setNotification({
              message: `${section} regenerated with ${secondInsertData.length} plays on second attempt`,
              type: 'success'
            });
          } else {
            setNotification({
              message: 'Sorry, we found no valid plays for this section. Try regenerating the section again',
              type: 'error'
            });
          }
        } else {
          setNotification({
            message: 'Sorry, we found no valid plays for this section. Try regenerating the section again',
            type: 'error'
          });
        }
      }

      // Optimized UI update - only fetch this section's data
      const updatedPlan = await fetchGamePlanFromDatabase(sectionSizes);
      if (updatedPlan) {
        setPlan(updatedPlan);
        if (isBrowser) {
          save('plan', updatedPlan);
        }
      }

    } catch (error) {
      console.error('Error regenerating section:', error);
      setNotification({
        message: error instanceof Error ? error.message : 'Failed to regenerate section',
        type: 'error'
      });
    } finally {
      setGeneratingSection(null);
    }
  };

  // Add section-specific loading modal component
  const renderSectionLoadingModal = (section: keyof GamePlan) => {
    if (generatingSection !== section) return null;

    return (
      <div className="absolute inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50 rounded-lg overflow-hidden">
        <div className="bg-white/90 rounded-lg p-6 text-center shadow-xl">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <Image
              src="/ball.gif"
              alt="Loading football"
              width={64}
              height={64}
              priority
              className="object-contain"
            />
          </div>
          <h3 className="text-lg font-semibold mb-2">Regenerating {section}...</h3>
          <p className="text-gray-600 text-sm">AI is selecting new plays</p>
        </div>
      </div>
    );
  };

  // Show loading state while fetching data
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
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  // Check if playpool is empty
  const isPlayPoolEmpty = !playPool || playPool.length === 0;

  // Check if gameplan is empty (all sections are empty or null)
  const isGamePlanEmpty = !plan || Object.values(plan).every(section => {
    // Check if section is undefined/null or is an empty array
    return !section || (Array.isArray(section) && section.every(play => !play.play));
  });

  // If playpool is empty, show message to build playpool first
  if (isPlayPoolEmpty) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Game Plan</h1>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Unfortunately, you need to generate a play pool for this opponent before we generate your gameplan</h2>
            <p className="text-gray-600">Please build your play pool first.</p>
          </div>
          <Button 
            onClick={() => router.push('/playpool')}
            className="bg-blue-900 hover:bg-blue-800 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Build your play pool
          </Button>
        </div>
      </div>
    );
  }

  // If playpool exists but gameplan is empty, show options to build
  if (isGamePlanEmpty && !isManualBuildMode) {
    console.log('Game plan is empty, showing build options');
    return (
      <>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Game Plan</h1>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Let's build your gameplan!</h2>
            <p className="text-gray-600">Choose how you'd like to create your game plan.</p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <Button 
              onClick={handleGenerateGamePlan}
              disabled={generating}
              className="bg-[#0b2545] hover:bg-[#1e3a8a] text-white min-w-[250px]"
            >
              {generating ? (
                <>
                  <div className="animate-spin mr-2">
                    <Wand2 className="h-4 w-4" />
                  </div>
                  Building...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Build your game plan with AI
                </>
              )}
            </Button>
            
            
            
            
            <div className="text-gray-500">Or</div>
            
            <Button 
                onClick={handleBuildManually}
              variant="outline"
              className="bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-900 min-w-[250px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Build your gameplan manually
            </Button>
          </div>
          
          <p className="text-sm text-gray-500 mt-4">
            You can still edit the gameplan after it's been generated
          </p>
        </div>
      </div>
      </>
    );
  }

  // Add this JSX near the end of the component, before the final return
  const renderEditDialog = () => (
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Play</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={editingPlay?.text || ''}
            onChange={(e) => setEditingPlay(prev => prev ? { ...prev, text: e.target.value } : null)}
            placeholder="Enter play text..."
          />
        </div>
        <DialogFooter className="flex justify-between">
                      <Button
              onClick={handleResetEdit}
              className="bg-black hover:bg-gray-800 text-white"
            >
              Reset to Default
            </Button>
          <Button 
            onClick={handleSaveEdit}
            className="bg-[#2ECC70] hover:bg-[#27AE60]"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const handleLockSection = async (section: keyof GamePlan) => {
    if (!plan) return;

    const team_id = localStorage.getItem('selectedTeam');
    const opponent_id = localStorage.getItem('selectedOpponent');

    if (!team_id || !opponent_id) {
      setNotification({ message: 'Team or opponent not selected.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const playsToLock = plan[section].filter(play => play.play && !play.is_locked);
    if (playsToLock.length === 0) {
      setNotification({ message: 'No unlocked plays in this section.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const positionsToLock = plan[section]
      .map((play, index) => (play.play && !play.is_locked ? index : -1))
      .filter(index => index !== -1);
    
    // Optimistic UI update
    const updatedPlan = { ...plan };
    const updatedSectionPlays = [...updatedPlan[section]];
    positionsToLock.forEach(index => {
      updatedSectionPlays[index].is_locked = true;
    });
    updatedPlan[section] = updatedSectionPlays;
    setPlan(updatedPlan);

    try {
      const { error } = await browserClient
        .from('game_plan')
        .update({ is_locked: true })
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id)
        .eq('section', section.toLowerCase())
        .in('position', positionsToLock);

      if (error) throw error;

      setNotification({ message: 'Section locked successfully.', type: 'success' });
      setTimeout(() => setNotification(null), 3000);

    } catch (error) {
      // Revert UI on error
      setPlan(plan);
      setNotification({ message: 'Failed to lock section.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      console.error('Error locking section:', error);
    }
  };

  return (
    <>
      {/* Add this line before the final closing tag */}
      {renderEditDialog()}
      <DragDropContext onDragEnd={handleDragEnd} onBeforeDragStart={handleBeforeDragStart}>
        <div className={`container mx-auto px-4 py-8 ${isDragging ? 'bg-gray-50' : ''}`}>
          {isDragging && (
            <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50">
              Drag to add play to game plan
            </div>
          )}
          
          {notification && (
            <div 
              className={`fixed bottom-4 right-4 px-4 py-3 rounded shadow-lg z-50 ${
                notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {notification.message}
            </div>
          )}
          
          {/* Print Orientation Dialog */}
          {showPrintDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <h3 className="text-xl font-bold mb-4">Select Print Orientation</h3>
                <div className="flex space-x-4 mb-6">
                  <div 
                    className={`border p-4 rounded cursor-pointer flex-1 flex flex-col items-center ${printOrientation === 'portrait' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                    onClick={() => setPrintOrientation('portrait')}
                  >
                    <div className="w-16 h-24 border border-gray-400 mb-2"></div>
                    <span>Portrait</span>
                  </div>
                  <div 
                    className={`border p-4 rounded cursor-pointer flex-1 flex flex-col items-center ${printOrientation === 'landscape' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                    onClick={() => setPrintOrientation('landscape')}
                  >
                    <div className="w-24 h-16 border border-gray-400 mb-2"></div>
                    <span>Landscape</span>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => printHandler()} className="flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Printable content (hidden from normal view) */}
          <div className="hidden">
            <div ref={printRef} className={`p-2 ${printOrientation === 'landscape' ? 'landscape' : 'portrait'}`}>
              <style type="text/css" media="print">
                {`
                  @page {
                    size: ${printOrientation};
                    margin: 3mm;
                  }
                  
                  @media print {
                    body {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      color-adjust: exact !important;
                    }

                    /* Force background colors to print */
                    * {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      color-adjust: exact !important;
                    }

                    /* Ensure Tailwind background colors print */
                    .bg-green-50 { background-color: #f0fdf4 !important; }
                    .bg-green-100 { background-color: #dcfce7 !important; }
                    .bg-red-50 { background-color: #fef2f2 !important; }
                    .bg-red-100 { background-color: #fee2e2 !important; }
                    .bg-blue-50 { background-color: #eff6ff !important; }
                    .bg-blue-100 { background-color: #dbeafe !important; }
                    .bg-orange-50 { background-color: #fff7ed !important; }
                    .bg-orange-100 { background-color: #ffedd5 !important; }
                    .bg-purple-50 { background-color: #faf5ff !important; }
                    .bg-purple-100 { background-color: #f3e8ff !important; }
                    .bg-yellow-100 { background-color: #fef9c3 !important; }
                    .bg-yellow-200 { background-color: #fef08a !important; }
                    .bg-pink-50 { background-color: #fdf2f8 !important; }
                    .bg-pink-100 { background-color: #fce7f3 !important; }
                    .bg-indigo-50 { background-color: #eef2ff !important; }
                    .bg-indigo-100 { background-color: #e0e7ff !important; }
                  }
                  
                  body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    font-size: 6.5pt !important;
                  }
                  
                  .landscape {
                    width: 297mm;
                    height: 210mm;
                    max-height: 210mm;
                    overflow: hidden;
                  }
                  
                  .portrait {
                    width: 210mm;
                    height: 297mm;
                  }
                  
                  table {
                    page-break-inside: avoid;
                  }
                  
                  .break-inside-avoid {
                    page-break-inside: avoid;
                    border: 1px solid #000;
                  }

                  .print-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.5mm;
                    page-break-after: avoid;
                    max-height: 180mm; /* Leave room for header */
                  }

                  .col-span-full {
                    grid-column: 1 / -1;
                  }

                  /* Shrink table rows for compactness */
                  .print-grid tr {
                    line-height: 1;
                  }

                  /* Minimize cell padding */
                  .print-grid td, .print-grid th {
                    padding: 0.3mm 0.5mm;
                  }

                  /* Override any hover effects in print */
                  .print-grid tr:hover {
                    background-color: transparent !important;
                  }

                  /* Ensure proper table width */
                  .print-grid table {
                    width: 100%;
                    table-layout: fixed;
                  }

                  /* Set smaller font for play text */
                  .print-grid .font-mono {
                    font-size: 6pt;
                  }
                  
                  /* Make text smaller in landscape mode */
                  @media print and (orientation: landscape) {
                    body {
                      font-size: 6pt !important;
                    }
                    .print-grid .font-mono {
                      font-size: 5.5pt;
                    }
                    .text-xxs {
                      font-size: 5.5pt;
                    }
                  }
                `}
              </style>
              
              {/* Update the print header to be more compact */}
              <div className="text-center mb-1">
                <h1 className="text-sm font-bold mb-0">
                  Game Plan {selectedOpponentName && `vs. ${selectedOpponentName}`}
                </h1>
                <div className="text-xs flex justify-center items-center gap-4">
                  <span>✓ = Called</span>
                  <span>★ = Key Play</span>
                </div>
              </div>
              
              <div className="print-grid">
                {plan && (() => {
                  const sectionGroups = [
                    ['openingScript', 'basePackage1', 'basePackage2'],
                    ['basePackage3', 'firstDowns', 'shortYardage'],
                    ['thirdAndShort', 'thirdAndMedium', 'thirdAndLong'],
                    ['highRedZone', 'lowRedZone', 'goalline'],
                    ['backedUp', 'screens', 'playAction'],
                    ['deepShots', 'twoMinuteDrill', 'twoPointPlays'],
                    ['firstSecondCombos', 'coverage0Beaters']
                  ];

                  const sectionDetails = {
                    openingScript: { title: 'Opening Script', bgColor: 'bg-white' },
                    basePackage1: { title: customSectionNames.basePackage1 || 'Base Package 1', bgColor: 'bg-white' },
                    basePackage2: { title: customSectionNames.basePackage2 || 'Base Package 2', bgColor: 'bg-white' },
                    basePackage3: { title: customSectionNames.basePackage3 || 'Base Package 3', bgColor: 'bg-white' },
                    firstDowns: { title: 'First Downs', bgColor: 'bg-white' },
                    shortYardage: { title: 'Short Yardage', bgColor: 'bg-white' },
                    thirdAndShort: { title: 'Third and Short', bgColor: 'bg-white' },
                    thirdAndMedium: { title: 'Third and Medium', bgColor: 'bg-white' },
                    thirdAndLong: { title: 'Third and Long', bgColor: 'bg-white' },
                    highRedZone: { title: 'High Red Zone (10-20)', bgColor: 'bg-white' },
                    lowRedZone: { title: 'Low Red Zone (5-10)', bgColor: 'bg-white' },
                    goalline: { title: 'Goalline', bgColor: 'bg-white' },
                    backedUp: { title: 'Backed Up', bgColor: 'bg-white' },
                    screens: { title: 'Screens', bgColor: 'bg-white' },
                    playAction: { title: 'Play Action', bgColor: 'bg-white' },
                    deepShots: { title: 'Deep Shots', bgColor: 'bg-white' },
                    twoMinuteDrill: { title: 'Two Minute Drill', bgColor: 'bg-white' },
                    twoPointPlays: { title: 'Two Point Plays', bgColor: 'bg-white' },
                    firstSecondCombos: { title: '1st and 2nd Combos', bgColor: 'bg-white' },
                    coverage0Beaters: { title: 'Cover 0 Beaters', bgColor: 'bg-white' }
                  };

                  return sectionGroups.map(group => {
                    const visibleKeysInGroup = group.filter(key => sectionVisibility[key as keyof GamePlan]);
                    if (visibleKeysInGroup.length === 0) return null;

                    const maxLength = Math.max(0, ...visibleKeysInGroup.map(key => 
                      plan[key as keyof GamePlan]?.filter(p => p.play).length || 0
                    ));

                    return group.map(key => {
                      const sectionKey = key as keyof GamePlan;
                      if (!sectionVisibility[sectionKey]) return <div key={key} />;
                      
                      const details = sectionDetails[sectionKey as keyof typeof sectionDetails];
                      if (!details) return null;

                      // Get custom title for base packages
                      const isBasePackage = sectionKey.startsWith('basePackage');
                      const displayTitle = isBasePackage ? customSectionNames[sectionKey] || details.title : details.title;

                      return (
                        <div key={key}>
                          {renderPrintableList(
                            displayTitle,
                            plan[sectionKey],
                            details.bgColor,
                            maxLength,
                            sectionKey // Pass the section key
                          )}
                </div>
                      );
                    });
                  });
                })()}
              </div>
            </div>
          </div>

        <div ref={componentRef} className="space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold">Game Plan</h1>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => router.push('/playpool')} 
                className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 border-black"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Play Pool
              </Button>

              {/* Add Color Settings Dialog */}
              <Dialog open={showColorSettings} onOpenChange={setShowColorSettings}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Colors
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Category Colors</DialogTitle>
                    <DialogDescription>
                      Customize the background colors for each play category.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {Object.entries(CATEGORIES).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label htmlFor={`color-${key}`}>{label}</Label>
                        <select
                          id={`color-${key}`}
                          value={categoryColors[key as keyof CategoryColors]}
                          onChange={(e) => handleColorChange(key as keyof CategoryColors, e.target.value)}
                          className="w-40 p-1 border rounded"
                        >
                          <option value="bg-green-50">Light Green</option>
                          <option value="bg-green-100">Medium Green</option>
                          <option value="bg-red-50">Light Red</option>
                          <option value="bg-red-100">Medium Red</option>
                          <option value="bg-blue-50">Light Blue</option>
                          <option value="bg-blue-100">Medium Blue</option>
                          <option value="bg-orange-50">Light Orange</option>
                          <option value="bg-orange-100">Medium Orange</option>
                          <option value="bg-purple-50">Light Purple</option>
                          <option value="bg-purple-100">Medium Purple</option>
                          <option value="bg-yellow-100">Light Yellow</option>
                          <option value="bg-yellow-200">Medium Yellow</option>
                          <option value="bg-pink-50">Light Pink</option>
                          <option value="bg-pink-100">Medium Pink</option>
                          <option value="bg-indigo-50">Light Indigo</option>
                          <option value="bg-indigo-100">Medium Indigo</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setShowColorSettings(false)}>Done</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Existing Customize button */}
              <Dialog open={showVisibilitySettings} onOpenChange={setShowVisibilitySettings}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Customize
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Section Visibility</DialogTitle>
                    <DialogDescription>
                      Toggle which sections are visible in your game plan.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    {/* Column 1: Base Packages */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm border-b pb-2">Base Packages</h3>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="opening-script">Opening Script</Label>
                        <Switch
                          id="opening-script"
                          checked={sectionVisibility.openingScript}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, openingScript: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="base-package-1">Base Package 1</Label>
                        <Switch
                          id="base-package-1"
                          checked={sectionVisibility.basePackage1}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, basePackage1: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="base-package-2">Base Package 2</Label>
                        <Switch
                          id="base-package-2"
                          checked={sectionVisibility.basePackage2}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, basePackage2: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="base-package-3">Base Package 3</Label>
                        <Switch
                          id="base-package-3"
                          checked={sectionVisibility.basePackage3}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, basePackage3: checked }))
                          }
                        />
                      </div>
                    </div>

                    {/* Column 2: Down & Distance */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm border-b pb-2">Down & Distance</h3>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="first-downs">First Downs</Label>
                        <Switch
                          id="first-downs"
                          checked={sectionVisibility.firstDowns}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, firstDowns: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="short-yardage">Short Yardage</Label>
                        <Switch
                          id="short-yardage"
                          checked={sectionVisibility.shortYardage}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, shortYardage: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="third-and-short">Third and Short</Label>
                        <Switch
                          id="third-and-short"
                          checked={sectionVisibility.thirdAndShort}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, thirdAndShort: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="third-and-medium">Third and Medium</Label>
                        <Switch
                          id="third-and-medium"
                          checked={sectionVisibility.thirdAndMedium}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, thirdAndMedium: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="third-and-long">Third and Long</Label>
                        <Switch
                          id="third-and-long"
                          checked={sectionVisibility.thirdAndLong}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, thirdAndLong: checked }))
                          }
                        />
                      </div>
                    </div>

                    {/* Column 3: Situational */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm border-b pb-2">Situational</h3>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="high-red-zone">High Red Zone (10-20)</Label>
                        <Switch
                          id="high-red-zone"
                          checked={sectionVisibility.highRedZone}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, highRedZone: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="low-red-zone">Low Red Zone (5-10)</Label>
                        <Switch
                          id="low-red-zone"
                          checked={sectionVisibility.lowRedZone}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, lowRedZone: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="goalline">Goalline</Label>
                        <Switch
                          id="goalline"
                          checked={sectionVisibility.goalline}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, goalline: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="backed-up">Backed Up</Label>
                        <Switch
                          id="backed-up"
                          checked={sectionVisibility.backedUp}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, backedUp: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="two-minute-drill">Two Minute Drill</Label>
                        <Switch
                          id="two-minute-drill"
                          checked={sectionVisibility.twoMinuteDrill}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, twoMinuteDrill: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="two-point-plays">Two Point Plays</Label>
                        <Switch
                          id="two-point-plays"
                          checked={sectionVisibility.twoPointPlays}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, twoPointPlays: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="first-second-combos">1st and 2nd Combos</Label>
                        <Switch
                          id="first-second-combos"
                          checked={sectionVisibility.firstSecondCombos}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, firstSecondCombos: checked }))
                          }
                        />
                      </div>
                    </div>

                    {/* Column 4: Play Types */}
                    <div className="space-y-4 md:col-span-3 lg:col-span-1">
                      <h3 className="font-semibold text-sm border-b pb-2">Play Types</h3>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="screens">Screens</Label>
                        <Switch
                          id="screens"
                          checked={sectionVisibility.screens}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, screens: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="play-action">Play Action</Label>
                        <Switch
                          id="play-action"
                          checked={sectionVisibility.playAction}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, playAction: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="deep-shots">Deep Shots</Label>
                        <Switch
                          id="deep-shots"
                          checked={sectionVisibility.deepShots}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, deepShots: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="coverage0-beaters">Cover 0 Beaters</Label>
                        <Switch
                          id="coverage0-beaters"
                          checked={sectionVisibility.coverage0Beaters}
                          onCheckedChange={(checked) => 
                            setSectionVisibility(prev => ({ ...prev, coverage0Beaters: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setShowVisibilitySettings(false)}>Done</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button 
                onClick={handlePrint} 
                className="flex items-center gap-2 bg-[#2ecc71] hover:bg-[#27ae60] text-white border-[#2ecc71]"
              >
                <Printer className="h-4 w-4" />
                Print PDF
              </Button>
            </div>
          </div>

          {/* User Preferences Form */}
          <Card className="bg-white">
              <CardHeader>
                <CardTitle>Game Plan Settings</CardTitle>
              </CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 bg-blue-50 text-blue-800 rounded-md">
                  <p className="text-sm">
                    Use the "Add a Play" button on each section to build your game plan from the play pool.
                  </p>
                </div>

                <div className="flex flex-row gap-4">
                  <Button 
                    onClick={handleGenerateGamePlan}
                    className="flex-1 bg-[#0b2545] hover:bg-[#1e3a8a] text-white"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin mr-2">
                          <Wand2 className="h-4 w-4" />
                        </div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate with AI
                      </>
                    )}
                  </Button>

                  <Button 
                    onClick={handleDeleteGamePlan}
                    className="flex-1 bg-[#ff3b3f] hover:bg-[#e63538] text-white"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin mr-2">
                          <Loader2 className="h-4 w-4" />
                        </div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Game Plan
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Opening Script and other sections in a single grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 auto-rows-auto gap-6 mt-6">
              {[
                { key: 'openingScript', title: 'Opening Script', bgColor: 'bg-amber-100' },
                { key: 'basePackage1', title: customSectionNames.basePackage1 || 'Base Package 1', bgColor: 'bg-green-100' },
                { key: 'basePackage2', title: customSectionNames.basePackage2 || 'Base Package 2', bgColor: 'bg-green-100' },
                { key: 'basePackage3', title: customSectionNames.basePackage3 || 'Base Package 3', bgColor: 'bg-green-100' },
                { key: 'firstDowns', title: 'First Downs', bgColor: 'bg-blue-100' },
                { key: 'shortYardage', title: 'Short Yardage', bgColor: 'bg-blue-100' },
                { key: 'thirdAndShort', title: 'Third and Short', bgColor: 'bg-blue-100' },
                { key: 'thirdAndMedium', title: 'Third and Medium', bgColor: 'bg-blue-100' },
                { key: 'thirdAndLong', title: 'Third and Long', bgColor: 'bg-blue-100' },
                { key: 'highRedZone', title: 'High Red Zone (10-20)', bgColor: 'bg-red-100' },
    { key: 'lowRedZone', title: 'Low Red Zone (5-10)', bgColor: 'bg-red-100' },
                { key: 'goalline', title: 'Goalline', bgColor: 'bg-red-100' },
                { key: 'backedUp', title: 'Backed Up', bgColor: 'bg-red-100' },
                { key: 'screens', title: 'Screens', bgColor: 'bg-purple-100' },
                { key: 'playAction', title: 'Play Action', bgColor: 'bg-purple-100' },
                { key: 'deepShots', title: 'Deep Shots', bgColor: 'bg-purple-100' },
                { key: 'twoMinuteDrill', title: 'Two Minute Drill', bgColor: 'bg-pink-100' },
                { key: 'twoPointPlays', title: 'Two Point Plays', bgColor: 'bg-pink-100' },
                { key: 'firstSecondCombos', title: '1st and 2nd Combos', bgColor: 'bg-indigo-100' },
                { key: 'coverage0Beaters', title: 'Cover 0 Beaters', bgColor: 'bg-yellow-100' }
              ].filter(item => sectionVisibility[item.key as keyof GamePlan]).map(item => (
                <div key={item.key} className="col-span-1">
                  <div className="relative">
                    {plan && renderPlayListCard(
                      item.title,
                      plan[item.key as keyof GamePlan],
                      sectionSizes[item.key as keyof GamePlan],
                      item.bgColor,
                      item.key as keyof GamePlan
                    )}
                    {renderPlayPoolAbsolute(item.key as keyof GamePlan)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DragLayer isDragging={isDragging} play={draggingPlay} />
      </DragDropContext>
    </>
  )
}




