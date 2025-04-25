"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Check, Trash2 } from "lucide-react"
import { load, save } from "@/lib/local"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TerminologyItem {
  id: string
  concept: string
  label: string
  isEditing: boolean
}

interface TermRow {
  concept: string
  label: string
  isEditing?: boolean
}

export default function SetupPage() {
  const router = useRouter()
  const [selectedSet, setSelectedSet] = useState("formations")
  const [rows, setRows] = useState<TermRow[]>(() => load('terms', []))

  // Save rows to localStorage whenever they change
  useEffect(() => {
    save('terms', rows)
  }, [rows])

  const terminologySets = {
    formations: [
      { concept: "Spread", label: "sprd" },
      { concept: "Trips", label: "trps" },
      { concept: "Deuce", label: "duce" },
      { concept: "Trey", label: "trey" },
      { concept: "Empty", label: "mt" },
      { concept: "Queen", label: "q" },
      { concept: "Sam", label: "sam" },
      { concept: "Will", label: "will" },
      { concept: "Bunch", label: "bunch" },
    ],
    tags: [
      { concept: "Over", label: "ovr" },
      { concept: "Slot", label: "slot" },
      { concept: "Closed", label: "clsd" },
      { concept: "Flip", label: "flip" },
    ],
    motions: [
      { concept: "Jet", label: "jet" },
      { concept: "Orbit", label: "orb" },
      { concept: "Zoom", label: "zm" },
      { concept: "Flash", label: "fl" },
    ],
    run_game: [
      { concept: "Inside Zone", label: "iz" },
      { concept: "Outside Zone", label: "oz" },
      { concept: "Power", label: "pwr" },
      { concept: "Counter", label: "ctr" },
      { concept: "Draw", label: "drw" },
    ],
    quick_game: [
      { concept: "Hoss", label: "hoss" },
      { concept: "Stick", label: "stick" },
      { concept: "Quick Out", label: "qo" },
      { concept: "Slot Fade", label: "slfade" },
      { concept: "Snag", label: "snag" },
    ],
    dropback: [
      { concept: "Curl", label: "curl" },
      { concept: "Dig", label: "dig" },
      { concept: "Dagger", label: "dger" },
      { concept: "Flood", label: "fl" },
    ],
    shot_plays: [
      { concept: "Go", label: "go" },
      { concept: "Post/Wheel", label: "pw" },
      { concept: "Double Move", label: "dbm" },
      { concept: "Yankee", label: "yanke" },
    ],
    screens: [
      { concept: "Bubble", label: "bub" },
      { concept: "Tunnel", label: "tnl" },
      { concept: "RB Screen", label: "rbs" },
      { concept: "Double Screen", label: "dbl screen" },
    ],
  }

  // Convert terminologySet items to rows when set changes
  useEffect(() => {
    const newRows = terminologySets[selectedSet as keyof typeof terminologySets].map(item => ({
      ...item,
      isEditing: false
    }))
    setRows(newRows)
  }, [selectedSet])

  const addRow = () => {
    const newRow: TermRow = {
      concept: `New Concept ${rows.length + 1}`,
      label: '',
      isEditing: true
    }
    setRows([...rows, newRow])
  }

  const toggleEdit = (index: number) => {
    setRows(rows.map((row, i) => 
      i === index ? { ...row, isEditing: !row.isEditing } : row
    ))
  }

  const updateConcept = (index: number, newConcept: string) => {
    setRows(rows.map((row, i) => 
      i === index ? { ...row, concept: newConcept } : row
    ))
  }

  const updateLabel = (index: number, newLabel: string) => {
    setRows(rows.map((row, i) => 
      i === index ? { ...row, label: newLabel } : row
    ))
  }

  const saveItem = (index: number) => {
    setRows(rows.map((row, i) => 
      i === index ? { ...row, isEditing: false } : row
    ))
  }

  const deleteRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleContinue = () => {
    // Save current state before navigation
    save('terms', rows)
    router.push('/scouting')
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-8 rounded shadow bg-white">
      <div className="mb-4">
        <Select value={selectedSet} onValueChange={setSelectedSet}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select terminology set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="formations">Formations</SelectItem>
            <SelectItem value="tags">Formation Tags</SelectItem>
            <SelectItem value="motions">Motions/Shifts</SelectItem>
            <SelectItem value="run_game">Run Game</SelectItem>
            <SelectItem value="quick_game">Quick Game</SelectItem>
            <SelectItem value="dropback">Dropback Game</SelectItem>
            <SelectItem value="shot_plays">Shot Plays</SelectItem>
            <SelectItem value="screens">Screen Game</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <h1 className="text-2xl font-bold mb-6">Terminology</h1>

      <div className="mb-6">
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 font-medium mb-2 px-2">
          <div>Concept</div>
          <div>Label</div>
          <div></div>
          <div></div>
        </div>

        {rows.map((row, index) => (
          <div key={row.concept} className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center py-2 border-b">
            <div>
              {row.isEditing ? (
                <Input 
                  value={row.concept} 
                  onChange={(e) => updateConcept(index, e.target.value)} 
                  className="h-9" 
                />
              ) : (
                <span className="text-gray-600">{row.concept}</span>
              )}
            </div>
            <div>
              {row.isEditing ? (
                <Input 
                  value={row.label} 
                  onChange={(e) => updateLabel(index, e.target.value)} 
                  className="h-9" 
                />
              ) : (
                <span>{row.label}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (row.isEditing) {
                  saveItem(index)
                } else {
                  toggleEdit(index)
                }
              }}
            >
              {row.isEditing ? <Check className="h-4 w-4 text-green-500" /> : <Pencil className="h-4 w-4" />}
              <span className="sr-only">{row.isEditing ? "Save" : "Edit"}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteRow(index)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={addRow}>
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
        <Button onClick={handleContinue}>
          Continue <span aria-hidden="true">→</span>
        </Button>
      </div>
    </div>
  )
}
