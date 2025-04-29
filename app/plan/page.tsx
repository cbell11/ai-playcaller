"use client"

import { useState, useEffect, useRef, MouseEventHandler } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Download, ArrowLeft, Trash2, GripVertical, Plus, Star, Check, Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { load, save } from "@/lib/local"
import { makeGamePlan } from "@/app/actions"
import { getPlayPool, Play } from "@/lib/playpool"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Slider } from "../components/ui/slider"
import { Textarea } from "../components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

// Add a helper component for displaying a dragging item
const DragItem = ({ play, snapshot }: { play: Play, snapshot: any }) => {
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
};

// Add a global drag layer component
function DragLayer({ isDragging, play }: { isDragging: boolean, play: Play | null }) {
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

// Add new types for the cascading dropdowns
type ConceptCategory = 'formation' | 'run' | 'pass' | 'screen'

interface ConceptOption {
  category: ConceptCategory
  value: string
  label: string
}

interface GamePlan {
  openingScript: PlayCall[]
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

// Add new utility function to format a play from the play pool
function formatPlayFromPool(play: Play): string {
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

// Add categories for filtering
const CATEGORIES = {
  run_game: "Run Game",
  quick_game: "Quick Game",
  dropback_game: "Dropback Game",
  shot_plays: "Shot Plays",
  screen_game: "Screen Game"
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

export default function PlanPage() {
  const router = useRouter()
  const componentRef = useRef<HTMLDivElement>(null)
  const [plan, setPlan] = useState<GamePlan | null>(() => load('plan', null))
  const [loading, setLoading] = useState(false)
  const [runPassRatio, setRunPassRatio] = useState<number>(50)
  const [basePackage1, setBasePackage1] = useState<string>("none")
  const [basePackage2, setBasePackage2] = useState<string>("none")
  const [basePackage3, setBasePackage3] = useState<string>("none")
  const [motionPercentage, setMotionPercentage] = useState<number>(50)
  const [specificConcepts, setSpecificConcepts] = useState<string[]>([])

  // Add new state for cascading dropdowns
  const [selectedCategory1, setSelectedCategory1] = useState<ConceptCategory | ''>('')
  const [selectedConcept1, setSelectedConcept1] = useState<string>("none")
  const [selectedCategory2, setSelectedCategory2] = useState<ConceptCategory | ''>('')
  const [selectedConcept2, setSelectedConcept2] = useState<string>("none")
  const [selectedCategory3, setSelectedCategory3] = useState<ConceptCategory | ''>('')
  const [selectedConcept3, setSelectedConcept3] = useState<string>("none")

  const [isDragging, setIsDragging] = useState(false);
  const [draggingPlay, setDraggingPlay] = useState<Play | null>(null);

  const [playPool, setPlayPool] = useState<Play[]>([]);
  const [showPlayPool, setShowPlayPool] = useState(false);
  const [playPoolCategory, setPlayPoolCategory] = useState<keyof typeof CATEGORIES>('run_game');
  const [playPoolSection, setPlayPoolSection] = useState<keyof GamePlan | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [playPoolFilterType, setPlayPoolFilterType] = useState<'category' | 'formation'>('category');
  const [selectedFormation, setSelectedFormation] = useState<string>('Trips');

  // Add state for print orientation
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // Define concept options for each category
  const conceptOptions: Record<ConceptCategory, ConceptOption[]> = {
    formation: [
      { category: 'formation', value: 'Trips', label: 'trps' },
      { category: 'formation', value: 'Deuce', label: 'duce' },
      { category: 'formation', value: 'Trey', label: 'trey' },
      { category: 'formation', value: 'Empty', label: 'mt' },
      { category: 'formation', value: 'Queen', label: 'q' },
      { category: 'formation', value: 'Sam', label: 'sam' },
      { category: 'formation', value: 'Will', label: 'will' },
      { category: 'formation', value: 'Bunch', label: 'bunch' }
    ],
    run: [
      { category: 'run', value: 'Inside Zone', label: 'iz' },
      { category: 'run', value: 'Outside Zone', label: 'oz' },
      { category: 'run', value: 'Power', label: 'pwr' },
      { category: 'run', value: 'Counter', label: 'ctr' },
      { category: 'run', value: 'Draw', label: 'drw' }
    ],
    pass: [
      { category: 'pass', value: 'Hoss', label: 'hoss' },
      { category: 'pass', value: 'Stick', label: 'stick' },
      { category: 'pass', value: 'Quick Out', label: 'qo' },
      { category: 'pass', value: 'Slot Fade', label: 'slfade' },
      { category: 'pass', value: 'Snag', label: 'snag' }
    ],
    screen: [
      { category: 'screen', value: 'Bubble', label: 'bub' },
      { category: 'screen', value: 'Tunnel', label: 'tnl' },
      { category: 'screen', value: 'Quick', label: 'qck' }
    ]
  }

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

  // Helper function to get the label for a concept value
  const getLabelForValue = (category: ConceptCategory, value: string): string => {
    const option = conceptOptions[category].find(opt => opt.value === value);
    return option?.label || value;
  }

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

  useEffect(() => {
    async function generatePlan() {
      if (!plan) {
        setLoading(true)
        try {
          // Create an empty plan with no auto-generated plays
          const emptyPlan: GamePlan = {
            openingScript: Array(7).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            basePackage1: Array(10).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            basePackage2: Array(10).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            basePackage3: Array(10).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            firstDowns: Array(10).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            secondAndShort: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            secondAndLong: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            shortYardage: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            thirdAndLong: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            redZone: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            goalline: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            backedUp: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            screens: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            playAction: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            }),
            deepShots: Array(5).fill({
              formation: '',
              fieldAlignment: '+',
              motion: '',
              play: '',
              runDirection: '+'
            })
          };
          
          setPlan(emptyPlan);
          save('plan', emptyPlan);
        } catch (error) {
          console.error('Error creating empty plan:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    generatePlan()
  }, [plan])

  // Load the play pool when the component mounts
  useEffect(() => {
    async function loadPlayPool() {
      try {
        const plays = await getPlayPool();
        setPlayPool(plays.filter(play => play.is_enabled));
      } catch (error) {
        console.error('Error loading play pool:', error);
      }
    }
    loadPlayPool();
  }, []);

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

  // Handle drag end
  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    setDraggingPlay(null);
    
    console.log("Drag end result:", JSON.stringify(result, null, 2));
    
    // Drop outside the list or no movement
    if (!result.destination) {
      console.log("No destination");
      return;
    }
    
    // Check if dragging from play pool to game plan
    if (result.source.droppableId === 'pool-plays' && result.destination.droppableId.startsWith('section-')) {
      console.log("Dragging from pool to section");
      
      try {
        // Get the play from the pool
        const playId = result.draggableId.split('-')[1];
        console.log("Play ID:", playId);
        
        const play = playPool.find(p => p.id === playId);
        
        if (!play) {
          console.log("Play not found:", playId);
          console.log("Available play IDs:", playPool.map(p => p.id));
          return;
        }
        
        console.log("Found play:", play);
        
        // Convert Play to PlayCall
        const newPlay: PlayCall = {
          formation: play.formation || '',
          fieldAlignment: (play.strength as "+" | "-") || '+',
          motion: play.motion_shift || '',
          play: play.concept || play.pass_screen_concept || '',
          runDirection: (play.run_direction as "+" | "-") || '+'
        };
        
        console.log("New play:", newPlay);
        
        // Get the destination section
        const sectionId = result.destination.droppableId.split('-')[1] as keyof GamePlan;
        
        if (!plan || !plan[sectionId]) {
          console.log("No plan or section:", sectionId);
          return;
        }
        
        // Make a copy of the current plan
        const updatedPlan = { ...plan };
        const sectionPlays = [...updatedPlan[sectionId]];
        
        // Get the target length based on section
        const targetLength = sectionId === 'openingScript' ? 7 : 
                            (sectionId.startsWith('basePackage') ? 10 : 5);
        
        console.log("Target length for section:", targetLength);
        console.log("Current plays in section:", sectionPlays);
        
        // Separate empty and non-empty plays
        const nonEmptyPlays = sectionPlays.filter(p => p.formation);
        const emptyPlays = sectionPlays.filter(p => !p.formation);
        
        console.log("Non-empty plays:", nonEmptyPlays);
        console.log("Empty plays:", emptyPlays);
        
        // Create the new list of plays with the new play inserted
        let updatedPlays: PlayCall[];
        
        // Insert at beginning if dropping at index 0
        if (result.destination.index === 0) {
          updatedPlays = [newPlay, ...nonEmptyPlays];
        } 
        // Append if dropping at end or after last non-empty
        else if (result.destination.index >= nonEmptyPlays.length) {
          updatedPlays = [...nonEmptyPlays, newPlay];
        } 
        // Insert in the middle
        else {
          updatedPlays = [
            ...nonEmptyPlays.slice(0, result.destination.index),
            newPlay,
            ...nonEmptyPlays.slice(result.destination.index)
          ];
        }
        
        console.log("After insertion:", updatedPlays);
        
        // Trim if too many
        if (updatedPlays.length > targetLength) {
          updatedPlays = updatedPlays.slice(0, targetLength);
          console.log("Trimmed plays:", updatedPlays);
        }
        
        // Fill with empty plays if needed
        while (updatedPlays.length < targetLength) {
          updatedPlays.push({
            formation: '',
            fieldAlignment: '+',
            motion: '',
            play: '',
            runDirection: '+'
          });
        }
        
        console.log("Final updated plays:", updatedPlays);
        
        // Update the section in the plan
        updatedPlan[sectionId] = updatedPlays;
        
        // Save the updated plan
        setPlan(updatedPlan);
        save('plan', updatedPlan);
        
        console.log("Plan updated successfully");
      } catch (error) {
        console.error("Error handling drag:", error);
      }
      
      return;
    }
    
    // Handle normal reordering within a section
    if (result.source.droppableId === result.destination.droppableId) {
      // Identify which section was affected
      const sectionId = result.source.droppableId.split('-')[1] as keyof GamePlan;
      
      if (!plan || !plan[sectionId]) return;
      
      // Make a copy of the current plan
      const updatedPlan = { ...plan };
      const updatedPlays = [...updatedPlan[sectionId]];
      
      // Reorder the plays
      const [movedPlay] = updatedPlays.splice(result.source.index, 1);
      updatedPlays.splice(result.destination.index, 0, movedPlay);
      
      // Update the plan
      updatedPlan[sectionId] = updatedPlays;
      setPlan(updatedPlan);
      save('plan', updatedPlan);
    }
  };

  // Helper function to render a play list card with drag and drop
  const renderPlayListCard = (
    title: string,
    plays: PlayCall[],
    expectedLength: number,
    bgColor: string = "bg-blue-100",
    section: keyof GamePlan
  ) => {
    const filledPlays = [...plays];
    
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
    
    return (
    <Card className="bg-white rounded shadow">
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
      <CardContent className="p-0">
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
                  const hasContent = !!play.formation;
                  
                  if (!hasContent) {
                    // Render empty slot without draggable
                    return (
                      <div key={`${section}-${index}-empty`} className="px-4 py-2 flex items-center">
                        <span className="w-6 text-slate-500">{index + 1}.</span>
                        <span className="text-gray-400 italic border border-dashed border-gray-300 rounded p-2 flex-1 text-center">
                          Drop play here
                        </span>
                      </div>
                    );
                  }
                  
                  return (
                    <Draggable 
                      key={`${section}-${index}`} 
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
                            <span>{formatPlayCall(play)}</span>
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
  )
  }

  // Function to delete a play
  const handleDeletePlay = (section: keyof GamePlan, index: number) => {
    if (!plan) return;
    
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
  };

  // Function to add a play from the pool to the current section
  const handleAddPlayToSection = (play: Play) => {
    if (!plan || !playPoolSection) return;
    
    try {
      console.log("Adding play to section:", playPoolSection);
      console.log("Play being added:", play);
      
      // Get the formatted play string directly
      const playString = formatPlayFromPool(play);
      
      // Create a PlayCall object with the full string
      const newPlay: PlayCall = {
        formation: play.formation || '',
        fieldAlignment: (play.strength as "+" | "-") || '+',
        motion: play.motion_shift || '',
        play: playString, // Use the full formatted string as the play
        runDirection: (play.run_direction as "+" | "-") || '+'
      };
      
      console.log("New play created:", newPlay);
      
      // Make a copy of the current plan
      const updatedPlan = { ...plan };
      const sectionPlays = [...updatedPlan[playPoolSection]];
      
      // Get the target length based on section
      const targetLength = playPoolSection === 'openingScript' ? 7 : 
                          (playPoolSection.startsWith('basePackage') ? 10 : 5);
      
      // Separate empty and non-empty plays
      const nonEmptyPlays = sectionPlays.filter(p => p.formation);
      const emptyPlays = sectionPlays.filter(p => !p.formation);
      
      let updatedPlays: PlayCall[];
      
      // If we already have the max number of non-empty plays, replace the last one
      if (nonEmptyPlays.length >= targetLength) {
        // Replace the last play
        nonEmptyPlays[nonEmptyPlays.length - 1] = newPlay;
        updatedPlays = nonEmptyPlays;
      } else {
        // Add the new play to the end of non-empty plays
        updatedPlays = [...nonEmptyPlays, newPlay];
      }
      
      // Add empty plays to fill to target length
      while (updatedPlays.length < targetLength) {
        updatedPlays.push({
          formation: '',
          fieldAlignment: '+',
          motion: '',
          play: '',
          runDirection: '+'
        });
      }
      
      // Update the plan
      updatedPlan[playPoolSection] = updatedPlays;
      setPlan(updatedPlan);
      save('plan', updatedPlan);
      
      // Show success notification
      setNotification({
        message: `Added to ${playPoolSection === 'openingScript' ? 'Opening Script' : 
                 playPoolSection === 'basePackage1' ? 'Base Package 1' : 
                 playPoolSection === 'basePackage2' ? 'Base Package 2' : 
                 playPoolSection === 'basePackage3' ? 'Base Package 3' : 
                 playPoolSection}`,
        type: 'success'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
      
    } catch (error) {
      console.error("Error adding play:", error);
      
      // Show error notification
      setNotification({
        message: "Failed to add play",
        type: 'error'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  // Function to check if a play is already in a section
  const isPlayInSection = (play: Play, sectionPlays: PlayCall[]): boolean => {
    if (!playPoolSection) return false;
    
    const playText = formatPlayFromPool(play);
    
    return sectionPlays.some(sectionPlay => {
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
      if (playPoolFilterType === 'formation') {
        // Filter by selected formation
        return play.formation === selectedFormation;
      } else {
        // Filter by category (existing logic)
        if (playPoolCategory === 'run_game') {
          return play.category === 'run_game';
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

    // Get unique formations for the formation filter
    const formationsMap: Record<string, boolean> = {};
    playPool.forEach(play => {
      if (play.formation) {
        formationsMap[play.formation] = true;
      }
    });
    const formations = Object.keys(formationsMap).sort();

    // Get current section plays for checking if a play is already in the section
    const sectionPlays = plan[playPoolSection] || [];

    return (
      <div className="bg-white p-4 rounded-lg shadow-md w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">Play Pool</h3>
        
        <div className="p-2 mb-2 bg-blue-50 text-blue-800 text-sm rounded">
          Click the "+ Add" button to add a play to the {
            playPoolSection === 'openingScript' ? 'Opening Script' : 
            playPoolSection === 'basePackage1' ? 'Base Package 1' : 
            playPoolSection === 'basePackage2' ? 'Base Package 2' : 
            playPoolSection === 'basePackage3' ? 'Base Package 3' : 
            playPoolSection
          }
        </div>
        
        {/* Filter type selector */}
        <div className="flex justify-center mb-3 border-b pb-2">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
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
              className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                playPoolFilterType === 'formation' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setPlayPoolFilterType('formation')}
            >
              By Formation
            </button>
          </div>
        </div>
        
        <div className="flex">
          {/* Vertical tabs for either categories or formations */}
          <div className="w-1/3 border-r pr-2">
            {playPoolFilterType === 'category' ? (
              // Render category tabs
              Object.entries(CATEGORIES).map(([key, label]) => (
                <button 
                  key={key}
                  className={`w-full text-left py-2 px-3 mb-1 rounded ${playPoolCategory === key ? 'bg-blue-100 font-medium' : 'hover:bg-gray-100'}`}
                  onClick={() => setPlayPoolCategory(key as any)}
                >
                  {label}
                </button>
              ))
            ) : (
              // Render formation tabs
              formations.map((formation) => (
                <button 
                  key={formation}
                  className={`w-full text-left py-2 px-3 mb-1 rounded ${selectedFormation === formation ? 'bg-blue-100 font-medium' : 'hover:bg-gray-100'}`}
                  onClick={() => setSelectedFormation(formation)}
                >
                  {formation}
                </button>
              ))
            )}
          </div>
          
          {/* Play list area */}
          <div className="w-2/3 pl-2">
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredPlays.length > 0 ? (
                filteredPlays.map((play, index) => {
                  const alreadyInSection = isPlayInSection(play, sectionPlays);
                  return (
                    <div 
                      key={index}
                      className={`p-2 border rounded flex justify-between items-center ${
                        alreadyInSection ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className={`text-sm font-mono ${alreadyInSection ? 'text-gray-500' : ''}`}>
                        {formatPlayFromPool(play)}
                      </div>
                      {alreadyInSection ? (
                        <div className="text-xs text-gray-500 ml-1 px-3 py-1 border border-gray-300 rounded">
                          In Script
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddPlayToSection(play)}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 ml-1 rounded"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 italic">No plays available in this {playPoolFilterType === 'category' ? 'category' : 'formation'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Add a function to format plays for printable version
  const renderPrintableList = (title: string, plays: PlayCall[], bgColor: string = "bg-blue-100") => {
    // Filter only non-empty plays to save space
    const filledPlays = plays.filter(p => p.formation);
    
    return (
      <div className="break-inside-avoid">
        <div className={`${bgColor} p-0.5 font-bold border-b text-xxs`}>
          {title}
        </div>
        <table className="w-full border-collapse text-xxs">
          <thead>
            <tr className="border-b">
              <th className="py-0 px-0.5 text-left w-2">★</th>
              <th className="py-0 px-0.5 text-left w-2">✓</th>
              <th className="py-0 px-0.5 text-left w-2">#</th>
              <th className="py-0 px-0.5 text-left">Play</th>
            </tr>
          </thead>
          <tbody>
            {filledPlays.slice(0, title === "Opening Script" ? 7 : (title.startsWith("Base Package") ? 8 : 5)).map((play, idx) => (
              <tr key={idx} className="border-b">
                <td className="py-0 px-0.5 border-r">□</td>
                <td className="py-0 px-0.5 border-r">□</td>
                <td className="py-0 px-0.5 border-r">{idx + 1}</td>
                <td className="py-0 px-0.5 font-mono text-xxs whitespace-nowrap overflow-hidden text-ellipsis">{formatPlayCall(play)}</td>
              </tr>
            ))}
            {/* Add empty row only if no plays */}
            {filledPlays.length === 0 && (
              <tr><td colSpan={4} className="py-0.25 text-center text-gray-400 italic text-xxs">Empty</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-xl font-semibold animate-pulse">Generating Game Plan...</div>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-xl font-semibold text-gray-600">No plan generated yet.</p>
        </div>
      </div>
    )
  }

  return (
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
                  margin: 5mm;
                }
                
                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  font-size: 7pt !important;
                }
                
                .landscape {
                  width: 297mm;
                  height: 210mm;
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
                  gap: 1mm;
                  page-break-after: avoid;
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
                  font-size: 6.5pt;
                }
              `}
            </style>
            
            <div className="text-center mb-1">
              <h1 className="text-sm font-bold mb-0">Game Plan</h1>
              <p className="text-xs mb-1">✓ = Called &nbsp;&nbsp; ★ = Key Play</p>
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
              
              {/* Down & Distance */}
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
            <Download className="h-4 w-4" />
            Download PDF
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
                onClick={() => {
                  setPlan(null);
                  setShowPlayPool(false);
                  setDraggingPlay(null);
                  setIsDragging(false);
                }} 
              className="w-full"
              variant="default"
            >
                Create New Empty Game Plan
            </Button>
            </CardContent>
          </Card>

          {/* Opening Script - Special row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={showPlayPool && playPoolSection === 'openingScript' ? 'col-span-2' : 'col-span-3'}>
              {renderPlayListCard("Opening Script", plan.openingScript, 7, "bg-amber-100", "openingScript")}
            </div>
            
            {showPlayPool && playPoolSection === 'openingScript' && (
              <div className="col-span-1">
                {renderPlayPool()}
              </div>
            )}
          </div>
          
          {/* Base Package 1 row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className={showPlayPool && playPoolSection === 'basePackage1' ? 'col-span-2' : 'col-span-1'}>
              {renderPlayListCard("Base Package 1", plan.basePackage1, 10, "bg-green-100", "basePackage1")}
            </div>
            
            {showPlayPool && playPoolSection === 'basePackage1' ? (
              <div className="col-span-1">
                {renderPlayPool()}
              </div>
            ) : (
              <>
                <div className="col-span-1">
                  {renderPlayListCard("Base Package 2", plan.basePackage2, 10, "bg-green-100", "basePackage2")}
                </div>
                <div className="col-span-1">
                  {renderPlayListCard("Base Package 3", plan.basePackage3, 10, "bg-green-100", "basePackage3")}
                </div>
              </>
            )}
          </div>

          {/* Base Package 2 row */}
          {showPlayPool && playPoolSection === 'basePackage2' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-2">
                {renderPlayListCard("Base Package 2", plan.basePackage2, 10, "bg-green-100", "basePackage2")}
              </div>
              <div className="col-span-1">
                {renderPlayPool()}
              </div>
            </div>
          )}

          {/* Base Package 3 row */}
          {showPlayPool && playPoolSection === 'basePackage3' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-2">
                {renderPlayListCard("Base Package 3", plan.basePackage3, 10, "bg-green-100", "basePackage3")}
              </div>
              <div className="col-span-1">
                {renderPlayPool()}
              </div>
            </div>
          )}

          {/* Show Base Packages 2-3 when Base Package 1 is expanded */}
          {showPlayPool && playPoolSection === 'basePackage1' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Base Package 2", plan.basePackage2, 10, "bg-green-100", "basePackage2")}
              </div>
              <div className="col-span-1">
                {renderPlayListCard("Base Package 3", plan.basePackage3, 10, "bg-green-100", "basePackage3")}
              </div>
              <div className="col-span-1">
                {renderPlayListCard("First Downs", plan.firstDowns, 10, "bg-blue-100", "firstDowns")}
              </div>
            </div>
          )}

          {/* Short Yardage, 3rd and Long, Red Zone row */}
          {!showPlayPool || (playPoolSection !== 'shortYardage' && playPoolSection !== 'thirdAndLong' && playPoolSection !== 'redZone' && 
                          playPoolSection !== 'basePackage2' && playPoolSection !== 'basePackage3') ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Short Yardage", plan.shortYardage, 5, "bg-blue-100", "shortYardage")}
              </div>
              <div className="col-span-1">
                {renderPlayListCard("3rd and Long", plan.thirdAndLong, 5, "bg-blue-100", "thirdAndLong")}
              </div>
              <div className="col-span-1">
                {renderPlayListCard("Red Zone", plan.redZone, 5, "bg-red-100", "redZone")}
              </div>
            </div>
          ) : null}

          {/* Short Yardage with play pool */}
          {showPlayPool && playPoolSection === 'shortYardage' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Short Yardage", plan.shortYardage, 5, "bg-blue-100", "shortYardage")}
              </div>
              <div className="col-span-2">
                {renderPlayPool()}
              </div>
            </div>
          )}

          {/* 3rd and Long with play pool */}
          {showPlayPool && playPoolSection === 'thirdAndLong' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("3rd and Long", plan.thirdAndLong, 5, "bg-blue-100", "thirdAndLong")}
              </div>
              <div className="col-span-2">
                {renderPlayPool()}
              </div>
            </div>
          )}

          {/* Red Zone with play pool */}
          {showPlayPool && playPoolSection === 'redZone' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Red Zone", plan.redZone, 5, "bg-red-100", "redZone")}
              </div>
              <div className="col-span-2">
                {renderPlayPool()}
              </div>
            </div>
          )}

          {/* Field Position Row */}
          {!showPlayPool || (playPoolSection !== 'goalline' && playPoolSection !== 'backedUp' && playPoolSection !== 'screens') ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Goalline", plan.goalline, 5, "bg-red-100", "goalline")}
              </div>
              <div className="col-span-1">
                {renderPlayListCard("Backed Up", plan.backedUp, 5, "bg-red-100", "backedUp")}
              </div>
              <div className="col-span-1">
                {renderPlayListCard("Screens", plan.screens, 5, "bg-purple-100", "screens")}
              </div>
            </div>
          ) : null}

          {/* Goalline with play pool */}
          {showPlayPool && playPoolSection === 'goalline' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Goalline", plan.goalline, 5, "bg-red-100", "goalline")}
              </div>
              <div className="col-span-2">
                {renderPlayPool()}
              </div>
            </div>
          )}

          {/* Backed Up with play pool */}
          {showPlayPool && playPoolSection === 'backedUp' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Backed Up", plan.backedUp, 5, "bg-red-100", "backedUp")}
              </div>
              <div className="col-span-2">
                {renderPlayPool()}
              </div>
            </div>
          )}

          {/* Screens with play pool */}
          {showPlayPool && playPoolSection === 'screens' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Screens", plan.screens, 5, "bg-purple-100", "screens")}
              </div>
              <div className="col-span-2">
                {renderPlayPool()}
              </div>
            </div>
          )}

          {/* Special Categories Row */}
          {!showPlayPool || (playPoolSection !== 'playAction' && playPoolSection !== 'deepShots') ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Play Action", plan.playAction, 5, "bg-purple-100", "playAction")}
              </div>
              <div className="col-span-1">
                {renderPlayListCard("Deep Shots", plan.deepShots, 5, "bg-purple-100", "deepShots")}
              </div>
              <div className="col-span-1">
                {/* Empty cell for alignment */}
              </div>
            </div>
          ) : null}

          {/* Play Action with play pool */}
          {showPlayPool && playPoolSection === 'playAction' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Play Action", plan.playAction, 5, "bg-purple-100", "playAction")}
              </div>
              <div className="col-span-2">
                {renderPlayPool()}
              </div>
            </div>
          )}

          {/* Deep Shots with play pool */}
          {showPlayPool && playPoolSection === 'deepShots' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="col-span-1">
                {renderPlayListCard("Deep Shots", plan.deepShots, 5, "bg-purple-100", "deepShots")}
              </div>
              <div className="col-span-2">
                {renderPlayPool()}
              </div>
            </div>
          )}
        </div>
      </div>
      <DragLayer isDragging={isDragging} play={draggingPlay} />
    </DragDropContext>
  )
}
