"use client"

import { useState, useEffect, useRef, MouseEventHandler } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Download, ArrowLeft, Trash2, GripVertical, Plus } from "lucide-react"
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
    onAfterPrint: () => console.log('Print completed')
  })

  const handlePrint: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.preventDefault();
    printHandler();
  };

  // Helper function to get the label for a concept value
  const getLabelForValue = (category: ConceptCategory, value: string): string => {
    const option = conceptOptions[category].find(opt => opt.value === value);
    return option?.label || value;
  }

  // Helper function to format a play call using labels instead of concepts
  const formatPlayCall = (play: PlayCall) => {
    // Find the label for the formation
    const formationLabel = getLabelForValue('formation', play.formation);
    
    // Find the label for the motion if it exists
    let motionLabel = play.motion;
    if (play.motion === 'Jet') motionLabel = 'jet';
    if (play.motion === 'Orbit') motionLabel = 'orb';
    if (play.motion === 'Shift') motionLabel = 'zm';
    
    // Try to find the label for the play concept
    let playLabel = play.play;
    for (const category of ['run', 'pass', 'screen'] as ConceptCategory[]) {
      const option = conceptOptions[category].find(opt => opt.value === play.play);
      if (option) {
        playLabel = option.label;
        break;
      }
    }
    
    // For run plays, add the run direction
    const isRun = conceptOptions.run.some(option => option.value === play.play);
    const runDirectionText = isRun && play.runDirection ? ` ${play.runDirection}` : '';
    
    return `${formationLabel} ${play.fieldAlignment}${motionLabel ? ` ${motionLabel}` : ''} ${playLabel}${runDirectionText}`;
  }

  useEffect(() => {
    async function generatePlan() {
      if (!plan) {
        setLoading(true)
        try {
          const result = await makeGamePlan({
            fronts: load('fronts_pct', {}),
            coverages: load('coverages_pct', {}),
            blitz: load('blitz_pct', {}),
            terms: load('terms', []),
            preferences: {
              runPassRatio,
              basePackage1: selectedConcept1 !== "none" ? `${selectedCategory1}:${selectedConcept1}` : "none",
              basePackage2: selectedConcept2 !== "none" ? `${selectedCategory2}:${selectedConcept2}` : "none",
              basePackage3: selectedConcept3 !== "none" ? `${selectedCategory3}:${selectedConcept3}` : "none",
              motionPercentage,
              specificConcepts: [
                ...(selectedConcept1 !== "none" ? [`${selectedCategory1}:${selectedConcept1}`] : []),
                ...(selectedConcept2 !== "none" ? [`${selectedCategory2}:${selectedConcept2}`] : []),
                ...(selectedConcept3 !== "none" ? [`${selectedCategory3}:${selectedConcept3}`] : [])
              ]
            }
          })
          if (result) {
            const generatedPlan = JSON.parse(result) as GamePlan
            setPlan(generatedPlan)
            save('plan', generatedPlan)
          }
        } catch (error) {
          console.error('Error generating plan:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    generatePlan()
  }, [plan, runPassRatio, selectedCategory1, selectedConcept1, selectedCategory2, selectedConcept2, selectedCategory3, selectedConcept3, motionPercentage])

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
          {(section === 'openingScript' || section === 'basePackage1') && (
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
              {showPlayPool && playPoolSection === section ? "Hide" : "Show"} Play Pool
            </Button>
          )}
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
      
      // Convert Play to PlayCall
      const newPlay: PlayCall = {
        formation: play.formation || '',
        fieldAlignment: (play.strength as "+" | "-") || '+',
        motion: play.motion_shift || '',
        play: play.concept || play.pass_screen_concept || '',
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

  const renderPlayPool = () => {
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

    return (
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-2">Play Pool</h3>
        
        <div className="p-2 mb-2 bg-blue-50 text-blue-800 text-sm rounded">
          Click the "+ Add" button to add a play to the {
            playPoolSection === 'openingScript' ? 'Opening Script' : 
            playPoolSection === 'basePackage1' ? 'Base Package 1' : 
            playPoolSection === 'basePackage2' ? 'Base Package 2' : 
            playPoolSection === 'basePackage3' ? 'Base Package 3' : ''
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
                filteredPlays.map((play, index) => (
                  <div 
                    key={index}
                    className="p-2 bg-gray-50 border border-gray-200 rounded flex justify-between items-center"
                  >
                    <div className="text-sm font-mono">
                      {formatPlayFromPool(play)}
                    </div>
                    <button
                      onClick={() => handleAddPlayToSection(play)}
                      className="text-xs border border-green-200 text-green-700 hover:bg-green-50 ml-1 px-2 py-0 h-6 rounded"
                    >
                      + Add
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">No plays available in this {playPoolFilterType === 'category' ? 'category' : 'formation'}</p>
              )}
            </div>
          </div>
        </div>
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
              <CardTitle>Game Plan Preferences</CardTitle>
              </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Run/Pass Ratio</Label>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-right w-16">
                    <div>Run</div>
                    <div className="font-semibold">{runPassRatio}%</div>
                  </div>
                  <Slider
                    value={[runPassRatio]}
                    onValueChange={(value) => setRunPassRatio(value[0])}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <div className="text-sm w-16">
                    <div>Pass</div>
                    <div className="font-semibold">{100 - runPassRatio}%</div>
                  </div>
                </div>
              </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Base Package 1</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={selectedCategory1} onValueChange={(value: ConceptCategory) => {
                        setSelectedCategory1(value)
                        setSelectedConcept1("none")
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="formation">Formation</SelectItem>
                          <SelectItem value="run">Run Concept</SelectItem>
                          <SelectItem value="pass">Pass Concept</SelectItem>
                          <SelectItem value="screen">Screen Concept</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select 
                        value={selectedConcept1} 
                        onValueChange={setSelectedConcept1}
                        disabled={!selectedCategory1}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select concept" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {selectedCategory1 && conceptOptions[selectedCategory1].map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Base Package 2</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={selectedCategory2} onValueChange={(value: ConceptCategory) => {
                        setSelectedCategory2(value)
                        setSelectedConcept2("none")
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="formation">Formation</SelectItem>
                          <SelectItem value="run">Run Concept</SelectItem>
                          <SelectItem value="pass">Pass Concept</SelectItem>
                          <SelectItem value="screen">Screen Concept</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select 
                        value={selectedConcept2} 
                        onValueChange={setSelectedConcept2}
                        disabled={!selectedCategory2}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select concept" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {selectedCategory2 && conceptOptions[selectedCategory2].map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                </div>

              <div className="space-y-2">
                    <Label>Base Package 3</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={selectedCategory3} onValueChange={(value: ConceptCategory) => {
                        setSelectedCategory3(value)
                        setSelectedConcept3("none")
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="formation">Formation</SelectItem>
                          <SelectItem value="run">Run Concept</SelectItem>
                          <SelectItem value="pass">Pass Concept</SelectItem>
                          <SelectItem value="screen">Screen Concept</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select 
                        value={selectedConcept3} 
                        onValueChange={setSelectedConcept3}
                        disabled={!selectedCategory3}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select concept" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {selectedCategory3 && conceptOptions[selectedCategory3].map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
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
                Generate Game Plan
              </Button>
              </CardContent>
            </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Opening Script - Special color to stand out */}
            <div className={showPlayPool && playPoolSection === 'openingScript' ? 'col-span-1 md:col-span-1 xl:col-span-2' : 'col-span-1 md:col-span-2 xl:col-span-3'}>
              {renderPlayListCard("Opening Script", plan.openingScript, 7, "bg-amber-100", "openingScript")}
            </div>
            
            {/* Play Pool if visible and triggered by Opening Script */}
            {showPlayPool && playPoolSection === 'openingScript' && (
              <div className="col-span-1">
                {renderPlayPool()}
              </div>
            )}
            
            {/* Base Package 1 */}
            <div className={showPlayPool && playPoolSection === 'basePackage1' ? 'col-span-1 md:col-span-1 xl:col-span-2' : 'col-span-1 md:col-span-2 xl:col-span-3'}>
              {renderPlayListCard("Base Package 1", plan.basePackage1, 10, "bg-green-100", "basePackage1")}
            </div>
            
            {/* Play Pool if visible and triggered by Base Package 1 */}
            {showPlayPool && playPoolSection === 'basePackage1' && (
              <div className="col-span-1">
                {renderPlayPool()}
              </div>
            )}
            
            {/* Other Sections */}
            <div className="col-span-1 md:col-span-2 xl:col-span-3">
              {renderPlayListCard("Base Package 2", plan.basePackage2, 10, "bg-green-100", "basePackage2")}
            </div>
            <div className="col-span-1 md:col-span-2 xl:col-span-3">
              {renderPlayListCard("Base Package 3", plan.basePackage3, 10, "bg-green-100", "basePackage3")}
            </div>

            {/* Situational */}
            <div className="col-span-1 md:col-span-2 xl:col-span-3">
              {renderPlayListCard("First Downs", plan.firstDowns, 10, "bg-blue-100", "firstDowns")}
            </div>
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("2nd and Short", plan.secondAndShort, 5, "bg-blue-100", "secondAndShort")}
            </div>
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("2nd and Long", plan.secondAndLong, 5, "bg-blue-100", "secondAndLong")}
            </div>
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("Short Yardage", plan.shortYardage, 5, "bg-blue-100", "shortYardage")}
            </div>
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("3rd and Long", plan.thirdAndLong, 5, "bg-blue-100", "thirdAndLong")}
            </div>
            
            {/* Field Position */}
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("Red Zone", plan.redZone, 5, "bg-red-100", "redZone")}
            </div>
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("Goalline", plan.goalline, 5, "bg-red-100", "goalline")}
            </div>
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("Backed Up", plan.backedUp, 5, "bg-red-100", "backedUp")}
            </div>
            
            {/* Special Categories */}
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("Screens", plan.screens, 5, "bg-purple-100", "screens")}
            </div>
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("Play Action", plan.playAction, 5, "bg-purple-100", "playAction")}
            </div>
            <div className="col-span-1 md:col-span-1 xl:col-span-1">
              {renderPlayListCard("Deep Shots", plan.deepShots, 5, "bg-purple-100", "deepShots")}
            </div>
          </div>
        </div>
      </div>
      <DragLayer isDragging={isDragging} play={draggingPlay} />
    </DragDropContext>
  )
}
