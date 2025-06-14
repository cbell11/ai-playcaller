"use client"

import { useState, useEffect, useRef, MouseEventHandler } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Download, ArrowLeft, Trash2, GripVertical, Plus, Star, Check, Printer, Wand2, RefreshCw, Loader2 } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { load, save } from "@/lib/local"
// import { makeGamePlan } from "@/app/actions"
import { getPlayPool, Play } from "@/lib/playpool"
import { supabase } from '@/lib/supabase'
// import { Input } from "../components/ui/input"
// import { Label } from "../components/ui/label"
// import { Slider } from "../components/ui/slider"
// import { Textarea } from "../components/ui/textarea"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
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
async function fetchGamePlanFromDatabase(): Promise<GamePlan | null> {
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

    // Log the raw data from database
    console.log('Raw game plan data from database:', JSON.stringify(gamePlanData, null, 2));

    // Create an empty game plan with 10 slots for openingScript
    const emptyPlan: GamePlan = {
      openingScript: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      basePackage1: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      basePackage2: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      basePackage3: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      firstDowns: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      secondAndShort: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      secondAndLong: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      shortYardage: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      thirdAndLong: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      redZone: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      goalline: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      backedUp: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      screens: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      playAction: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
      deepShots: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' })
    };

    // Populate the plan with database data
    if (gamePlanData && gamePlanData.length > 0) {
      console.log('Found game plan data, processing entries...');
      
      gamePlanData.forEach((entry, index) => {
        // Map the database section name to our GamePlan key
        const dbSection = entry.section.toLowerCase();
        const section = sectionMapping[dbSection];
        const position = entry.position;
        
        console.log(`Processing entry ${index + 1}/${gamePlanData.length}:`, {
          dbSection,
          mappedSection: section,
          position,
          customized_edit: entry.customized_edit,
          combined_call: entry.combined_call
        });
        
        // Skip if we don't have a valid section mapping
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

        // Check if the position is valid
        if (position >= emptyPlan[section].length) {
          console.warn(`Position ${position} is out of bounds for section "${section}" (max: ${emptyPlan[section].length - 1})`);
          return;
        }

        // Update the plan at the correct position
        emptyPlan[section][position] = playCall;
        console.log(`Updated ${section} at position ${position} with:`, playCall);
      });

      // Log the final plan structure after population
      console.log('Final plan structure after population:', {
        openingScript: emptyPlan.openingScript.map(p => p.play).filter(Boolean),
        basePackage1: emptyPlan.basePackage1.map(p => p.play).filter(Boolean),
        // ... etc
      });
    } else {
      console.log('No game plan data found in database');
    }

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
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [selectedSection, setSelectedSection] = useState<keyof GamePlan | null>(null)
  const [draggingPlay, setDraggingPlay] = useState<ExtendedPlay | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const componentRef = useRef<HTMLDivElement>(null)

  const [playPool, setPlayPool] = useState<ExtendedPlay[]>([]);
  const [showPlayPool, setShowPlayPool] = useState(false);
  const [playPoolCategory, setPlayPoolCategory] = useState<'run_game' | 'rpo_game' | 'quick_game' | 'dropback_game' | 'shot_plays' | 'screen_game'>('run_game');
  const [playPoolSection, setPlayPoolSection] = useState<keyof GamePlan | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [playPoolFilterType, setPlayPoolFilterType] = useState<'category' | 'favorites'>('category');

  // Add state for print orientation
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // Add new state for AI generation
  const [isGenerating, setIsGenerating] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)

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

  // Add effect to load initial data
  useEffect(() => {
    const loadInitialData = async () => {
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

        // Load game plan
        const initialPlan = await fetchGamePlanFromDatabase();
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
                const updatedPlan = await fetchGamePlanFromDatabase();
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
    };

    loadInitialData();
  }, [supabase]);

  // Update the opponent change effect to load data
  useEffect(() => {
    const handleOpponentChange = async (event: Event) => {
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
        const updatedPlan = await fetchGamePlanFromDatabase();
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
    };

    window.addEventListener('opponentChanged', handleOpponentChange);
    return () => {
      window.removeEventListener('opponentChanged', handleOpponentChange);
    };
  }, []);

  // Update the storage change handler
  const handleStorageChange = async (e: StorageEvent) => {
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
        const updatedPlan = await fetchGamePlanFromDatabase();
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
  };

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
              const updatedPlan = await fetchGamePlanFromDatabase();
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
  }, []);

  // Update the play pool loading effect to depend on selectedOpponent
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
  }, [selectedOpponent]); // Add selectedOpponent as dependency

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

          // Create updates array for all affected positions
          const updates: { play: PlayCall; oldPosition: number; newPosition: number }[] = [];
          
          // Moving down
          if (sourceIdx < destIdx) {
            for (let i = sourceIdx + 1; i <= destIdx; i++) {
              if (updatedPlays[i - 1].play) {
                updates.push({
                  play: updatedPlays[i - 1],
                  oldPosition: i,
                  newPosition: i - 1
                });
              }
            }
          }
          // Moving up
          else if (sourceIdx > destIdx) {
            for (let i = destIdx; i < sourceIdx; i++) {
              if (updatedPlays[i].play) {
                updates.push({
                  play: updatedPlays[i],
                  oldPosition: i,
                  newPosition: i + 1
                });
              }
            }
          }
          
          // Add the moved play's position update
          updates.push({
            play: movedPlay,
            oldPosition: sourceIdx,
            newPosition: destIdx
          });

          console.log('Position updates to be made:', updates.map(u => ({
            play: u.play.play,
            from: u.oldPosition,
            to: u.newPosition
          })));

          // Update positions in the database
          await updatePlayPositionsInDatabase(sectionId, team_id, opponent_id, updates);
          
          // Only update local state if database update succeeds
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
      
      // Show more detailed error message
      setNotification({
        message: error instanceof Error ? 
          `Failed to update play positions: ${error.message}` : 
          "Failed to update play positions",
        type: 'error'
      });
    } finally {
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  // Helper function to render a play list card with drag and drop
  const renderPlayListCard = (
    title: string,
    plays: PlayCall[] | undefined,
    expectedLength: number,
    bgColor: string = "bg-blue-100",
    section: keyof GamePlan
  ) => {
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
        <CardHeader className={`${bgColor} border-b flex flex-row justify-between items-center`}>
        <CardTitle className="font-bold">{title}</CardTitle>
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
      
      // Get the target length based on section
      const targetLength = playPoolSection === 'openingScript' ? 10 : // Changed from 7 to 10
                          (playPoolSection.startsWith('basePackage') || playPoolSection === 'firstDowns') ? 10 : 5;
      
      // Count existing non-empty plays
      const nonEmptyPlays = sectionPlays.filter(p => p.play);
      const currentPosition = nonEmptyPlays.length;
      
      // Check if we've reached the maximum
      if (currentPosition >= targetLength) {
        setNotification({
          message: `Maximum plays (${targetLength}) reached for this section`,
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

  const renderPlayPool = () => {
    if (!plan || !playPoolSection) return null;
    
    const filteredPlays = playPool.filter(play => {
      if (playPoolFilterType === 'favorites') {
        // Filter by favorited plays
        return play.is_favorite === true;
      } else {
        // Filter by category (existing logic)
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
        // Default to showing all plays if no category is selected
        return play.category === Object.keys(CATEGORIES)[0];
      }
    });

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
                className={`px-4 py-1 text-xs font-medium rounded-r-lg cursor-pointer ${
                  playPoolFilterType === 'favorites' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setPlayPoolFilterType('favorites')}
              >
                Favorites
              </button>
            </div>
          </div>
          
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Category tabs - only show if not in favorites mode */}
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
            
            {/* Play list area */}
            <div className={`${playPoolFilterType === 'favorites' ? 'w-full' : 'w-2/3'} pl-1 flex-1 min-h-0`}>
              {playPoolFilterType === 'favorites' && (
                <div className="mb-2 text-sm font-medium text-center text-yellow-600">
                  <Star className="inline-block h-4 w-4 mr-1 fill-yellow-400" />
                  Favorite Plays
                </div>
              )}
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
                    {playPoolFilterType === 'favorites'
                      ? "No favorite plays yet. Star plays in the Play Pool page."
                      : "No plays available in this category"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Update the renderPrintableList function
  const renderPrintableList = (title: string, plays: PlayCall[] | undefined, bgColor: string = "bg-blue-100") => {
    // Check if plays is undefined and provide an empty array as fallback
    const safetyPlays = plays || [];
    
    // Filter only non-empty plays
    const filledPlays = safetyPlays.filter(p => p.play);
    
    // If no plays, don't render anything
    if (filledPlays.length === 0) {
      return null;
    }
    
    return (
      <div className="break-inside-avoid">
        <div className={`${bgColor} p-0.5 font-bold border-b text-xxs flex justify-between items-center`}>
          <span>{title}</span>
          <span className="text-xs">({filledPlays.length})</span>
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
          </tbody>
        </table>
      </div>
    );
  };

  // Function to render play pool in absolute position with responsive positioning
  const renderPlayPoolAbsolute = (section: keyof GamePlan) => {
    if (showPlayPool && playPoolSection === section) {
      return (
        <div className={`
          absolute z-10
          ${section === 'openingScript' 
            ? 'md:right-[-35%] md:w-[33%] md:top-0 md:h-full'
            : 'md:right-[-105%] md:w-[100%] md:top-0 md:h-full'}
          left-0 top-full w-full mt-2 md:mt-0
        `}>
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

    setIsGenerating(true);
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

      // Format plays for the API
      const formattedPlays = playPool.map(p => formatPlayFromPool(p));

      // Call our API route
      const response = await fetch('/api/generate-gameplan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playPool: formattedPlays
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

      // Update each section
      for (const [section, plays] of Object.entries(gamePlan)) {
        const sectionKey = section as keyof GamePlan;
        for (let i = 0; i < (plays as string[]).length; i++) {
          const playName = (plays as string[])[i];
          const play = findPlayByName(playName);
          if (play) {
            await savePlayToGamePlan(play, sectionKey, i);
          }
        }
      }

      // Refresh the page to show the new game plan
      window.location.reload();

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
      setIsGenerating(false);
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
        <Button onClick={loadInitialData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  // Check if playpool is empty
  const isPlayPoolEmpty = playPool.length === 0;

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
  if (isGamePlanEmpty) {
    console.log('Game plan is empty, showing build options');
    return (
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
              className="bg-blue-900 hover:bg-blue-800 text-white min-w-[250px]"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
              onClick={() => setPlan({ 
                openingScript: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                basePackage1: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                basePackage2: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                basePackage3: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                firstDowns: Array(10).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                secondAndShort: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                secondAndLong: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                shortYardage: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                thirdAndLong: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                redZone: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                goalline: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                backedUp: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                screens: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                playAction: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' }),
                deepShots: Array(5).fill({ formation: '', fieldAlignment: '+', motion: '', play: '', runDirection: '+' })
              })}
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
    );
  }

  return (
    <>
      {isGenerating && <LoadingModal />}
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
                <h1 className="text-sm font-bold mb-0">Game Plan</h1>
                <div className="text-xs flex justify-center items-center gap-4">
                  <span>✓ = Called</span>
                  <span>★ = Key Play</span>
                  {selectedOpponent && (
                    <span className="font-semibold">vs. {selectedOpponent}</span>
                  )}
                </div>
              </div>
              
              <div className="print-grid">
                {/* Opening Script - spans full width */}
                <div className="col-span-full mb-1">
                  {renderPrintableList("Opening Script", plan.openingScript, "bg-amber-100")}
                </div>
                
                {/* Base Packages - all in same row */}
                <div>
                  {renderPrintableList("Base Package 1", plan.basePackage1, "bg-green-100")}
                </div>
                <div>
                  {renderPrintableList("Base Package 2", plan.basePackage2, "bg-green-100")}
                </div>
                <div>
                  {renderPrintableList("Base Package 3", plan.basePackage3, "bg-green-100")}
                </div>
                
                {/* Down and Distance */}
                <div>
                  {renderPrintableList("First Downs", plan.firstDowns, "bg-blue-100")}
                </div>
                <div>
                  {renderPrintableList("Short Yardage", plan.shortYardage, "bg-blue-100")}
                </div>
                <div>
                  {renderPrintableList("3rd and Long", plan.thirdAndLong, "bg-blue-100")}
                </div>
                
                {/* Field Position */}
                <div>
                  {renderPrintableList("Red Zone", plan.redZone, "bg-red-100")}
                </div>
                <div>
                  {renderPrintableList("Goalline", plan.goalline, "bg-red-100")}
                </div>
                <div>
                  {renderPrintableList("Backed Up", plan.backedUp, "bg-red-100")}
                </div>
                
                {/* Special Categories */}
                <div>
                  {renderPrintableList("Screens", plan.screens, "bg-purple-100")}
                </div>
                <div>
                  {renderPrintableList("Play Action", plan.playAction, "bg-purple-100")}
                </div>
                <div>
                  {renderPrintableList("Deep Shots", plan.deepShots, "bg-purple-100")}
                </div>
              </div>
            </div>
          </div>

        <div ref={componentRef} className="space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold">Game Plan</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.push('/scouting')} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
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

              <Button 
                  onClick={handleGenerateGamePlan}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin mr-2">
                        <Wand2 className="h-4 w-4" />
                      </div>
                      Generating Game Plan...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Game Plan with AI
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Opening Script - Special row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-3">
                <div className="relative">
                  {renderPlayListCard("Opening Script", plan.openingScript, 10, "bg-amber-100", "openingScript")}
                  {renderPlayPoolAbsolute('openingScript')}
                </div>
              </div>
            </div>
            
            {/* Base Package row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Base Package 1", plan.basePackage1, 10, "bg-green-100", "basePackage1")}
                  {renderPlayPoolAbsolute('basePackage1')}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Base Package 2", plan.basePackage2, 10, "bg-green-100", "basePackage2")}
                  {renderPlayPoolAbsolute('basePackage2')}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Base Package 3", plan.basePackage3, 10, "bg-green-100", "basePackage3")}
                  {renderPlayPoolAbsolute('basePackage3')}
                </div>
              </div>
            </div>

            {/* Down and Distance row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("First Downs", plan.firstDowns, 10, "bg-blue-100", "firstDowns")}
                  {renderPlayPoolAbsolute('firstDowns')}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Short Yardage", plan.shortYardage, 5, "bg-blue-100", "shortYardage")}
                  {renderPlayPoolAbsolute('shortYardage')}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("3rd and Long", plan.thirdAndLong, 5, "bg-blue-100", "thirdAndLong")}
                  {renderPlayPoolAbsolute('thirdAndLong')}
                </div>
              </div>
            </div>

            {/* Field Position row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Red Zone", plan.redZone, 5, "bg-red-100", "redZone")}
                  {renderPlayPoolAbsolute('redZone')}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Goalline", plan.goalline, 5, "bg-red-100", "goalline")}
                  {renderPlayPoolAbsolute('goalline')}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Backed Up", plan.backedUp, 5, "bg-red-100", "backedUp")}
                  {renderPlayPoolAbsolute('backedUp')}
                </div>
              </div>
            </div>

            {/* Special Categories row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Screens", plan.screens, 5, "bg-purple-100", "screens")}
                  {renderPlayPoolAbsolute('screens')}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Play Action", plan.playAction, 5, "bg-purple-100", "playAction")}
                  {renderPlayPoolAbsolute('playAction')}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="relative">
                  {renderPlayListCard("Deep Shots", plan.deepShots, 5, "bg-purple-100", "deepShots")}
                  {renderPlayPoolAbsolute('deepShots')}
                </div>
              </div>
            </div>
          </div>
        </div>
        <DragLayer isDragging={isDragging} play={draggingPlay} />
      </DragDropContext>
    </>
  )
}
