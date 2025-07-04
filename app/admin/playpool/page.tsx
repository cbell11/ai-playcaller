"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayCircle, Loader2, Check, X, Plus, AlertCircle, Pencil, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"

interface ScoutingTerm {
  id: string
  name: string
  category: 'front' | 'coverage' | 'blitz'
  is_enabled: boolean
}

interface MasterPlay {
  id: string
  play_id: number
  shifts: string | null
  to_motions: string | null
  formations: string
  tags: string | null
  from_motions: string | null
  pass_protections: string | null
  concept: string
  concept_tag: string | null
  rpo_tag: string | null
  category: string
  third_s: boolean
  third_m: boolean
  third_l: boolean
  rz: boolean
  gl: boolean
  front_beaters: string | null
  coverage_beaters: string | null
  blitz_beaters: string | null
  notes: string | null
  created_at: string
  updated_at: string
  concept_direction: string | null
}

interface NewPlay {
  play_id: string
  shifts: string
  to_motions: string
  formations: string
  tags: string
  from_motions: string
  pass_protections: string
  concept: string
  concept_direction: 'plus' | 'minus' | 'none'
  concept_tag: string
  rpo_tag: string
  category: string
  third_s: boolean
  third_m: boolean
  third_l: boolean
  rz: boolean
  gl: boolean
  front_beaters: string[]
  coverage_beaters: string[]
  blitz_beaters: string[]
  notes: string
}

interface Terminology {
  id: string
  concept: string
  label: string
  category: string
  is_enabled: boolean
}

interface ScoutingData {
  fronts: { name: string }[]
  coverages: { name: string }[]
  blitzes: { name: string }[]
}

const defaultNewPlay: NewPlay = {
  play_id: '',
  shifts: '',
  to_motions: '',
  formations: '',
  tags: '',
  from_motions: '',
  pass_protections: '',
  concept: '',
  concept_direction: 'none',
  concept_tag: '',
  rpo_tag: '',
  category: '',
  third_s: false,
  third_m: false,
  third_l: false,
  rz: false,
  gl: false,
  front_beaters: [],
  coverage_beaters: [],
  blitz_beaters: [],
  notes: ''
}

