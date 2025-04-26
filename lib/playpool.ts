import { supabase } from './supabase'
import { initializeDefaultTerminology } from './terminology'

export interface Play {
  id: string
  formation?: string
  tag?: string
  strength?: string
  motion_shift?: string
  concept?: string
  run_concept?: string
  run_direction?: string
  pass_screen_concept?: string
  screen_direction?: string
  category: 'run_game' | 'quick_game' | 'dropback_game' | 'shot_plays' | 'screen_game'
  is_enabled: boolean
  created_at?: string
}

// Add interface for terminology items
interface TerminologyItem {
  id: string
  category: string
  concept: string
  label: string
  is_enabled: boolean
}

export async function testPlayPoolConnection(): Promise<boolean> {
  try {
    console.log('Testing playpool table connection...')
    const { error } = await supabase
      .from('playpool')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('Playpool table error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return false
    }
    return true
  } catch (error) {
    console.error('Unexpected error testing playpool connection:', error)
    return false
  }
}

export async function getPlayPool(): Promise<Play[]> {
  try {
    // Test connection first
    const isConnected = await testPlayPoolConnection()
    if (!isConnected) {
      throw new Error('Unable to connect to playpool table. Please ensure the table exists in your Supabase database.')
    }

    const { data, error } = await supabase
      .from('playpool')
      .select('*')
      .order('category')
      .order('concept')
    
    if (error) {
      console.error('Error fetching play pool:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw error
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getPlayPool:', error)
    throw error
  }
}

export async function updatePlay(id: string, updates: Partial<Omit<Play, 'id'>>): Promise<Play> {
  const { data, error } = await supabase
    .from('playpool')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating play:', error)
    throw error
  }
  
  return data
}

export async function initializeDefaultPlayPool(): Promise<void> {
  try {
    console.log('Starting initializeDefaultPlayPool...')
    
    // First test connection
    const isConnected = await testPlayPoolConnection()
    if (!isConnected) {
      throw new Error('Unable to connect to playpool table')
    }

    // Get terminology without isEnabled check
    console.log('Fetching terminology...')
    let terminology = null
    const { data: initialTerminology, error: termError } = await supabase
      .from('terminology')
      .select('*')

    if (termError) {
      console.error('Error fetching terminology:', {
        code: termError.code,
        message: termError.message,
        details: termError.details,
        hint: termError.hint
      })
      throw new Error(`Failed to fetch terminology: ${termError.message}`)
    }

    terminology = initialTerminology

    if (!terminology || terminology.length === 0) {
      // Try to initialize default terminology first
      console.log('No terminology found, initializing defaults...')
      await initializeDefaultTerminology()
      
      // Fetch again after initialization
      const { data: retryTerminology, error: retryError } = await supabase
        .from('terminology')
        .select('*')

      if (retryError || !retryTerminology || retryTerminology.length === 0) {
        throw new Error('Failed to initialize and fetch terminology')
      }

      terminology = retryTerminology
    }

    // Filter terminology by category
    const formations = terminology.filter(t => t.category === 'formations')
    const tags = terminology.filter(t => t.category === 'tags')
    const runConcepts = terminology.filter(t => t.category === 'run_game')
    const quickGame = terminology.filter(t => t.category === 'quick_game')
    const dropback = terminology.filter(t => t.category === 'dropback')
    const shotPlays = terminology.filter(t => t.category === 'shot_plays')
    const screens = terminology.filter(t => t.category === 'screens')
    const motions = terminology.filter(t => t.category === 'motions')

    if (!formations.length || !tags.length || !runConcepts.length) {
      throw new Error('Missing required terminology categories')
    }

    // Helper function to get random item from array
    const getRandomItem = <T>(array: T[]): T => {
      return array[Math.floor(Math.random() * array.length)]
    }

    // Helper function to randomly decide whether to include something
    const shouldInclude = () => Math.random() > 0.5

    // Generate 20 random run plays
    const runPlays = Array.from({ length: 20 }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const runConcept = getRandomItem(runConcepts)
      const motion = shouldInclude() ? getRandomItem(motions) : null
      const strength = Math.random() > 0.5 ? '+' : '-'
      const direction = Math.random() > 0.5 ? '+' : '-'

      return {
        formation: formation.label || '',
        tag: tag?.label || '',
        strength,
        motion_shift: motion?.label || '',
        concept: runConcept.label || '',
        run_concept: '',
        run_direction: direction,
        pass_screen_concept: '',
        category: 'run_game' as const,
        is_enabled: true
      }
    })

    // Generate 20 quick game plays
    const quickPlays = Array.from({ length: 20 }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const quickGameConcept = getRandomItem(quickGame)
      const motion = shouldInclude() ? getRandomItem(motions) : null
      const strength = Math.random() > 0.5 ? '+' : '-'

      return {
        formation: formation.label || '',
        tag: tag?.label || '',
        strength,
        motion_shift: motion?.label || '',
        concept: quickGameConcept.label || '',
        run_concept: '',
        run_direction: '',
        pass_screen_concept: '',
        category: 'quick_game' as const,
        is_enabled: true
      }
    })

    // Generate 20 dropback plays
    const dropbackPlays = Array.from({ length: 20 }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const dropbackConcept = getRandomItem(dropback)
      const motion = shouldInclude() ? getRandomItem(motions) : null
      const strength = Math.random() > 0.5 ? '+' : '-'

      return {
        formation: formation.label || '',
        tag: tag?.label || '',
        strength,
        motion_shift: motion?.label || '',
        concept: dropbackConcept.label || '',
        run_concept: '',
        run_direction: '',
        pass_screen_concept: '',
        category: 'dropback_game' as const,
        is_enabled: true
      }
    })

    // Generate 20 shot plays
    const shotPlaysGenerated = Array.from({ length: 20 }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const shotPlayConcept = getRandomItem(shotPlays)
      const motion = shouldInclude() ? getRandomItem(motions) : null
      const strength = Math.random() > 0.5 ? '+' : '-'

      return {
        formation: formation.label || '',
        tag: tag?.label || '',
        strength,
        motion_shift: motion?.label || '',
        concept: shotPlayConcept.label || '',
        run_concept: '',
        run_direction: '',
        pass_screen_concept: '',
        category: 'shot_plays' as const,
        is_enabled: true
      }
    })

    // Generate 20 screen plays
    const screenPlays = Array.from({ length: 20 }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const screenConcept = getRandomItem(screens)
      const motion = shouldInclude() ? getRandomItem(motions) : null
      const strength = Math.random() > 0.5 ? '+' : '-'
      const direction = Math.random() > 0.5 ? '+' : '-'

      return {
        formation: formation.label || '',
        tag: tag?.label || '',
        strength,
        motion_shift: motion?.label || '',
        concept: '',
        run_concept: '',
        run_direction: '',
        pass_screen_concept: screenConcept.label || '',
        screen_direction: direction,
        category: 'screen_game' as const,
        is_enabled: true
      }
    })

    const defaultPlays = [...runPlays, ...quickPlays, ...dropbackPlays, ...shotPlaysGenerated, ...screenPlays]

    console.log('Inserting randomly generated plays:', defaultPlays)

    const { error: insertError } = await supabase
      .from('playpool')
      .insert(defaultPlays)

    if (insertError) {
      console.error('Error initializing play pool:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      })
      throw new Error(`Failed to insert plays: ${insertError.message}`)
    }

    console.log('Successfully inserted plays')
  } catch (error) {
    console.error('Detailed error in initializeDefaultPlayPool:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

export async function regeneratePlayPool(): Promise<void> {
  try {
    console.log('Starting play pool regeneration...')
    
    // Delete all existing plays by category
    const categories = ['run_game', 'quick_game', 'dropback_game', 'shot_plays', 'screen_game']
    for (const category of categories) {
      const { error: deleteError } = await supabase
        .from('playpool')
        .delete()
        .eq('category', category)
      
      if (deleteError) {
        console.error(`Error clearing ${category} plays:`, {
          code: deleteError.code,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint
        })
        throw new Error(`Failed to clear ${category} plays: ${deleteError.message}`)
      }
    }

    // Initialize new plays
    await initializeDefaultPlayPool()
    
    console.log('Successfully regenerated play pool')
  } catch (error) {
    console.error('Error in regeneratePlayPool:', error)
    throw error
  }
}

export async function updatePlayPoolTerminology(): Promise<void> {
  try {
    console.log('Starting play pool terminology update...')

    // Get current plays
    const { data: plays, error: playsError } = await supabase
      .from('playpool')
      .select('*')
    
    if (playsError) {
      throw new Error(`Failed to fetch plays: ${playsError.message}`)
    }

    if (!plays || plays.length === 0) {
      console.log('No plays to update')
      return
    }

    // Get current terminology
    const { data: terminology, error: termError } = await supabase
      .from('terminology')
      .select('*')

    if (termError) {
      throw new Error(`Failed to fetch terminology: ${termError.message}`)
    }

    if (!terminology) {
      throw new Error('No terminology found')
    }

    // Group terminology by category
    const formations = terminology.filter(t => t.category === 'formations')
    const tags = terminology.filter(t => t.category === 'tags')
    const runConcepts = terminology.filter(t => t.category === 'run_game')
    const quickGame = terminology.filter(t => t.category === 'quick_game')
    const dropback = terminology.filter(t => t.category === 'dropback')
    const shotPlays = terminology.filter(t => t.category === 'shot_plays')
    const screens = terminology.filter(t => t.category === 'screens')
    const motions = terminology.filter(t => t.category === 'motions')

    // Update each play with new terminology
    const updatedPlays = plays.map(play => {
      // Create a copy of the play to update
      const updatedPlay = { ...play }

      // Helper function to find new label
      const findNewLabel = (oldLabel: string, terminologyList: TerminologyItem[]): string => {
        // First try to find by label in case it's unchanged
        const byLabel = terminologyList.find(t => t.label === oldLabel)
        if (byLabel) return byLabel.label

        // If not found by label, try to find by concept
        // This assumes the concept remains constant even if label changes
        const byConcept = terminologyList.find(t => t.label === oldLabel || t.concept === oldLabel)
        return byConcept ? byConcept.label : oldLabel
      }

      // Update formation
      if (play.formation) {
        updatedPlay.formation = findNewLabel(play.formation, formations)
      }

      // Update tag
      if (play.tag) {
        updatedPlay.tag = findNewLabel(play.tag, tags)
      }

      // Update motion
      if (play.motion_shift) {
        updatedPlay.motion_shift = findNewLabel(play.motion_shift, motions)
      }

      // Update concept and pass_screen_concept
      if (play.concept) {
        // Split concept if it contains a quick game component
        const [runPart, quickPart] = play.concept.split(' ')
        
        if (quickPart) {
          // If there's a quick game part, update both parts
          const newRunLabel = findNewLabel(runPart, runConcepts)
          const newQuickLabel = findNewLabel(quickPart, quickGame)
          updatedPlay.concept = `${newRunLabel} ${newQuickLabel}`
        } else {
          // If it's just a run concept
          updatedPlay.concept = findNewLabel(runPart, runConcepts)
        }
      }

      return updatedPlay
    })

    // Update plays in batches of 10 to avoid rate limits
    for (let i = 0; i < updatedPlays.length; i += 10) {
      const batch = updatedPlays.slice(i, i + 10)
      const { error: updateError } = await supabase
        .from('playpool')
        .upsert(batch)

      if (updateError) {
        throw new Error(`Failed to update plays batch ${i/10 + 1}: ${updateError.message}`)
      }
    }

    console.log('Successfully updated play pool terminology')
  } catch (error) {
    console.error('Error updating play pool terminology:', error)
    throw error
  }
} 