"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayCircle, Loader2, Check, X, Plus, AlertCircle, Pencil, Trash2, ChevronDown, Upload, FileSpreadsheet } from 'lucide-react'
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
  const [playText, setPlayText] = useState('')
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
  
  // Sorting states
  const [sortBy, setSortBy] = useState<'play_id' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
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

  const [expandedRows, setExpandedRows] = useState<{[key: string]: boolean}>({})
  const [selectedBeaters, setSelectedBeaters] = useState<{
    play: MasterPlay | null,
    type: 'front' | 'coverage' | null
  }>({
    play: null,
    type: null
  })

  // Bulk upload states
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null)
  const [bulkUploadResults, setBulkUploadResults] = useState<{
    play: any,
    status: 'success' | 'error' | 'duplicate',
    message: string,
    csvData?: { [key: string]: string },
    row?: number
  }[]>([])
  const [isBulkUploading, setIsBulkUploading] = useState(false)
  const [cameFromBulkUpload, setCameFromBulkUpload] = useState(false)

  const toggleRowExpansion = (playId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [playId]: !prev[playId]
    }))
  }

  // Handle sorting by play_id
  const handleSort = (column: 'play_id') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Get sorted and filtered plays
  const getSortedPlays = () => {
    let sortedPlays = [...plays]
    
    if (sortBy === 'play_id') {
      sortedPlays.sort((a, b) => {
        const aValue = a.play_id
        const bValue = b.play_id
        
        if (sortOrder === 'asc') {
          return aValue - bValue
        } else {
          return bValue - aValue
        }
      })
    }
    
    return sortedPlays
  }

  // Transform database play values to UI-friendly values for editing
  const preparePlayForEditing = (play: MasterPlay): MasterPlay => {
    // Convert concept_direction from database format (+/-/'') to UI format (plus/minus/none)
    let uiConceptDirection = 'none'
    if (play.concept_direction === '+') {
      uiConceptDirection = 'plus'
    } else if (play.concept_direction === '-') {
      uiConceptDirection = 'minus'
    }

    return {
      ...play,
      concept_direction: uiConceptDirection,
      // Convert null values to empty strings for better UI handling
      // Use empty string for fields that should show "none" option, null will be handled by the || "none" in selects
      shifts: play.shifts || null,
      to_motions: play.to_motions || null,
      tags: play.tags || null,
      from_motions: play.from_motions || null,
      pass_protections: play.pass_protections || null,
      concept_tag: play.concept_tag || null,
      rpo_tag: play.rpo_tag || null,
      notes: play.notes || ''
    }
  }

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

  const handleFillPlayFromText = () => {
    if (!playText.trim() || !newPlay.category) {
      setNotification({
        type: 'error',
        message: 'Please select a category and enter play text before filling'
      })
      return
    }

    try {
      // Split the play text into parts, handling quoted strings
      const parts = playText.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || []
      // Remove quotes from quoted parts
      const cleanParts = parts.map(part => part.replace(/^"(.*)"$/, '$1'))

      // Helper function to find matching terminology with better scoring
      const findMatch = (searchText: string, terminologyArray: Terminology[], allowPartial = true) => {
        if (!searchText) return null
        
        const searchLower = searchText.toLowerCase()
        
        // First try exact match on label or concept
        let match = terminologyArray.find(term => 
          (term.label && term.label.toLowerCase() === searchLower) ||
          (term.concept && term.concept.toLowerCase() === searchLower)
        )
        
        if (match) return match
        
        // If no exact match and partial allowed, try partial match
        if (allowPartial) {
          match = terminologyArray.find(term => 
            (term.label && term.label.toLowerCase().includes(searchLower)) ||
            (term.concept && term.concept.toLowerCase().includes(searchLower))
          )
        }
        
        return match
      }

      // Helper function to try multiple parts for compound terms (like "Gun Ace")
      const findCompoundMatch = (startIndex: number, maxWords: number, terminologyArray: Terminology[]) => {
        for (let wordCount = maxWords; wordCount >= 1; wordCount--) {
          if (startIndex + wordCount > cleanParts.length) continue
          
          const compoundTerm = cleanParts.slice(startIndex, startIndex + wordCount).join(' ')
          const match = findMatch(compoundTerm, terminologyArray, false) // Only exact matches for compounds
          
          if (match) {
            return { match, wordsUsed: wordCount }
          }
        }
        return null
      }

      let updatedPlay = { ...newPlay }
      let currentIndex = 0
      let fieldsChanged = 0

      // Get available concepts for later use
      const availableConcepts = concepts.filter(c => {
        if (newPlay.category === 'rpo_game') {
          return c.category === 'run_game'
        }
        return c.category === newPlay.category
      })

      const isPassPlay = ['quick_game', 'dropback_game', 'shot_plays', 'rpo_game', 'screen_game', 'moving_pocket'].includes(newPlay.category)

      // Process each part flexibly
      while (currentIndex < cleanParts.length) {
        let matched = false

        // Try to match formation first (most important and often appears early)
        if (!updatedPlay.formations) {
          const result = findCompoundMatch(currentIndex, 3, formations)
          if (result) {
            updatedPlay.formations = result.match.label || result.match.concept
            currentIndex += result.wordsUsed
            fieldsChanged++
            matched = true
            continue
          }
        }

        // Try concept (required field)
        if (!updatedPlay.concept) {
          const result = findCompoundMatch(currentIndex, 3, availableConcepts)
          if (result) {
            updatedPlay.concept = result.match.label || result.match.concept
            currentIndex += result.wordsUsed
            fieldsChanged++
            matched = true
            continue
          }
        }

        // Try pass protection for pass plays (can have + and -)
        if (isPassPlay && !updatedPlay.pass_protections) {
          const result = findCompoundMatch(currentIndex, 3, passProtections)
          if (result) {
            updatedPlay.pass_protections = result.match.label || result.match.concept
            currentIndex += result.wordsUsed
            fieldsChanged++
            matched = true
            continue
          }
        }

        // Try shifts
        if (!updatedPlay.shifts) {
          const match = findMatch(cleanParts[currentIndex], shifts)
          if (match) {
            updatedPlay.shifts = match.label || match.concept
            currentIndex++
            fieldsChanged++
            matched = true
            continue
          }
        }

        // Try to motion
        if (!updatedPlay.to_motions) {
          const result = findCompoundMatch(currentIndex, 2, toMotions)
          if (result) {
            updatedPlay.to_motions = result.match.label || result.match.concept
            currentIndex += result.wordsUsed
            fieldsChanged++
            matched = true
            continue
          }
        }

        // Try formation tags
        if (!updatedPlay.tags) {
          const result = findCompoundMatch(currentIndex, 2, tags)
          if (result) {
            updatedPlay.tags = result.match.label || result.match.concept
            currentIndex += result.wordsUsed
            fieldsChanged++
            matched = true
            continue
          }
        }

        // Try from motion
        if (!updatedPlay.from_motions) {
          const result = findCompoundMatch(currentIndex, 2, fromMotions)
          if (result) {
            updatedPlay.from_motions = result.match.label || result.match.concept
            currentIndex += result.wordsUsed
            fieldsChanged++
            matched = true
            continue
          }
        }

        // Try concept tags
        if (!updatedPlay.concept_tag) {
          const result = findCompoundMatch(currentIndex, 2, conceptTags)
          if (result) {
            updatedPlay.concept_tag = result.match.label || result.match.concept
            currentIndex += result.wordsUsed
            fieldsChanged++
            matched = true
            continue
          }
        }

        // Try RPO tags
        if (!updatedPlay.rpo_tag) {
          const match = findMatch(cleanParts[currentIndex], rpoTags)
          if (match) {
            updatedPlay.rpo_tag = match.label || match.concept
            currentIndex++
            fieldsChanged++
            matched = true
            continue
          }
        }

        // Try direction (but only if it's a standalone +/- or plus/minus, not part of a formation/protection)
        if (!updatedPlay.concept_direction || updatedPlay.concept_direction === 'none') {
          const directionText = cleanParts[currentIndex].toLowerCase()
          if (directionText === '+' || directionText === 'plus') {
            updatedPlay.concept_direction = 'plus'
            currentIndex++
            fieldsChanged++
            matched = true
            continue
          } else if (directionText === '-' || directionText === 'minus') {
            updatedPlay.concept_direction = 'minus'
            currentIndex++
            fieldsChanged++
            matched = true
            continue
          }
        }

        // If nothing matched, move to next part
        if (!matched) {
          currentIndex++
        }
      }

      setNewPlay(updatedPlay)
      
      // Show success message
      const message = fieldsChanged > 0 
        ? `Successfully filled ${fieldsChanged} field${fieldsChanged !== 1 ? 's' : ''} from play text`
        : 'No matching fields found. Try adjusting your play text or terminology.'
      
      setNotification({
        type: fieldsChanged > 0 ? 'success' : 'error',
        message
      })
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setNotification(null)
      }, 3000)
      
    } catch (error) {
      console.error('Error parsing play text:', error)
      setNotification({
        type: 'error',
        message: 'Error parsing play text. Please check the format and try again.'
      })
    }
  }

  const handleEditFromCsv = (csvData: { [key: string]: string }) => {
    // No category mapping needed - use original CSV categories directly

    // Normalize concept direction
    let conceptDirection: 'plus' | 'minus' | 'none' = 'none'
    if (csvData['Concept_Direction']) {
      const dir = csvData['Concept_Direction'].trim()
      if (dir === '+') {
        conceptDirection = 'plus'
      } else if (dir === '-') {
        conceptDirection = 'minus'
      } else if (['plus', 'minus', 'none'].includes(dir)) {
        conceptDirection = dir as 'plus' | 'minus' | 'none'
      }
    }

    // Parse beaters from CSV
    const frontBeaters = csvData['Front Beaters'] ? 
      csvData['Front Beaters'].split(',').map(b => b.trim()).filter(b => b) : []
    const coverageBeaters = csvData['Coverage Beaters'] ? 
      csvData['Coverage Beaters'].split(',').map(b => b.trim()).filter(b => b) : []
    const blitzBeaters = csvData['Blitz Beaters'] ? 
      csvData['Blitz Beaters'].split(',').map(b => b.trim()).filter(b => b) : []

    // Populate the newPlay state with CSV data
    setNewPlay({
      play_id: '',
      shifts: csvData['Shift'] || '',
      to_motions: csvData['TO_Motions'] || '',
      formations: csvData['Formations'] || '',
      tags: csvData['Tags'] || '',
      from_motions: csvData['From_Motions'] || '',
      pass_protections: csvData['Pass_Protections'] || '',
      concept: csvData['Concept'] || '',
      concept_direction: conceptDirection,
      concept_tag: csvData['Concept_Tag'] || '',
      rpo_tag: csvData['RPO_Tag'] || '',
      category: csvData['Category'] || '',
      third_s: csvData['3rd & S']?.toUpperCase() === 'TRUE',
      third_m: csvData['3rd & M']?.toUpperCase() === 'TRUE',
      third_l: csvData['3rd & L']?.toUpperCase() === 'TRUE',
      rz: csvData['RZ']?.toUpperCase() === 'TRUE',
      gl: csvData['GL']?.toUpperCase() === 'TRUE',
      front_beaters: frontBeaters,
      coverage_beaters: coverageBeaters,
      blitz_beaters: blitzBeaters,
      notes: ''
    })

    // Set the play text from Full Play Call and clear it first
    setPlayText(csvData['Full Play Call'] || '')
    
    // Mark that we came from bulk upload
    setCameFromBulkUpload(true)
    
    // Close bulk upload modal and open add play modal
    setIsBulkUploadOpen(false)
    setIsAddPlayOpen(true)
  }

  const handleBulkUpload = async () => {
    if (!bulkUploadFile) {
      setNotification({
        type: 'error',
        message: 'Please select a CSV file to upload'
      })
      return
    }

    try {
      setIsBulkUploading(true)
      setBulkUploadResults([])

      const fileText = await bulkUploadFile.text()
      const lines = fileText.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('CSV file must have header row and at least one data row')
      }

      // Parse header row
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      
      // Expected columns (exactly as in Excel sheet)
      const expectedColumns = [
        'Full Play Call', 'Shift', 'TO_Motions', 'Formations', 'Tags', 'From_Motions', 
        'Pass_Protections', 'Concept', 'Concept_Tag', 'Concept_Direction', 'RPO_Tag', 
        'Category', '3rd & S', '3rd & M', '3rd & L', 'RZ', 'GL', 
        'Front Beaters', 'Coverage Beaters', 'Blitz Beaters'
      ]

      // Check if all required columns exist
      const missingColumns = expectedColumns.slice(1).filter(col => !headers.includes(col)) // Skip 'Full Play Call'
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`)
      }

      const results: typeof bulkUploadResults = []

      // Get the next available play_id
      const { data: maxPlayId, error: maxPlayIdError } = await supabase
        .from('master_play_pool')
        .select('play_id')
        .order('play_id', { ascending: false })
        .limit(1)
        .single()

      if (maxPlayIdError && maxPlayIdError.code !== 'PGRST116') {
        throw new Error(`Failed to get next play ID: ${maxPlayIdError.message}`)
      }

      let nextPlayId = maxPlayId ? maxPlayId.play_id + 1 : 1

      // Process each data row
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
        if (!row.trim()) continue

        try {
          // Parse CSV row (properly handle quoted values with commas)
          const values: string[] = []
          let current = ''
          let inQuotes = false
          let i = 0
          
          while (i < row.length) {
            const char = row[i]
            
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim())
              current = ''
              i++
              continue
            } else {
              current += char
            }
            i++
          }
          
          // Add the last value
          if (current || values.length > 0) {
            values.push(current.trim())
          }
          
          const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim())

          // Create column mapping
          const rowData: { [key: string]: string } = {}
          headers.forEach((header, index) => {
            rowData[header] = cleanValues[index] || ''
          })

          console.log(`Row ${i + 1} data:`, rowData)

          // Skip rows that are completely empty or only have FALSE/empty values
          const hasValidData = cleanValues.some((value, index) => {
            const header = headers[index]
            return value && 
                   value !== 'FALSE' && 
                   value !== '' && 
                   header !== 'Full Play Call' && 
                   header !== 'Duplicate?' &&
                   !header.includes('3rd &') && 
                   !header.includes('RZ') && 
                   !header.includes('GL')
          })
          
          if (!hasValidData) continue

          // Check if required fields are present
          if (!rowData['Category'] || (!rowData['Formations'] && !rowData['Concept'])) {
            results.push({
              row: i + 1,
              play: { fullPlayCall: rowData['Full Play Call'] || `Row ${i + 1}` },
              status: 'error',
              message: 'Missing required fields (Category, Formation, or Concept)',
              csvData: rowData
            })
            continue
          }

          // Validate each field against dropdown options
          const errors: string[] = []
          
          // Helper function to find terminology item
          const findTerminologyItem = (category: string, value: string) => {
            if (!value) return null
            let terminologyList: Terminology[] = []
            
            switch (category) {
              case 'shifts':
                terminologyList = shifts
                break
              case 'to_motions':
                terminologyList = toMotions
                break
              case 'formations':
                terminologyList = formations
                break
              case 'tags':
                terminologyList = tags
                break
              case 'from_motions':
                terminologyList = fromMotions
                break
              case 'pass_protections':
                terminologyList = passProtections
                break
              case 'concept_tags':
                terminologyList = conceptTags
                break
              case 'rpo_tags':
                terminologyList = rpoTags
                break
              default:
                return null
            }
            
            return terminologyList.find(t => t.label === value || t.concept === value)
          }
          
          // Helper function to validate beaters
          const validateBeaters = (beaterType: string, values: string) => {
            if (!values) return []
            const beaterList = values.split(',').map(b => b.trim()).filter(b => b)
            const invalidBeaters: string[] = []
            
            beaterList.forEach(beater => {
              let found = false
              if (beaterType === 'front') {
                // Check against scouting terms (fronts array has different structure)
                found = scoutingTerms.fronts.some(f => f.name === beater)
              } else if (beaterType === 'coverage') {
                // Check against scouting terms
                found = scoutingTerms.coverages.some(c => c.name === beater)
              } else if (beaterType === 'blitz') {
                // Check against scouting terms
                found = scoutingTerms.blitzes.some(b => b.name === beater)
              }
              if (!found) {
                invalidBeaters.push(beater)
              }
            })
            
            return invalidBeaters
          }
          
          // Validate category (keep original CSV categories)
          const validCategories = ['moving_pocket', 'screen_game', 'shot_plays', 'run_game', 'rpo_game']
          if (rowData['Category'] && !validCategories.includes(rowData['Category'])) {
            errors.push(`Invalid category: ${rowData['Category']} (valid: moving_pocket, screen_game, shot_plays, run_game, rpo_game)`)
          }
          
          // Validate shift (optional)
          if (rowData['Shift'] && rowData['Shift'].trim() && !findTerminologyItem('shifts', rowData['Shift'])) {
            errors.push(`Invalid shift: ${rowData['Shift']}`)
          }
          
          // Validate TO motions (optional)  
          if (rowData['TO_Motions'] && rowData['TO_Motions'].trim() && !findTerminologyItem('to_motions', rowData['TO_Motions'])) {
            errors.push(`Invalid TO motion: ${rowData['TO_Motions']}`)
          }
          
          // Validate formation (optional for now)
          if (rowData['Formations'] && rowData['Formations'].trim() && !findTerminologyItem('formations', rowData['Formations'])) {
            errors.push(`Invalid formation: ${rowData['Formations']}`)
          }
          
          // Validate tag (optional)
          if (rowData['Tags'] && rowData['Tags'].trim() && !findTerminologyItem('tags', rowData['Tags'])) {
            errors.push(`Invalid tag: ${rowData['Tags']}`)
          }
          
          // Validate FROM motions (optional)
          if (rowData['From_Motions'] && rowData['From_Motions'].trim() && !findTerminologyItem('from_motions', rowData['From_Motions'])) {
            errors.push(`Invalid FROM motion: ${rowData['From_Motions']}`)
          }
          
          // Validate pass protection (optional)
          if (rowData['Pass_Protections'] && rowData['Pass_Protections'].trim() && !findTerminologyItem('pass_protections', rowData['Pass_Protections'])) {
            errors.push(`Invalid pass protection: ${rowData['Pass_Protections']}`)
          }
          
          // Validate concept (optional for now)
          if (rowData['Concept'] && rowData['Concept'].trim()) {
            let conceptFound = false
            
            if (rowData['Category'] === 'rpo_game') {
              // RPO concepts come from run_game
              conceptFound = concepts.some(t => 
                t.category === 'run_game' && 
                (t.label === rowData['Concept'] || t.concept === rowData['Concept'])
              )
              if (!conceptFound) {
                errors.push(`Invalid concept for ${rowData['Category']}: ${rowData['Concept']} (looking in run_game)`)
              }
            } else if (rowData['Category'] === 'moving_pocket') {
              // moving_pocket concepts can be from quick_game, dropback_game, or shot_plays
              conceptFound = concepts.some(t => 
                (t.category === 'quick_game' || t.category === 'dropback_game' || t.category === 'shot_plays') &&
                (t.label === rowData['Concept'] || t.concept === rowData['Concept'])
              )
              if (!conceptFound) {
                errors.push(`Invalid concept for ${rowData['Category']}: ${rowData['Concept']} (must be from quick_game, dropback_game, or shot_plays)`)
              }
            } else {
              // For other categories (run_game, screen_game, shot_plays), validate directly
              conceptFound = concepts.some(t => 
                t.category === rowData['Category'] && 
                (t.label === rowData['Concept'] || t.concept === rowData['Concept'])
              )
              if (!conceptFound) {
                errors.push(`Invalid concept for ${rowData['Category']}: ${rowData['Concept']} (looking in ${rowData['Category']})`)
              }
            }
          }
          
          // Validate concept tag
          if (rowData['Concept_Tag'] && !findTerminologyItem('concept_tags', rowData['Concept_Tag'])) {
            errors.push(`Invalid concept tag: ${rowData['Concept_Tag']}`)
          }
          
          // Validate and normalize concept direction
          let normalizedDirection = 'none'
          if (rowData['Concept_Direction']) {
            const dir = rowData['Concept_Direction'].trim()
            if (dir === '+') {
              normalizedDirection = 'plus'
            } else if (dir === '-') {
              normalizedDirection = 'minus'
            } else if (['plus', 'minus', 'none'].includes(dir)) {
              normalizedDirection = dir
            } else {
              errors.push(`Invalid concept direction: ${rowData['Concept_Direction']} (must be +, -, plus, minus, or none)`)
            }
          }
          
          // Validate RPO tag
          if (rowData['RPO_Tag'] && !findTerminologyItem('rpo_tags', rowData['RPO_Tag'])) {
            errors.push(`Invalid RPO tag: ${rowData['RPO_Tag']}`)
          }
          
          // Validate beaters
          const invalidFrontBeaters = validateBeaters('front', rowData['Front Beaters'] || '')
          if (invalidFrontBeaters.length > 0) {
            errors.push(`Invalid front beaters: ${invalidFrontBeaters.join(', ')}`)
          }
          
          const invalidCoverageBeaters = validateBeaters('coverage', rowData['Coverage Beaters'] || '')
          if (invalidCoverageBeaters.length > 0) {
            errors.push(`Invalid coverage beaters: ${invalidCoverageBeaters.join(', ')}`)
          }
          
          const invalidBlitzBeaters = validateBeaters('blitz', rowData['Blitz Beaters'] || '')
          if (invalidBlitzBeaters.length > 0) {
            errors.push(`Invalid blitz beaters: ${invalidBlitzBeaters.join(', ')}`)
          }
          
          // If there are validation errors, mark as error
          if (errors.length > 0) {
            console.log(`Row ${i + 1} validation errors:`, errors)
            results.push({
              row: i + 1,
              play: { fullPlayCall: rowData['Full Play Call'] || `Row ${i + 1}` },
              status: 'error',
              message: errors.join('; '),
              csvData: rowData
            })
            continue
          }

          console.log(`Row ${i + 1} passed validation, creating play data...`)

          // Build play object
          const playData = {
            play_id: nextPlayId++,
            shifts: rowData['Shift'] || '',
            to_motions: rowData['TO_Motions'] || '',
            formations: rowData['Formations'] || '',
            tags: rowData['Tags'] || '',
            from_motions: rowData['From_Motions'] || '',
            pass_protections: rowData['Pass_Protections'] || '',
            concept: rowData['Concept'] || '',
            concept_tag: rowData['Concept_Tag'] || '',
            concept_direction: normalizedDirection as 'plus' | 'minus' | 'none',
            rpo_tag: rowData['RPO_Tag'] || '',
            category: rowData['Category'] || '',
            third_s: rowData['3rd & S']?.toUpperCase() === 'TRUE',
            third_m: rowData['3rd & M']?.toUpperCase() === 'TRUE',
            third_l: rowData['3rd & L']?.toUpperCase() === 'TRUE',
            rz: rowData['RZ']?.toUpperCase() === 'TRUE',
            gl: rowData['GL']?.toUpperCase() === 'TRUE',
            front_beaters: (rowData['Front Beaters'] || '').split(',').map(b => b.trim()).filter(b => b),
            coverage_beaters: (rowData['Coverage Beaters'] || '').split(',').map(b => b.trim()).filter(b => b),
            blitz_beaters: (rowData['Blitz Beaters'] || '').split(',').map(b => b.trim()).filter(b => b),
            notes: ''
          }

          // Validate required fields
          if (!playData.category || !playData.formations || !playData.concept) {
            results.push({
              play: { fullPlayCall: rowData['Full Play Call'] || `Row ${i}` },
              status: 'error',
              message: 'Missing required fields: Category, Formation, or Concept'
            })
            continue
          }

          // Check for duplicate (same category, formation, and concept)
          const isDuplicate = plays.some(existingPlay => 
            existingPlay.category === playData.category &&
            existingPlay.formations === playData.formations &&
            existingPlay.concept === playData.concept &&
            existingPlay.tags === playData.tags &&
            existingPlay.concept_direction === playData.concept_direction
          )

          if (isDuplicate) {
            results.push({
              play: { fullPlayCall: rowData['Full Play Call'] || `Row ${i}` },
              status: 'duplicate',
              message: 'Play already exists in master pool'
            })
            continue
          }

          // Convert arrays to comma-separated strings for database
          const dbPlay = {
            ...playData,
            front_beaters: playData.front_beaters.join(','),
            coverage_beaters: playData.coverage_beaters.join(','),
            blitz_beaters: playData.blitz_beaters.join(',')
          }

          // Insert into database
          const { data, error } = await supabase
            .from('master_play_pool')
            .insert([dbPlay])
            .select()
            .single()

          if (error) {
            results.push({
              play: { fullPlayCall: rowData['Full Play Call'] || `Row ${i}` },
              status: 'error',
              message: `Database error: ${error.message}`
            })
          } else {
            results.push({
              play: { fullPlayCall: rowData['Full Play Call'] || `Row ${i}` },
              status: 'success',
              message: 'Successfully added to master pool'
            })
          }

        } catch (rowError) {
          results.push({
            play: { fullPlayCall: `Row ${i}` },
            status: 'error',
            message: `Row parsing error: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`
          })
        }
      }

      setBulkUploadResults(results)
      
      // Refresh plays list
      await fetchPlays()

      const successCount = results.filter(r => r.status === 'success').length
      const errorCount = results.filter(r => r.status === 'error').length
      const duplicateCount = results.filter(r => r.status === 'duplicate').length

      setNotification({
        type: successCount > 0 ? 'success' : 'error',
        message: `Upload complete: ${successCount} added, ${duplicateCount} duplicates, ${errorCount} errors`
      })

    } catch (error) {
      console.error('Bulk upload error:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to process CSV file'
      })
    } finally {
      setIsBulkUploading(false)
    }
  }

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

      // Since we're now storing the label in newPlay.formations, use it directly
      // But ensure we have the label, not the concept
      const formationObj = formations.find(f => (f.label || f.concept) === newPlay.formations)
      const formationLabel = formationObj ? (formationObj.label || formationObj.concept) : newPlay.formations

      // Convert beaters arrays to comma-separated strings
      const front_beaters = newPlay.front_beaters.join(', ')
      const coverage_beaters = newPlay.coverage_beaters.join(', ')
      const blitz_beaters = newPlay.blitz_beaters.join(', ')

      // Check for duplicate play
      const { data: existingPlays, error: checkError } = await supabase
        .from('master_play_pool')
        .select('*')
        .eq('category', newPlay.category)
        .eq('shifts', newPlay.shifts || '')
        .eq('to_motions', newPlay.to_motions || '')
        .eq('formations', formationLabel)
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

      // Create the play with formatted beaters
      const { error: createError } = await supabase
        .from('master_play_pool')
        .insert({
          ...newPlay,
          formations: formationLabel,
          front_beaters,
          coverage_beaters,
          blitz_beaters,
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
      setPlayText('')
      
      // If we came from bulk upload, return to it and update the result status
      if (cameFromBulkUpload) {
        setCameFromBulkUpload(false)
        setIsBulkUploadOpen(true)
        
        // Update the bulk upload results to mark this play as successfully added
        setBulkUploadResults(prevResults => 
          prevResults.map(result => {
            // Find the result that matches the play we just added (by Full Play Call)
            if (result.status === 'error' && result.csvData && 
                result.csvData['Full Play Call'] === playText) {
              return {
                ...result,
                status: 'success' as const,
                message: 'Successfully added after manual correction'
              }
            }
            return result
          })
        )
      }
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
        setConceptTags(terminology.filter(t => t.category === 'concept_tags')) // Updated from concept_tag
        setRpoTags(terminology.filter(t => t.category === 'rpo_tag'))
        
        // Combine all offensive concepts
        const allConcepts = [
          ...terminology.filter(t => t.category === 'run_game'),
          ...terminology.filter(t => t.category === 'rpo_game'),
          ...terminology.filter(t => t.category === 'quick_game'),
          ...terminology.filter(t => t.category === 'dropback_game'),
          ...terminology.filter(t => t.category === 'screen_game'),
          ...terminology.filter(t => t.category === 'shot_plays')
        ]
        setConcepts(allConcepts)
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

      // Since we're now storing the label in editingPlay.formations, use it directly
      // But ensure we have the label, not the concept
      const formationObj = formations.find(f => (f.label || f.concept) === editingPlay.formations)
      const formationLabel = formationObj ? (formationObj.label || formationObj.concept) : editingPlay.formations

      // Prepare play data
      const playData = {
        ...editingPlay,
        formations: formationLabel,
        concept_direction: dbConceptDirection,
      }

      const { error: updateError } = await supabase
        .from('master_play_pool')
        .update(playData)
        .eq('play_id', editingPlay.play_id)

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
          <div className="flex gap-2">
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setIsBulkUploadOpen(true)}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Bulk Upload (CSV)
            </Button>
            <Button 
              className="bg-[#2ecc71] hover:bg-[#27ae60] text-white"
              onClick={() => setIsAddPlayOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add a play to the master playpool
            </Button>
          </div>
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
                  {uniqueCategories
                    .sort((a, b) => a.localeCompare(b))
                    .map(category => (
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
                  {uniqueFormations
                    .sort((a, b) => a.localeCompare(b))
                    .map(formation => (
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
                  {uniqueConcepts
                    .sort((a, b) => a.localeCompare(b))
                    .map(concept => (
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
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th 
                      className="h-8 px-2 text-left text-xs font-medium cursor-pointer hover:bg-muted/70 select-none"
                      onClick={() => handleSort('play_id')}
                    >
                      <div className="flex items-center gap-1">
                        ID
                        {sortBy === 'play_id' && (
                          <span className="text-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="h-8 px-2 text-left text-xs font-medium">Category</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">Shifts</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">To Motions</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">Formation</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">Formation Tag</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">From Motions</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">Concept</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">Concept Tag</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">Direction</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">RPO Tag</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">Front Beaters</th>
                    <th className="h-8 px-2 text-left text-xs font-medium">Coverage Beaters</th>
                    <th className="h-8 px-2 text-center text-xs font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedPlays().map((play, index) => (
                    <tr key={play.id || index} className="border-b">
                      <td className="p-2 text-xs">{play.play_id}</td>
                      <td className="p-2 text-xs">{play.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                      <td className="p-2 text-xs">{play.shifts}</td>
                      <td className="p-2 text-xs">{play.to_motions}</td>
                      <td className="p-2 text-xs">{play.formations}</td>
                      <td className="p-2 text-xs">{play.tags}</td>
                      <td className="p-2 text-xs">{play.from_motions}</td>
                      <td className="p-2 text-xs">{play.concept}</td>
                      <td className="p-2 text-xs">{play.concept_tag}</td>
                      <td className="p-2 text-xs">{play.concept_direction}</td>
                      <td className="p-2 text-xs">{play.rpo_tag}</td>
                      <td className="p-2 max-w-[120px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-6 text-xs"
                          onClick={() => setSelectedBeaters({ play, type: 'front' })}
                        >
                          Front
                        </Button>
                      </td>
                      <td className="p-2 max-w-[120px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-6 text-xs"
                          onClick={() => setSelectedBeaters({ play, type: 'coverage' })}
                        >
                          Coverage
                        </Button>
                      </td>
                                              <td className="p-2">
                          <div className="flex items-center justify-center space-x-1">
                          <Button
                            variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingPlay(preparePlayForEditing(play))
                                setIsEditPlayOpen(true)
                              }}
                            >
                              <Pencil className="h-3 w-3 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            onClick={() => {
                              setPlayToDelete(play)
                              setIsDeleteConfirmOpen(true)
                            }}
                          >
                              <Trash2 className="h-3 w-3 text-red-500" />
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

        {/* Beaters Dialog */}
        <Dialog 
          open={selectedBeaters.play !== null} 
          onOpenChange={(open) => {
            if (!open) setSelectedBeaters({ play: null, type: null })
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedBeaters.type === 'front' ? 'Front Beaters' : 'Coverage Beaters'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                {selectedBeaters.type === 'front' && selectedBeaters.play?.front_beaters && (
                  <div className="text-sm space-y-1">
                    {selectedBeaters.play.front_beaters.split(',')
                      .filter(beater => beater.trim())
                      .map((beater, index) => (
                        <div key={index} className="py-1 px-2 rounded-md bg-muted">
                          {beater.trim()}
                        </div>
                    ))}
                  </div>
                )}
                {selectedBeaters.type === 'coverage' && selectedBeaters.play?.coverage_beaters && (
                  <div className="text-sm space-y-1">
                    {selectedBeaters.play.coverage_beaters.split(',')
                      .filter(beater => beater.trim())
                      .map((beater, index) => (
                        <div key={index} className="py-1 px-2 rounded-md bg-muted">
                          {beater.trim()}
                        </div>
                    ))}
                  </div>
                )}
                {(!selectedBeaters.play?.front_beaters && selectedBeaters.type === 'front') && (
                  <div className="text-sm text-muted-foreground">No front beaters defined</div>
                )}
                {(!selectedBeaters.play?.coverage_beaters && selectedBeaters.type === 'coverage') && (
                  <div className="text-sm text-muted-foreground">No coverage beaters defined</div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Play Modal */}
        <Dialog open={isEditPlayOpen} onOpenChange={(open) => {
          if (open) {
            fetchTerminology()
            fetchScoutingTerms()
          }
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
            <div className="grid gap-3 py-2 overflow-y-auto max-h-[60vh]">
              {/* Main Play Information - 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Category Selection */}
                <div className="space-y-1">
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
                    <SelectItem value="rpo_game">RPO Game</SelectItem>
                    <SelectItem value="quick_game">Quick Game</SelectItem>
                    <SelectItem value="dropback_game">Dropback Game</SelectItem>
                    <SelectItem value="screen_game">Screen Game</SelectItem>
                    <SelectItem value="shot_plays">Shot Plays</SelectItem>
                    <SelectItem value="moving_pocket">Moving Pocket</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Formation */}
                <div className="space-y-1">
                <Label htmlFor="formations">Formation *</Label>
                <Select
                  value={editingPlay?.formations || ''}
                  onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, formations: value }) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select formation" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {formations
                      .sort((a, b) => {
                        const aLabel = a.label || a.concept
                        const bLabel = b.label || b.concept
                        return aLabel.localeCompare(bLabel)
                      })
                      .map(formation => (
                        <SelectItem key={formation.id} value={formation.label || formation.concept}>
                          {formation.label || formation.concept}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

                {/* Formation Tag */}
                <div className="space-y-1">
                  <Label htmlFor="tags">Formation Tag</Label>
                  <Select
                    value={editingPlay?.tags || "none"}
                    onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, tags: value === "none" ? "" : value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select formation tag" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {tags
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(tag => (
                          <SelectItem key={tag.id} value={tag.label || tag.concept}>
                            {tag.label || tag.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Motion and Shifts - 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Shifts */}
                <div className="space-y-1">
                  <Label htmlFor="shifts">Shifts</Label>
                  <Select
                    value={editingPlay?.shifts || "none"}
                    onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, shifts: value === "none" ? "" : value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select shifts" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {shifts
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(shift => (
                          <SelectItem key={shift.id} value={shift.label || shift.concept}>
                            {shift.label || shift.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* To Motion */}
                <div className="space-y-1">
                  <Label htmlFor="to_motions">To Motion</Label>
                  <Select
                    value={editingPlay?.to_motions || "none"}
                    onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, to_motions: value === "none" ? "" : value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select to motion" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {toMotions
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(motion => (
                          <SelectItem key={motion.id} value={motion.label || motion.concept}>
                            {motion.label || motion.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* From Motion */}
                <div className="space-y-1">
                  <Label htmlFor="from_motions">From Motion</Label>
                  <Select
                    value={editingPlay?.from_motions || "none"}
                    onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, from_motions: value === "none" ? "" : value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select from motion" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {fromMotions
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(motion => (
                          <SelectItem key={motion.id} value={motion.label || motion.concept}>
                            {motion.label || motion.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Concept and Protection - 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Concept */}
                <div className="space-y-1">
                  <Label htmlFor="concept">Concept *</Label>
                  <Select
                    value={editingPlay?.concept || ''}
                    onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, concept: value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select concept" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {concepts
                        .filter(c => {
                          if (!editingPlay?.category) return true
                          // RPO games use run_game concepts since they're run plays with RPO tags
                          if (editingPlay.category === 'rpo_game') {
                            return c.category === 'run_game'
                          }
                          // Moving pocket can use concepts from quick_game, dropback_game, or shot_plays
                          if (editingPlay.category === 'moving_pocket') {
                            return c.category === 'quick_game' || c.category === 'dropback_game' || c.category === 'shot_plays'
                          }
                          return c.category === editingPlay.category
                        })
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(concept => (
                          <SelectItem key={concept.id} value={concept.label || concept.concept}>
                            {concept.label || concept.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Concept Direction */}
                <div className="space-y-1">
                  <Label htmlFor="concept_direction">Concept Direction</Label>
                  <Select
                    value={editingPlay?.concept_direction || "none"}
                    onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, concept_direction: value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="plus">Plus (+)</SelectItem>
                      <SelectItem value="minus">Minus (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pass Protection */}
                <div className="space-y-1">
                  <Label htmlFor="pass_protections">Pass Protection</Label>
                  <Select
                    value={editingPlay?.pass_protections || "none"}
                    onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, pass_protections: value === "none" ? "" : value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select protection" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {passProtections
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(protection => (
                          <SelectItem key={protection.id} value={protection.label || protection.concept}>
                            {protection.label || protection.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags - 2 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Concept Tag */}
                <div className="space-y-1">
                  <Label htmlFor="concept_tag">Concept Tag</Label>
                  <Select
                    value={editingPlay?.concept_tag || "none"}
                    onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, concept_tag: value === "none" ? "" : value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select concept tag" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {conceptTags
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(tag => (
                          <SelectItem key={tag.id} value={tag.label || tag.concept}>
                            {tag.label || tag.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* RPO Tag */}
                <div className="space-y-1">
                  <Label htmlFor="rpo_tag">RPO Tag</Label>
                  <Select
                    value={editingPlay?.rpo_tag || "none"}
                    onValueChange={(value) => setEditingPlay(prev => prev ? ({ ...prev, rpo_tag: value === "none" ? "" : value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select RPO tag" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {rpoTags
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(tag => (
                          <SelectItem key={tag.id} value={tag.label || tag.concept}>
                            {tag.label || tag.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Down & Distance Checkboxes */}
              <div className="space-y-2">
                <Label>Down & Distance</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="third_s"
                      checked={editingPlay?.third_s || false}
                      onCheckedChange={(checked) => setEditingPlay(prev => prev ? ({ ...prev, third_s: checked as boolean }) : null)}
                    />
                    <Label htmlFor="third_s" className="text-sm">3rd Short</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="third_m"
                      checked={editingPlay?.third_m || false}
                      onCheckedChange={(checked) => setEditingPlay(prev => prev ? ({ ...prev, third_m: checked as boolean }) : null)}
                    />
                    <Label htmlFor="third_m" className="text-sm">3rd Medium</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="third_l"
                      checked={editingPlay?.third_l || false}
                      onCheckedChange={(checked) => setEditingPlay(prev => prev ? ({ ...prev, third_l: checked as boolean }) : null)}
                    />
                    <Label htmlFor="third_l" className="text-sm">3rd Long</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rz"
                      checked={editingPlay?.rz || false}
                      onCheckedChange={(checked) => setEditingPlay(prev => prev ? ({ ...prev, rz: checked as boolean }) : null)}
                    />
                    <Label htmlFor="rz" className="text-sm">Red Zone</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="gl"
                      checked={editingPlay?.gl || false}
                      onCheckedChange={(checked) => setEditingPlay(prev => prev ? ({ ...prev, gl: checked as boolean }) : null)}
                    />
                    <Label htmlFor="gl" className="text-sm">Goal Line</Label>
                  </div>
                </div>
              </div>

              {/* Beaters Section */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Beaters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Front Beaters */}
                  <div className="space-y-1">
                    <Label className="text-xs">Front Beaters</Label>
                    <div className="max-h-[150px] overflow-y-auto border rounded-md p-2">
                      <div className="space-y-1">
                        {scoutingTerms.fronts.map((front) => (
                          <div
                            key={front.id}
                            className="flex items-center"
                          >
                            <Checkbox
                              id={`edit-front-${front.id}`}
                              checked={editingPlay?.front_beaters?.split(',').map(b => b.trim()).includes(front.name) || false}
                              onCheckedChange={(checked) => {
                                setEditingPlay(prev => {
                                  if (!prev) return null;
                                  const currentBeaters = prev.front_beaters?.split(',').map(b => b.trim()).filter(b => b) || [];
                                  const newBeaters = checked
                                    ? [...currentBeaters, front.name]
                                    : currentBeaters.filter(f => f !== front.name);
                                  return {
                                    ...prev,
                                    front_beaters: newBeaters.length > 0 ? newBeaters.join(',') : ''
                                  };
                                });
                              }}
                            />
                            <Label
                              htmlFor={`edit-front-${front.id}`}
                              className="ml-2 text-xs font-normal"
                            >
                              {front.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Coverage Beaters */}
                  <div className="space-y-1">
                    <Label className="text-xs">Coverage Beaters</Label>
                    <div className="max-h-[150px] overflow-y-auto border rounded-md p-2">
                      <div className="space-y-1">
                        {scoutingTerms.coverages.map((coverage) => (
                          <div
                            key={coverage.id}
                            className="flex items-center"
                          >
                            <Checkbox
                              id={`edit-coverage-${coverage.id}`}
                              checked={editingPlay?.coverage_beaters?.split(',').map(b => b.trim()).includes(coverage.name) || false}
                              onCheckedChange={(checked) => {
                                setEditingPlay(prev => {
                                  if (!prev) return null;
                                  const currentBeaters = prev.coverage_beaters?.split(',').map(b => b.trim()).filter(b => b) || [];
                                  const newBeaters = checked
                                    ? [...currentBeaters, coverage.name]
                                    : currentBeaters.filter(c => c !== coverage.name);
                                  return {
                                    ...prev,
                                    coverage_beaters: newBeaters.length > 0 ? newBeaters.join(',') : ''
                                  };
                                });
                              }}
                            />
                            <Label
                              htmlFor={`edit-coverage-${coverage.id}`}
                              className="ml-2 text-xs font-normal"
                            >
                              {coverage.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Blitz Beaters */}
                  <div className="space-y-1">
                    <Label className="text-xs">Blitz Beaters</Label>
                    <div className="max-h-[150px] overflow-y-auto border rounded-md p-2">
                      <div className="space-y-1">
                        {scoutingTerms.blitzes.map((blitz) => (
                          <div
                            key={blitz.id}
                            className="flex items-center"
                          >
                            <Checkbox
                              id={`edit-blitz-${blitz.id}`}
                              checked={editingPlay?.blitz_beaters?.split(',').map(b => b.trim()).includes(blitz.name) || false}
                              onCheckedChange={(checked) => {
                                setEditingPlay(prev => {
                                  if (!prev) return null;
                                  const currentBeaters = prev.blitz_beaters?.split(',').map(b => b.trim()).filter(b => b) || [];
                                  const newBeaters = checked
                                    ? [...currentBeaters, blitz.name]
                                    : currentBeaters.filter(b => b !== blitz.name);
                                  return {
                                    ...prev,
                                    blitz_beaters: newBeaters.length > 0 ? newBeaters.join(',') : ''
                                  };
                                });
                              }}
                            />
                            <Label
                              htmlFor={`edit-blitz-${blitz.id}`}
                              className="ml-2 text-xs font-normal"
                            >
                              {blitz.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editingPlay?.notes || ''}
                  onChange={(e) => setEditingPlay(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                  placeholder="Additional notes about this play..."
                  className="min-h-[60px]"
                />
              </div>

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

        {/* Bulk Upload Modal */}
        <Dialog open={isBulkUploadOpen} onOpenChange={(open) => {
          setIsBulkUploadOpen(open)
          if (!open) {
            setBulkUploadFile(null)
            setBulkUploadResults([])
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Bulk Upload Plays (CSV)</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {/* File Upload Section */}
              <div className="space-y-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="csvFile">Select CSV File</Label>
                  <Input
                    id="csvFile"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
                    disabled={isBulkUploading}
                  />
                                     <p className="text-xs text-gray-600">
                     CSV should include columns: Full Play Call, Shift, TO_Motions, Formations, Tags, From_Motions, 
                     Pass_Protections, Concept, Concept_Tag, Concept_Direction, RPO_Tag, Category, 
                     3rd & S, 3rd & M, 3rd & L, RZ, GL, Front Beaters, Coverage Beaters, Blitz Beaters
                   </p>
                </div>
                
                <Button
                  onClick={handleBulkUpload}
                  disabled={!bulkUploadFile || isBulkUploading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isBulkUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload CSV
                    </>
                  )}
                </Button>
              </div>

              {/* Results Section */}
              {bulkUploadResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Upload Results</h3>
                  <div className="max-h-96 overflow-y-auto border rounded-md">
                    <div className="space-y-2 p-4">
                      {bulkUploadResults.map((result, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-2 p-2 rounded ${
                            result.status === 'success' ? 'bg-green-50 text-green-700' :
                            result.status === 'duplicate' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700 cursor-pointer hover:bg-red-100'
                          }`}
                          onClick={() => {
                            if (result.status === 'error' && result.csvData) {
                              handleEditFromCsv(result.csvData)
                            }
                          }}
                        >
                          {result.status === 'success' ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : result.status === 'duplicate' ? (
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                          ) : (
                            <X className="h-4 w-4 text-red-600" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium">
                              {result.play.fullPlayCall || 'Unknown Play'}
                            </div>
                            <div className="text-sm">
                              {result.message}
                            </div>
                            {result.status === 'error' && (
                              <div className="text-xs mt-1 opacity-75">
                                Click to edit and fix errors
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsBulkUploadOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Play Modal */}
        <Dialog open={isAddPlayOpen} onOpenChange={(open) => {
          if (open) {
            fetchTerminology()
            fetchScoutingTerms()
          }
          setIsAddPlayOpen(open)
          if (!open) {
            setNotification(null)
            setNewPlay(defaultNewPlay)
            setPlayText('')
            // If we came from bulk upload, return to it
            if (cameFromBulkUpload) {
              setCameFromBulkUpload(false)
              setIsBulkUploadOpen(true)
            }
          }
        }}>
          <DialogContent className="w-[90vw] max-w-[1200px] h-[85vh] flex flex-col">
            <DialogHeader className="pb-2 flex flex-row items-center justify-between flex-shrink-0">
              <DialogTitle>Add New Play to Master Pool</DialogTitle>
              <Button
                type="submit"
                onClick={handleAddPlay}
                disabled={isSubmitting || !newPlay.category || !newPlay.formations || !newPlay.concept}
                className="bg-[#2ecc71] hover:bg-[#27ae60] text-white mr-8"
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
            </DialogHeader>
            {notification && notification.type === 'error' && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-2 mb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {notification.message}
                </div>
              </div>
            )}
            {notification && notification.type === 'success' && (
              <div className="bg-green-50 text-green-700 border border-green-200 rounded-md p-2 mb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  {notification.message}
                </div>
              </div>
            )}
            
            {/* Play Text Input and Fill Button */}
            {newPlay.category && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3 flex-shrink-0">
                <div className="space-y-2">
                  <Label htmlFor="playText" className="text-sm font-medium">Quick Fill from Play Text</Label>
                  <p className="text-xs text-gray-600">
                    Enter your play call and click Fill to auto-populate fields. Not all components need to be present.
                    System will intelligently match: Formation, Concept, Pass Protection, Shifts, Motions, Tags, Directions (+/-), etc.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="playText"
                      value={playText}
                      onChange={(e) => setPlayText(e.target.value)}
                      placeholder="e.g. Gun Ace + Jet 5 Go or I Formation Power + RPO"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleFillPlayFromText}
                      disabled={!playText.trim() || !newPlay.category}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Fill
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid gap-3 py-2 overflow-y-auto flex-grow">{/* Rest of the content */}
              {/* Main Play Information - 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Category Selection */}
                <div className="space-y-1">
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
                    <SelectItem value="rpo_game">RPO Game</SelectItem>
                    <SelectItem value="quick_game">Quick Game</SelectItem>
                    <SelectItem value="dropback_game">Dropback Game</SelectItem>
                    <SelectItem value="screen_game">Screen Game</SelectItem>
                    <SelectItem value="shot_plays">Shot Plays</SelectItem>
                    <SelectItem value="moving_pocket">Moving Pocket</SelectItem>
                  </SelectContent>
                </Select>
                </div>

                {/* Formation and Formation Tag */}
                <div className="space-y-1">
                  <Label htmlFor="formations">Formation *</Label>
                  <Select
                    value={newPlay.formations}
                    onValueChange={(value) => setNewPlay(prev => ({ ...prev, formations: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select formation" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {formations
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(formation => (
                          <SelectItem key={formation.id} value={formation.label || formation.concept}>
                            {formation.label || formation.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
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
                      {tags
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(tag => (
                          <SelectItem key={tag.id} value={tag.label || tag.concept}>
                            {tag.label || tag.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Motion and Protection - 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Shifts */}
                <div className="space-y-1">
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
                      {shifts
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(shift => (
                          <SelectItem key={shift.id} value={shift.label || shift.concept}>
                            {shift.label || shift.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* To Motion */}
                <div className="space-y-1">
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
                      {toMotions
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(motion => (
                          <SelectItem key={motion.id} value={motion.label || motion.concept}>
                            {motion.label || motion.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* From Motion */}
                <div className="space-y-1">
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
                      {fromMotions
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(motion => (
                          <SelectItem key={motion.id} value={motion.label || motion.concept}>
                            {motion.label || motion.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Concept Information - 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Concept */}
                <div className="space-y-1">
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
                          // RPO games use run_game concepts since they're run plays with RPO tags
                          if (newPlay.category === 'rpo_game') {
                            return c.category === 'run_game'
                          }
                          // Moving pocket can use concepts from quick_game, dropback_game, or shot_plays
                          if (newPlay.category === 'moving_pocket') {
                            return c.category === 'quick_game' || c.category === 'dropback_game' || c.category === 'shot_plays'
                          }
                          return c.category === newPlay.category
                        })
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(concept => (
                          <SelectItem key={concept.id} value={concept.label || concept.concept}>
                            {concept.label || concept.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Concept Tag */}
                <div className="space-y-1">
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
                      {conceptTags
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(tag => (
                          <SelectItem key={tag.id} value={tag.label || tag.concept}>
                            {tag.label || tag.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Concept Direction */}
                <div className="space-y-1">
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

              {/* Additional Options - 2 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Pass Protection */}
                <div className="space-y-1">
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
                      {passProtections
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(protection => (
                          <SelectItem key={protection.id} value={protection.label || protection.concept}>
                            {protection.label || protection.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* RPO Tag */}
                <div className="space-y-1">
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
                      {rpoTags
                        .sort((a, b) => {
                          const aLabel = a.label || a.concept
                          const bLabel = b.label || b.concept
                          return aLabel.localeCompare(bLabel)
                        })
                        .map(tag => (
                          <SelectItem key={tag.id} value={tag.label || tag.concept}>
                            {tag.label || tag.concept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Beaters Section */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Beaters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Front Beaters */}
                  <div className="space-y-1">
                    <Label className="text-xs">Front Beaters</Label>
                    <div className="max-h-[150px] overflow-y-auto border rounded-md p-2">
                      <div className="space-y-1">
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
                              className="ml-2 text-xs font-normal"
                            >
                              {front.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Coverage Beaters */}
                  <div className="space-y-1">
                    <Label className="text-xs">Coverage Beaters</Label>
                    <div className="max-h-[150px] overflow-y-auto border rounded-md p-2">
                      <div className="space-y-1">
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
                              className="ml-2 text-xs font-normal"
                            >
                              {coverage.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Blitz Beaters */}
                  <div className="space-y-1">
                    <Label className="text-xs">Blitz Beaters</Label>
                    <div className="max-h-[150px] overflow-y-auto border rounded-md p-2">
                      <div className="space-y-1">
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
                              className="ml-2 text-xs font-normal"
                            >
                              {blitz.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Situations */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Situations</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="third_s"
                      checked={newPlay.third_s}
                      onCheckedChange={(checked) => 
                        setNewPlay(prev => ({ ...prev, third_s: !!checked }))
                      }
                    />
                    <Label htmlFor="third_s" className="text-xs">3rd & Short</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="third_m"
                      checked={newPlay.third_m}
                      onCheckedChange={(checked) => 
                        setNewPlay(prev => ({ ...prev, third_m: !!checked }))
                      }
                    />
                    <Label htmlFor="third_m" className="text-xs">3rd & Medium</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="third_l"
                      checked={newPlay.third_l}
                      onCheckedChange={(checked) => 
                        setNewPlay(prev => ({ ...prev, third_l: !!checked }))
                      }
                    />
                    <Label htmlFor="third_l" className="text-xs">3rd & Long</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rz"
                      checked={newPlay.rz}
                      onCheckedChange={(checked) => 
                        setNewPlay(prev => ({ ...prev, rz: !!checked }))
                      }
                    />
                    <Label htmlFor="rz" className="text-xs">Red Zone</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="gl"
                      checked={newPlay.gl}
                      onCheckedChange={(checked) => 
                        setNewPlay(prev => ({ ...prev, gl: !!checked }))
                      }
                    />
                    <Label htmlFor="gl" className="text-xs">Goal Line</Label>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label htmlFor="notes" className="text-sm">Notes</Label>
                <Textarea
                  id="notes"
                  value={newPlay.notes}
                  onChange={(e) => setNewPlay(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Enter any additional notes"
                  className="h-20"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
} 