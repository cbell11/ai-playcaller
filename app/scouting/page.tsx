"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Plus } from "lucide-react"
import { load, save } from "@/lib/local"

// Define the option type with the new fields
type ScoutingOption = {
  name: string
  dominateDown: string
  fieldArea: string
}

export default function ScoutingPage() {
  const router = useRouter()

  // Initialize state with data from localStorage
  const [fronts, setFronts] = useState<ScoutingOption[]>(() => 
    load('fronts', [
      { name: "Even", dominateDown: "", fieldArea: "" },
      { name: "Odd", dominateDown: "", fieldArea: "" },
      { name: "Bear", dominateDown: "", fieldArea: "" },
      { name: "46", dominateDown: "", fieldArea: "" },
    ])
  )

  const [coverages, setCoverages] = useState<ScoutingOption[]>(() => 
    load('coverages', [
      { name: "Cover 0", dominateDown: "", fieldArea: "" },
      { name: "Cover 1", dominateDown: "", fieldArea: "" },
      { name: "Cover 2", dominateDown: "", fieldArea: "" },
      { name: "Cover 3", dominateDown: "", fieldArea: "" },
      { name: "Cover 4", dominateDown: "", fieldArea: "" },
    ])
  )

  const [blitzes, setBlitzes] = useState<ScoutingOption[]>(() => 
    load('blitz', [
      { name: "Inside", dominateDown: "", fieldArea: "" },
      { name: "Outside", dominateDown: "", fieldArea: "" },
      { name: "Corner", dominateDown: "", fieldArea: "" },
      { name: "Safety", dominateDown: "", fieldArea: "" },
    ])
  )

  // Initialize percentage states
  const [frontPct, setFrontPct] = useState<Record<string, number>>(() => load('fronts_pct', {}))
  const [coverPct, setCoverPct] = useState<Record<string, number>>(() => load('coverages_pct', {}))
  const [blitzPct, setBlitzPct] = useState<Record<string, number>>(() => load('blitz_pct', {}))

  const [addingCustomTo, setAddingCustomTo] = useState<"fronts" | "coverages" | "blitzes" | null>(null)
  const [customName, setCustomName] = useState("")
  const [notes, setNotes] = useState(() => load('notes', ""))

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
      dominateDown: "",
      fieldArea: "",
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
    // Save all percentages
    save('fronts', frontPct)
    save('coverages', coverPct)
    save('blitz', blitzPct)
    
    // Navigate to plan page
    router.push('/plan')
  }

  // Helper function to render option rows
  const renderOptionRow = (option: ScoutingOption, index: number, category: "fronts" | "coverages" | "blitzes") => {
    const { name } = option
    const [pct, setPct] = category === "fronts" 
      ? [frontPct, setFrontPct]
      : category === "coverages"
      ? [coverPct, setCoverPct]
      : [blitzPct, setBlitzPct]

    return (
      <div key={`${category}-${index}`} className="space-y-3 pb-4 border-b border-slate-200 last:border-0 last:pb-0">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${category}-${index}`} className="flex-grow font-medium">
            {name}
          </Label>
          <div className="flex items-center">
            <Input
              id={`${category}-${index}`}
              type="number"
              min="0"
              max="100"
              value={pct[name] || 0}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = Math.min(100, Math.max(0, +e.target.value || 0))
                setPct({...pct, [name]: value})
              }}
              className="w-16 mr-2"
            />
            <span>%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${category}-${index}-down`} className="text-xs mb-1 block">
              Dominate Down
            </Label>
            <Select
              value={option.dominateDown}
              onValueChange={(value: string) => handleInputChange(category, index, "dominateDown", value)}
            >
              <SelectTrigger id={`${category}-${index}-down`} className="w-full">
                <SelectValue placeholder="Select down" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1st">1st Down</SelectItem>
                <SelectItem value="2nd">2nd Down</SelectItem>
                <SelectItem value="3rd">3rd Down</SelectItem>
                <SelectItem value="4th">4th Down</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${category}-${index}-field`} className="text-xs mb-1 block">
              Field Area
            </Label>
            <Select
              value={option.fieldArea}
              onValueChange={(value: string) => handleInputChange(category, index, "fieldArea", value)}
            >
              <SelectTrigger id={`${category}-${index}-field`} className="w-full">
                <SelectValue placeholder="Select area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="goalline">Goalline</SelectItem>
                <SelectItem value="redzone">Redzone</SelectItem>
                <SelectItem value="openfield">Open Field</SelectItem>
                <SelectItem value="backedup">Backed Up</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Scouting Form</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Fronts Card */}
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle>Fronts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fronts.map((front, index) => renderOptionRow(front, index, "fronts"))}

            {addingCustomTo === "fronts" ? (
              <div className="mt-4 space-y-2">
                <Label htmlFor="custom-front-name">Custom Front Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-front-name"
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
                onClick={() => addCustomOption("fronts")}
              >
                <Plus className="h-4 w-4 mr-1" /> Custom
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Coverages Card */}
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle>Coverages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {coverages.map((coverage, index) => renderOptionRow(coverage, index, "coverages"))}

            {addingCustomTo === "coverages" ? (
              <div className="mt-4 space-y-2">
                <Label htmlFor="custom-coverage-name">Custom Coverage Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-coverage-name"
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
                onClick={() => addCustomOption("coverages")}
              >
                <Plus className="h-4 w-4 mr-1" /> Custom
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Blitzes Card */}
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle>Blitz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {blitzes.map((blitz, index) => renderOptionRow(blitz, index, "blitzes"))}

            {addingCustomTo === "blitzes" ? (
              <div className="mt-4 space-y-2">
                <Label htmlFor="custom-blitz-name">Custom Blitz Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-blitz-name"
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
                onClick={() => addCustomOption("blitzes")}
              >
                <Plus className="h-4 w-4 mr-1" /> Custom
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Notes */}
      <Card className="bg-slate-50 mb-8">
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

      <div className="flex justify-center">
        <Button size="lg" onClick={handleGenerateGamePlan}>
          Generate Game Plan
        </Button>
      </div>
    </div>
  )
}
