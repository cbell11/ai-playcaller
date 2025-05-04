"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Check, Trash2, Save, Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getTerminology, addTerminology, updateTerminology, batchUpdateTerminology, deleteTerminology, initializeDefaultTerminology, Terminology, testSupabaseConnection, updateFormationConcepts, getDefaultTeamFormations } from "@/lib/terminology"
import { updatePlayPoolTerminology } from "@/lib/playpool"
import { supabase } from '@/lib/supabase'

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
  const [isSaving, setIsSaving] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{url: string, concept: string} | null>(null)
  const [defaultFormations, setDefaultFormations] = useState<Terminology[]>([])
  const [localTerms, setLocalTerms] = useState<TerminologyWithUI[]>(terms)
  const [userInfo, setUserInfo] = useState<{id: string | null, email: string | null}>({id: null, email: null})
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Get user info when component mounts
  useEffect(() => {
    const getUserInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session in useEffect:', session) // Debug log
      if (session?.user) {
        console.log('User ID:', session.user.id) // Debug log
        console.log('User Email:', session.user.email) // Debug log
        setUserInfo({
          id: session.user.id || null,
          email: session.user.email || null
        })
      } else {
        console.log('No session found') // Debug log
      }
    }
    getUserInfo()
  }, [])

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
    }
    checkAuth()
  }, [])

  useEffect(() => {
    if (category === "formations") {
      getDefaultTeamFormations()
        .then(setDefaultFormations)
        .catch(error => console.error('Error loading default formations:', error))
    }
  }, [category])

  // Update local terms when props change
  useEffect(() => {
    setLocalTerms(terms)
  }, [terms])

  // Get available formations that haven't been selected yet
  const getAvailableFormations = () => {
    const selectedConcepts = localTerms.map(term => term.concept)
    return defaultFormations.filter(formation => !selectedConcepts.includes(formation.concept))
  }

  const addRow = () => {
    if (category === "formations") {
      const availableFormations = getAvailableFormations()
      if (availableFormations.length === 0) {
        return // Don't add if no formations available
      }

      const newTerm: TerminologyWithUI = {
        id: crypto.randomUUID(),
        concept: availableFormations[0].concept || '',
        label: availableFormations[0].label || '',
        category: category,
        is_enabled: true,
        isDirty: true,
        isEditing: true
      }
      setLocalTerms([...localTerms, newTerm])
      onUpdate([...localTerms, newTerm])
    } else {
      const newTerm: TerminologyWithUI = {
        id: crypto.randomUUID(),
        concept: '',
        label: '',
        category: category,
        is_enabled: true,
        isDirty: true,
        isEditing: true
      }
      setLocalTerms([...localTerms, newTerm])
      onUpdate([...localTerms, newTerm])
    }
  }

  const updateConcept = (term: TerminologyWithUI, newConcept: string) => {
    if (category === "formations") {
      const formation = defaultFormations.find(f => f.concept === newConcept)
      const isAlreadySelected = localTerms.some(t => t.id !== term.id && t.concept === newConcept)
      
      if (formation && !isAlreadySelected) {
        const updatedTerms = localTerms.map(t => t.id === term.id ? { 
          ...term, 
          concept: formation.concept || '', 
          label: formation.label || '', 
          isDirty: true 
        } : t)
        setLocalTerms(updatedTerms)
        onUpdate(updatedTerms)
      }
    } else {
      const updatedTerms = localTerms.map(t => t.id === term.id ? { ...term, concept: newConcept, isDirty: true } : t)
      setLocalTerms(updatedTerms)
      onUpdate(updatedTerms)
    }
  }

  const updateLabel = (term: TerminologyWithUI, newLabel: string) => {
    const updatedTerms = localTerms.map(t => t.id === term.id ? { ...term, label: newLabel, isDirty: true } : t)
    setLocalTerms(updatedTerms)
    onUpdate(updatedTerms)
  }

  const toggleEdit = (term: TerminologyWithUI) => {
    const updatedTerms = localTerms.map(t => t.id === term.id ? { ...t, isEditing: !t.isEditing } : t)
    setLocalTerms(updatedTerms)
    onUpdate(updatedTerms)
  }

  const deleteRow = (term: TerminologyWithUI) => {
    const updatedTerms = localTerms.filter(t => t.id !== term.id)
    setLocalTerms(updatedTerms)
    onUpdate(updatedTerms)
  }

  const handleSaveAll = async () => {
    try {
      setIsSaving(true)
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Session:', session) // Debug log
      console.log('Session Error:', sessionError) // Debug log

      if (sessionError) {
        console.error('Session error:', sessionError)
        throw new Error('Authentication error: ' + sessionError.message)
      }

      if (!session?.user?.id) {
        console.error('No user ID in session')
        throw new Error('No authenticated user found')
      }

      // Get the user's team_id from the profiles table using the session's user ID
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', session.user.id)
        .single()

      console.log('Profile Data:', profile) // Debug log
      console.log('Profile Error:', profileError) // Debug log

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        throw new Error('Error fetching user profile: ' + profileError.message)
      }

      if (!profile?.team_id) {
        console.error('No team_id found in profile')
        throw new Error('No team ID found in user profile')
      }

      // Get all dirty terms
      const dirtyTerms = localTerms.filter(term => term.isDirty)
      if (dirtyTerms.length === 0) return

      if (category === "formations") {
        // For formations, we need to create new records with the team's ID
        const newFormations = dirtyTerms.map(term => ({
          concept: term.concept,
          label: term.label,
          category: 'formations',
          team_id: profile.team_id,
          is_enabled: true
        }))

        console.log('New Formations:', newFormations) // Debug log

        // Delete any existing formations for this team
        const { error: deleteError } = await supabase
          .from('terminology')
          .delete()
          .eq('category', 'formations')
          .eq('team_id', profile.team_id)

        if (deleteError) {
          console.error('Delete error:', deleteError)
          throw new Error('Error deleting existing formations: ' + deleteError.message)
        }

        // Insert new formations
        const { error: insertError } = await supabase
          .from('terminology')
          .insert(newFormations)

        if (insertError) {
          console.error('Insert error:', insertError)
          throw new Error('Error inserting new formations: ' + insertError.message)
        }

        // Update local state to remove dirty flags
        const updatedTerms = localTerms.map(term => ({
          ...term,
          isDirty: false
        }))
        setLocalTerms(updatedTerms)
        onUpdate(updatedTerms)
      } else {
        // For non-formations, update existing records
        await batchUpdateTerminology(
          dirtyTerms.map(term => ({
            id: term.id,
            concept: term.concept,
            label: term.label
          }))
        )
        
        // Update local state to remove dirty flags
        const updatedTerms = localTerms.map(term => ({
          ...term,
          isDirty: false
        }))
        setLocalTerms(updatedTerms)
        onUpdate(updatedTerms)
      }
    } catch (error) {
      console.error('Error in handleSaveAll:', error)
      alert(error instanceof Error ? error.message : 'An error occurred while saving')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          {userInfo.id ? (
            <div className="text-sm bg-blue-50 p-2 rounded mt-2">
              <div className="font-medium text-blue-700">Debug Info:</div>
              <div className="text-blue-600">User ID: {userInfo.id}</div>
              {userInfo.email && <div className="text-blue-600">Email: {userInfo.email}</div>}
            </div>
          ) : (
            <div className="text-sm bg-red-50 p-2 rounded mt-2">
              <div className="text-red-600">No user session found</div>
            </div>
          )}
        </div>
        <div className="flex space-x-2 items-center">
          {localTerms.some(term => term.isDirty) && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </>
              )}
            </Button>
          )}
          {category === "formations" ? (
            getAvailableFormations().length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={addRow}
                className="text-blue-600 hover:text-blue-800"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Formation
              </Button>
            ) : (
              <span className="text-sm text-gray-500">All formations have been selected</span>
            )
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={addRow}
              className="text-blue-600 hover:text-blue-800"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="grid grid-cols-[2fr_1fr_auto_auto_auto] gap-4 font-medium mb-2 px-2">
            <div>Concept</div>
            <div>Label</div>
            <div></div>
            <div></div>
            <div></div>
          </div>

          {localTerms.map((term) => (
            <div key={`row-${term.id}`} className="grid grid-cols-[2fr_1fr_auto_auto_auto] gap-4 items-center py-2 border-b">
              <div key={`concept-${term.id}`}>
                {term.isEditing || category === "formations" ? (
                  category === "formations" ? (
                    <Select
                      value={term.concept || ''}
                      onValueChange={(value) => updateConcept(term, value)}
                    >
                      <SelectTrigger className="h-9 w-full bg-white border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors duration-200">
                        <SelectValue placeholder="Select formation" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 shadow-lg rounded-md">
                        {defaultFormations.map((formation) => {
                          const isSelected = localTerms.some(t => t.id !== term.id && t.concept === formation.concept)
                          return (
                            <SelectItem 
                              key={formation.concept} 
                              value={formation.concept || ''}
                              disabled={isSelected}
                              className="cursor-pointer px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[state=checked]:bg-green-50 [&>span]:pl-6"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{formation.concept}</span>
                                {isSelected && (
                                  <span className="text-xs text-gray-400 ml-2">(selected)</span>
                                )}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                  <Input 
                    key={`concept-input-${term.id}`}
                    value={term.concept} 
                    onChange={(e) => updateConcept(term, e.target.value)} 
                    className="h-9" 
                  />
                  )
                ) : (
                  <span key={`concept-text-${term.id}`} className="text-gray-600">
                    {term.concept}
                  </span>
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
                key={`view-btn-${term.id}`}
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (term.image_url) {
                    setSelectedImage({url: term.image_url, concept: term.concept || ''})
                  }
                }}
                disabled={!term.image_url}
                className="hover:bg-yellow-50"
              >
                <Eye className="h-4 w-4 text-yellow-500" />
                <span className="sr-only">View concept</span>
              </Button>
              <Button
                key={`edit-btn-${term.id}`}
                variant="ghost"
                size="icon"
                onClick={() => toggleEdit(term)}
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

        {category === "formations" ? (
          getAvailableFormations().length > 0 ? (
            <Button variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
          ) : (
            <div className="text-sm text-gray-500 text-center">
              All formations have been selected
            </div>
          )
        ) : (
        <Button variant="outline" onClick={addRow}>
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
        )}
      </CardContent>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              {selectedImage?.concept}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {selectedImage && (
              <img 
                src={selectedImage.url} 
                alt={selectedImage.concept} 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg border-2 border-black"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [terminologyState, setTerminologyState] = useState<Record<string, TerminologyWithUI[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedSections, setSavedSections] = useState<Record<string, boolean>>({})
  const [savingCategories, setSavingCategories] = useState<Record<string, boolean>>({})
  const [needsPlayPoolUpdate, setNeedsPlayPoolUpdate] = useState(false)
  const [updatingPlayPool, setUpdatingPlayPool] = useState(false)
  const [teamId, setTeamId] = useState<string | null>(null)

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

        // Get the team ID from localStorage
        const storedTeamId = localStorage.getItem('teamId')
        setTeamId(storedTeamId)

        try {
          await initializeDefaultTerminology()
          // Update formation concepts to match predefined list
          await updateFormationConcepts()
        } catch (initError) {
          console.error('Initialization error:', initError)
          setError(`Error initializing terminology: ${initError instanceof Error ? initError.message : 'Unknown initialization error'}`)
          setIsLoading(false)
          return
        }

        try {
          const terms = await getTerminology(storedTeamId || undefined)
          
          // Group terms by category
          const groupedTerms = terms.reduce((acc, term) => {
            if (!term.category) return acc
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
          isEditing: true
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
    motions: { title: "Motions", category: "motions" },
    shifts: { title: "Shifts", category: "shifts" },
    pass_protections: { title: "Pass Protections", category: "pass_protections" },
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
          {needsPlayPoolUpdate && (
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  setUpdatingPlayPool(true);
                  await updatePlayPoolTerminology();
                  setNeedsPlayPoolUpdate(false);
                } catch (error) {
                  console.error('Error updating play pool:', error);
                } finally {
                  setUpdatingPlayPool(false);
                }
              }}
              disabled={updatingPlayPool}
              className="bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            >
              {updatingPlayPool ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-yellow-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating Play Pool...
                </>
              ) : (
                <>
                  <span className="mr-2">⚠️</span>
                  Sync Changes to Play Pool
                </>
              )}
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={() => router.push('/playpool')}
          >
            Continue to Play Pool →
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
          <TerminologySet
            key={category}
            title={title}
            terms={terminologyState[category] || []}
            category={category}
            onUpdate={(newTerms) => {
                        setTerminologyState(prev => ({
                          ...prev,
                [category]: newTerms
              }))
            }}
          />
        ))}
      </div>

      <div className="flex justify-between mt-8">
        <Button 
          variant="outline" 
          onClick={() => router.push('/')}
        >
          ← Back to Home
        </Button>
        <div className="flex gap-2">
          {needsPlayPoolUpdate && (
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  setUpdatingPlayPool(true);
                  await updatePlayPoolTerminology();
                  setNeedsPlayPoolUpdate(false);
                } catch (error) {
                  console.error('Error updating play pool:', error);
                } finally {
                  setUpdatingPlayPool(false);
                }
              }}
              disabled={updatingPlayPool}
              className="bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            >
              {updatingPlayPool ? "Updating..." : "Sync to Play Pool"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push('/playpool')}
          >
            Continue to Play Pool →
          </Button>
        </div>
      </div>
    </div>
  )
}
