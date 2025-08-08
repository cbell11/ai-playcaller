"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from '@supabase/ssr'
import { Plus, FileText, Loader2, X, ChevronDown, ChevronUp } from "lucide-react"
import { load, save } from "@/lib/local"
import { getMasterFronts } from "../actions/fronts"
import { getMasterCoverages } from "../actions/coverages"
import { 
  getMasterBlitzes, 
  listAllBlitzes,
  removeProblematicBlitzes
} from "../actions/blitzes"
import {
  saveScoutingReport,
  getScoutingReport
} from "../actions/scouting-reports"
import { analyzeAndUpdatePlays } from "../actions/analyze-plays"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Slider } from "@/app/components/ui/slider"
import { Textarea } from "@/app/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { 
  DialogHighZ, 
  DialogHighZContent, 
  DialogHighZHeader, 
  DialogHighZTitle, 
  DialogHighZFooter 
} from "../components/ui/dialog-high-z"
import {
  SelectSafeDialog,
  SelectSafeDialogContent,
  SelectSafeDialogHeader,
  SelectSafeDialogFooter,
  SelectSafeDialogTitle,
} from "../components/ui/dialog-select-fix"

// Define the option type with the new fields
type ScoutingOption = {
  id?: string
  name: string
  dominateDown: string
  fieldArea: string
}

// Define master front type
type MasterFront = {
  id: string
  name: string
  created_at: string
}

// Define master coverage type
type MasterCoverage = {
  id: string
  name: string
  created_at: string
}

// Define master blitz type
type MasterBlitz = {
  id: string
  name: string
  created_at: string
}

