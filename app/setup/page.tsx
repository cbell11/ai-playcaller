"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Check, Trash2 } from "lucide-react"
import { load, save } from "@/lib/local"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface TermRow {
  id: string
  concept: string
  label: string
  isEditing?: boolean
}

interface TerminologySetProps {
  title: string
  rows: TermRow[]
  onUpdate: (rows: TermRow[]) => void
}

const TerminologySet: React.FC<TerminologySetProps> = ({ title, rows, onUpdate }) => {
  const addRow = () => {
    const newRow: TermRow = {
      id: crypto.randomUUID(),
      concept: `New Concept`,
      label: '',
      isEditing: true
    }
    onUpdate([...rows, newRow])
  }

  const updateConcept = (index: number, newConcept: string) => {
    onUpdate(rows.map((row, i) => 
      i === index ? { ...row, concept: newConcept } : row
    ))
  }

  const updateLabel = (index: number, newLabel: string) => {
    onUpdate(rows.map((row, i) => 
      i === index ? { ...row, label: newLabel } : row
    ))
  }

  const toggleEdit = (index: number) => {
    onUpdate(rows.map((row, i) => 
      i === index ? { ...row, isEditing: !row.isEditing } : row
    ))
  }

  const saveItem = (index: number) => {
    onUpdate(rows.map((row, i) => 
      i === index ? { ...row, isEditing: false } : row
    ))
  }

  const deleteRow = (index: number) => {
    onUpdate(rows.filter((_, i) => i !== index))
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 font-medium mb-2 px-2">
            <div>Concept</div>
            <div>Label</div>
            <div></div>
            <div></div>
          </div>

          {rows.map((row, index) => (
            <div key={row.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center py-2 border-b">
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

        <Button variant="outline" onClick={addRow}>
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
      </CardContent>
    </Card>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [terminologyState, setTerminologyState] = useState<Record<string, TermRow[]>>(() => {
    const savedState = load('terms', {})
    return savedState
  })

  const terminologySets = {
    formations: {
      title: "Formations",
      data: [
        { concept: "Spread", label: "sprd" },
        { concept: "Trips", label: "trps" },
        { concept: "Deuce", label: "duce" },
        { concept: "Trey", label: "trey" },
        { concept: "Empty", label: "mt" },
        { concept: "Queen", label: "q" },
        { concept: "Sam", label: "sam" },
        { concept: "Will", label: "will" },
        { concept: "Bunch", label: "bunch" },
      ]
    },
    tags: {
      title: "Formation Tags",
      data: [
        { concept: "Over", label: "ovr" },
        { concept: "Slot", label: "slot" },
        { concept: "Closed", label: "clsd" },
        { concept: "Flip", label: "flip" },
      ]
    },
    motions: {
      title: "Motions/Shifts",
      data: [
        { concept: "Jet", label: "jet" },
        { concept: "Orbit", label: "orb" },
        { concept: "Zoom", label: "zm" },
        { concept: "Flash", label: "fl" },
      ]
    },
    run_game: {
      title: "Run Game",
      data: [
        { concept: "Inside Zone", label: "iz" },
        { concept: "Outside Zone", label: "oz" },
        { concept: "Power", label: "pwr" },
        { concept: "Counter", label: "ctr" },
        { concept: "Draw", label: "drw" },
      ]
    },
    quick_game: {
      title: "Quick Game",
      data: [
        { concept: "Hoss", label: "hoss" },
        { concept: "Stick", label: "stick" },
        { concept: "Quick Out", label: "qo" },
        { concept: "Slot Fade", label: "slfade" },
        { concept: "Snag", label: "snag" },
      ]
    },
    dropback: {
      title: "Dropback Game",
      data: [
        { concept: "Curl", label: "curl" },
        { concept: "Dig", label: "dig" },
        { concept: "Dagger", label: "dger" },
        { concept: "Flood", label: "fl" },
      ]
    },
    shot_plays: {
      title: "Shot Plays",
      data: [
        { concept: "Go", label: "go" },
        { concept: "Post/Wheel", label: "pw" },
        { concept: "Double Move", label: "dbm" },
        { concept: "Yankee", label: "yanke" },
      ]
    },
    screens: {
      title: "Screen Game",
      data: [
        { concept: "Bubble", label: "bub" },
        { concept: "Tunnel", label: "tnl" },
        { concept: "RB Screen", label: "rbs" },
        { concept: "Double Screen", label: "dbl screen" },
      ]
    },
  }

  // Initialize state from terminologySets on first load
  useEffect(() => {
    const initialState: Record<string, TermRow[]> = {}
    Object.entries(terminologySets).forEach(([key, { data }]) => {
      initialState[key] = data.map(item => ({
        id: crypto.randomUUID(),
        ...item,
        isEditing: false
      }))
    })
    setTerminologyState(initialState)
  }, [])

  // Save state whenever it changes
  useEffect(() => {
    save('terms', terminologyState)
  }, [terminologyState])

  const updateSetRows = (setKey: string, newRows: TermRow[]) => {
    setTerminologyState(prev => ({
      ...prev,
      [setKey]: newRows
    }))
  }

  const handleContinue = () => {
    router.push('/scouting')
  }

  return (
    <div className="max-w-7xl mx-auto mt-10 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Terminology Setup</h1>
        <Button onClick={handleContinue}>
          Continue <span aria-hidden="true">→</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(terminologySets).map(([key, { title }]) => (
          <TerminologySet
            key={key}
            title={title}
            rows={terminologyState[key] || []}
            onUpdate={(newRows) => updateSetRows(key, newRows)}
          />
        ))}
      </div>
    </div>
  )
}
