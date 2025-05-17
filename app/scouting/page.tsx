"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from '@supabase/ssr'
import { Plus, FileText, Loader2, X } from "lucide-react"
import { load, save } from "@/lib/local"
import { getMasterFronts, removeSpecificFronts } from "../actions/fronts"
import { getMasterCoverages, removeDefaultCoverages } from "../actions/coverages"
import { 
  getMasterBlitzes, 
  removeDefaultBlitzes, 
  listAllBlitzes,
  removeProblematicBlitzes
} from "../actions/blitzes"

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
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null)
  const [selectedOpponentName, setSelectedOpponentName] = useState<string | null>(null)
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  
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

  // Initialize state with data from localStorage, filtering out unwanted fronts
  const [fronts, setFronts] = useState<ScoutingOption[]>(() => {
    const storedFronts = load('fronts', []) as ScoutingOption[];
    return storedFronts.filter(front => !['Even', 'Odd', 'Bear'].includes(front.name));
  })

  // Initialize state with data from localStorage, filtering out default coverages
  const [coverages, setCoverages] = useState<ScoutingOption[]>(() => {
    const storedCoverages = load('coverages', []) as ScoutingOption[];
    return storedCoverages.filter(coverage => !['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].includes(coverage.name));
  })

  // Initialize state with data from localStorage, filtering out default blitzes
  const [blitzes, setBlitzes] = useState<ScoutingOption[]>(() => {
    const storedBlitzes = load('blitz', []) as ScoutingOption[];
    // Use case-insensitive comparison for more thorough filtering
    return storedBlitzes.filter(blitz => {
      const name = blitz.name.toLowerCase();
      return !(
        name === 'inside' || 
        name === 'outside' || 
        name === 'corner' || 
        name === 'safety'
      );
    });
  })

  // Initialize percentage states
  const [frontPct, setFrontPct] = useState<Record<string, number>>(() => load('fronts_pct', {}))
  const [coverPct, setCoverPct] = useState<Record<string, number>>(() => load('coverages_pct', {}))
  const [blitzPct, setBlitzPct] = useState<Record<string, number>>(() => load('blitz_pct', {}))

  // Add overall blitz percentage state
  const [overallBlitzPct, setOverallBlitzPct] = useState<number>(() => load('overall_blitz_pct', 0))

  const [addingCustomTo, setAddingCustomTo] = useState<"fronts" | "coverages" | "blitzes" | null>(null)
  const [customName, setCustomName] = useState("")
  const [notes, setNotes] = useState(() => load('notes', ""))

  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [report, setReport] = useState<string | null>(null)

  // Initialize Supabase client and load opponent data
  useEffect(() => {
    // Create Supabase client
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    setSupabaseClient(supabase)

    // Get selected opponent from localStorage
    const opponentId = localStorage.getItem('selectedOpponent')
    if (opponentId) {
      setSelectedOpponentId(opponentId)
      
      // Fetch opponent name
      const fetchOpponentName = async () => {
        const { data } = await supabase
          .from('opponents')
          .select('name')
          .eq('id', opponentId)
          .single()
        
        if (data) {
          setSelectedOpponentName(data.name)
          
          // Load opponent-specific scouting data if it exists
          const opponentFronts = load(`fronts_${opponentId}`, null) as ScoutingOption[] | null;
          const opponentCoverages = load(`coverages_${opponentId}`, null) as ScoutingOption[] | null;
          const opponentBlitzes = load(`blitz_${opponentId}`, null) as ScoutingOption[] | null;
          const opponentFrontPct = load(`fronts_pct_${opponentId}`, null) as Record<string, number> | null;
          const opponentCoverPct = load(`coverages_pct_${opponentId}`, null) as Record<string, number> | null;
          const opponentBlitzPct = load(`blitz_pct_${opponentId}`, null) as Record<string, number> | null;
          const opponentOverallBlitzPct = load(`overall_blitz_pct_${opponentId}`, null) as number | null;
          const opponentNotes = load(`notes_${opponentId}`, null) as string | null;
          
          // Update state with opponent-specific data if it exists, filtering out unwanted fronts/coverages/blitzes
          if (opponentFronts) {
            const filteredFronts = opponentFronts.filter(
              (front) => !['Even', 'Odd', 'Bear'].includes(front.name)
            );
            setFronts(filteredFronts);
          }
          if (opponentCoverages) {
            const filteredCoverages = opponentCoverages.filter(
              (coverage) => !['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].includes(coverage.name)
            );
            setCoverages(filteredCoverages);
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
            setBlitzes(filteredBlitzes);
          }
          if (opponentFrontPct) {
            // Remove percentages for unwanted fronts
            const filteredFrontPct = { ...opponentFrontPct };
            ['Even', 'Odd', 'Bear'].forEach(frontName => {
              delete filteredFrontPct[frontName];
            });
            setFrontPct(filteredFrontPct);
          }
          if (opponentCoverPct) {
            // Remove percentages for default coverages
            const filteredCoverPct = { ...opponentCoverPct };
            ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].forEach(coverageName => {
              delete filteredCoverPct[coverageName];
            });
            setCoverPct(filteredCoverPct);
          }
          if (opponentBlitzPct) {
            // Remove percentages for default blitzes
            const filteredBlitzPct = { ...opponentBlitzPct };
            ['Inside', 'Outside', 'Corner', 'Safety', 'inside', 'outside', 'corner', 'safety'].forEach(blitzName => {
              delete filteredBlitzPct[blitzName];
            });
            setBlitzPct(filteredBlitzPct);
          }
          if (opponentOverallBlitzPct) setOverallBlitzPct(opponentOverallBlitzPct)
          if (opponentNotes) setNotes(opponentNotes)
        }
      }
      
      fetchOpponentName()
    }
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    save('fronts', fronts)
  }, [fronts])

  useEffect(() => {
    save('coverages', coverages)
  }, [coverages])

  useEffect(() => {
    save('blitz', blitzes)
  }, [blitzes])

  useEffect(() => {
    save('fronts_pct', frontPct)
  }, [frontPct])

  useEffect(() => {
    save('coverages_pct', coverPct)
  }, [coverPct])

  useEffect(() => {
    save('blitz_pct', blitzPct)
  }, [blitzPct])

  useEffect(() => {
    save('overall_blitz_pct', overallBlitzPct)
  }, [overallBlitzPct])

  useEffect(() => {
    save('notes', notes)
  }, [notes])

  // Fetch master fronts
  useEffect(() => {
    const fetchMasterFronts = async () => {
      setIsLoadingMasterFronts(true);
      
      try {
        // First remove specific fronts
        await removeSpecificFronts();
        
        // Then fetch all fronts
        const result = await getMasterFronts();
        
        if (result.success && result.data) {
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
        // First remove default coverages
        await removeDefaultCoverages();
        
        // Then fetch all coverages
        const result = await getMasterCoverages();
        
        if (result.success && result.data) {
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

  const handleGenerateGamePlan = () => {
    // Filter out unwanted fronts, coverages, and blitzes before saving
    const filteredFronts = fronts.filter(front => !['Even', 'Odd', 'Bear'].includes(front.name));
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
    ['Even', 'Odd', 'Bear'].forEach(frontName => {
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
    
    // Save all percentages including overall blitz percentage
    save('fronts', filteredFronts);
    save('coverages', filteredCoverages);
    save('blitz', filteredBlitzes);
    save('fronts_pct', filteredFrontPct);
    save('coverages_pct', filteredCoverPct);
    save('blitz_pct', filteredBlitzPct);
    save('overall_blitz_pct', overallBlitzPct);
    
    // If we have a selected opponent, save data with opponent ID for future retrieval
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
          
          {items.length === 0 && category === "fronts" ? (
            <div className="py-8 text-center text-gray-500">
              <p>No fronts added yet</p>
              <p className="text-sm mt-1">Click "Add Front" to select from the master list</p>
            </div>
          ) : items.length === 0 && category === "coverages" ? (
            <div className="py-8 text-center text-gray-500">
              <p>No coverages added yet</p>
              <p className="text-sm mt-1">Click "Add Coverage" to select from the master list</p>
            </div>
          ) : items.length === 0 && category === "blitzes" ? (
            <div className="py-8 text-center text-gray-500">
              <p>No blitzes added yet</p>
              <p className="text-sm mt-1">Click "Add Blitz" to select from the master list</p>
            </div>
          ) : (
            items.map((item, index) => renderOptionRow(item, index, category))
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container max-w-7xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Scouting Report</h1>
          {selectedOpponentName && (
            <p className="text-gray-500">Opponent: {selectedOpponentName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isGeneratingReport ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating...</span>
              </div>
            ) : (
              'Generate Scouting Report'
            )}
          </Button>
          <Button
            onClick={handleGenerateGamePlan}
            variant="outline"
          >
            Save & Continue
          </Button>
        </div>
      </div>

      {/* Add Front Dialog */}
      <DialogHighZ open={showAddFrontDialog} onOpenChange={setShowAddFrontDialog}>
        <DialogHighZContent>
          <DialogHighZHeader>
            <DialogHighZTitle>Add Front</DialogHighZTitle>
          </DialogHighZHeader>
          <div className="py-4">
            <Label htmlFor="front-select" className="text-sm font-medium block mb-2">
              Select a Front
            </Label>
            <Select 
              value={selectedFrontId} 
              onValueChange={(value) => {
                setSelectedFrontId(value);
                
                // Automatically add front when selected
                if (value) {
                  // Find the selected front in the master list
                  const selectedFront = masterFronts.find(front => front.id === value);
                  
                  if (selectedFront) {
                    // Check if this front is already added
                    const frontExists = fronts.some(front => front.name === selectedFront.name);
                    
                    if (frontExists) {
                      setErrorMessage(`Front "${selectedFront.name}" is already added`);
                      return;
                    }
                    
                    // Add the front to the list
                    const newFront: ScoutingOption = {
                      id: selectedFront.id,
                      name: selectedFront.name,
                      dominateDown: "no_tendency",
                      fieldArea: "no_tendency"
                    };
                    
                    setFronts(prev => [...prev, newFront]);
                    
                    // Reset selection and close dialog
                    setSelectedFrontId("");
                    setShowAddFrontDialog(false);
                  }
                }
              }}
            >
              <SelectTrigger id="front-select" className="w-full">
                <SelectValue placeholder="Select a front" />
              </SelectTrigger>
              <SelectContent className="z-[202]">
                {masterFronts
                  .filter(masterFront => !fronts.some(f => f.name === masterFront.name))
                  .map(front => (
                    <SelectItem key={front.id} value={front.id}>
                      {front.name}
                    </SelectItem>
                  ))
                }
                {masterFronts.length > 0 && 
                  masterFronts.every(masterFront => fronts.some(f => f.name === masterFront.name)) && (
                    <div className="py-2 px-2 text-sm text-gray-500">
                      All fronts have been added
                    </div>
                  )
                }
              </SelectContent>
            </Select>
          </div>
          <DialogHighZFooter>
            <Button variant="outline" onClick={() => {
              setShowAddFrontDialog(false);
              setSelectedFrontId("");
              setErrorMessage(null);
            }}>
              Cancel
            </Button>
          </DialogHighZFooter>
        </DialogHighZContent>
      </DialogHighZ>

      {/* Add Coverage Dialog */}
      <DialogHighZ open={showAddCoverageDialog} onOpenChange={setShowAddCoverageDialog}>
        <DialogHighZContent>
          <DialogHighZHeader>
            <DialogHighZTitle>Add Coverage</DialogHighZTitle>
          </DialogHighZHeader>
          <div className="py-4">
            <Label htmlFor="coverage-select" className="text-sm font-medium block mb-2">
              Select a Coverage
            </Label>
            <Select 
              value={selectedCoverageId} 
              onValueChange={(value) => {
                setSelectedCoverageId(value);
                
                // Automatically add coverage when selected
                if (value) {
                  // Find the selected coverage in the master list
                  const selectedCoverage = masterCoverages.find(coverage => coverage.id === value);
                  
                  if (selectedCoverage) {
                    // Check if this coverage is already added
                    const coverageExists = coverages.some(coverage => coverage.name === selectedCoverage.name);
                    
                    if (coverageExists) {
                      setErrorMessage(`Coverage "${selectedCoverage.name}" is already added`);
                      return;
                    }
                    
                    // Add the coverage to the list
                    const newCoverage: ScoutingOption = {
                      id: selectedCoverage.id,
                      name: selectedCoverage.name,
                      dominateDown: "no_tendency",
                      fieldArea: "no_tendency"
                    };
                    
                    setCoverages(prev => [...prev, newCoverage]);
                    
                    // Reset selection and close dialog
                    setSelectedCoverageId("");
                    setShowAddCoverageDialog(false);
                  }
                }
              }}
            >
              <SelectTrigger id="coverage-select" className="w-full">
                <SelectValue placeholder="Select a coverage" />
              </SelectTrigger>
              <SelectContent className="z-[202]">
                {masterCoverages
                  .filter(masterCoverage => !coverages.some(c => c.name === masterCoverage.name))
                  .map(coverage => (
                    <SelectItem key={coverage.id} value={coverage.id}>
                      {coverage.name}
                    </SelectItem>
                  ))
                }
                {masterCoverages.length > 0 && 
                  masterCoverages.every(masterCoverage => coverages.some(c => c.name === masterCoverage.name)) && (
                    <div className="py-2 px-2 text-sm text-gray-500">
                      All coverages have been added
                    </div>
                  )
                }
              </SelectContent>
            </Select>
          </div>
          <DialogHighZFooter>
            <Button variant="outline" onClick={() => {
              setShowAddCoverageDialog(false);
              setSelectedCoverageId("");
              setErrorMessage(null);
            }}>
              Cancel
            </Button>
          </DialogHighZFooter>
        </DialogHighZContent>
      </DialogHighZ>

      {/* Add Blitz Dialog */}
      <DialogHighZ open={showAddBlitzDialog} onOpenChange={setShowAddBlitzDialog}>
        <DialogHighZContent>
          <DialogHighZHeader>
            <DialogHighZTitle>Add Blitz</DialogHighZTitle>
          </DialogHighZHeader>
          <div className="py-4">
            <Label htmlFor="blitz-select" className="text-sm font-medium block mb-2">
              Select a Blitz
            </Label>
            <div className="mb-2 text-xs text-slate-500">
              {masterBlitzes.length} blitz types available in database
            </div>
            <Select 
              value={selectedBlitzId} 
              onValueChange={(value) => {
                setSelectedBlitzId(value);
                
                // Automatically add blitz when selected
                if (value) {
                  // Find the selected blitz in the master list
                  const selectedBlitz = masterBlitzes.find(blitz => blitz.id === value);
                  
                  if (selectedBlitz) {
                    console.log("Selected blitz:", selectedBlitz); // Debug log
                    
                    // Case-insensitive check if this blitz is already added
                    const blitzExists = blitzes.some(
                      blitz => blitz.name.toLowerCase() === selectedBlitz.name.toLowerCase()
                    );
                    
                    if (blitzExists) {
                      setErrorMessage(`Blitz "${selectedBlitz.name}" is already added`);
                      return;
                    }
                    
                    // Add the blitz to the list
                    const newBlitz: ScoutingOption = {
                      id: selectedBlitz.id,
                      name: selectedBlitz.name,
                      dominateDown: "no_tendency",
                      fieldArea: "no_tendency"
                    };
                    
                    setBlitzes(prev => [...prev, newBlitz]);
                    
                    // Reset selection and close dialog
                    setSelectedBlitzId("");
                    setShowAddBlitzDialog(false);
                  }
                }
              }}
            >
              <SelectTrigger id="blitz-select" className="w-full">
                <SelectValue placeholder="Select a blitz" />
              </SelectTrigger>
              <SelectContent className="z-[202]">
                {masterBlitzes.length === 0 ? (
                  <div className="py-2 px-2 text-sm text-gray-500">
                    No blitzes available. Please check database.
                  </div>
                ) : (
                  masterBlitzes
                    .filter(masterBlitz => 
                      !blitzes.some(b => b.name.toLowerCase() === masterBlitz.name.toLowerCase())
                    )
                    .map(blitz => (
                      <SelectItem key={blitz.id} value={blitz.id}>
                        {blitz.name}
                      </SelectItem>
                    ))
                )}
                {masterBlitzes.length > 0 && 
                  masterBlitzes.every(masterBlitz => 
                    blitzes.some(b => b.name.toLowerCase() === masterBlitz.name.toLowerCase())
                  ) && (
                    <div className="py-2 px-2 text-sm text-gray-500">
                      All blitzes have been added
                    </div>
                  )
                }
              </SelectContent>
            </Select>
          </div>
          <DialogHighZFooter>
            <Button variant="outline" onClick={() => {
              setShowAddBlitzDialog(false);
              setSelectedBlitzId("");
              setErrorMessage(null);
            }}>
              Cancel
            </Button>
          </DialogHighZFooter>
        </DialogHighZContent>
      </DialogHighZ>

      {(report || isGeneratingReport) && (
        <Card className="mb-8 bg-white shadow-lg border-2 border-green-600">
          <CardHeader className="border-b border-slate-200">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-bold text-green-700">
                {isGeneratingReport ? 'Generating Scouting Report...' : 'Defensive Breakdown'}
              </CardTitle>
              {!isGeneratingReport && (
                <Button
                  onClick={() => setReport(null)}
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-slate-700"
                >
                  Clear Report
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {report?.split('\n\n').map((section, index) => {
                // Handle section headers
                if (section.trim().startsWith('###')) {
                  return (
                    <div key={index} className="border-t first:border-t-0 border-slate-200 pt-6 first:pt-0">
                      <h2 className="text-xl font-bold text-slate-900 mb-4">
                        {section.trim().replace('### ', '')}
                      </h2>
                    </div>
                  )
                }

                // Handle content sections
                return (
                  <div key={index} className="text-slate-700">
                    {section.split('\n').map((line, lineIndex) => {
                      const trimmedLine = line.trim()
                      
                      // Skip empty lines
                      if (!trimmedLine) return null
                      
                      // Handle bullet points
                      if (trimmedLine.startsWith('•')) {
                        return (
                          <div key={lineIndex} className="flex items-start gap-2 mb-3">
                            <span className="text-green-600 mt-1">•</span>
                            <span className="flex-1">{trimmedLine.substring(1).trim()}</span>
                          </div>
                        )
                      }
                      
                      // Handle regular paragraphs
                      return (
                        <p key={lineIndex} className="mb-4">
                          {trimmedLine}
                        </p>
                      )
                    })}
                  </div>
                )
              })}
              {isGeneratingReport && (
                <div className="flex items-center gap-2 text-slate-500 mt-4 border-t border-slate-200 pt-4">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="animate-pulse">Breaking down defensive tendencies...</div>
                </div>
              )}
            </div>
          </CardContent>
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
    </div>
  )
}
