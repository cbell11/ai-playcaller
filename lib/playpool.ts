import { supabase } from './supabase'
import { initializeDefaultTerminology } from './terminology'
import { load } from '@/lib/local'
import { createClient } from '@supabase/supabase-js'

export interface Play {
  id: string
  play_id: string
  team_id: string
  category: string
  formation: string
  tag: string
  strength: string
  motion_shift: string
  concept: string
  run_concept: string
  run_direction: string
  pass_screen_concept: string
  screen_direction: string
  front_beaters: string
  coverage_beaters: string
  blitz_beaters: string
  is_enabled: boolean
  is_locked: boolean
  is_favorite: boolean
  customized_edit: string | null
  created_at?: string
  updated_at?: string
}

// Add interface for terminology items
interface TerminologyItem {
  id: string
  category: string
  concept: string
  label: string
  is_enabled: boolean
}

interface Front {
  id?: string;
  name: string;
  dominateDown?: string;
  fieldArea?: string;
  notes?: string;
}

export async function testPlayPoolConnection(): Promise<boolean> {
  try {
    console.log('Testing playpool table connection...')
    const { error } = await supabase
      .from('playpool')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('[Database] Master_Play_Pool connection failed:', {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        },
        timestamp: new Date().toISOString(),
        operation: 'testConnection'
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
      .order('is_locked', { ascending: false })
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

export async function updatePlay(id: string, updates: Partial<Play>): Promise<Play> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // If customized_edit is explicitly set to null, we need to handle that
    const updateData = updates.customized_edit === null
      ? { ...updates, customized_edit: null }
      : updates

    const { data, error } = await supabase
      .from('playpool')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('No data returned from update')

    return data
  } catch (error) {
    console.error('Error updating play:', error)
    throw error
  }
}

export async function toggleFavoritePlay(id: string, isFavorite: boolean): Promise<Play> {
  const { data, error } = await supabase
    .from('playpool')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Error toggling favorite status:', error)
    throw error
  }
  
  return data
}

