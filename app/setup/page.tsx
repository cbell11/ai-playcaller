"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Check, Trash2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { getTerminology, addTerminology, updateTerminology, deleteTerminology, initializeDefaultTerminology, Terminology, testSupabaseConnection } from "@/lib/terminology"
import { updatePlayPoolTerminology } from "@/lib/playpool"

// Extend Terminology interface to include UI state
interface TerminologyWithUI extends Terminology {
  isEditing?: boolean
  isDirty?: boolean  // Track if this term has unsaved changes
}

interface TerminologySetProps {
  title: string
  terms: TerminologyWithUI[]
  category: string
  onUpdate: (terms: TerminologyWithUI[]) => void
}

const TerminologySet: React.FC<TerminologySetProps> = ({ title, terms, category, onUpdate }) => {
  const addRow = async () => {
    try {
      const newTerm = await addTerminology({
        concept: "New Concept",
        label: "",
        category: category
      })
      onUpdate([...terms, { ...newTerm, isEditing: true, isDirty: true }])
    } catch (error) {
      console.error('Error adding new term:', error)
    }
  }

  const updateConcept = (term: TerminologyWithUI, newConcept: string) => {
    onUpdate(terms.map(t => t.id === term.id ? { ...term, concept: newConcept, isDirty: true } : t))
  }

  const updateLabel = (term: TerminologyWithUI, newLabel: string) => {
    onUpdate(terms.map(t => t.id === term.id ? { ...term, label: newLabel, isDirty: true } : t))
  }

  const toggleEdit = (term: TerminologyWithUI) => {
    onUpdate(terms.map(t => t.id === term.id ? { ...t, isEditing: !t.isEditing } : t))
  }

  const saveItem = async (term: TerminologyWithUI) => {
    try {
      await updateTerminology(term.id, {
        concept: term.concept,
        label: term.label
      })
      onUpdate(terms.map(t => t.id === term.id ? { ...term, isEditing: false, isDirty: false } : t))
    } catch (error) {
      console.error('Error saving term:', error)
    }
  }

  const deleteRow = async (term: TerminologyWithUI) => {
    try {
      await deleteTerminology(term.id)
      onUpdate(terms.filter(t => t.id !== term.id))
    } catch (error) {
      console.error('Error deleting term:', error)
    }
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

          {terms.map((term) => (
            <div key={`row-${term.id}`} className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center py-2 border-b">
              <div key={`concept-${term.id}`}>
                {term.isEditing ? (
                  <Input 
                    key={`concept-input-${term.id}`}
                    value={term.concept} 
                    onChange={(e) => updateConcept(term, e.target.value)} 
                    className="h-9" 
                  />
                ) : (
                  <span key={`concept-text-${term.id}`} className="text-gray-600">{term.concept}</span>
                )}
              </div>
              <div key={`label-${term.id}`}>
                {term.isEditing ? (
                  <Input 
                    key={`label-input-${term.id}`}
                    value={term.label} 
                    onChange={(e) => updateLabel(term, e.target.value)} 
                    className="h-9" 
                  />
                ) : (
                  <span key={`label-text-${term.id}`} className={term.isDirty ? "text-yellow-600 font-medium" : ""}>{term.label}</span>
                )}
              </div>
              <Button
                key={`edit-btn-${term.id}`}
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (term.isEditing) {
                    saveItem(term)
                  } else {
                    toggleEdit(term)
                  }
                }}
              >
                {term.isEditing ? <Check className="h-4 w-4 text-green-500" /> : <Pencil className="h-4 w-4" />}
                <span className="sr-only">{term.isEditing ? "Save" : "Edit"}</span>
              </Button>
              <Button
                key={`delete-btn-${term.id}`}
                variant="ghost"
                size="icon"
                onClick={() => deleteRow(term)}
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
  const [terminologyState, setTerminologyState] = useState<Record<string, TerminologyWithUI[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const loadTerminology = async () => {
      try {
        // Test connection first
        const isConnected = await testSupabaseConnection()
        if (!isConnected) {
          setError('Unable to connect to Supabase. Please check your database configuration.')
          setIsLoading(false)
          return
        }

        try {
          await initializeDefaultTerminology()
        } catch (initError) {
          console.error('Initialization error:', initError)
          setError(`Error initializing terminology: ${initError instanceof Error ? initError.message : 'Unknown initialization error'}`)
          setIsLoading(false)
          return
        }

        try {
          const terms = await getTerminology()
          
          // Group terms by category
          const groupedTerms = terms.reduce((acc, term) => {
            const category = term.category
            if (!acc[category]) {
              acc[category] = []
            }
            acc[category].push({ ...term, isEditing: false, isDirty: false })
            return acc
          }, {} as Record<string, TerminologyWithUI[]>)
          
          setTerminologyState(groupedTerms)
          setIsLoading(false)
        } catch (fetchError) {
          console.error('Fetch error:', fetchError)
          setError(`Error fetching terminology: ${fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'}`)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Setup error:', error)
        let errorMessage = 'An unexpected error occurred'
        
        if (error instanceof Error) {
          errorMessage = `Error: ${error.message}`
        } else if (typeof error === 'object' && error !== null) {
          const supabaseError = error as any
          if (supabaseError.code && supabaseError.message) {
            errorMessage = `Database error (${supabaseError.code}): ${supabaseError.message}`
            if (supabaseError.hint) {
              errorMessage += `\nHint: ${supabaseError.hint}`
            }
          }
        }
        
        setError(errorMessage)
        setIsLoading(false)
      }
    }

    loadTerminology()
  }, [])

  const updateSetTerms = (category: string, newTerms: TerminologyWithUI[]) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: newTerms
    }))
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      // Save all dirty terms
      for (const category of Object.keys(terminologyState)) {
        const dirtyTerms = terminologyState[category].filter(term => term.isDirty)
        for (const term of dirtyTerms) {
          await updateTerminology(term.id, {
            concept: term.concept,
            label: term.label
          })
        }
      }

      // Update play pool with new terminology
      await updatePlayPoolTerminology()

      // Clear dirty flags
      setTerminologyState(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(category => {
          updated[category] = updated[category].map(term => ({
            ...term,
            isDirty: false
          }))
        })
        return updated
      })
    } catch (error) {
      console.error('Error saving changes:', error)
      // You might want to show an error message to the user here
    } finally {
      setIsSaving(false)
    }
  }

  const hasUnsavedChanges = Object.values(terminologyState).some(
    terms => terms.some(term => term.isDirty)
  )

  const handleAddRow = (category: string) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: [
        ...(prev[category] || []),
        {
          id: crypto.randomUUID(),
          category,
          concept: '',
          label: '',
          is_enabled: true,
          isDirty: true,
          isEditing: false
        }
      ]
    }))
  }

  const handleUpdateConcept = (category: string, index: number, value: string) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: prev[category].map((term, i) => 
        i === index ? { ...term, concept: value, isDirty: true } : term
      )
    }))
  }

  const handleUpdateLabel = (category: string, index: number, value: string) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: prev[category].map((term, i) => 
        i === index ? { ...term, label: value, isDirty: true } : term
      )
    }))
  }

  const handleDeleteRow = (category: string, index: number) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }))
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <div className="text-red-500 text-lg mb-4">Error Loading Terminology</div>
        <div className="text-gray-700 whitespace-pre-wrap text-center">{error}</div>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    )
  }

  const terminologySets = {
    formations: { title: "Formations", category: "formations" },
    tags: { title: "Formation Tags", category: "tags" },
    motions: { title: "Motions/Shifts", category: "motions" },
    run_game: { title: "Run Game", category: "run_game" },
    quick_game: { title: "Quick Game", category: "quick_game" },
    dropback: { title: "Dropback Game", category: "dropback" },
    shot_plays: { title: "Shot Plays", category: "shot_plays" },
    screens: { title: "Screen Game", category: "screens" },
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Terminology Setup</h1>
        <div className="flex gap-4">
          <Button 
            variant="outline"
            onClick={handleSaveChanges}
            disabled={!hasUnsavedChanges || isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(terminologySets).map(([key, { title, category }]) => (
          <Card key={category} className="mb-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">{title}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddRow(category)}
                className="text-blue-600 hover:text-blue-800"
              >
                Add Row
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 pb-1 px-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700">Concept</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700">Label</span>
                  </div>
                  <div className="w-8"></div>
                </div>
                {terminologyState[category]?.map((term, index) => (
                  <div
                    key={term.id}
                    className={`flex items-center space-x-2 ${term.isDirty ? 'bg-blue-50 rounded p-1' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={term.concept}
                        onChange={(e) => handleUpdateConcept(category, index, e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded"
                        placeholder="Concept"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={term.label}
                        onChange={(e) => handleUpdateLabel(category, index, e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded"
                        placeholder="Label"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRow(category, index)}
                      className="text-red-600 hover:text-red-800 px-2"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between mt-8">
        <Button 
          variant="outline" 
          onClick={() => router.push('/')}
        >
          ← Back to Home
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveChanges}
          disabled={!hasUnsavedChanges || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
