"use client"

import { useState, useEffect, useRef, MouseEventHandler, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, ArrowLeft, Trash2, GripVertical, Plus, Star, Check, Printer, Wand2, RefreshCw, Loader2, Search, Eye, Settings } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { load, save } from "@/lib/local"
// import { makeGamePlan } from "@/app/actions"
import { getPlayPool, Play } from "@/lib/playpool"
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { LoadingModal } from "../components/loading-modal"

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
  thirdAndLong: PlayCall[]
  redZone: PlayCall[]
  goalline: PlayCall[]
  backedUp: PlayCall[]
  screens: PlayCall[]
  playAction: PlayCall[]
  deepShots: PlayCall[]
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
  'thirdandlong': 'thirdAndLong',
  'redzone': 'redZone',
  'goalline': 'goalline',
  'backedup': 'backedUp',
  'screens': 'screens',
  'playaction': 'playAction',
  'deepshots': 'deepShots'
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
  thirdAndLong: 5,
  redZone: 5,
  goalline: 5,
  backedUp: 5,
  screens: 5,
  playAction: 5,
  deepShots: 5
};

// Add helper function to create empty plans
const createEmptyPlan = (sizes: Record<keyof GamePlan, number>): GamePlan => {
  return {
    openingScript: Array(sizes.openingScript).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    basePackage1: Array(sizes.basePackage1).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    basePackage2: Array(sizes.basePackage2).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    basePackage3: Array(sizes.basePackage3).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    firstDowns: Array(sizes.firstDowns).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    secondAndShort: Array(sizes.secondAndShort).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    secondAndLong: Array(sizes.secondAndLong).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    shortYardage: Array(sizes.shortYardage).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    thirdAndLong: Array(sizes.thirdAndLong).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    redZone: Array(sizes.redZone).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    goalline: Array(sizes.goalline).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    backedUp: Array(sizes.backedUp).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    screens: Array(sizes.screens).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    playAction: Array(sizes.playAction).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
    deepShots: Array(sizes.deepShots).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' })
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
    const team_id = localStorage.getItem('selectedTeam');
    const opponent_id = localStorage.getItem('selectedOpponent');

    if (!team_id || !opponent_id) {
      throw new Error('Please select both a team and opponent in the sidebar first');
    }

    // First, get the current highest position for this section
    const { data: existingPlays, error: queryError } = await supabase
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
    const { data, error } = await supabase
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
  const team_id = typeof window !== 'undefined' ? localStorage.getItem('selectedTeam') : null;
  const opponent_id = typeof window !== 'undefined' ? localStorage.getItem('selectedOpponent') : null;
  return { team_id, opponent_id };
}

// Add this function to create a play if it doesn't exist
async function ensurePlayExists(play: ExtendedPlay): Promise<{ id: string | null; error: string | null }> {
  try {
    // If play doesn't exist, create it
    const { data, error } = await supabase
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
    const { error } = await supabase
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
    const { data: play, error: fetchError } = await supabase
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
    const { error: updateError } = await supabase
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
    const team_id = localStorage.getItem('selectedTeam');
    const opponent_id = localStorage.getItem('selectedOpponent');

    if (!team_id || !opponent_id) {
      console.log('Team or opponent not selected');
      return null;
    }

    console.log('Fetching game plan for:', { team_id, opponent_id });

    // Fetch all plays for this team and opponent
    const { data: gamePlanData, error } = await supabase
      .from('game_plan')
      .select('*')
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
          runDirection: '+'
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
        runDirection: '+'
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
    const { data: functions, error: functionError } = await supabase
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

  const componentRef = useRef<HTMLDivElement>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchOpponentName = async () => {
      if (selectedOpponent) {
        const { data, error } = await supabase
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
          localStorage.setItem('sectionSizes', JSON.stringify(initialSectionSizes));
        }
      } catch (error) {
        console.error('Error loading saved section sizes:', error);
        localStorage.setItem('sectionSizes', JSON.stringify(initialSectionSizes));
      }
    } else {
      // If no saved sizes exist, save the initial sizes
      localStorage.setItem('sectionSizes', JSON.stringify(initialSectionSizes));
    }
  }, []);

  // Add effect to load initial data
  const loadInitialData = useCallback(async () => {
      try {
        setLoading(true);
        console.log('Loading initial data...');

        // Get team and opponent IDs from localStorage
        const teamId = localStorage.getItem('selectedTeam');
        const opponentId = localStorage.getItem('selectedOpponent');

        if (!teamId || !opponentId) {
          console.log('No team or opponent selected');
        setLoading(false);
        return;
      }

        setSelectedTeam(teamId);
        setSelectedOpponent(opponentId);

      // Get saved section sizes
      const savedSizes = localStorage.getItem('sectionSizes');
      const currentSizes = savedSizes ? JSON.parse(savedSizes) : initialSectionSizes;

      // Load game plan with current sizes
      const initialPlan = await fetchGamePlanFromDatabase(currentSizes);
        if (initialPlan) {
          console.log('Loaded initial game plan');
          setPlan(initialPlan);
          save('plan', initialPlan);
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
        
        const subscription = supabase
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
              const currentSizes = JSON.parse(localStorage.getItem('sectionSizes') || JSON.stringify(initialSectionSizes));
              const updatedPlan = await fetchGamePlanFromDatabase(currentSizes);
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
        const teamId = localStorage.getItem('selectedTeam');
        if (!teamId) {
          throw new Error('No team selected');
        }

        // Load game plan
      const updatedPlan = await fetchGamePlanFromDatabase(sectionSizes);
        if (updatedPlan) {
          console.log('Updating plan from opponent change');
          setPlan(updatedPlan);
          save('plan', updatedPlan);
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
  }, [setSelectedOpponent, setLoading, setPlan, setPlayPool, setShowPlayPool, setPlayPoolSection, setPlayPoolCategory, setPlayPoolFilterType]); // Remove sectionSizes from dependencies

  useEffect(() => {
    window.addEventListener('opponentChanged', handleOpponentChange);
    return () => {
      window.removeEventListener('opponentChanged', handleOpponentChange);
    };
  }, [handleOpponentChange]);

  // Update the storage change handler
  const handleStorageChange = useCallback(async (e: StorageEvent) => {
    if (e.key === 'selectedOpponent' && e.newValue !== e.oldValue) {
      console.log('Opponent changed in storage, updating state...');
      setSelectedOpponent(e.newValue);

      // Load game plan data
      try {
        setLoading(true);
        const teamId = localStorage.getItem('selectedTeam');
        if (!teamId) {
          throw new Error('No team selected');
        }

        // Load game plan
        const updatedPlan = await fetchGamePlanFromDatabase(sectionSizes);
        if (updatedPlan) {
          console.log('Updating plan from storage change');
          setPlan(updatedPlan);
          save('plan', updatedPlan);
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
  }, [setSelectedOpponent, setLoading, setPlan, setPlayPool, setShowPlayPool, setPlayPoolSection, setPlayPoolCategory, setPlayPoolFilterType]); // Remove sectionSizes from dependencies

  // Update the main team/opponent effect
  useEffect(() => {
    const team = localStorage.getItem('selectedTeam');
    const opponent = localStorage.getItem('selectedOpponent');
    
    setSelectedTeam(team);
    setSelectedOpponent(opponent);
    
    window.addEventListener('storage', handleStorageChange);
    
    if (team && opponent) {
      console.log('Setting up real-time subscription for:', { team, opponent });
      
      const subscription = supabase
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
          const { data: sectionPlays, error: fetchError } = await supabase
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
            const { error: updateError } = await supabase
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
            localStorage.setItem('sectionSizes', JSON.stringify(updated));
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
            
            save('plan', updatedPlan);
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
    
    return (
    <Card className="bg-white rounded shadow h-full">
        <CardHeader className={`${bgColor} border-b p-4`}>
          <div className="mb-2">
        <CardTitle className="font-bold">{title}</CardTitle>
          </div>
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => handleSectionSizeChange(section, sectionSizes[section] - 1)}
                disabled={sectionSizes[section] <= 1}
              >
                <span className="sr-only">Decrease size</span>
                -
              </Button>
              <span className="text-sm font-medium w-6 text-center">
                {sectionSizes[section]}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => handleSectionSizeChange(section, sectionSizes[section] + 1)}
                disabled={sectionSizes[section] >= 20} // Set a reasonable maximum
              >
                <span className="sr-only">Increase size</span>
                +
              </Button>
            </div>
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
                  const hasContent = !!play.play; // Check if play has content based on the play field
                  
                  console.log(`Rendering play ${index} in ${title}:`, {
                    play,
                    hasContent
                  });
                  
                  if (!hasContent) {
                    // Render empty slot without draggable
                    return (
                      <div key={`${section}-${index}-empty`} className="px-4 py-1 flex items-center">
                        <span className="w-6 text-slate-500">{index + 1}.</span>
                        <span className="text-gray-300 italic flex-1 text-center text-xs">
                          {/* Empty space for vacant slot */}
                        </span>
                      </div>
                    );
                  }
                  
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
                            snapshotDrag.isDragging ? 'opacity-50 bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center flex-1">
                            <div 
                              {...providedDrag.dragHandleProps}
                              className="mr-2 cursor-grab"
                            >
                              <GripVertical className="h-4 w-4 text-gray-400" />
                            </div>
                            <span className="w-6 text-slate-500">{index + 1}.</span>
                            <span>{play.play}</span>
                          </div>
                          
                          {hasContent && (
                            <div className="flex items-center gap-1">
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
        runDirection: (play.run_direction as "+" | "-") || '+'
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
        const { data: existingPlays, error: queryError } = await supabase
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

  // Update the renderPrintableList function
  const renderPrintableList = (
    title: string,
    plays: PlayCall[] | undefined,
    bgColor: string = "bg-blue-100",
    maxLength: number = 0
    ) => {
    // Check if plays is undefined and provide an empty array as fallback
    const safetyPlays = plays || [];
    
    // Filter only non-empty plays
    const filledPlays = safetyPlays.filter(p => p.play);
    
    // If no plays and no padding needed, don't render
    if (filledPlays.length === 0 && maxLength === 0) {
      return null;
    }

    const emptyRowsCount = maxLength > filledPlays.length ? maxLength - filledPlays.length : 0;
    
    return (
      <div className="break-inside-avoid h-full border border-black">
        <div className={`${bgColor} p-0.5 font-bold border-b text-xxs flex items-center`}>
          <span>{title}</span>
        </div>
        <table className="w-full border-collapse text-xxs">
          <tbody>
            {filledPlays.map((play, idx) => (
              <tr key={idx} className="border-b">
                <td className="py-0 px-0.5 border-r w-4">□</td>
                <td className="py-0 px-0.5 border-r w-4">□</td>
                <td className="py-0 px-0.5 border-r w-4">{idx + 1}</td>
                <td className="py-0 px-0.5 font-mono text-xxs whitespace-nowrap overflow-hidden text-ellipsis">
                  {play.play}
                </td>
              </tr>
            ))}
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
    try {
      // First, clear the existing game plan from the database
      const team_id = localStorage.getItem('selectedTeam');
      const opponent_id = localStorage.getItem('selectedOpponent');

      if (!team_id || !opponent_id) {
        throw new Error('Team or opponent not selected');
      }

      // Delete all existing plays for this game plan
      const { error: deleteError } = await supabase
        .from('game_plan')
        .delete()
        .eq('team_id', team_id)
        .eq('opponent_id', opponent_id);

      if (deleteError) {
        throw new Error('Failed to clear existing game plan');
      }

      // Format plays for the API and include section sizes
      const formattedPlays = playPool.map(p => formatPlayFromPool(p));

      // Call our API route with section sizes
      const response = await fetch('/api/generate-gameplan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playPool: formattedPlays,
          sectionSizes: sectionSizes // Pass the section sizes to the API
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate game plan');
      }

      const gamePlan = await response.json();
      
      // Helper function to find a play in the pool by its formatted name
      const findPlayByName = (name: string) => {
        return playPool.find(p => formatPlayFromPool(p) === name);
      };

      // Update each section, respecting the section sizes
      for (const [section, plays] of Object.entries(gamePlan)) {
        const sectionKey = section as keyof GamePlan;
        const maxPlays = sectionSizes[sectionKey];
        
        // Only save up to the maximum number of plays for this section
        for (let i = 0; i < Math.min((plays as string[]).length, maxPlays); i++) {
          const playName = (plays as string[])[i];
          const play = findPlayByName(playName);
          if (play) {
            await savePlayToGamePlan(play, sectionKey, i);
          }
        }
      }

      // Instead of reloading the page, fetch the updated game plan
      const updatedPlan = await fetchGamePlanFromDatabase(sectionSizes);
      if (updatedPlan) {
        setPlan(updatedPlan);
        save('plan', updatedPlan);
      }

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
      const { error: deleteError } = await supabase
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
      save('plan', emptyPlan);

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
        {generating && <LoadingModal message="Generating your Game Plan now!" />}
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

  return (
    <>
      {generating && <LoadingModal message="Generating your Game Plan now!" />}
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
                    }
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

                  /* Ensure background colors print */
                  .bg-amber-100 { background-color: #fef3c7 !important; }
                  .bg-green-100 { background-color: #dcfce7 !important; }
                  .bg-blue-100 { background-color: #dbeafe !important; }
                  .bg-red-100 { background-color: #fee2e2 !important; }
                  .bg-purple-100 { background-color: #f3e8ff !important; }

                  /* Adjust header spacing */
                  .text-center.mb-1 {
                    margin-bottom: 1mm !important;
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
                    ['thirdAndLong', 'redZone', 'goalline'],
                    ['backedUp', 'screens', 'playAction'],
                    ['deepShots']
                  ];

                  const sectionDetails = {
                    openingScript: { title: 'Opening Script', bgColor: 'bg-amber-100' },
                    basePackage1: { title: 'Base Package 1', bgColor: 'bg-green-100' },
                    basePackage2: { title: 'Base Package 2', bgColor: 'bg-green-100' },
                    basePackage3: { title: 'Base Package 3', bgColor: 'bg-green-100' },
                    firstDowns: { title: 'First Downs', bgColor: 'bg-blue-100' },
                    shortYardage: { title: 'Short Yardage', bgColor: 'bg-blue-100' },
                    thirdAndLong: { title: '3rd and Long', bgColor: 'bg-blue-100' },
                    redZone: { title: 'Red Zone', bgColor: 'bg-red-100' },
                    goalline: { title: 'Goalline', bgColor: 'bg-red-100' },
                    backedUp: { title: 'Backed Up', bgColor: 'bg-red-100' },
                    screens: { title: 'Screens', bgColor: 'bg-purple-100' },
                    playAction: { title: 'Play Action', bgColor: 'bg-purple-100' },
                    deepShots: { title: 'Deep Shots', bgColor: 'bg-purple-100' }
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

                      return (
                        <div key={key}>
                          {renderPrintableList(
                            details.title,
                            plan[sectionKey],
                            details.bgColor,
                            maxLength
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
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Section Visibility</DialogTitle>
                    <DialogDescription>
                      Toggle which sections are visible in your game plan.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
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
                      <Label htmlFor="third-and-long">Third and Long</Label>
                      <Switch
                        id="third-and-long"
                        checked={sectionVisibility.thirdAndLong}
                        onCheckedChange={(checked) => 
                          setSectionVisibility(prev => ({ ...prev, thirdAndLong: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="red-zone">Red Zone</Label>
                      <Switch
                        id="red-zone"
                        checked={sectionVisibility.redZone}
                        onCheckedChange={(checked) => 
                          setSectionVisibility(prev => ({ ...prev, redZone: checked }))
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
                  </div>
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
                { key: 'basePackage1', title: 'Base Package 1', bgColor: 'bg-green-100' },
                { key: 'basePackage2', title: 'Base Package 2', bgColor: 'bg-green-100' },
                { key: 'basePackage3', title: 'Base Package 3', bgColor: 'bg-green-100' },
                { key: 'firstDowns', title: 'First Downs', bgColor: 'bg-blue-100' },
                { key: 'shortYardage', title: 'Short Yardage', bgColor: 'bg-blue-100' },
                { key: 'thirdAndLong', title: 'Third and Long', bgColor: 'bg-blue-100' },
                { key: 'redZone', title: 'Red Zone', bgColor: 'bg-red-100' },
                { key: 'goalline', title: 'Goalline', bgColor: 'bg-red-100' },
                { key: 'backedUp', title: 'Backed Up', bgColor: 'bg-red-100' },
                { key: 'screens', title: 'Screens', bgColor: 'bg-purple-100' },
                { key: 'playAction', title: 'Play Action', bgColor: 'bg-purple-100' },
                { key: 'deepShots', title: 'Deep Shots', bgColor: 'bg-purple-100' }
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