export async function initializeDefaultPlayPool(existingPlayCounts: Record<string, number> = {}): Promise<void> {
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

    // Helper function to decide whether to include motion based on the saved percentage
    const shouldIncludeMotion = () => {
      const motionPercentage = load('motion_percentage', 25)
      return Math.random() * 100 < motionPercentage
    }

    // Maximum number of plays per category - special case for run plays
    const MAX_RUN_PLAYS = 15;
    const PLAYS_PER_CATEGORY = 20;

    // Calculate how many new plays to generate for each category
    const runGameCount = MAX_RUN_PLAYS - (existingPlayCounts['run_game'] || 0)
    const quickGameCount = PLAYS_PER_CATEGORY - (existingPlayCounts['quick_game'] || 0)
    const dropbackGameCount = PLAYS_PER_CATEGORY - (existingPlayCounts['dropback_game'] || 0)
    const shotPlaysCount = PLAYS_PER_CATEGORY - (existingPlayCounts['shot_plays'] || 0)
    const screenGameCount = PLAYS_PER_CATEGORY - (existingPlayCounts['screen_game'] || 0)

    // Generate run plays (adjusted count)
    const runPlays = Array.from({ length: Math.max(0, runGameCount) }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const runConcept = getRandomItem(runConcepts)
      const motion = shouldIncludeMotion() ? getRandomItem(motions) : null
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
        is_enabled: true,
        is_locked: false
      }
    })

    // Generate quick game plays (adjusted count)
    const quickPlays = Array.from({ length: Math.max(0, quickGameCount) }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const quickGameConcept = getRandomItem(quickGame)
      const motion = shouldIncludeMotion() ? getRandomItem(motions) : null
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
        is_enabled: true,
        is_locked: false
      }
    })

    // Generate dropback plays (adjusted count)
    const dropbackPlays = Array.from({ length: Math.max(0, dropbackGameCount) }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const dropbackConcept = getRandomItem(dropback)
      const motion = shouldIncludeMotion() ? getRandomItem(motions) : null
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
        is_enabled: true,
        is_locked: false
      }
    })

    // Generate shot plays (adjusted count)
    const shotPlaysGenerated = Array.from({ length: Math.max(0, shotPlaysCount) }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const shotPlayConcept = getRandomItem(shotPlays)
      const motion = shouldIncludeMotion() ? getRandomItem(motions) : null
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
        is_enabled: true,
        is_locked: false
      }
    })

    // Generate screen plays (adjusted count)
    const screenPlays = Array.from({ length: Math.max(0, screenGameCount) }, () => {
      const formation = getRandomItem(formations)
      const tag = shouldInclude() ? getRandomItem(tags) : null
      const screenConcept = getRandomItem(screens)
      const motion = shouldIncludeMotion() ? getRandomItem(motions) : null
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
        is_enabled: true,
        is_locked: false
      }
    })

    const defaultPlays = [...runPlays, ...quickPlays, ...dropbackPlays, ...shotPlaysGenerated, ...screenPlays]

    // Only insert if there are plays to insert
    if (defaultPlays.length > 0) {
      console.log(`Inserting ${defaultPlays.length} randomly generated plays`)

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
    } else {
      console.log('No new plays to insert, all categories at maximum capacity with locked plays')
    }
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
    
    // Constants - special case for run plays
    const MAX_RUN_PLAYS = 15;
    const MAX_PLAYS_PER_CATEGORY = 20;
    const categories = ['run_game', 'quick_game', 'dropback_game', 'shot_plays', 'screen_game'];
    
    // First, get all locked plays
    const { data: lockedPlays, error: lockedError } = await supabase
      .from('playpool')
      .select('*')
      .eq('is_locked', true)
    
    if (lockedError) {
      console.error('Error fetching locked plays:', lockedError)
      throw lockedError
    }
    
    // Delete all unlocked plays
    const { error: deleteError } = await supabase
      .from('playpool')
      .delete()
      .eq('is_locked', false)
    
    if (deleteError) {
      console.error('Error deleting unlocked plays:', deleteError)
      throw deleteError
    }

    // Get locked plays by category
    const lockedPlaysByCategory: Record<string, Play[]> = {};
    categories.forEach(category => {
      lockedPlaysByCategory[category] = (lockedPlays || []).filter(p => p.category === category);
      console.log(`Found ${lockedPlaysByCategory[category].length} locked plays in ${category}`);
    });

    // Calculate how many new plays we need for each category
    const playsToGenerate: Record<string, number> = {};
    for (const category of categories) {
      const lockedPlayCount = lockedPlaysByCategory[category].length;
      const maxPlays = category === 'run_game' ? MAX_RUN_PLAYS : MAX_PLAYS_PER_CATEGORY;
      playsToGenerate[category] = Math.max(0, maxPlays - lockedPlayCount);
      console.log(`Need to generate ${playsToGenerate[category]} new plays for ${category}`);
    }

    // Get the current team and opponent IDs from the scouting report
    const { data: scoutingData, error: scoutingError } = await supabase
      .from('scouting_reports')
      .select('team_id, opponent_id, fronts, fronts_pct')
      .order('created_at', { ascending: false })
      .limit(1);

    if (scoutingError) {
      console.error('Error fetching scouting report:', scoutingError);
      throw scoutingError;
    }

    if (!scoutingData || scoutingData.length === 0) {
      throw new Error('No scouting report found');
    }

    const { team_id, opponent_id, fronts, fronts_pct } = scoutingData[0];

    // Fetch plays from master_play_pool for each category
    const newPlays: Partial<Play>[] = [];
    
    for (const category of categories) {
      const maxPlays = category === 'run_game' ? MAX_RUN_PLAYS : MAX_PLAYS_PER_CATEGORY;
      const neededPlays = playsToGenerate[category];
      
      if (neededPlays > 0) {
        if (category === 'run_game') {
          // For run plays, we need to consider the defensive fronts
          const frontNames = fronts.map((f: Front) => f.name);
          
          // Calculate how many plays to get for each front based on percentage
          const playsByFront: Record<string, number> = {};
          frontNames.forEach((front: string) => {
            const percentage = fronts_pct[front] || 0;
            playsByFront[front] = Math.ceil((percentage / 100) * neededPlays);
          });

          // Fetch plays for each front
          for (const front of frontNames) {
            const playsNeeded = playsByFront[front];
            if (playsNeeded > 0) {
              const { data: frontPlays, error: frontError } = await supabase
                .from('master_play_pool')
                .select('*')
                .eq('category', 'run_game')
                .ilike('front_beaters', `%${front}%`)
                .order('random()')
                .limit(playsNeeded);

              if (frontError) {
                console.error(`Error fetching run plays for front ${front}:`, frontError);
                continue;
              }

              if (frontPlays && frontPlays.length > 0) {
                const formattedPlays = frontPlays.map(play => ({
                  ...play,
                  team_id,
                  opponent_id,
                  is_enabled: true,
                  is_locked: false
                }));
                newPlays.push(...formattedPlays);
                console.log(`Added ${formattedPlays.length} run plays that beat front: ${front}`);
              }
            }
          }

          // If we still need more plays, get additional random run plays
          const currentRunPlays = newPlays.filter(p => p.category === 'run_game').length;
          if (currentRunPlays < neededPlays) {
            const additionalPlaysNeeded = neededPlays - currentRunPlays;
            const { data: additionalPlays, error: additionalError } = await supabase
              .from('master_play_pool')
              .select('*')
              .eq('category', 'run_game')
              .order('random()')
              .limit(additionalPlaysNeeded);

            if (!additionalError && additionalPlays) {
              const formattedPlays = additionalPlays.map(play => ({
                ...play,
                team_id,
                opponent_id,
                is_enabled: true,
                is_locked: false
              }));
              newPlays.push(...formattedPlays);
              console.log(`Added ${formattedPlays.length} additional run plays`);
            }
          }
        } else {
          // For other categories, continue with the normal random selection
          const { data: masterPlays, error: masterError } = await supabase
            .from('master_play_pool')
            .select('*')
            .eq('category', category)
            .order('random()')
            .limit(neededPlays);

          if (masterError) {
            console.error(`Error fetching ${category} plays from master_play_pool:`, masterError);
            continue;
          }

          if (masterPlays && masterPlays.length > 0) {
            const formattedPlays = masterPlays.map(play => ({
              ...play,
              team_id,
              opponent_id,
              is_enabled: true,
              is_locked: false
            }));
            newPlays.push(...formattedPlays);
            console.log(`Added ${formattedPlays.length} ${category} plays from master_play_pool`);
          }
        }
      }
    }

    // Insert the new plays if any
    if (newPlays.length > 0) {
      console.log(`Inserting ${newPlays.length} new plays from master_play_pool`);
      const { error: insertError } = await supabase
        .from('playpool')
        .insert(newPlays);
        
      if (insertError) {
        console.error('Error inserting new plays:', insertError);
        throw insertError;
      }
    } else {
      console.log('No new plays to insert');
    }
    
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