export default function ScoutingPage() {
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedTeamName, setSelectedTeamName] = useState<string | null>(null)
  
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null)
  const [selectedOpponentName, setSelectedOpponentName] = useState<string | null>(null)
  
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  
  // Database sync status
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [savingError, setSavingError] = useState<string | null>(null)
  const [isRegeneratingPlaypool, setIsRegeneratingPlaypool] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error',
    message: string
  } | null>(null)
  
  // Master fronts state
  const [masterFronts, setMasterFronts] = useState<MasterFront[]>([])
  const [isLoadingMasterFronts, setIsLoadingMasterFronts] = useState(true)
  const [showAddFrontDialog, setShowAddFrontDialog] = useState(false)
  const [selectedFrontId, setSelectedFrontId] = useState<string>("")
  
  // Master coverages state
  const [masterCoverages, setMasterCoverages] = useState<MasterCoverage[]>([])
  const [isLoadingMasterCoverages, setIsLoadingMasterCoverages] = useState(true)
  const [showAddCoverageDialog, setShowAddCoverageDialog] = useState(false)
  const [selectedCoverageId, setSelectedCoverageId] = useState<string>("")
  
  // Master blitzes state
  const [masterBlitzes, setMasterBlitzes] = useState<MasterBlitz[]>([])
  const [isLoadingMasterBlitzes, setIsLoadingMasterBlitzes] = useState(true)
  const [showAddBlitzDialog, setShowAddBlitzDialog] = useState(false)
  const [selectedBlitzId, setSelectedBlitzId] = useState<string>("")
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Initialize state with empty arrays instead of loading from localStorage to prevent mixing data
  const [fronts, setFronts] = useState<ScoutingOption[]>([])

  // Initialize state with empty arrays instead of loading from localStorage
  const [coverages, setCoverages] = useState<ScoutingOption[]>([])

  // Initialize state with empty arrays instead of loading from localStorage
  const [blitzes, setBlitzes] = useState<ScoutingOption[]>([])

  // Initialize percentage states with empty objects
  const [frontPct, setFrontPct] = useState<Record<string, number>>({})
  const [coverPct, setCoverPct] = useState<Record<string, number>>({})
  const [blitzPct, setBlitzPct] = useState<Record<string, number>>({})

  // Initialize overall blitz percentage to 0
  const [overallBlitzPct, setOverallBlitzPct] = useState<number>(0)

  const [addingCustomTo, setAddingCustomTo] = useState<"fronts" | "coverages" | "blitzes" | null>(null)
  const [customName, setCustomName] = useState("")
  const [notes, setNotes] = useState("")

  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [report, setReport] = useState<string | null>(null)

  // Add this at the top level with other state declarations
  const initialSaveRender = useRef(true);

  // State to store the list of opponents for the dropdown
  const [opponentsList, setOpponentsList] = useState<any[]>([]);
  const [isLoadingOpponentsList, setIsLoadingOpponentsList] = useState(false);

  // Add these dialog state handlers
  const [selectedFront, setSelectedFront] = useState<MasterFront | null>(null);
  const [selectedCoverage, setSelectedCoverage] = useState<MasterCoverage | null>(null);
  const [selectedBlitz, setSelectedBlitz] = useState<MasterBlitz | null>(null);

  // Add loading state for opponent data
  const [isLoadingOpponentData, setIsLoadingOpponentData] = useState(false)

  // Add state for AI report generation
  const [isGeneratingAIReport, setIsGeneratingAIReport] = useState(false);

  // Add state for toggling the AI report display
  const [showReport, setShowReport] = useState(false);

  // Add state to prevent premature saving on initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [dataFullyLoaded, setDataFullyLoaded] = useState(false);

  // Add state for app-wide loading
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Initialize Supabase client and load data
  useEffect(() => {
    // Create Supabase client
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    setSupabaseClient(supabase)
    
    // Set app to loading state initially
    setIsAppLoading(true);

    const initializeData = async () => {
      // Set initial load flag to prevent any auto-saves until we've loaded data
      setIsInitialLoad(true);
      setDataFullyLoaded(false);
      
      try {
        // First get the current user's session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting user session:', sessionError.message);
          setIsAppLoading(false);
          return;
        }
        
        const userId = sessionData.session?.user?.id;
        
        if (!userId) {
          console.error('No user ID found. User might not be authenticated.');
          setIsAppLoading(false);
          return;
        }
        
        console.log('Found authenticated user ID:', userId);
        
        // Get the user's profile to find their team_id
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId);
          
        if (profileError) {
          console.error('Error fetching user profile:', profileError.message);
          setIsAppLoading(false);
        } else if (profileData && profileData.length > 0 && profileData[0].team_id) {
          console.log('Found team_id in user profile:', profileData[0].team_id);
          
          // Now fetch the team details
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .eq('id', profileData[0].team_id);
            
          if (teamError) {
            console.error('Error fetching team from profile:', teamError.message);
            setIsAppLoading(false);
          } else if (teamData && teamData.length > 0) {
            // Set the team info from the profile
            setSelectedTeamId(teamData[0].id);
            setSelectedTeamName(teamData[0].name);
            localStorage.setItem('selectedTeam', teamData[0].id);
            console.log('Set team from user profile:', teamData[0].name);
            
            // Get selected opponent from localStorage
            let storedOpponentId = localStorage.getItem('selectedOpponent');
            console.log('Selected opponent ID from localStorage:', storedOpponentId);
            
            // If no opponent is selected, fetch the list of opponents and use the first one
            if (!storedOpponentId) {
              console.log('No opponent selected, fetching available opponents...');
              
              try {
                // Fetch all opponents first (don't limit to 10)
                const { data: opponentsData, error: opponentsError } = await supabase
                  .from('opponents')
                  .select('id, name')
                  .order('name');
                  
                if (opponentsError) {
                  console.error('Error fetching opponents list:', opponentsError.message);
                  setIsAppLoading(false);
                } else if (opponentsData && opponentsData.length > 0) {
                  // Save the full list of opponents for the dropdown
                  setOpponentsList(opponentsData);
                  
                  // Check if we have scouting reports for any of these opponents
                  console.log('Looking for existing scouting reports...');
                  const { data: scoutingData, error: scoutingError } = await supabase
                    .from('scouting_reports')
                    .select('opponent_id')
                    .eq('team_id', teamData[0].id);
                  
                  let selectedOpId: string; // Use a non-nullable variable
                  
                  if (scoutingError) {
                    console.error('Error checking for existing scouting reports:', scoutingError.message);
                    // Fall back to using the first opponent
                    selectedOpId = opponentsData[0].id;
                  } else if (scoutingData && scoutingData.length > 0) {
                    // We have scouting reports - use the first one that matches our opponents list
                    const matchingOpponents = opponentsData.filter(
                      opponent => scoutingData.some(report => report.opponent_id === opponent.id)
                    );
                    
                    if (matchingOpponents.length > 0) {
                      console.log('Found existing scouting reports, using opponent:', matchingOpponents[0].name);
                      selectedOpId = matchingOpponents[0].id;
                    } else {
                      // No matching reports, use the first opponent
                      console.log('No matching scouting reports, using first opponent as default');
                      selectedOpId = opponentsData[0].id;
                    }
                  } else {
                    // No scouting reports found, use the first opponent
                    console.log('No scouting reports found, using first opponent as default');
                    selectedOpId = opponentsData[0].id;
                  }
                  
                  console.log('Using opponent as default:', selectedOpId);
                  
                  // Save to localStorage
                  localStorage.setItem('selectedOpponent', selectedOpId);
                  storedOpponentId = selectedOpId; // Update the original variable
                  
                  // Find the opponent details and set them
                  const opponent = opponentsData.find(o => o.id === selectedOpId);
                  if (opponent) {
                    setSelectedOpponentId(selectedOpId);
                    setSelectedOpponentName(opponent.name);
                    console.log('Set opponent name:', opponent.name);
                  } else {
                    console.error('Could not find opponent details for ID:', selectedOpId);
                    setSelectedOpponentId(selectedOpId);
                    setSelectedOpponentName(`Unknown (${selectedOpId.slice(0, 8)}...)`);
                  }
                  
                  // Load the scouting report for this opponent
                  // Pass true to indicate this is the initial load
                  const dataLoaded = await loadScoutingReport(teamData[0].id, selectedOpId, true);
                  
                  if (!dataLoaded) {
                    console.log('No data loaded for default opponent, creating empty scouting report');
                    // If no data was loaded, create an empty scouting report to save it
                    await saveToDatabase();
                  }
                } else {
                  console.log('No opponents found to use as default');
                  setIsAppLoading(false);
                  setDataFullyLoaded(true);
                }
              } catch (opponentsError) {
                console.error('Error getting default opponent:', opponentsError);
                setIsAppLoading(false);
                setDataFullyLoaded(true);
              }
            } else {
              // We have a stored opponent ID
              setSelectedOpponentId(storedOpponentId);
              
              // Fetch opponent name
              try {
                const { data, error } = await supabase
                  .from('opponents')
                  .select('name')
                  .eq('id', storedOpponentId);
                
                if (error) {
                  console.error('Error fetching opponent name:', error.message);
                  setIsAppLoading(false);
                } else if (data && data.length > 0) {
                  console.log('Found opponent name:', data[0].name);
                  setSelectedOpponentName(data[0].name);
                  
                  // Important: Now that we have both team ID and opponent ID, load the scouting report
                  // Pass true to indicate this is the initial load
                  const dataLoaded = await loadScoutingReport(teamData[0].id, storedOpponentId, true);
                  
                  if (!dataLoaded) {
                    console.log('No data loaded for stored opponent, creating empty scouting report');
                    // If no data was loaded, create an empty scouting report to save it
                    await saveToDatabase();
                  }
                } else {
                  console.log('No opponent found with ID:', storedOpponentId);
                  // Even if we can't find the opponent name, try to load data anyway
                  setSelectedOpponentName(`Unknown (${storedOpponentId.slice(0, 8)}...)`);
                  const dataLoaded = await loadScoutingReport(teamData[0].id, storedOpponentId, true);
                  
                  if (!dataLoaded) {
                    console.log('No data loaded for unknown opponent, creating empty scouting report');
                    // If no data was loaded, create an empty scouting report to save it
                    await saveToDatabase();
                  }
                }
              } catch (opponentError) {
                console.error('Exception fetching opponent:', opponentError);
                setIsAppLoading(false);
                setDataFullyLoaded(true);
              }
            }
            
            // Also fetch the full opponents list for the dropdown
            try {
              const { data: allOpponents, error: allOpponentsError } = await supabase
                .from('opponents')
                .select('id, name')
                .order('name');
              
              if (allOpponentsError) {
                console.error('Error fetching all opponents:', allOpponentsError.message);
              } else if (allOpponents) {
                setOpponentsList(allOpponents);
                console.log(`Loaded ${allOpponents.length} opponents for dropdown`);
              }
            } catch (error) {
              console.error('Exception fetching all opponents:', error);
            }
          } else {
            console.log('No team found with team_id:', profileData[0].team_id);
            setIsAppLoading(false);
          }
        } else {
          console.log('No team_id found in user profile or profile not found');
          setIsAppLoading(false);
          setDataFullyLoaded(true);
        }
      } catch (error) {
        console.error('Error in initialization:', error);
        setIsAppLoading(false);
        setDataFullyLoaded(true);
      } finally {
        // After all initialization, set initial load to false
        // This will allow auto-saves to work after the first complete load
        setTimeout(() => {
          setIsInitialLoad(false);
        }, 1000);
      }
    };
    
    initializeData();

    // Setup event listener for storage changes (for opponent selection changes from other components)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'selectedOpponent' && event.newValue) {
        console.log('Storage event: Opponent changed to:', event.newValue);
        if (event.newValue !== selectedOpponentId) {
          setSelectedOpponentId(event.newValue);
          
          // Set loading state
          setIsLoadingOpponentData(true);
          
          // Fetch the opponent name and load the scouting report
          (async () => {
            try {
              const { data, error } = await supabase
                .from('opponents')
                .select('name')
                .eq('id', event.newValue);
                
              if (error) {
                console.error('Error fetching opponent from storage event:', error.message);
                setIsLoadingOpponentData(false);
              } else if (data && data.length > 0) {
                setSelectedOpponentName(data[0].name);
                console.log('Set opponent from storage event:', data[0].name);
                
                // Get the current team ID from state or localStorage
                const teamId = selectedTeamId || localStorage.getItem('selectedTeam');
                if (teamId && event.newValue) { // Add null check for TypeScript
                  await loadScoutingReport(teamId, event.newValue);
                } else {
                  setIsLoadingOpponentData(false);
                }
              } else {
                console.warn('No opponent found with ID:', event.newValue, 'but attempting to load scouting data anyway');
                
                // Even if opponent details aren't found, try to load the scouting report anyway
                if (event.newValue) {
                  setSelectedOpponentName(`Unknown (${event.newValue.slice(0, 8)}...)`);
                  
                  // Get the current team ID from state or localStorage
                  const teamId = selectedTeamId || localStorage.getItem('selectedTeam');
                  if (teamId) {
                    await loadScoutingReport(teamId, event.newValue);
                  } else {
                    console.error('No team ID available when switching opponents');
                    setIsLoadingOpponentData(false);
                  }
                } else {
                  setIsLoadingOpponentData(false);
                }
              }
            } catch (error) {
              console.error('Exception in storage event handler:', error);
              setIsLoadingOpponentData(false);
            }
          })();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Add a special event listener for our custom opponent change events
    const handleOpponentChangeEvent = (event: CustomEvent) => {
      const opponentId = event.detail?.opponentId;
      if (opponentId && opponentId !== selectedOpponentId) {
        console.log('Custom event: Opponent changed to:', opponentId);
        
        // Save current data for the current opponent before switching, only if we've fully loaded
        if (selectedTeamId && selectedOpponentId && dataFullyLoaded && !isInitialLoad) {
          console.log('Saving data for current opponent before switching');
          saveToDatabase();
        }
        
        // Then continue with the normal opponent change process
        // Set loading state first
        setIsLoadingOpponentData(true);
        
        // Update localStorage and state for the new opponent
        localStorage.setItem('selectedOpponent', opponentId);
        setSelectedOpponentId(opponentId);
        
        // Clear ALL current data before loading new data
        setFronts([]);
        setCoverages([]);
        setBlitzes([]);
        setFrontPct({});
        setCoverPct({});
        setBlitzPct({});
        setOverallBlitzPct(0);
        setNotes('');
        setReport(null);
        
        // Fetch the opponent name and load the scouting report
        (async () => {
          try {
            const { data, error } = await supabase
              .from('opponents')
              .select('name')
              .eq('id', opponentId);
              
            if (error) {
              console.error('Error fetching opponent from custom event:', error.message);
              setIsLoadingOpponentData(false);
            } else if (data && data.length > 0) {
              setSelectedOpponentName(data[0].name);
              console.log('Set opponent from custom event:', data[0].name);
              
              // Get the current team ID from state or localStorage
              const teamId = selectedTeamId || localStorage.getItem('selectedTeam');
              if (teamId) {
                // Ensure we're loading with consistent teamId/opponentId
                await loadScoutingReport(teamId, opponentId);
              } else {
                console.error('No team ID available when switching opponents');
                setIsLoadingOpponentData(false);
              }
            } else {
              console.warn('No opponent found with ID:', opponentId, 'but attempting to load scouting data anyway');
              
              // Even if opponent details aren't found, try to load the scouting report anyway
              // This handles cases where the opponent ID exists in scouting_reports but not in opponents table
              setSelectedOpponentId(opponentId);
              setSelectedOpponentName(`Unknown (${opponentId.slice(0, 8)}...)`);
              
              // Get the current team ID from state or localStorage
              const teamId = selectedTeamId || localStorage.getItem('selectedTeam');
              if (teamId) {
                await loadScoutingReport(teamId, opponentId);
              } else {
                console.error('No team ID available when switching opponents');
                setIsLoadingOpponentData(false);
              }
            }
          } catch (error) {
            console.error('Exception in custom event handler:', error);
            setIsLoadingOpponentData(false);
          }
        })();
      }
    };
    
    window.addEventListener('opponentChanged', handleOpponentChangeEvent as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('opponentChanged', handleOpponentChangeEvent as EventListener);
    };
  }, []);

  // Fetch master fronts
  useEffect(() => {
    const fetchMasterFronts = async () => {
      setIsLoadingMasterFronts(true);
      
      try {
        // Just fetch all fronts from the database without removing anything
        const result = await getMasterFronts();
        
        if (result.success && result.data) {
          // Keep all fronts in masterFronts for selection, filtering happens only at UI level
          setMasterFronts(result.data);
        } else {
          setErrorMessage(result.error?.message || 'Failed to load master fronts');
          console.error('Failed to fetch master fronts:', result.error);
        }
      } catch (error) {
        setErrorMessage('Error loading master fronts');
        console.error('Error fetching master fronts:', error);
      } finally {
        setIsLoadingMasterFronts(false);
      }
    };
    
    fetchMasterFronts();
  }, []);

  // Fetch master coverages
  useEffect(() => {
    const fetchMasterCoverages = async () => {
      setIsLoadingMasterCoverages(true);
      
      try {
        // Just fetch all coverages from the database without removing anything
        const result = await getMasterCoverages();
        
        if (result.success && result.data) {
          // Keep all coverages in masterCoverages for selection, filtering happens only at UI level
          setMasterCoverages(result.data);
        } else {
          setErrorMessage(result.error?.message || 'Failed to load master coverages');
          console.error('Failed to fetch master coverages:', result.error);
        }
      } catch (error) {
        setErrorMessage('Error loading master coverages');
        console.error('Error fetching master coverages:', error);
      } finally {
        setIsLoadingMasterCoverages(false);
      }
    };
    
    fetchMasterCoverages();
  }, []);

  // Fetch master blitzes - updated to prevent deletion of blitzes
  useEffect(() => {
    const fetchMasterBlitzes = async () => {
      setIsLoadingMasterBlitzes(true);
      
      try {
        // Skip removal of default blitzes to prevent data loss
        // await removeDefaultBlitzes(); <-- This was likely causing issues
        
        // Just fetch the blitzes without any filtering
        const result = await getMasterBlitzes();
        
        if (result.success && result.data) {
          console.log("Fetched master blitzes:", result.data);
          setMasterBlitzes(result.data);
          
          // Log all blitz names to help diagnose issues
          const blitzNames = result.data.map(blitz => blitz.name);
          console.log("Available blitz names:", blitzNames);
          
          if (blitzNames.includes('Strong Outside') || blitzNames.includes('Weak Outside')) {
            console.log("WARNING: Found unexpected blitz names 'Strong Outside' or 'Weak Outside'");
          }
        } else {
          setErrorMessage(result.error?.message || 'Failed to load master blitzes');
          console.error('Failed to fetch master blitzes:', result.error);
        }
      } catch (error) {
        setErrorMessage('Error loading master blitzes');
        console.error('Error fetching master blitzes:', error);
      } finally {
        setIsLoadingMasterBlitzes(false);
      }
    };
    
    fetchMasterBlitzes();
  }, []);
  
  // Handle removing a front
  const handleRemoveFront = (index: number) => {
    const newFronts = [...fronts];
    newFronts.splice(index, 1);
    setFronts(newFronts);
    
    // Also update percentages
    const deletedFrontName = fronts[index].name;
    const newFrontPct = { ...frontPct };
    delete newFrontPct[deletedFrontName];
    setFrontPct(newFrontPct);
  };

  // Handle removing a coverage
  const handleRemoveCoverage = (index: number) => {
    const newCoverages = [...coverages];
    newCoverages.splice(index, 1);
    setCoverages(newCoverages);
    
    // Also update percentages
    const deletedCoverageName = coverages[index].name;
    const newCoverPct = { ...coverPct };
    delete newCoverPct[deletedCoverageName];
    setCoverPct(newCoverPct);
  };

  // Handle removing a blitz
  const handleRemoveBlitz = (index: number) => {
    const newBlitzes = [...blitzes];
    newBlitzes.splice(index, 1);
    setBlitzes(newBlitzes);
    
    // Also update percentages
    const deletedBlitzName = blitzes[index].name;
    const newBlitzPct = { ...blitzPct };
    delete newBlitzPct[deletedBlitzName];
    setBlitzPct(newBlitzPct);
  };

  const handleInputChange = (
    category: "fronts" | "coverages" | "blitzes",
    index: number,
    field: "dominateDown" | "fieldArea",
    value: string,
  ) => {
    if (category === "fronts") {
      const newFronts = [...fronts]
      newFronts[index][field] = value
      setFronts(newFronts)
    } else if (category === "coverages") {
      const newCoverages = [...coverages]
      newCoverages[index][field] = value
      setCoverages(newCoverages)
    } else if (category === "blitzes") {
      const newBlitzes = [...blitzes]
      newBlitzes[index][field] = value
      setBlitzes(newBlitzes)
    }
  }

  const addCustomOption = (category: "fronts" | "coverages" | "blitzes") => {
    // No longer used for any category
    setErrorMessage("Custom options have been replaced with master lists. Use Add buttons instead.");
  }

  const confirmAddCustom = () => {
    // No longer used
  }

  const cancelAddCustom = () => {
    setAddingCustomTo(null)
    setCustomName("")
  }

  const handleGenerateGamePlan = async () => {
    // Save to database if we have both team and opponent IDs
    if (selectedTeamId && selectedOpponentId) {
      await saveToDatabase();
    }
    
    // Filter out unwanted fronts, coverages, and blitzes before saving
    const filteredFronts = fronts.filter(front => !['Even', 'Odd'].includes(front.name));
    const filteredCoverages = coverages.filter(coverage => !['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].includes(coverage.name));
    
    // More thorough case-insensitive filtering for blitzes
    const filteredBlitzes = blitzes.filter(blitz => {
      const name = blitz.name.toLowerCase();
      return !(
        name === 'inside' || 
        name === 'outside' || 
        name === 'corner' || 
        name === 'safety'
      );
    });
    
    // Clean up percentages for unwanted items
    const filteredFrontPct = { ...frontPct };
    ['Even', 'Odd'].forEach(frontName => {
      delete filteredFrontPct[frontName];
    });
    
    const filteredCoverPct = { ...coverPct };
    ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].forEach(coverageName => {
      delete filteredCoverPct[coverageName];
    });
    
    const filteredBlitzPct = { ...blitzPct };
    ['Inside', 'Outside', 'Corner', 'Safety', 'inside', 'outside', 'corner', 'safety'].forEach(blitzName => {
      delete filteredBlitzPct[blitzName];
    });
    
    // Only save data with opponent-specific keys to avoid mixed data
    if (selectedOpponentId) {
      save(`fronts_${selectedOpponentId}`, filteredFronts);
      save(`coverages_${selectedOpponentId}`, filteredCoverages);
      save(`blitz_${selectedOpponentId}`, filteredBlitzes);
      save(`fronts_pct_${selectedOpponentId}`, filteredFrontPct);
      save(`coverages_pct_${selectedOpponentId}`, filteredCoverPct);
      save(`blitz_pct_${selectedOpponentId}`, filteredBlitzPct);
      save(`overall_blitz_pct_${selectedOpponentId}`, overallBlitzPct);
      save(`notes_${selectedOpponentId}`, notes);
    }
    
    // Navigate to plan page
    router.push('/plan');
  }

  // Save data to the database
  const saveToDatabase = async () => {
    if (!selectedTeamId || !selectedOpponentId) {
      setSavingError('Missing team or opponent ID');
      return { success: false };
    }
    
    // Prevent saving if we're still in initial loading
    if (isInitialLoad || !dataFullyLoaded) {
      console.log("Skipping save during initial data load");
      return { success: false };
    }
    
    // Check if we have any data to save
    const hasData = fronts.length > 0 || coverages.length > 0 || blitzes.length > 0 || notes !== '';
    if (!hasData) {
      console.log("No data to save, creating an empty record instead");
      // Even with no data, we should still create an empty record in the database
      // This ensures the record exists for future loadScoutingReport calls
    }
    
    setIsSaving(true);
    setSavingError(null);
    
    try {
      console.log(`Saving data to database for team ${selectedTeamId} and opponent ${selectedOpponentId}`);
      console.log(`Data summary: fronts=${fronts.length}, coverages=${coverages.length}, blitzes=${blitzes.length}`);
      
      // Add detailed logging of blitz data
      console.log('Blitz data being saved:', {
        blitzes: blitzes,
        blitzPct: blitzPct,
        overallBlitzPct: overallBlitzPct
      });
      
      const result = await saveScoutingReport({
        team_id: selectedTeamId,
        opponent_id: selectedOpponentId,
        fronts,
        coverages,
        blitzes,
        fronts_pct: frontPct,
        coverages_pct: coverPct,
        blitz_pct: blitzPct,
        overall_blitz_pct: overallBlitzPct,
        notes
      });
      
      if (result.success) {
        console.log('Successfully saved data to database');
        setLastSaved(new Date());

        // After saving, trigger playpool regeneration
        try {
          setIsRegeneratingPlaypool(true);
          console.log('Regenerating playpool based on new scouting data');
          const regenerateResult = await analyzeAndUpdatePlays({
            team_id: selectedTeamId,
            opponent_id: selectedOpponentId,
            fronts,
            coverages,
            blitzes,
            fronts_pct: frontPct,
            coverages_pct: coverPct,
            blitz_pct: blitzPct,
            overall_blitz_pct: overallBlitzPct,
            motion_percentage: 25, // Default value
            notes,
            keep_locked_plays: true
          });

          if (regenerateResult.success) {
            console.log('Successfully regenerated playpool');
            setNotification({
              type: 'success',
              message: 'Scouting report saved and playpool updated successfully!'
            });
            // Clear notification after 3 seconds
            setTimeout(() => {
              setNotification(null);
            }, 3000);
          } else {
            console.error('Failed to regenerate playpool:', regenerateResult.error);
            setNotification({
              type: 'error',
              message: 'Scouting report saved but failed to update playpool: ' + (regenerateResult.error || 'Unknown error')
            });
          }
        } catch (regenerateError) {
          console.error('Error regenerating playpool:', regenerateError);
          setNotification({
            type: 'error',
            message: 'Scouting report saved but failed to update playpool: ' + (regenerateError instanceof Error ? regenerateError.message : 'Unknown error')
          });
        } finally {
          setIsRegeneratingPlaypool(false);
        }

        return { success: true };
      } else {
        console.error('Failed to save data:', result.error);
        setSavingError(result.error?.message || 'Failed to save');
        return { success: false };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Error saving to database:', error);
      setSavingError(errorMessage);
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  }

  // Auto-save when data changes
  useEffect(() => {
    // Skip initial render and when data isn't fully loaded yet
    if (initialSaveRender.current || isInitialLoad || !dataFullyLoaded) {
      initialSaveRender.current = false;
      return;
    }
    
    // Only auto-save if we have both team and opponent IDs
    if (!selectedTeamId || !selectedOpponentId) return;
    
    console.log(`Auto-saving data for opponent: ${selectedOpponentId}`);
    
    // Use debounce to avoid too frequent saves
    const debounceTimer = setTimeout(() => {
      saveToDatabase();
    }, 2000); // Save after 2 seconds of inactivity
    
    return () => {
      clearTimeout(debounceTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fronts, coverages, blitzes, frontPct, coverPct, blitzPct, overallBlitzPct, notes, selectedTeamId, selectedOpponentId, isInitialLoad, dataFullyLoaded]);

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true)
    setReport("")
    
    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fronts,
          coverages,
          blitzes,
          frontPct,
          coverPct,
          blitzPct,
          overallBlitzPct,
          notes,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const text = new TextDecoder().decode(value)
        setReport(prev => (prev || "") + text)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to generate report. Please try again.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // Function to generate an AI scouting report
  const handleGenerateAIReport = async () => {
    if (!selectedTeamId || !selectedOpponentId) {
      alert('Please make sure team and opponent are selected first');
      return;
    }
    
    // First save the data to ensure it's up to date
    await saveToDatabase();
    
    setIsGeneratingAIReport(true);
    setReport("");
    setShowReport(true); // Make sure report section is visible when generating
    
    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fronts,
          coverages,
          blitzes,
          frontPct,
          coverPct,
          blitzPct,
          overallBlitzPct,
          notes,
          teamName: selectedTeamName,
          opponentName: selectedOpponentName
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = new TextDecoder().decode(value);
        setReport(prev => (prev || "") + text);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate AI report. Please try again.');
    } finally {
      setIsGeneratingAIReport(false);
    }
  };

  // Helper function to calculate total percentage for a category
  const calculateTotal = (percentages: Record<string, number>, names: string[]): number => {
    return names.reduce((sum, name) => sum + (percentages[name] || 0), 0)
  }

  // Helper function to adjust percentages to maintain 100% total
  const adjustPercentages = (
    currentPct: Record<string, number>,
    names: string[],
    changedName: string,
    newValue: number
  ): Record<string, number> => {
    // Round to nearest 5
    newValue = Math.round(newValue / 5) * 5
    
    // Calculate total of other values
    const otherNames = names.filter(name => name !== changedName)
    const otherTotal = calculateTotal(currentPct, otherNames)
    
    // If new value would make total exceed 100%, cap it
    if (otherTotal + newValue > 100) {
      newValue = Math.max(0, 100 - otherTotal)
      // Ensure it's still in increments of 5
      newValue = Math.floor(newValue / 5) * 5
    }

    return {
      ...currentPct,
      [changedName]: newValue
    }
  }

  // Helper function to render option rows
  const renderOptionRow = (option: ScoutingOption, index: number, category: "fronts" | "coverages" | "blitzes") => {
    const { name } = option
    const [pct, setPct] = category === "fronts" 
      ? [frontPct, setFrontPct]
      : category === "coverages"
      ? [coverPct, setCoverPct]
      : [blitzPct, setBlitzPct]

    const options = category === "fronts" 
      ? fronts
      : category === "coverages"
      ? coverages
      : blitzes

    const names = options.map(opt => opt.name)
    const total = calculateTotal(pct, names)

    const handlePercentageChange = (newValue: number) => {
      const adjustedPercentages = adjustPercentages(pct, names, name, newValue)
      setPct(adjustedPercentages)
    }

    // Calculate maximum allowed value for this slider
    const otherTotal = calculateTotal(
      pct,
      names.filter(n => n !== name)
    )
    const maxValue = 100 - otherTotal
    const currentValue = Math.round((pct[name] || 0) / 5) * 5

    // Determine if the remove button should be shown
    const showRemoveButton = category === "fronts" || category === "coverages" || category === "blitzes"
    
    // Determine which remove handler to use
    const handleRemove = category === "fronts" 
      ? () => handleRemoveFront(index) 
      : category === "coverages" 
      ? () => handleRemoveCoverage(index)
      : category === "blitzes"
      ? () => handleRemoveBlitz(index)
      : undefined

    return (
      <div key={`${category}-${index}`} className="space-y-3 pb-4 border-b border-slate-200 last:border-0 last:pb-0">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={`${category}-${index}`} className="flex-grow font-medium">
            {name}
          </Label>
          <div className="flex items-center gap-4 flex-grow">
            <Slider
              id={`${category}-${index}`}
              min={0}
              max={Math.min(100, maxValue + currentValue)}
              step={5}
              value={[currentValue]}
              onValueChange={(value) => handlePercentageChange(value[0])}
              className="flex-grow"
            />
            <div className="w-16 text-right">
              <span>{currentValue}%</span>
            </div>
            
            {/* Add remove button for fronts, coverages, and blitzes */}
            {showRemoveButton && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-8 w-8"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${category}-${index}-down`} className="text-xs mb-1 block">
              Dominate Down
            </Label>
            <Select
              defaultValue="no_tendency"
              value={option.dominateDown}
              onValueChange={(value: string) => handleInputChange(category, index, "dominateDown", value)}
            >
              <SelectTrigger id={`${category}-${index}-down`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_tendency">No Tendency</SelectItem>
                <SelectItem value="1st">1st Down</SelectItem>
                <SelectItem value="2nd">2nd Down</SelectItem>
                <SelectItem value="3rd">3rd Down</SelectItem>
                <SelectItem value="4th">4th Down</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${category}-${index}-area`} className="text-xs mb-1 block">
              Field Area
            </Label>
            <Select
              defaultValue="no_tendency"
              value={option.fieldArea}
              onValueChange={(value: string) => handleInputChange(category, index, "fieldArea", value)}
            >
              <SelectTrigger id={`${category}-${index}-area`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_tendency">No Tendency</SelectItem>
                <SelectItem value="backed_up">Backed Up</SelectItem>
                <SelectItem value="open_field">Open Field</SelectItem>
                <SelectItem value="red_zone">Red Zone</SelectItem>
                <SelectItem value="goal_line">Goal Line</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    )
  }

  // Helper function to render a category card
  const renderCategoryCard = (
    title: string,
    category: "fronts" | "coverages" | "blitzes",
    items: ScoutingOption[],
    percentages: Record<string, number>
  ) => {
    const total = calculateTotal(percentages, items.map(item => item.name))
    console.log(`Rendering ${category} card with ${items.length} items:`, items);

    return (
      <Card className="bg-slate-50">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{title}</CardTitle>
            <span className="text-sm text-slate-500">Total: {total}%</span>
          </div>
          
          {/* Add button for fronts */}
          {category === "fronts" && (
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddFrontDialog(true)}
                className="w-full flex justify-center items-center"
                disabled={isLoadingMasterFronts}
              >
                {isLoadingMasterFronts ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading Fronts...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Front
                  </>
                )}
              </Button>
              
              {errorMessage && category === "fronts" && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  <p><strong>Error:</strong> {errorMessage}</p>
                  <Button 
                    onClick={() => setErrorMessage(null)} 
                    variant="ghost" 
                    className="mt-1 h-auto p-0 text-xs text-red-600 hover:text-red-800 hover:bg-transparent"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Add button for coverages */}
          {category === "coverages" && (
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddCoverageDialog(true)}
                className="w-full flex justify-center items-center"
                disabled={isLoadingMasterCoverages}
              >
                {isLoadingMasterCoverages ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading Coverages...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Coverage
                  </>
                )}
              </Button>
              
              {errorMessage && category === "coverages" && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  <p><strong>Error:</strong> {errorMessage}</p>
                  <Button 
                    onClick={() => setErrorMessage(null)} 
                    variant="ghost" 
                    className="mt-1 h-auto p-0 text-xs text-red-600 hover:text-red-800 hover:bg-transparent"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Add button for blitzes */}
          {category === "blitzes" && (
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddBlitzDialog(true)}
                className="w-full flex justify-center items-center"
                disabled={isLoadingMasterBlitzes}
              >
                {isLoadingMasterBlitzes ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading Blitzes...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Blitz
                  </>
                )}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {category === "blitzes" && (
            <div className="mb-6 pb-4 border-b border-slate-200">
              <Label className="font-medium mb-2 block">
                Overall Blitz Percentage
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="overall-blitz"
                  min={0}
                  max={100}
                  step={5}
                  value={[Math.round(overallBlitzPct / 5) * 5]}
                  onValueChange={(value) => setOverallBlitzPct(value[0])}
                  className="flex-grow"
                />
                <div className="w-16 text-right">
                  <span>{Math.round(overallBlitzPct / 5) * 5}%</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                How often they blitz overall, regardless of type
              </p>
            </div>
          )}
          
          {items.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p>No {category} added yet</p>
              <p className="text-sm mt-1">Click "Add {category === "blitzes" ? "Blitz" : category === "coverages" ? "Coverage" : "Front"}" to select from the master list</p>
              <p className="text-xs mt-2 text-amber-600">Make sure your team and opponent are selected correctly.</p>
            </div>
          ) : (
            items.map((item, index) => renderOptionRow(item, index, category))
          )}
        </CardContent>
      </Card>
    )
  }

  // Update the loadScoutingReport function
  const loadScoutingReport = async (teamId: string, opponentId: string, isInitializing = false) => {
    if (!teamId || !opponentId) {
      console.error("Cannot load scouting report: missing teamId or opponentId", { teamId, opponentId });
      setIsLoadingOpponentData(false);
      setIsAppLoading(false);
      if (isInitializing) setDataFullyLoaded(true);
      return;
    }
    
    console.log(`--------- LOADING DATA FOR OPPONENT ${opponentId} ---------`);
    console.log(`Team ID: ${teamId}, Opponent ID: ${opponentId}, Initial Load: ${isInitializing}`);
    
    // Clear all existing data first to prevent any mixing
    console.log("Clearing all existing data before loading new data");
    setFronts([]);
    setCoverages([]);
    setBlitzes([]);
    setFrontPct({});
    setCoverPct({});
    setBlitzPct({});
    setOverallBlitzPct(0);
    setNotes('');
    setLastSaved(null);
    setReport(null); // Clear any existing report
    
    // Set loading state
    setIsLoadingOpponentData(true);
    
      try {
        // First try to load from the database
      console.log(`Loading from database for team ${teamId} and opponent ${opponentId}...`);
        const result = await getScoutingReport(teamId, opponentId);
        
        if (result.success && result.data) {
          console.log(`SUCCESS: Found data in database for opponent ${opponentId}`);
          console.log("Data summary:", {
            fronts: result.data.fronts?.length || 0, 
            coverages: result.data.coverages?.length || 0, 
            blitzes: result.data.blitzes?.length || 0
          });
          
          // Add detailed logging of blitz data
          console.log('Blitz data loaded from database:', {
            blitzes: result.data.blitzes,
            blitz_pct: result.data.blitz_pct,
            overall_blitz_pct: result.data.overall_blitz_pct
          });
          
          // Make sure we're not setting undefined arrays
          const safeData = {
            fronts: Array.isArray(result.data.fronts) ? result.data.fronts : [],
            coverages: Array.isArray(result.data.coverages) ? result.data.coverages : [],
            blitzes: Array.isArray(result.data.blitzes) ? result.data.blitzes : [],
            fronts_pct: result.data.fronts_pct || {},
            coverages_pct: result.data.coverages_pct || {},
            blitz_pct: result.data.blitz_pct || {},
            overall_blitz_pct: result.data.overall_blitz_pct || 0,
            notes: result.data.notes || '',
            updated_at: result.data.updated_at || new Date().toISOString()
          };
          
          // Set state with the safe data
          setFronts(safeData.fronts);
          setCoverages(safeData.coverages);
          setBlitzes(safeData.blitzes);
          setFrontPct(safeData.fronts_pct);
          setCoverPct(safeData.coverages_pct);
          setBlitzPct(safeData.blitz_pct);
          setOverallBlitzPct(safeData.overall_blitz_pct);
          setNotes(safeData.notes);
          setLastSaved(new Date(safeData.updated_at));
          console.log(`Successfully set state with data for opponent ${opponentId}`);
        } else {
        // No data found in database - keep everything empty for new opponent
        console.log(`No data found in database for opponent ${opponentId} - initializing empty scouting report`);
        // Data is already cleared above, so we don't need to do anything here
        }
      } catch (error) {
      console.error(`Error loading scouting report for opponent ${opponentId}:`, error);
      // Keep everything empty in case of error
    } finally {
    setIsLoadingOpponentData(false);
    setIsAppLoading(false);
    if (isInitializing) {
      console.log("Initial data load complete, enabling auto-saves");
      setDataFullyLoaded(true);
      }
    }
    
    console.log(`--------- FINISHED LOADING DATA FOR OPPONENT ${opponentId} ---------`);
    return true;
  };

  // Improve the fallbackToLocalStorage function
  const fallbackToLocalStorage = (opponentId: string) => {
    console.log(`Looking for data in localStorage for opponent: ${opponentId}`);
    
    // Log what we're looking for in localStorage
    const keys = [`fronts_${opponentId}`, `coverages_${opponentId}`, `blitz_${opponentId}`, 
                  `fronts_pct_${opponentId}`, `coverages_pct_${opponentId}`, `blitz_pct_${opponentId}`,
                  `overall_blitz_pct_${opponentId}`, `notes_${opponentId}`];
    console.log(`Looking for localStorage keys:`, keys);
    
    // Try to load data from localStorage
    const opponentFronts = load(`fronts_${opponentId}`, null) as ScoutingOption[] | null;
    const opponentCoverages = load(`coverages_${opponentId}`, null) as ScoutingOption[] | null;
    const opponentBlitzes = load(`blitz_${opponentId}`, null) as ScoutingOption[] | null;
    const opponentFrontPct = load(`fronts_pct_${opponentId}`, null) as Record<string, number> | null;
    const opponentCoverPct = load(`coverages_pct_${opponentId}`, null) as Record<string, number> | null;
    const opponentBlitzPct = load(`blitz_pct_${opponentId}`, null) as Record<string, number> | null;
    const opponentOverallBlitzPct = load(`overall_blitz_pct_${opponentId}`, null) as number | null;
    const opponentNotes = load(`notes_${opponentId}`, null) as string | null;
    
    // Also try to load from general keys (for backwards compatibility)
    if (!opponentFronts) {
      const generalFronts = load('fronts', null) as ScoutingOption[] | null;
      if (generalFronts && generalFronts.length > 0) {
        console.log("Found fronts in general localStorage key, using that");
        setFronts(generalFronts.filter(front => !['Even', 'Odd'].includes(front.name)));
      }
    }
    
    if (!opponentCoverages) {
      const generalCoverages = load('coverages', null) as ScoutingOption[] | null;
      if (generalCoverages && generalCoverages.length > 0) {
        console.log("Found coverages in general localStorage key, using that");
        setCoverages(generalCoverages.filter(coverage => 
          !['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].includes(coverage.name)
        ));
      }
    }
    
    if (!opponentBlitzes) {
      const generalBlitzes = load('blitz', null) as ScoutingOption[] | null;
      if (generalBlitzes && generalBlitzes.length > 0) {
        console.log("Found blitzes in general localStorage key, using that");
        setBlitzes(generalBlitzes.filter(blitz => {
          const name = blitz.name.toLowerCase();
          return !(
            name === 'inside' || 
            name === 'outside' || 
            name === 'corner' || 
            name === 'safety'
          );
        }));
      }
    }
    
    // Log what we found
    console.log("Found in localStorage:", {
      fronts: opponentFronts ? opponentFronts.length : 0,
      coverages: opponentCoverages ? opponentCoverages.length : 0,
      blitzes: opponentBlitzes ? opponentBlitzes.length : 0,
      frontPct: opponentFrontPct ? Object.keys(opponentFrontPct).length : 0,
      coverPct: opponentCoverPct ? Object.keys(opponentCoverPct).length : 0,
      blitzPct: opponentBlitzPct ? Object.keys(opponentBlitzPct).length : 0,
      overallBlitzPct: opponentOverallBlitzPct,
      notes: opponentNotes ? "has notes" : "no notes"
    });
    
    // Update state with opponent-specific data if it exists
    if (opponentFronts) {
      const filteredFronts = opponentFronts.filter(
        (front) => !['Even', 'Odd'].includes(front.name)
      );
      console.log(`Setting ${filteredFronts.length} fronts from localStorage`);
      if (filteredFronts.length > 0) {
        console.log("FRONT NAMES:", filteredFronts.map(f => f.name));
      }
      setFronts(filteredFronts);
    } else {
      console.log("No fronts found in localStorage for this opponent");
    }
    
    if (opponentCoverages) {
      const filteredCoverages = opponentCoverages.filter(
        (coverage) => !['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].includes(coverage.name)
      );
      console.log(`Setting ${filteredCoverages.length} coverages from localStorage`);
      if (filteredCoverages.length > 0) {
        console.log("COVERAGE NAMES:", filteredCoverages.map(c => c.name));
      }
      setCoverages(filteredCoverages);
    } else {
      console.log("No coverages found in localStorage for this opponent");
    }
    
    if (opponentBlitzes) {
      const filteredBlitzes = opponentBlitzes.filter(blitz => {
        const name = blitz.name.toLowerCase();
        return !(
          name === 'inside' || 
          name === 'outside' || 
          name === 'corner' || 
          name === 'safety'
        );
      });
      console.log(`Setting ${filteredBlitzes.length} blitzes from localStorage`);
      if (filteredBlitzes.length > 0) {
        console.log("BLITZ NAMES:", filteredBlitzes.map(b => b.name));
      }
      setBlitzes(filteredBlitzes);
    } else {
      console.log("No blitzes found in localStorage for this opponent");
    }
    
    // Set other properties
    if (opponentFrontPct) {
      // Remove percentages for unwanted fronts
      const filteredFrontPct = { ...opponentFrontPct };
      ['Even', 'Odd'].forEach(frontName => {
        delete filteredFrontPct[frontName];
      });
      console.log(`Setting front percentages from localStorage`);
      setFrontPct(filteredFrontPct);
    } else {
      // Try general key
      const generalFrontPct = load('fronts_pct', null) as Record<string, number> | null;
      if (generalFrontPct) {
        console.log("Found front percentages in general localStorage key, using that");
        setFrontPct(generalFrontPct);
      } else {
        console.log("No front percentages found in localStorage");
      }
    }
    
    if (opponentCoverPct) {
      // Remove percentages for default coverages
      const filteredCoverPct = { ...opponentCoverPct };
      ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].forEach(coverageName => {
        delete filteredCoverPct[coverageName];
      });
      console.log(`Setting coverage percentages from localStorage`);
      setCoverPct(filteredCoverPct);
    } else {
      // Try general key
      const generalCoverPct = load('coverages_pct', null) as Record<string, number> | null;
      if (generalCoverPct) {
        console.log("Found coverage percentages in general localStorage key, using that");
        setCoverPct(generalCoverPct);
      } else {
        console.log("No coverage percentages found in localStorage");
      }
    }
    
    if (opponentBlitzPct) {
      // Remove percentages for default blitzes
      const filteredBlitzPct = { ...opponentBlitzPct };
      ['Inside', 'Outside', 'Corner', 'Safety', 'inside', 'outside', 'corner', 'safety'].forEach(blitzName => {
        delete filteredBlitzPct[blitzName];
      });
      console.log(`Setting blitz percentages from localStorage`);
      setBlitzPct(filteredBlitzPct);
    } else {
      // Try general key
      const generalBlitzPct = load('blitz_pct', null) as Record<string, number> | null;
      if (generalBlitzPct) {
        console.log("Found blitz percentages in general localStorage key, using that");
        setBlitzPct(generalBlitzPct);
      } else {
        console.log("No blitz percentages found in localStorage");
      }
    }
    
    if (opponentOverallBlitzPct !== null) {
      console.log(`Setting overall blitz percentage from localStorage: ${opponentOverallBlitzPct}`);
      setOverallBlitzPct(opponentOverallBlitzPct);
    } else {
      // Try general key
      const generalOverallBlitzPct = load('overall_blitz_pct', null) as number | null;
      if (generalOverallBlitzPct !== null) {
        console.log("Found overall blitz percentage in general localStorage key, using that");
        setOverallBlitzPct(generalOverallBlitzPct);
      } else {
        console.log("No overall blitz percentage found in localStorage");
      }
    }
    
    if (opponentNotes) {
      console.log(`Setting notes from localStorage`);
      setNotes(opponentNotes);
    } else {
      // Try general key
      const generalNotes = load('notes', null) as string | null;
      if (generalNotes) {
        console.log("Found notes in general localStorage key, using that");
        setNotes(generalNotes);
      } else {
        console.log("No notes found in localStorage");
      }
    }
  };

  // Function to directly fetch team from user profile
  const getTeamFromUserProfile = async () => {
    if (!supabaseClient) {
      console.error('No Supabase client available');
      return;
    }
    
    try {
      // Get user session
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      
      if (sessionError) {
        console.error('Error getting user session:', sessionError.message);
        return;
      }
      
      const userId = sessionData.session?.user?.id;
      
      if (!userId) {
        console.error('No user ID found. User might not be authenticated.');
        return;
      }
      
      console.log('Fetching profile for user ID:', userId);
      
      // Get user profile
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId);
        
      if (profileError) {
        console.error('Error fetching user profile:', profileError.message);
        return;
      }
      
      if (!profileData || profileData.length === 0 || !profileData[0].team_id) {
        console.error('No team_id found in user profile');
        return;
      }
      
      console.log('Found team_id in profile:', profileData[0].team_id);
      
      // Get team details
      const { data: teamData, error: teamError } = await supabaseClient
        .from('teams')
        .select('*')
        .eq('id', profileData[0].team_id);
        
      if (teamError) {
        console.error('Error fetching team from profile:', teamError.message);
        return;
      }
      
      if (!teamData || teamData.length === 0) {
        console.error('Team not found with ID:', profileData[0].team_id);
        return;
      }
      
      // Set team in state and localStorage
      setSelectedTeamId(teamData[0].id);
      setSelectedTeamName(teamData[0].name);
      localStorage.setItem('selectedTeam', teamData[0].id);
      console.log('Successfully set team from profile:', teamData[0].name);
      
      // Load scouting report if we have both team and opponent
      if (selectedOpponentId) {
        loadScoutingReport(teamData[0].id, selectedOpponentId);
      }
    } catch (error) {
      console.error('Error in getTeamFromUserProfile:', error);
    }
  };

  // Load opponents for the dropdown when component mounts
  useEffect(() => {
    const loadOpponentsList = async () => {
      if (!supabaseClient) return;
      
      setIsLoadingOpponentsList(true);
      try {
        const { data, error } = await supabaseClient
          .from('opponents')
          .select('id, name')
          .order('name');
          
        if (error) {
          console.error('Error loading opponents for dropdown:', error.message);
        } else if (data) {
          setOpponentsList(data);
        }
      } catch (error) {
        console.error('Exception loading opponents dropdown:', error);
      } finally {
        setIsLoadingOpponentsList(false);
      }
    };
    
    if (supabaseClient) {
      loadOpponentsList();
    }
  }, [supabaseClient]);

  // Handle opponent change from dropdown
  const handleOpponentChange = async (opponentId: string) => {
    if (!opponentId || opponentId === selectedOpponentId) return;
    
    try {
      // Find opponent in the list
      const opponent = opponentsList.find(o => o.id === opponentId);
      
      if (opponent) {
        // Update state
        setSelectedOpponentId(opponentId);
        setSelectedOpponentName(opponent.name);
        
        // Save to localStorage
        localStorage.setItem('selectedOpponent', opponentId);
        console.log('Changed opponent to:', opponent.name);
        
        // Load scouting report if we have a team
        if (selectedTeamId) {
          loadScoutingReport(selectedTeamId, opponentId);
        }
        
        // Dispatch a custom event to notify other components
        const event = new CustomEvent('opponentChanged', { 
          detail: { opponentId: opponentId }
        });
        window.dispatchEvent(event);
      } else {
        // Fetch opponent details if not in list
        const { data, error } = await supabaseClient
          .from('opponents')
          .select('name')
          .eq('id', opponentId);
          
        if (error) {
          console.error('Error fetching opponent for dropdown change:', error.message);
        } else if (data && data.length > 0) {
          // Update state
          setSelectedOpponentId(opponentId);
          setSelectedOpponentName(data[0].name);
          
          // Save to localStorage
          localStorage.setItem('selectedOpponent', opponentId);
          console.log('Changed opponent to:', data[0].name);
          
          // Load scouting report if we have a team
          if (selectedTeamId) {
            loadScoutingReport(selectedTeamId, opponentId);
          }
          
          // Dispatch a custom event to notify other components
          const event = new CustomEvent('opponentChanged', { 
            detail: { opponentId: opponentId }
          });
          window.dispatchEvent(event);
        } else {
          console.warn('No opponent found with ID:', opponentId, 'but attempting to load scouting data anyway');
          
          // Even if opponent details aren't found, try to load the scouting report anyway
          setSelectedOpponentId(opponentId);
          setSelectedOpponentName(`Unknown (${opponentId.slice(0, 8)}...)`);
          
          // Save to localStorage
          localStorage.setItem('selectedOpponent', opponentId);
          
          // Load scouting report if we have a team
          if (selectedTeamId) {
            loadScoutingReport(selectedTeamId, opponentId);
          }
          
          // Dispatch a custom event to notify other components
          const event = new CustomEvent('opponentChanged', { 
            detail: { opponentId: opponentId }
          });
          window.dispatchEvent(event);
        }
      }
    } catch (error) {
      console.error('Error in handleOpponentChange:', error);
    }
  };

  // Function to reset all scouting data
  const resetScoutingData = () => {
    console.log("Resetting all scouting data");
    
    // Clear all state
    setFronts([]);
    setCoverages([]);
    setBlitzes([]);
    setFrontPct({});
    setCoverPct({});
    setBlitzPct({});
    setOverallBlitzPct(0);
    setNotes('');
    setLastSaved(null);
    
    // Clear opponent-specific localStorage if we have an opponent
    if (selectedOpponentId) {
      console.log("Clearing localStorage for opponent:", selectedOpponentId);
      
      // Clear opponent-specific data
      localStorage.removeItem(`fronts_${selectedOpponentId}`);
      localStorage.removeItem(`coverages_${selectedOpponentId}`);
      localStorage.removeItem(`blitz_${selectedOpponentId}`);
      localStorage.removeItem(`fronts_pct_${selectedOpponentId}`);
      localStorage.removeItem(`coverages_pct_${selectedOpponentId}`);
      localStorage.removeItem(`blitz_pct_${selectedOpponentId}`);
      localStorage.removeItem(`overall_blitz_pct_${selectedOpponentId}`);
      localStorage.removeItem(`notes_${selectedOpponentId}`);
    }
    
    // Also clear general localStorage data
    localStorage.removeItem('fronts');
    localStorage.removeItem('coverages');
    localStorage.removeItem('blitz');
    localStorage.removeItem('fronts_pct');
    localStorage.removeItem('coverages_pct');
    localStorage.removeItem('blitz_pct');
    localStorage.removeItem('overall_blitz_pct');
    localStorage.removeItem('notes');
    
    // If we have both team and opponent, also try to delete from database
    if (selectedTeamId && selectedOpponentId && supabaseClient) {
      // Delete from database in background
      supabaseClient
        .from('scouting_reports')
        .delete()
        .match({ 
          team_id: selectedTeamId,
          opponent_id: selectedOpponentId 
        })
        .then((result: any) => {
          if (result.error) {
            console.error("Error deleting from database:", result.error.message);
          } else {
            console.log("Successfully deleted from database");
          }
        })
        .catch((error: any) => {
          console.error("Exception deleting from database:", error);
        });
    }
  };

  // Add front from dialog - Remove selectedFrontId parameter as it's provided by selector
  const handleAddFront = (frontId: string) => {
    if (!frontId) {
      setErrorMessage("Please select a front to add");
      return;
    }
    
    // Find the selected front in the master list
    const front = masterFronts.find(front => front.id === frontId);
    if (!front) {
      setErrorMessage("Selected front not found");
      return;
    }
    
    // Check if this front is already in the list
    const exists = fronts.some(f => f.name === front.name);
    if (exists) {
      setErrorMessage(`Front "${front.name}" is already in your list`);
      return;
    }
    
    // Add to fronts array with default values
    const newFront: ScoutingOption = {
      id: front.id,
      name: front.name,
      dominateDown: "no_tendency",
      fieldArea: "no_tendency"
    };
    
    setFronts([...fronts, newFront]);
    
    // Also initialize percentage
    setFrontPct({
      ...frontPct,
      [front.name]: 0
    });
    
    // Close dialog and clear selection
    setShowAddFrontDialog(false);
    setSelectedFrontId("");
  };

  // Add coverage from dialog - Remove selectedCoverageId parameter as it's provided by selector
  const handleAddCoverage = (coverageId: string) => {
    if (!coverageId) {
      setErrorMessage("Please select a coverage to add");
      return;
    }
    
    // Find the selected coverage in the master list
    const coverage = masterCoverages.find(coverage => coverage.id === coverageId);
    if (!coverage) {
      setErrorMessage("Selected coverage not found");
      return;
    }
    
    // Check if this coverage is already in the list
    const exists = coverages.some(c => c.name === coverage.name);
    if (exists) {
      setErrorMessage(`Coverage "${coverage.name}" is already in your list`);
      return;
    }
    
    // Add to coverages array with default values
    const newCoverage: ScoutingOption = {
      id: coverage.id,
      name: coverage.name,
      dominateDown: "no_tendency",
      fieldArea: "no_tendency"
    };
    
    setCoverages([...coverages, newCoverage]);
    
    // Also initialize percentage
    setCoverPct({
      ...coverPct,
      [coverage.name]: 0
    });
    
    // Close dialog and clear selection
    setShowAddCoverageDialog(false);
    setSelectedCoverageId("");
  };

  // Add blitz from dialog
  const handleAddBlitz = (blitzId: string) => {
    if (!blitzId) {
      setErrorMessage("Please select a blitz to add");
      return;
    }
    
    // Find the selected blitz in the master list
    const blitz = masterBlitzes.find(blitz => blitz.id === blitzId);
    if (!blitz) {
      setErrorMessage("Selected blitz not found");
      return;
    }
    
    // Check if this blitz is already in the list
    const exists = blitzes.some(b => b.name === blitz.name);
    if (exists) {
      setErrorMessage(`Blitz "${blitz.name}" is already in your list`);
      return;
    }
    
    // Add to blitzes array with default values
    const newBlitz: ScoutingOption = {
      id: blitz.id,
      name: blitz.name,
      dominateDown: "no_tendency",
      fieldArea: "no_tendency"
    };
    
    // Update state
    const newBlitzes = [...blitzes, newBlitz];
    setBlitzes(newBlitzes);
    
    // Also initialize percentage
    const newBlitzPct = { ...blitzPct };
    newBlitzPct[blitz.name] = 0;
    setBlitzPct(newBlitzPct);
    
    // Save to database immediately
    if (selectedTeamId && selectedOpponentId) {
      saveToDatabase();
    }
    
    // Close dialog and clear selection
    setShowAddBlitzDialog(false);
    setSelectedBlitzId("");
  };

                      return (
    <div className="container max-w-7xl space-y-6">
      {/* Full-screen loading overlay */}
      {isAppLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 z-50 flex items-center justify-center">
          <div className="text-center">
            <img src="/ball.gif" alt="Loading..." className="w-16 h-16 mx-auto" />
            <p className="mt-4 text-xl font-bold text-[#0B2545]">Loading your scouting information</p>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg ${
          notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <p className="text-sm">{notification.message}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Scouting Report</h1>
          {/* Database sync status */}
          {selectedTeamId && selectedOpponentId && (
            <div className="mt-1 text-xs text-gray-500">
              {isSaving ? (
                <span className="text-amber-600 flex items-center">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </span>
              ) : savingError ? (
                <span className="text-red-600 flex items-center">
                  Save failed: {savingError}
                </span>
              ) : lastSaved ? (
                <span>
                  Last Update: {lastSaved.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })} {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
            </div>
          )}
        </div>
        
        {/* Add buttons container with Save and Generate Game Plan buttons */}
        {!isLoadingOpponentData && selectedTeamId && selectedOpponentId && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* Save button */}
          <Button 
              variant="outline"
              className="gap-2 bg-[#2ecc71] hover:bg-[#27ae60] text-white border-[#2ecc71]"
              onClick={saveToDatabase}
              disabled={isSaving || isRegeneratingPlaypool}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isRegeneratingPlaypool ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating Playpool...
                </>
              ) : (
                <>
                  Save Report Information
                </>
              )}
          </Button>
            
            {/* Generate AI Report button */}
          <Button
            variant="outline"
              className="gap-2 bg-[#0b2545] hover:bg-[#1e3a8a] text-white border-[#0b2545]"
              onClick={handleGenerateAIReport}
              disabled={isGeneratingAIReport}
            >
              {isGeneratingAIReport ? (
                <>
                <Loader2 className="h-4 w-4 animate-spin" />
                  AI Generating...
                </>
            ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate AI Report
                </>
            )}
          </Button>
        </div>
        )}
      </div>

      {/* Show loading overlay when changing opponents */}
      {isLoadingOpponentData ? (
        <div className="flex items-center justify-center bg-slate-100 p-8 rounded-lg mb-4">
          <p className="text-lg font-bold text-[#0B2545]">Loading your data</p>
        </div>
      ) : (
        <>
          {/* AI Generated Report Section - Accordion Style */}
          {report && (
            <Card className="bg-slate-50 overflow-hidden mb-6">
              <div 
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-100"
                onClick={() => setShowReport(!showReport)}
              >
                <h3 className="text-lg font-semibold">
                  AI Generated Scouting Report
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  {showReport ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </div>
              
              {showReport && (
                <div className="p-6 pt-0 border-t border-slate-200">
                  {isGeneratingAIReport ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-3 text-blue-600" />
                      <p className="text-blue-600">Generating report...</p>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm prose max-w-none">
                      {report}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderCategoryCard("Fronts", "fronts", fronts, frontPct)}
            {renderCategoryCard("Coverages", "coverages", coverages, coverPct)}
            {renderCategoryCard("Blitz", "blitzes", blitzes, blitzPct)}
          </div>

          {/* Additional Notes */}
          <Card className="bg-slate-50">
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter any additional observations, tendencies, or notes here..."
                className="min-h-[150px]"
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Front Dialog */}
      <SelectSafeDialog open={showAddFrontDialog} onOpenChange={setShowAddFrontDialog}>
        <SelectSafeDialogContent>
          <SelectSafeDialogHeader>
            <SelectSafeDialogTitle>Add Front</SelectSafeDialogTitle>
          </SelectSafeDialogHeader>
          <div className="py-2">
            <Select 
              value={selectedFrontId} 
              onValueChange={(value) => handleAddFront(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a front to add" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                className="z-[9999]"
                sideOffset={4}
                align="start"
              >
                {masterFronts.map(front => (
                  <SelectItem key={front.id} value={front.id}>
                    {front.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorMessage && (
              <p className="text-sm text-red-600 mt-2">{errorMessage}</p>
            )}
          </div>
          <SelectSafeDialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddFrontDialog(false);
              setSelectedFrontId("");
              setErrorMessage(null);
            }}>
              Cancel
            </Button>
          </SelectSafeDialogFooter>
        </SelectSafeDialogContent>
      </SelectSafeDialog>

      {/* Add Coverage Dialog */}
      <SelectSafeDialog open={showAddCoverageDialog} onOpenChange={setShowAddCoverageDialog}>
        <SelectSafeDialogContent>
          <SelectSafeDialogHeader>
            <SelectSafeDialogTitle>Add Coverage</SelectSafeDialogTitle>
          </SelectSafeDialogHeader>
          <div className="py-2">
            <Select 
              value={selectedCoverageId} 
              onValueChange={(value) => handleAddCoverage(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a coverage to add" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                className="z-[9999]"
                sideOffset={4}
                align="start"
              >
                {masterCoverages.map(coverage => (
                  <SelectItem key={coverage.id} value={coverage.id}>
                    {coverage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorMessage && (
              <p className="text-sm text-red-600 mt-2">{errorMessage}</p>
            )}
          </div>
          <SelectSafeDialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddCoverageDialog(false);
              setSelectedCoverageId("");
              setErrorMessage(null);
            }}>
              Cancel
            </Button>
          </SelectSafeDialogFooter>
        </SelectSafeDialogContent>
      </SelectSafeDialog>

      {/* Add Blitz Dialog */}
      <SelectSafeDialog open={showAddBlitzDialog} onOpenChange={setShowAddBlitzDialog}>
        <SelectSafeDialogContent>
          <SelectSafeDialogHeader>
            <SelectSafeDialogTitle>Add Blitz</SelectSafeDialogTitle>
          </SelectSafeDialogHeader>
          <div className="py-2">
            <Select 
              value={selectedBlitzId} 
              onValueChange={(value) => handleAddBlitz(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a blitz to add" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                className="z-[9999]"
                sideOffset={4}
                align="start"
              >
                {masterBlitzes.map(blitz => (
                  <SelectItem key={blitz.id} value={blitz.id}>
                    {blitz.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorMessage && (
              <p className="text-sm text-red-600 mt-2">{errorMessage}</p>
            )}
          </div>
          <SelectSafeDialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddBlitzDialog(false);
              setSelectedBlitzId("");
              setErrorMessage(null);
            }}>
              Cancel
            </Button>
          </SelectSafeDialogFooter>
        </SelectSafeDialogContent>
      </SelectSafeDialog>
    </div>
  )
}
