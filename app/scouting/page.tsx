"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from '@supabase/ssr'
import { Plus, FileText, Loader2 } from "lucide-react"
import { load, save } from "@/lib/local"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Slider } from "@/app/components/ui/slider"
import { Textarea } from "@/app/components/ui/textarea"

// Define the option type with the new fields
type ScoutingOption = {
  name: string
  dominateDown: string
  fieldArea: string
}

export default function ScoutingPage() {
  const router = useRouter()
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null)
  const [selectedOpponentName, setSelectedOpponentName] = useState<string | null>(null)
  const [supabaseClient, setSupabaseClient] = useState<any>(null)

  // Initialize state with data from localStorage
  const [fronts, setFronts] = useState<ScoutingOption[]>(() => 
    load('fronts', [
      { name: "Even", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "Odd", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "Bear", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "46", dominateDown: "no_tendency", fieldArea: "no_tendency" },
    ])
  )

  const [coverages, setCoverages] = useState<ScoutingOption[]>(() => 
    load('coverages', [
      { name: "Cover 0", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "Cover 1", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "Cover 2", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "Cover 3", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "Cover 4", dominateDown: "no_tendency", fieldArea: "no_tendency" },
    ])
  )

  const [blitzes, setBlitzes] = useState<ScoutingOption[]>(() => 
    load('blitz', [
      { name: "Inside", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "Outside", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "Corner", dominateDown: "no_tendency", fieldArea: "no_tendency" },
      { name: "Safety", dominateDown: "no_tendency", fieldArea: "no_tendency" },
    ])
  )

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
          const opponentFronts = load(`fronts_${opponentId}`, null)
          const opponentCoverages = load(`coverages_${opponentId}`, null)
          const opponentBlitzes = load(`blitz_${opponentId}`, null)
          const opponentFrontPct = load(`fronts_pct_${opponentId}`, null)
          const opponentCoverPct = load(`coverages_pct_${opponentId}`, null)
          const opponentBlitzPct = load(`blitz_pct_${opponentId}`, null)
          const opponentOverallBlitzPct = load(`overall_blitz_pct_${opponentId}`, null)
          const opponentNotes = load(`notes_${opponentId}`, null)
          
          // Update state with opponent-specific data if it exists
          if (opponentFronts) setFronts(opponentFronts)
          if (opponentCoverages) setCoverages(opponentCoverages)
          if (opponentBlitzes) setBlitzes(opponentBlitzes)
          if (opponentFrontPct) setFrontPct(opponentFrontPct)
          if (opponentCoverPct) setCoverPct(opponentCoverPct)
          if (opponentBlitzPct) setBlitzPct(opponentBlitzPct)
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
    setAddingCustomTo(category)
    setCustomName("")
  }

  const confirmAddCustom = () => {
    if (!addingCustomTo || !customName.trim()) return

    const newOption: ScoutingOption = {
      name: customName,
      dominateDown: "no_tendency",
      fieldArea: "no_tendency",
    }

    if (addingCustomTo === "fronts") {
      setFronts([...fronts, newOption])
    } else if (addingCustomTo === "coverages") {
      setCoverages([...coverages, newOption])
    } else if (addingCustomTo === "blitzes") {
      setBlitzes([...blitzes, newOption])
    }

    setAddingCustomTo(null)
    setCustomName("")
  }

  const cancelAddCustom = () => {
    setAddingCustomTo(null)
    setCustomName("")
  }

  const handleGenerateGamePlan = () => {
    // Save all percentages including overall blitz percentage
    save('fronts_pct', frontPct)
    save('coverages_pct', coverPct)
    save('blitz_pct', blitzPct)
    save('overall_blitz_pct', overallBlitzPct)
    
    // If we have a selected opponent, save data with opponent ID for future retrieval
    if (selectedOpponentId) {
      save(`fronts_${selectedOpponentId}`, fronts)
      save(`coverages_${selectedOpponentId}`, coverages)
      save(`blitz_${selectedOpponentId}`, blitzes)
      save(`fronts_pct_${selectedOpponentId}`, frontPct)
      save(`coverages_pct_${selectedOpponentId}`, coverPct)
      save(`blitz_pct_${selectedOpponentId}`, blitzPct)
      save(`overall_blitz_pct_${selectedOpponentId}`, overallBlitzPct)
      save(`notes_${selectedOpponentId}`, notes)
    }
    
    // Navigate to plan page
    router.push('/plan')
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
          {items.map((item, index) => renderOptionRow(item, index, category))}

          {addingCustomTo === category ? (
            <div className="mt-4 space-y-2">
              <Label htmlFor={`custom-${category}-name`}>Custom {title.slice(0, -1)} Name</Label>
              <div className="flex gap-2">
                <Input
                  id={`custom-${category}-name`}
                  value={customName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomName(e.target.value)}
                  placeholder="Enter name"
                  className="flex-grow"
                  autoFocus
                />
                <Button size="sm" onClick={confirmAddCustom}>
                  Add
                </Button>
                <Button size="sm" variant="outline" onClick={cancelAddCustom}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="flex items-center text-sm mt-2 pl-0"
              onClick={() => addCustomOption(category)}
            >
              <Plus className="h-4 w-4 mr-1" /> Custom
            </Button>
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
