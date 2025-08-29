"use client"

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Pencil, Check, Trash2, Eye, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

// Default team that contains base terminology
const DEFAULT_TEAM_ID = '8feef3dc-942f-4bc5-b526-0b39e14cb683';

interface Terminology {
  id: string
  concept?: string
  label?: string
  category?: string
  is_enabled?: boolean
  image_url?: string
  team_id?: string
}

// Extend Terminology interface to include UI state
interface TerminologyWithUI extends Terminology {
  isEditing?: boolean
  isDirty?: boolean
}

interface TerminologySetProps {
  title: string
  terms: TerminologyWithUI[]
  category: string
  onUpdate: (terms: TerminologyWithUI[]) => void
  supabase: any
  setProfileInfo: (info: any) => void
  setTeamCode: (code: string) => void
  setTeamName: (name: string) => void
}

const TerminologySet: React.FC<TerminologySetProps> = ({ title, terms, category, onUpdate, supabase, setProfileInfo, setTeamCode, setTeamName }) => {
  const [isSaving, setIsSaving] = useState(false)
  const [hasDeleted, setHasDeleted] = useState(false)
  const [localTerms, setLocalTerms] = useState<TerminologyWithUI[]>(terms || [])
  const [selectedImage, setSelectedImage] = useState<{url: string, concept: string} | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showNewConceptDialog, setShowNewConceptDialog] = useState(false)
  const [newConcept, setNewConcept] = useState({ concept: '', label: '', image_url: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showAddImageDialog, setShowAddImageDialog] = useState(false)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [isUpdatingImage, setIsUpdatingImage] = useState(false)

  // Check if user is admin when component mounts
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        if (!supabase) {
          console.error('Supabase client is not initialized');
          return;
        }
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role === 'admin') {
          setIsAdmin(true)
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    }
    
    checkAdminStatus()
  }, [supabase])

  // Update local terms when props change
  useEffect(() => {
    setLocalTerms(terms || [])
  }, [terms])

  // Add useEffect to simulate loading state
  useEffect(() => {
    // Set a small timeout to show loading state
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  const filteredTerms = localTerms.filter(term => 
    term.concept?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    term.label?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addRow = () => {
    const newTerm: TerminologyWithUI = {
      id: crypto.randomUUID(),
      concept: '',
      label: '',
      category: category,
      is_enabled: true,
      isDirty: true,
      isEditing: true,
      team_id: DEFAULT_TEAM_ID
    }
    setLocalTerms([...localTerms, newTerm])
    onUpdate([...localTerms, newTerm])
  }

  const updateConcept = (term: TerminologyWithUI, newConcept: string) => {
    const updatedTerms = localTerms.map(t => 
      t.id === term.id ? { ...t, concept: newConcept, isDirty: true } : t
    )
    setLocalTerms(updatedTerms)
    onUpdate(updatedTerms)
  }

  const updateLabel = (term: TerminologyWithUI, newLabel: string) => {
    const updatedTerms = localTerms.map(t => 
      t.id === term.id ? { ...t, label: newLabel, isDirty: true } : t
    )
    setLocalTerms(updatedTerms)
    onUpdate(updatedTerms)
  }

  const toggleEdit = (term: TerminologyWithUI) => {
    const updatedTerms = localTerms.map(t => 
      t.id === term.id ? { ...t, isEditing: !t.isEditing } : t
    )
    setLocalTerms(updatedTerms)
    onUpdate(updatedTerms)
  }

  const deleteRow = async (term: TerminologyWithUI) => {
    try {
      const { error } = await supabase
        .from('terminology')
        .delete()
        .eq('id', term.id)
        .eq('team_id', DEFAULT_TEAM_ID)

      if (error) throw error

      const updatedTerms = localTerms.filter(t => t.id !== term.id)
      setLocalTerms(updatedTerms)
      onUpdate(updatedTerms)

      setSaveSuccess('Term deleted successfully')
      const timeout = setTimeout(() => setSaveSuccess(null), 3000)
      setSaveTimeout(timeout)
    } catch (error) {
      console.error('Error deleting term:', error)
      alert('Failed to delete term')
    }
  }

  const handleUpdateImage = async () => {
    if (!selectedImage?.concept) return;
    
    try {
      setIsUpdatingImage(true)

      // Find the term in the default team that matches this concept
      const { data: termData, error: findError } = await supabase
        .from('terminology')
        .select('id')
        .eq('concept', selectedImage.concept)
        .eq('category', category)
        .eq('team_id', DEFAULT_TEAM_ID)
        .single()

      if (findError) {
        throw new Error('Failed to find terminology item')
      }

      // Update the image_url for this terminology item
      const { error: updateError } = await supabase
        .from('terminology')
        .update({ image_url: newImageUrl })
        .eq('id', termData.id)

      if (updateError) {
        throw new Error('Failed to update image URL')
      }

      // Update local state
      const updatedTerms = localTerms.map(term => 
        term.concept === selectedImage.concept 
          ? { ...term, image_url: newImageUrl }
          : term
      )
      setLocalTerms(updatedTerms)
      onUpdate(updatedTerms)

      // Update selectedImage to reflect the change
      setSelectedImage({ ...selectedImage, url: newImageUrl })

      // Show success message
      setSaveSuccess('Image updated successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(null)
      }, 3000)

      // Close the dialog
      setShowAddImageDialog(false)
      setNewImageUrl('')

    } catch (error) {
      console.error('Error updating image:', error)
      alert('Failed to update image. Please try again.')
    } finally {
      setIsUpdatingImage(false)
    }
  }

  const handleSave = async () => {
    if (!isAdmin) {
      alert('Only admins can modify the default terminology')
      return
    }

    try {
      setIsSaving(true)
      
      // Clear any existing success message and timeout
      setSaveSuccess(null)
      if (saveTimeout) {
        clearTimeout(saveTimeout)
        setSaveTimeout(null)
      }

      const dirtyTerms = localTerms.filter(term => term.isDirty)
      
      for (const term of dirtyTerms) {
        const termData = {
          concept: term.concept,
          label: term.label,
          category: category,
          team_id: DEFAULT_TEAM_ID,
          ...(term.image_url && { image_url: term.image_url })
        }

        if (term.id.includes('-')) { // New term (UUID)
          const { error: insertError } = await supabase
            .from('terminology')
            .insert([termData])

          if (insertError) throw insertError
        } else { // Existing term
          const { error: updateError } = await supabase
            .from('terminology')
            .update(termData)
            .eq('id', term.id)
            .eq('team_id', DEFAULT_TEAM_ID)

          if (updateError) throw updateError
        }
      }

      // Update local state to reflect saved changes
      const updatedTerms = localTerms.map(term => ({
        ...term,
        isDirty: false
      }))
      setLocalTerms(updatedTerms)
      onUpdate(updatedTerms)

      setSaveSuccess('Changes saved successfully')
      const timeout = setTimeout(() => setSaveSuccess(null), 3000)
      setSaveTimeout(timeout)
    } catch (error) {
      console.error('Error saving changes:', error)
      alert('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAll = async () => {
    try {
      setIsSaving(true)
      
      // Clear any existing success message and timeout
      setSaveSuccess(null)
      if (saveTimeout) {
        clearTimeout(saveTimeout)
        setSaveTimeout(null)
      }

      const dirtyTerms = localTerms.filter(term => term.isDirty)
      
      for (const term of dirtyTerms) {
        // Only update the concept and label fields, preserve other fields
        const termData = {
          concept: term.concept,
          label: term.label
        }

        // Always update existing row since we're editing in the master terminology
        const { error: updateError } = await supabase
          .from('terminology')
          .update(termData)
          .eq('id', term.id)
          .eq('team_id', DEFAULT_TEAM_ID)

        if (updateError) throw updateError
      }

      // Update local state to reflect saved changes
      const updatedTerms = localTerms.map(term => ({
        ...term,
        isDirty: false,
        isEditing: false // Close edit mode after saving
      }))
      setLocalTerms(updatedTerms)
      onUpdate(updatedTerms)

      setSaveSuccess('Changes saved successfully')
      const timeout = setTimeout(() => setSaveSuccess(null), 3000)
      setSaveTimeout(timeout)
    } catch (error) {
      console.error('Error in handleSaveAll:', error)
      alert(error instanceof Error ? error.message : 'An error occurred while saving')
    } finally {
      setIsSaving(false)
      setHasDeleted(false) // Reset delete flag after saving
    }
  }

  const getAvailableItems = () => {
    // Your existing getAvailableItems logic here
    return []
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
    }
  }, [saveTimeout])

  const handleCreateNewConcept = async () => {
    try {
      setIsCreating(true)
      setCreateError(null)

      // Validate inputs
      if (!newConcept.concept.trim() || !newConcept.label.trim()) {
        setCreateError('Concept and Label are required')
        return
      }

      // Check if concept already exists
      const { data: existingConcepts, error: checkError } = await supabase
        .from('terminology')
        .select('concept')
        .eq('category', category)
        .eq('team_id', DEFAULT_TEAM_ID)
        .eq('concept', newConcept.concept)

      if (checkError) {
        throw new Error('Error checking existing concepts')
      }

      if (existingConcepts && existingConcepts.length > 0) {
        setCreateError('This concept already exists')
        return
      }

      // Create new concept for default team
      const { data: newItem, error: createError } = await supabase
        .from('terminology')
        .insert([{
          concept: newConcept.concept,
          label: newConcept.label,
          category: category,
          team_id: DEFAULT_TEAM_ID,
          ...(newConcept.image_url ? { image_url: newConcept.image_url } : {})
        }])
        .select()
        .single()

      if (createError) {
        throw new Error('Error creating new concept')
      }

      // Update local state
      const updatedTerms = [...localTerms, { ...newItem, isDirty: false, isEditing: false }]
      setLocalTerms(updatedTerms)
      onUpdate(updatedTerms)

      // Show success message
      setSaveSuccess('New concept created successfully!')
      const timeout = setTimeout(() => setSaveSuccess(null), 3000)
      setSaveTimeout(timeout)

      // Reset form and close dialog
      setNewConcept({ concept: '', label: '', image_url: '' })
      setShowNewConceptDialog(false)

    } catch (error) {
      console.error('Error creating new concept:', error)
      setCreateError(error instanceof Error ? error.message : 'An error occurred while creating the concept')
    } finally {
      setIsCreating(false)
    }
  }



  if (!isAdmin) {
    return null
  }

  return (
    <Card className={category === "to_motions" || category === "from_motions" || category === "shifts" ? "mb-8 w-full" : "mb-8"}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          {(category === "formations" || category === "form_tags") && (
            <p className="text-sm text-gray-500 mt-1">
              Select the {category === "formations" ? "formations" : "formation tags"} you want to use in your playbook.
              <span className="block mt-1 italic">Click the edit button to customize names.</span>
            </p>
          )}
          {saveSuccess && (
            <div className="mt-2 text-sm bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-600" />
              {saveSuccess}
            </div>
          )}
        </div>
        <div className="flex space-x-2 items-center">
          {((localTerms?.some && localTerms.some(term => term.isDirty)) || hasDeleted) && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="bg-[#2ecc71] hover:bg-[#27ae60] text-white"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowNewConceptDialog(true)}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New {category === "formations" ? "Formation" : 
                       category === "form_tags" ? "Formation Tag" : 
                       category === "shifts" ? "Shift" : 
                       category === "to_motions" ? "To Motion" : 
                       category === "from_motions" ? "From Motion" :
                       category === "run_game" ? "Run Game" :
                       category === "pass_protections" ? "Pass Protection" :
                       category === "quick_game" ? "Quick Game" :
                       category === "dropback_game" ? "Dropback Game" :
                       category === "screen_game" ? "Screen Game" :
                       category === "shot_plays" ? "Shot Play" :
                       category === "concept_tags" ? "Concept Tag" : ""}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">Loading {title.toLowerCase()}...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Input
                placeholder="Search terms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="mb-6">
              <div className="grid grid-cols-[2fr_1fr_auto_auto_auto] gap-4 font-medium mb-2 px-2">
                <div>Concept</div>
                <div>Label</div>
                <div></div>
                <div></div>
                <div></div>
              </div>

              {filteredTerms.length > 0 ? (
                filteredTerms.map((term) => (
                  <div key={term.id} className="grid grid-cols-[2fr_1fr_auto_auto_auto] gap-4 items-center py-2 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      {term.isEditing ? (
                        <Input
                          value={term.concept || ''}
                          onChange={(e) => updateConcept(term, e.target.value)}
                          placeholder="Enter concept..."
                        />
                      ) : (
                        <span>{term.concept}</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-8 w-8"
                        onClick={() => setSelectedImage({
                          url: term.image_url || '',
                          concept: term.concept || ''
                        })}
                      >
                        <Eye className={`h-4 w-4 ${term.image_url ? 'text-amber-500' : 'text-gray-400'}`} />
                      </Button>
                    </div>
                    <div>
                      {term.isEditing ? (
                        <Input
                          value={term.label || ''}
                          onChange={(e) => updateLabel(term, e.target.value)}
                          placeholder="Enter label..."
                        />
                      ) : (
                        <span>{term.label}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleEdit(term)}
                    >
                      <Pencil className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRow(term)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                    <div></div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? "No terms match your search" : "No terms added yet"}
                </div>
              )}
            </div>

            {/* Image preview dialog */}
            <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
              <DialogContent className="max-w-[75vw] w-full max-h-[98vh]">
                <DialogHeader>
                  <DialogTitle className="text-xl text-center w-full">
                    {category === "formations" ? "Formation" : 
                     category === "form_tags" ? "Formation Tag" : 
                     category === "shifts" ? "Shift" : 
                     category === "to_motions" ? "To Motion" : 
                     category === "from_motions" ? "From Motion" :
                     category === "run_game" ? "Run Game" :
                     category === "pass_protections" ? "Pass Protection" :
                     category === "quick_game" ? "Quick Game" :
                     category === "dropback_game" ? "Dropback Game" :
                     category === "screen_game" ? "Screen Game" :
                     category === "shot_plays" ? "Shot Play" : ""}: {selectedImage?.concept}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex justify-center items-center p-0 h-full w-full">
                  {selectedImage?.url ? (
                    <div className="w-full h-full flex justify-center items-center">
                      <img 
                        src={selectedImage.url} 
                        alt={selectedImage.concept} 
                        className="max-h-[95vh] w-auto object-contain"
                        style={{ maxWidth: '100%' }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 min-h-[200px] w-full">
                      <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Image Available</h3>
                      <p className="text-gray-500">This item doesn't have an image associated with it.</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="pt-1 justify-center">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setNewImageUrl(selectedImage?.url || '')
                        setShowAddImageDialog(true)
                      }}
                    >
                      {selectedImage?.url ? 'Update Image' : 'Add Image'}
                    </Button>
                  <Button variant="secondary" onClick={() => setSelectedImage(null)}>
                    Close
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog for adding/updating image URL */}
            <Dialog open={showAddImageDialog} onOpenChange={setShowAddImageDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Image for {selectedImage?.concept}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL</Label>
                    <Input
                      id="imageUrl"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Enter image URL..."
                    />
                    <p className="text-sm text-gray-500">
                      Provide a URL for an image that represents this concept.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddImageDialog(false)
                      setNewImageUrl('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateImage}
                    disabled={isUpdatingImage || !newImageUrl.trim()}
                  >
                    {isUpdatingImage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Image'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog for creating new concept */}
            <Dialog open={showNewConceptDialog} onOpenChange={setShowNewConceptDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New {title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {createError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                      {createError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Concept Name</Label>
                    <Input
                      value={newConcept.concept}
                      onChange={(e) => setNewConcept({ ...newConcept, concept: e.target.value })}
                      placeholder="Enter concept name..."
                    />
                    <p className="text-sm text-gray-500">
                      This is the internal name used by the system
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Display Label</Label>
                    <Input
                      value={newConcept.label}
                      onChange={(e) => setNewConcept({ ...newConcept, label: e.target.value })}
                      placeholder="Enter display label..."
                    />
                    <p className="text-sm text-gray-500">
                      This is what users will see
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Image URL {category === "formations" ? "(Required)" : "(Optional)"}</Label>
                    <Input
                      value={newConcept.image_url}
                      onChange={(e) => setNewConcept({ ...newConcept, image_url: e.target.value })}
                      placeholder="Enter image URL..."
                    />
                    <p className="text-sm text-gray-500">
                      {category === "formations" 
                        ? "Provide a URL for the formation diagram" 
                        : "Optional: Provide a URL for an illustration"}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewConcept({ concept: '', label: '', image_url: '' })
                      setShowNewConceptDialog(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateNewConcept}
                    disabled={isCreating || !newConcept.concept || !newConcept.label || (category === "formations" && !newConcept.image_url)}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminTerminologyPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [terminology, setTerminology] = useState<Terminology[]>([])
  const [formationsSet, setFormationsSet] = useState<TerminologyWithUI[]>([])
  const [formTagsSet, setFormTagsSet] = useState<TerminologyWithUI[]>([])
  const [shiftsSet, setShiftsSet] = useState<TerminologyWithUI[]>([])
  const [toMotionsSet, setToMotionsSet] = useState<TerminologyWithUI[]>([])
  const [fromMotionsSet, setFromMotionsSet] = useState<TerminologyWithUI[]>([])
  const [runGameSet, setRunGameSet] = useState<TerminologyWithUI[]>([])
  const [rpoTagsSet, setRpoTagsSet] = useState<TerminologyWithUI[]>([])
  const [passProtectionsSet, setPassProtectionsSet] = useState<TerminologyWithUI[]>([])
  const [quickGameSet, setQuickGameSet] = useState<TerminologyWithUI[]>([])
  const [dropbackGameSet, setDropbackGameSet] = useState<TerminologyWithUI[]>([])
  const [screenGameSet, setScreenGameSet] = useState<TerminologyWithUI[]>([])
  const [shotPlaysSet, setShotPlaysSet] = useState<TerminologyWithUI[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredTerms, setFilteredTerms] = useState<TerminologyWithUI[]>([])
  const [conceptTagsSet, setConceptTagsSet] = useState<TerminologyWithUI[]>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('Not authenticated')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          setError('Unauthorized: Admin access required')
          return
        }

        setIsAdmin(true)
        // Set loading to false only after we confirm admin status
        setTimeout(() => setIsLoading(false), 500) // Small delay to ensure smooth transition
      } catch (err) {
        setError('Failed to check admin status')
      }
    }

    checkAdminStatus()
  }, [])

  // Load terminology when component mounts
  useEffect(() => {
    const loadTerminology = async () => {
      try {
        setIsLoading(true)

        // Get all terminology for the default team
        const { data, error } = await supabase
          .from('terminology')
          .select('*')
          .eq('team_id', DEFAULT_TEAM_ID)
          .order('category')

        if (error) throw error

        setTerminology(data || [])

        // Group terminology by category
        setFormationsSet(data?.filter(term => term.category === 'formations') || [])
        setFormTagsSet(data?.filter(term => term.category === 'form_tags') || [])
        setShiftsSet(data?.filter(term => term.category === 'shifts') || [])
        setToMotionsSet(data?.filter(term => term.category === 'to_motions') || [])
        setFromMotionsSet(data?.filter(term => term.category === 'from_motions') || [])
        setRunGameSet(data?.filter(term => term.category === 'run_game') || [])
        setRpoTagsSet(data?.filter(term => term.category === 'rpo_tag') || [])
        setPassProtectionsSet(data?.filter(term => term.category === 'pass_protections') || [])
        setQuickGameSet(data?.filter(term => term.category === 'quick_game') || [])
        setDropbackGameSet(data?.filter(term => term.category === 'dropback_game') || [])
        setScreenGameSet(data?.filter(term => term.category === 'screen_game') || [])
        setShotPlaysSet(data?.filter(term => term.category === 'shot_plays') || [])
        setConceptTagsSet(data?.filter(term => term.category === 'concept_tags') || [])
      } catch (error) {
        console.error('Error loading terminology:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTerminology()
  }, [supabase])

  const handleUpdateFormations = (updatedTerms: TerminologyWithUI[]) => setFormationsSet(updatedTerms)
  const handleUpdateFormTags = (updatedTerms: TerminologyWithUI[]) => setFormTagsSet(updatedTerms)
  const handleUpdateShifts = (updatedTerms: TerminologyWithUI[]) => setShiftsSet(updatedTerms)
  const handleUpdateToMotions = (updatedTerms: TerminologyWithUI[]) => setToMotionsSet(updatedTerms)
  const handleUpdateFromMotions = (updatedTerms: TerminologyWithUI[]) => setFromMotionsSet(updatedTerms)
  const handleUpdateRunGame = (updatedTerms: TerminologyWithUI[]) => setRunGameSet(updatedTerms)
  const handleUpdateRpoTags = (updatedTerms: TerminologyWithUI[]) => setRpoTagsSet(updatedTerms)
  const handleUpdatePassProtections = (updatedTerms: TerminologyWithUI[]) => setPassProtectionsSet(updatedTerms)
  const handleUpdateQuickGame = (updatedTerms: TerminologyWithUI[]) => setQuickGameSet(updatedTerms)
  const handleUpdateDropbackGame = (updatedTerms: TerminologyWithUI[]) => setDropbackGameSet(updatedTerms)
  const handleUpdateScreenGame = (updatedTerms: TerminologyWithUI[]) => setScreenGameSet(updatedTerms)
  const handleUpdateShotPlays = (updatedTerms: TerminologyWithUI[]) => setShotPlaysSet(updatedTerms)
  const handleUpdateConceptTags = (updatedTerms: TerminologyWithUI[]) => setConceptTagsSet(updatedTerms)

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
          <p className="text-lg text-gray-600">Loading Master Terminology Management...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Master Terminology Management</h1>
        <p className="text-gray-600">
          Manage the default terminology that will be available to all teams. Changes made here will affect the terminology options available to all teams.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            <TerminologySet
              title="Formations"
              terms={formationsSet}
              category="formations"
              onUpdate={handleUpdateFormations}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="Shifts"
              terms={shiftsSet}
              category="shifts"
              onUpdate={handleUpdateShifts}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="Pass Protections"
              terms={passProtectionsSet}
              category="pass_protections"
              onUpdate={handleUpdatePassProtections}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="Quick Game"
              terms={quickGameSet}
              category="quick_game"
              onUpdate={handleUpdateQuickGame}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="Screen Game"
              terms={screenGameSet}
              category="screen_game"
              onUpdate={handleUpdateScreenGame}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <TerminologySet
              title="Formation Tags"
              terms={formTagsSet}
              category="form_tags"
              onUpdate={handleUpdateFormTags}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="To Motions"
              terms={toMotionsSet}
              category="to_motions"
              onUpdate={handleUpdateToMotions}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="From Motions"
              terms={fromMotionsSet}
              category="from_motions"
              onUpdate={handleUpdateFromMotions}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="Run Game"
              terms={runGameSet}
              category="run_game"
              onUpdate={handleUpdateRunGame}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="RPO Tags"
              terms={rpoTagsSet}
              category="rpo_tag"
              onUpdate={handleUpdateRpoTags}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="Dropback Game"
              terms={dropbackGameSet}
              category="dropback_game"
              onUpdate={handleUpdateDropbackGame}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="Shot Plays"
              terms={shotPlaysSet}
              category="shot_plays"
              onUpdate={handleUpdateShotPlays}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
            <TerminologySet
              title="Concept Tags"
              terms={conceptTagsSet}
              category="concept_tags"
              onUpdate={handleUpdateConceptTags}
              supabase={supabase}
              setProfileInfo={() => {}}
              setTeamCode={() => {}}
              setTeamName={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 