export default function MasterPlayPoolPage() {
  const [plays, setPlays] = useState<MasterPlay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddPlayOpen, setIsAddPlayOpen] = useState(false)
  const [newPlay, setNewPlay] = useState<NewPlay>(defaultNewPlay)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error',
    message: string
  } | null>(null)
  
  // Add states for edit functionality
  const [editingPlay, setEditingPlay] = useState<MasterPlay | null>(null)
  const [isEditPlayOpen, setIsEditPlayOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [playToDelete, setPlayToDelete] = useState<MasterPlay | null>(null)
  
  // Filter states
  const [conceptFilter, setConceptFilter] = useState('all')
  const [formationFilter, setFormationFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  
  // Unique values for filters
  const [uniqueConcepts, setUniqueConcepts] = useState<string[]>([])
  const [uniqueFormations, setUniqueFormations] = useState<string[]>([])
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([])

  // Terminology states
  const [formations, setFormations] = useState<Terminology[]>([])
  const [concepts, setConcepts] = useState<Terminology[]>([])
  const [tags, setTags] = useState<Terminology[]>([])
  const [shifts, setShifts] = useState<Terminology[]>([])
  const [toMotions, setToMotions] = useState<Terminology[]>([])
  const [fromMotions, setFromMotions] = useState<Terminology[]>([])
  const [passProtections, setPassProtections] = useState<Terminology[]>([])
  const [fronts, setFronts] = useState<Terminology[]>([])
  const [coverages, setCoverages] = useState<Terminology[]>([])
  const [blitzes, setBlitzes] = useState<Terminology[]>([])
  const [conceptTags, setConceptTags] = useState<Terminology[]>([])
  const [rpoTags, setRpoTags] = useState<Terminology[]>([])

  const [scoutingTerms, setScoutingTerms] = useState<{
    fronts: ScoutingTerm[]
    coverages: ScoutingTerm[]
    blitzes: ScoutingTerm[]
  }>({
    fronts: [],
    coverages: [],
    blitzes: []
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchPlays()
    fetchTerminology()
    fetchScoutingTerms()
  }, [])

  const fetchPlays = async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase.from('master_play_pool').select('*')

      if (conceptFilter && conceptFilter !== 'all') {
        query = query.ilike('concept', `%${conceptFilter}%`)
      }
      if (formationFilter && formationFilter !== 'all') {
        query = query.ilike('formations', `%${formationFilter}%`)
      }
      if (categoryFilter && categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter)
      }

      const { data, error } = await query

      if (error) throw error

      setPlays(data || [])

      // Extract unique values for filters using reduce
      const concepts = (data || [])
        .map(play => play.concept)
        .filter((value, index, self) => value && self.indexOf(value) === index)
      const formations = (data || [])
        .map(play => play.formations)
        .filter((value, index, self) => value && self.indexOf(value) === index)
        .flatMap(formation => formation.split(',').map((f: string) => f.trim()))
        .filter((value, index, self) => value && self.indexOf(value) === index)
      const categories = (data || [])
        .map(play => play.category)
        .filter((value, index, self) => value && self.indexOf(value) === index)

      setUniqueConcepts(concepts)
      setUniqueFormations(formations)
      setUniqueCategories(categories)

    } catch (err) {
      console.error('Error fetching plays:', err)
      setError('Failed to fetch plays')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlays()
  }, [conceptFilter, formationFilter, categoryFilter])

  const handleAddPlay = async () => {
    try {
      setIsSubmitting(true)
      setNotification(null)
      
      // Validate required fields
      if (!newPlay.category || !newPlay.formations || !newPlay.concept) {
        setNotification({
          type: 'error',
          message: "Category, Formation, and Concept are required fields"
        })
        return
      }

      // Check for duplicate play
      const { data: existingPlays, error: checkError } = await supabase
        .from('master_play_pool')
        .select('*')
        .eq('category', newPlay.category)
        .eq('shifts', newPlay.shifts || '')
        .eq('to_motions', newPlay.to_motions || '')
        .eq('formations', newPlay.formations)
        .eq('tags', newPlay.tags || '')
        .eq('from_motions', newPlay.from_motions || '')
        .eq('concept', newPlay.concept)
        .eq('concept_tag', newPlay.concept_tag || '')
        .eq('concept_direction', newPlay.concept_direction === 'none' ? '' : newPlay.concept_direction === 'plus' ? '+' : '-')
        .eq('rpo_tag', newPlay.rpo_tag || '')

      if (checkError) throw checkError

      if (existingPlays && existingPlays.length > 0) {
        setNotification({
          type: 'error',
          message: "A play with these exact specifications already exists in the master play pool"
        })
        return
      }

      // Convert concept_direction back to database format
      const dbConceptDirection = newPlay.concept_direction === 'none' ? '' : 
                               newPlay.concept_direction === 'plus' ? '+' : '-'

      // Get the next available play_id
      const { data: maxPlayId, error: maxPlayIdError } = await supabase
        .from('master_play_pool')
        .select('play_id')
        .order('play_id', { ascending: false })
        .limit(1)
        .single()

      if (maxPlayIdError && maxPlayIdError.code !== 'PGRST116') throw maxPlayIdError

      const nextPlayId = maxPlayId ? maxPlayId.play_id + 1 : 1

      // Create the play
      const { error: createError } = await supabase
        .from('master_play_pool')
        .insert({
          ...newPlay,
          play_id: nextPlayId,
          concept_direction: dbConceptDirection,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (createError) throw createError

      // Refresh plays list
      await fetchPlays()
      
      setNotification({
        type: 'success',
        message: 'Play added successfully!'
      })
      setIsAddPlayOpen(false)
      setNewPlay(defaultNewPlay)
    } catch (err) {
      console.error('Error adding play:', err)
      setNotification({
        type: 'error',
        message: 'Failed to add play. Please try again.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const fetchTerminology = async () => {
    try {
      // Get default team terminology
      const defaultTeamId = '8feef3dc-942f-4bc5-b526-0b39e14cb683'
      const { data: terminology, error } = await supabase
        .from('terminology')
        .select('*')
        .eq('team_id', defaultTeamId)

      if (error) throw error

      if (terminology) {
        // Set formations and tags
        setFormations(terminology.filter(t => t.category === 'formations'))
        setTags(terminology.filter(t => t.category === 'form_tags'))
        setShifts(terminology.filter(t => t.category === 'shifts'))
        setToMotions(terminology.filter(t => t.category === 'to_motions'))
        setFromMotions(terminology.filter(t => t.category === 'from_motions'))
        setPassProtections(terminology.filter(t => t.category === 'pass_protections'))
        setConceptTags(terminology.filter(t => t.category === 'concept_tag'))
        setRpoTags(terminology.filter(t => t.category === 'rpo_tag'))
        
        // Combine all offensive concepts
        const allConcepts = [
          ...terminology.filter(t => t.category === 'run_game'),
          ...terminology.filter(t => t.category === 'quick_game'),
          ...terminology.filter(t => t.category === 'dropback_game'),
          ...terminology.filter(t => t.category === 'screen_game'),
          ...terminology.filter(t => t.category === 'shot_plays')
        ]
        setConcepts(allConcepts)

        // Get defensive terminology from scouting reports
        const { data: scoutingData, error: scoutingError } = await supabase
          .from('scouting_reports')
          .select('fronts, coverages, blitzes')
          .limit(1)
          .single()

        if (scoutingError) {
          console.error('Error fetching scouting data:', scoutingError)
          return
        }

        if (scoutingData) {
          const data = scoutingData as ScoutingData
          
          // Convert scouting data to terminology format
          if (data.fronts && Array.isArray(data.fronts)) {
            setFronts(data.fronts.map(f => ({ 
              id: f.name, 
              concept: f.name, 
              label: f.name, 
              category: 'fronts', 
              is_enabled: true 
            })))
          }
          
          if (data.coverages && Array.isArray(data.coverages)) {
            setCoverages(data.coverages.map(c => ({ 
              id: c.name, 
              concept: c.name, 
              label: c.name, 
              category: 'coverages', 
              is_enabled: true 
            })))
          }
          
          if (data.blitzes && Array.isArray(data.blitzes)) {
            setBlitzes(data.blitzes.map(b => ({ 
              id: b.name, 
              concept: b.name, 
              label: b.name, 
              category: 'blitzes', 
              is_enabled: true 
            })))
          }
        }
      }
    } catch (err) {
      console.error('Error fetching terminology:', err)
      setError('Failed to fetch terminology')
    }
  }

  const fetchScoutingTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('scouting_terminology')
        .select('*')
        .eq('is_enabled', true)
        .order('name')

      if (error) throw error

      const terms = {
        fronts: data.filter(term => term.category === 'front'),
        coverages: data.filter(term => term.category === 'coverage'),
        blitzes: data.filter(term => term.category === 'blitz')
      }

      setScoutingTerms(terms)
    } catch (err) {
      console.error('Error fetching scouting terms:', err)
      setNotification({
        type: 'error',
        message: 'Failed to fetch scouting terminology'
      })
    }
  }

  const handleEditPlay = async () => {
    try {
      setIsSubmitting(true)
      setNotification(null)
      
      if (!editingPlay) return;

      // Convert concept_direction back to database format
      const dbConceptDirection = editingPlay.concept_direction === 'none' ? '' : 
                               editingPlay.concept_direction === 'plus' ? '+' : '-';

      // Find the formation object to get its label
      const formationObj = formations.find(f => f.concept === editingPlay.formations)
      const formationLabel = formationObj ? formationObj.label : editingPlay.formations

      // Prepare play data
      const playData = {
        ...editingPlay,
        formations: formationLabel,
        concept_direction: dbConceptDirection,
      }

      const { error: updateError } = await supabase
        .from('master_play_pool')
        .update(playData)
        .eq('id', editingPlay.id)

      if (updateError) throw updateError

      setEditingPlay(null)
      setIsEditPlayOpen(false)
      setNotification({
        type: 'success',
        message: "Play updated successfully!"
      })

      // Refresh plays list
      fetchPlays()
    } catch (err) {
      console.error('Error updating play:', err)
      setNotification({
        type: 'error',
        message: "Failed to update play. Please try again."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePlay = async () => {
    try {
      if (!playToDelete) return;
      
      console.log('Attempting to delete play:', {
        playId: playToDelete.play_id,
        playDetails: playToDelete
      });

      // First verify if the play exists
      const { data: existingPlay, error: checkError } = await supabase
        .from('master_play_pool')
        .select('play_id')
        .eq('play_id', playToDelete.play_id)
        .single();

      if (checkError) {
        console.error('Error checking play existence:', checkError);
        throw checkError;
      }

      if (!existingPlay) {
        throw new Error(`Play with ID ${playToDelete.play_id} not found in master_play_pool`);
      }

      // Attempt the delete operation
      const { error: deleteError, data: deleteData } = await supabase
        .from('master_play_pool')
        .delete()
        .eq('play_id', playToDelete.play_id)
        .select()

      if (deleteError) {
        console.error('Delete error details:', {
          code: deleteError.code,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint
        });
        throw deleteError;
      }

      console.log('Play deleted successfully', deleteData);
      setPlayToDelete(null);
      setIsDeleteConfirmOpen(false);
      setNotification({
        type: 'success',
        message: "Play deleted successfully!"
      });

      // Refresh plays list
      await fetchPlays();
    } catch (error: any) {
      console.error('Error deleting play:', {
        name: error.name,
        message: error.message,
        details: error.details,
        code: error.code,
        stack: error.stack
      });
      setNotification({
        type: 'error',
        message: `Failed to delete play: ${error.message || 'Unknown error'}`
      });
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-6 w-6" />
            Master Play Pool
          </CardTitle>
          <Button 
            className="bg-[#2ecc71] hover:bg-[#27ae60] text-white"
            onClick={() => setIsAddPlayOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add a play to the master playpool
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Total Plays Counter Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center">
              <div className="text-2xl font-bold">{plays.length}</div>
              <div className="text-sm text-muted-foreground">Total Plays in Master Pool</div>
            </div>
          </CardContent>
        </Card>

        {notification && (
          <div 
            className={`mb-4 p-4 rounded-md ${
              notification.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {notification.message}
            </div>
          </div>
        )}
        <div className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Formation</Label>
              <Select value={formationFilter} onValueChange={setFormationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select formation" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Formations</SelectItem>
                  {uniqueFormations.map(formation => (
                    <SelectItem key={formation} value={formation}>
                      {formation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Concept</Label>
              <Select value={conceptFilter} onValueChange={setConceptFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select concept" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Concepts</SelectItem>
                  {uniqueConcepts.map(concept => (
                    <SelectItem key={concept} value={concept}>
                      {concept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Plays Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">ID</th>
                    <th className="h-10 px-4 text-left font-medium">Category</th>
                    <th className="h-10 px-4 text-left font-medium">Shifts</th>
                    <th className="h-10 px-4 text-left font-medium">To Motions</th>
                    <th className="h-10 px-4 text-left font-medium">Formation</th>
                    <th className="h-10 px-4 text-left font-medium">Formation Tag</th>
                    <th className="h-10 px-4 text-left font-medium">From Motions</th>
                    <th className="h-10 px-4 text-left font-medium">Concept</th>
                    <th className="h-10 px-4 text-left font-medium">Concept Tag</th>
                    <th className="h-10 px-4 text-left font-medium">Direction</th>
                    <th className="h-10 px-4 text-left font-medium">RPO Tag</th>
                    <th className="h-10 px-4 text-left font-medium">Front Beaters</th>
                    <th className="h-10 px-4 text-left font-medium">Coverage Beaters</th>
                    <th className="h-10 px-4 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plays.map((play, index) => (
                    <tr key={play.id || index} className="border-b">
                      <td className="p-4">{play.play_id}</td>
                      <td className="p-4">{play.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                      <td className="p-4">{play.shifts}</td>
                      <td className="p-4">{play.to_motions}</td>
                      <td className="p-4">{play.formations}</td>
                      <td className="p-4">{play.tags}</td>
                      <td className="p-4">{play.from_motions}</td>
                      <td className="p-4">{play.concept}</td>
                      <td className="p-4">{play.concept_tag}</td>
                      <td className="p-4">{play.concept_direction}</td>
                      <td className="p-4">{play.rpo_tag}</td>
                      <td className="p-4 max-w-[200px] break-words">{play.front_beaters}</td>
                      <td className="p-4 max-w-[200px] break-words">{play.coverage_beaters}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPlayToDelete(play)
                              setIsDeleteConfirmOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Play Modal */}
        <Dialog open={isEditPlayOpen} onOpenChange={(open) => {
          setIsEditPlayOpen(open)
          if (!open) {
            setEditingPlay(null)
            setNotification(null)
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Play</DialogTitle>
            </DialogHeader>
            {notification && notification.type === 'error' && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {notification.message}
                </div>
              </div>
            )}
            <div className="grid gap-4 py-4">
              {/* Category Selection */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={editingPlay?.category || ''}
                  onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, category: value }) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="run_game">Run Game</SelectItem>
                    <SelectItem value="quick_game">Quick Game</SelectItem>
                    <SelectItem value="dropback_game">Dropback Game</SelectItem>
                    <SelectItem value="screen_game">Screen Game</SelectItem>
                    <SelectItem value="shot_plays">Shot Plays</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Formation */}
              <div className="space-y-2">
                <Label htmlFor="formations">Formation *</Label>
                <Select
                  value={editingPlay?.formations || ''}
                  onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, formations: value }) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select formation" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {formations.map(formation => (
                      <SelectItem key={formation.id} value={formation.concept}>
                        {formation.label || formation.concept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Add other fields similar to Add Play modal but for editing */}
              {/* ... */}

            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleEditPlay}
                disabled={isSubmitting || !editingPlay?.category || !editingPlay?.formations || !editingPlay?.concept}
                className="bg-[#2ecc71] hover:bg-[#27ae60] text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Play...
                  </>
                ) : (
                  'Update Play'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this play from the master play pool.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPlayToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePlay}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Play Modal */}
        <Dialog open={isAddPlayOpen} onOpenChange={(open) => {
          setIsAddPlayOpen(open)
          if (!open) {
            setNotification(null)
            setNewPlay(defaultNewPlay)
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Play to Master Pool</DialogTitle>
            </DialogHeader>
            {notification && notification.type === 'error' && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {notification.message}
                </div>
              </div>
            )}
            <div className="grid gap-4 py-4">
              {/* Category Selection */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={newPlay.category}
                  onValueChange={(value) => setNewPlay(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="run_game">Run Game</SelectItem>
                    <SelectItem value="quick_game">Quick Game</SelectItem>
                    <SelectItem value="dropback_game">Dropback Game</SelectItem>
                    <SelectItem value="screen_game">Screen Game</SelectItem>
                    <SelectItem value="shot_plays">Shot Plays</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Shifts */}
              <div className="space-y-2">
                <Label htmlFor="shifts">Shifts</Label>
                <Select
                  value={newPlay.shifts || "none"}
                  onValueChange={(value) => setNewPlay(prev => ({ ...prev, shifts: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shifts" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">None</SelectItem>
                    {shifts.map(shift => (
                      <SelectItem key={shift.id} value={shift.concept}>
                        {shift.label || shift.concept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To Motion */}
              <div className="space-y-2">
                <Label htmlFor="to_motions">To Motion</Label>
                <Select
                  value={newPlay.to_motions || "none"}
                  onValueChange={(value) => setNewPlay(prev => ({ ...prev, to_motions: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select to motion" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">None</SelectItem>
                    {toMotions.map(motion => (
                      <SelectItem key={motion.id} value={motion.concept}>
                        {motion.label || motion.concept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Formation and Formation Tag */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formations">Formation *</Label>
                  <Select
                    value={newPlay.formations}
                    onValueChange={(value) => setNewPlay(prev => ({ ...prev, formations: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select formation" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {formations.map(formation => (
                        <SelectItem key={formation.id} value={formation.concept}>
                          {formation.label || formation.concept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Formation Tag</Label>
                  <Select
                    value={newPlay.tags || "none"}
                    onValueChange={(value) => setNewPlay(prev => ({ ...prev, tags: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select formation tag" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.concept}>
                          {tag.label || tag.concept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* From Motion */}
              <div className="space-y-2">
                <Label htmlFor="from_motions">From Motion</Label>
                <Select
                  value={newPlay.from_motions || "none"}
                  onValueChange={(value) => setNewPlay(prev => ({ ...prev, from_motions: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select from motion" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">None</SelectItem>
                    {fromMotions.map(motion => (
                      <SelectItem key={motion.id} value={motion.concept}>
                        {motion.label || motion.concept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Concept and Direction */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="concept">Concept *</Label>
                  <Select
                    value={newPlay.concept}
                    onValueChange={(value) => setNewPlay(prev => ({ ...prev, concept: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select concept" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {concepts
                        .filter(c => {
                          if (!newPlay.category) return true
                          return c.category === newPlay.category
                        })
                        .map(concept => (
                          <SelectItem key={concept.id} value={concept.concept}>
                            {concept.label || concept.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="concept_direction">Concept Direction</Label>
                  <Select
                    value={newPlay.concept_direction}
                    onValueChange={(value: 'plus' | 'minus' | 'none') => 
                      setNewPlay(prev => ({ ...prev, concept_direction: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">No Direction</SelectItem>
                      <SelectItem value="plus">+ (Plus)</SelectItem>
                      <SelectItem value="minus">- (Minus)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Concept Tag and RPO Tag */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="concept_tag">Concept Tag</Label>
                  <Select
                    value={newPlay.concept_tag || "none"}
                    onValueChange={(value) => setNewPlay(prev => ({ ...prev, concept_tag: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select concept tag" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {conceptTags.map(tag => (
                        <SelectItem key={tag.id} value={tag.concept}>
                          {tag.label || tag.concept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rpo_tag">RPO Tag</Label>
                  <Select
                    value={newPlay.rpo_tag || "none"}
                    onValueChange={(value) => setNewPlay(prev => ({ ...prev, rpo_tag: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select RPO tag" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {rpoTags.map(tag => (
                        <SelectItem key={tag.id} value={tag.concept}>
                          {tag.label || tag.concept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pass Protection */}
              <div className="space-y-2">
                <Label htmlFor="pass_protections">Pass Protection</Label>
                <Select
                  value={newPlay.pass_protections || "none"}
                  onValueChange={(value) => setNewPlay(prev => ({ ...prev, pass_protections: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pass protection" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">None</SelectItem>
                    {passProtections.map(protection => (
                      <SelectItem key={protection.id} value={protection.concept}>
                        {protection.label || protection.concept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Beaters Section */}
              <div className="space-y-4">
                <h3 className="font-medium">Beaters</h3>
                
                {/* Front Beaters */}
                <div className="space-y-2">
                  <Label>Front Beaters</Label>
                  <div className="flex flex-wrap gap-2">
                    {scoutingTerms.fronts.map((front) => (
                      <div
                        key={front.id}
                        className="flex items-center"
                      >
                        <Checkbox
                          id={`front-${front.id}`}
                          checked={newPlay.front_beaters.includes(front.name)}
                          onCheckedChange={(checked) => {
                            setNewPlay(prev => ({
                              ...prev,
                              front_beaters: checked
                                ? [...prev.front_beaters, front.name]
                                : prev.front_beaters.filter(f => f !== front.name)
                            }))
                          }}
                        />
                        <Label
                          htmlFor={`front-${front.id}`}
                          className="ml-2 text-sm font-normal"
                        >
                          {front.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coverage Beaters */}
                <div className="space-y-2">
                  <Label>Coverage Beaters</Label>
                  <div className="flex flex-wrap gap-2">
                    {scoutingTerms.coverages.map((coverage) => (
                      <div
                        key={coverage.id}
                        className="flex items-center"
                      >
                        <Checkbox
                          id={`coverage-${coverage.id}`}
                          checked={newPlay.coverage_beaters.includes(coverage.name)}
                          onCheckedChange={(checked) => {
                            setNewPlay(prev => ({
                              ...prev,
                              coverage_beaters: checked
                                ? [...prev.coverage_beaters, coverage.name]
                                : prev.coverage_beaters.filter(c => c !== coverage.name)
                            }))
                          }}
                        />
                        <Label
                          htmlFor={`coverage-${coverage.id}`}
                          className="ml-2 text-sm font-normal"
                        >
                          {coverage.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blitz Beaters */}
                <div className="space-y-2">
                  <Label>Blitz Beaters</Label>
                  <div className="flex flex-wrap gap-2">
                    {scoutingTerms.blitzes.map((blitz) => (
                      <div
                        key={blitz.id}
                        className="flex items-center"
                      >
                        <Checkbox
                          id={`blitz-${blitz.id}`}
                          checked={newPlay.blitz_beaters.includes(blitz.name)}
                          onCheckedChange={(checked) => {
                            setNewPlay(prev => ({
                              ...prev,
                              blitz_beaters: checked
                                ? [...prev.blitz_beaters, blitz.name]
                                : prev.blitz_beaters.filter(b => b !== blitz.name)
                            }))
                          }}
                        />
                        <Label
                          htmlFor={`blitz-${blitz.id}`}
                          className="ml-2 text-sm font-normal"
                        >
                          {blitz.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Situations */}
              <div className="space-y-4">
                <h3 className="font-medium">Situations</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="third_s"
                        checked={newPlay.third_s}
                        onCheckedChange={(checked) => 
                          setNewPlay(prev => ({ ...prev, third_s: !!checked }))
                        }
                      />
                      <Label htmlFor="third_s">3rd & Short</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="third_m"
                        checked={newPlay.third_m}
                        onCheckedChange={(checked) => 
                          setNewPlay(prev => ({ ...prev, third_m: !!checked }))
                        }
                      />
                      <Label htmlFor="third_m">3rd & Medium</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="third_l"
                        checked={newPlay.third_l}
                        onCheckedChange={(checked) => 
                          setNewPlay(prev => ({ ...prev, third_l: !!checked }))
                        }
                      />
                      <Label htmlFor="third_l">3rd & Long</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rz"
                        checked={newPlay.rz}
                        onCheckedChange={(checked) => 
                          setNewPlay(prev => ({ ...prev, rz: !!checked }))
                        }
                      />
                      <Label htmlFor="rz">Red Zone</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="gl"
                        checked={newPlay.gl}
                        onCheckedChange={(checked) => 
                          setNewPlay(prev => ({ ...prev, gl: !!checked }))
                        }
                      />
                      <Label htmlFor="gl">Goal Line</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newPlay.notes}
                  onChange={(e) => setNewPlay(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Enter any additional notes"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="submit"
                onClick={handleAddPlay}
                disabled={isSubmitting || !newPlay.category || !newPlay.formations || !newPlay.concept}
                className="bg-[#2ecc71] hover:bg-[#27ae60] text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Play...
                  </>
                ) : (
                  'Add Play'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
} 