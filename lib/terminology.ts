import { supabase } from './supabase'
import { updatePlayPoolTerminology } from './playpool'

export interface Terminology {
  id: string
  concept?: string
  label?: string
  category?: string
  is_enabled?: boolean
  image_url?: string
}

export interface TerminologyWithUI extends Terminology {
  isEditing?: boolean
  isNew?: boolean
  isDirty?: boolean
}

// Define available formation concepts
export const FORMATION_CONCEPTS = [
  // 2x2 Formations
  { concept: "2x2 Open (Field)", label: "Spread +" },
  { concept: "2x2 Open (Boundary)", label: "Spread -" },
  { concept: "2x2 Y Attached (Field)", label: "Deuce +" },
  { concept: "2x2 Y Attached (Boundary)", label: "Deuce -" },
  { concept: "2x2 2 TE Attached (Field)", label: "Queen +" },
  { concept: "2x2 2 TE Attached (Boundary)", label: "Queen -" },
  // 3x1 Formations
  { concept: "3x1 Open (Field)", label: "Trips +" },
  { concept: "3x1 Open (Boundary)", label: "Trips -" },
  { concept: "3x1 Y Attached (Field)", label: "Trey +" },
  { concept: "3x1 Y Attached (Boundary)", label: "Trey -" },
  { concept: "3x1 2 TE Wing (Field)", label: "Sam +" },
  { concept: "3x1 2 TE Wing (Boundary)", label: "Sam -" },
  { concept: "3x1 Backside TE Attached (Field)", label: "Closed + " },
  { concept: "3x1 Backside TE Attached (Boundary)", label: "Closed -" },
  { concept: "3x1 Bunch (Field)", label: "Bunch + " },
  { concept: "3x1 Bunch (Boundary)", label: "Bunch -" },
 
  // 5WR Formations
  { concept: "5 WR (Field)", label: "Empty +" },
  { concept: "5 WR (Boundary)", label: "Empty -" },
] as const

export async function getTerminology(): Promise<Terminology[]> {
  const { data, error } = await supabase
    .from('terminology')
    .select('*')
    .order('category')
  
  if (error) {
    console.error('Error fetching terminology:', error)
    throw error
  }
  
  return data || []
}

export async function addTerminology(terminology: Omit<Terminology, 'id'>): Promise<Terminology> {
  const { data, error } = await supabase
    .from('terminology')
    .insert([terminology])
    .select()
    .single()
  
  if (error) {
    console.error('Error adding terminology:', error)
    throw error
  }
  
  return data
}

export async function updateTerminology(id: string, updates: { concept?: string, label?: string, is_enabled?: boolean }): Promise<void> {
  try {
    // Only include fields that are actually provided in the updates
    const filteredUpdates: { [key: string]: any } = {}
    if (updates.concept !== undefined) filteredUpdates.concept = updates.concept
    if (updates.label !== undefined) filteredUpdates.label = updates.label
    if (updates.is_enabled !== undefined) filteredUpdates.is_enabled = updates.is_enabled

    const { error } = await supabase
      .from('terminology')
      .update(filteredUpdates)
      .eq('id', id)
    
    if (error) {
      console.error('Error updating terminology:', error)
      throw error
    }

    // Removed automatic updatePlayPoolTerminology call
  } catch (error) {
    console.error('Error in updateTerminology:', error)
    throw error
  }
}

// New function to batch update multiple terms at once
export async function batchUpdateTerminology(updates: Array<{id: string, concept?: string, label?: string, is_enabled?: boolean}>): Promise<void> {
  try {
    if (updates.length === 0) return;
    
    // Prepare batch updates
    const promises = updates.map(update => {
      const { id, ...fields } = update;
      const filteredUpdates: { [key: string]: any } = {}
      if (fields.concept !== undefined) filteredUpdates.concept = fields.concept
      if (fields.label !== undefined) filteredUpdates.label = fields.label
      if (fields.is_enabled !== undefined) filteredUpdates.is_enabled = fields.is_enabled
      
      return supabase
        .from('terminology')
        .update(filteredUpdates)
        .eq('id', id);
    });
    
    // Execute all updates in parallel
    await Promise.all(promises);
    
  } catch (error) {
    console.error('Error in batchUpdateTerminology:', error)
    throw error
  }
}

export async function deleteTerminology(id: string): Promise<void> {
  const { error } = await supabase
    .from('terminology')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting terminology:', error)
    throw error
  }
}

// Function to initialize default terminology if none exists
export async function initializeDefaultTerminology(): Promise<void> {
  try {
    console.log('Checking for existing terminology...')
    const { count, error: countError } = await supabase
      .from('terminology')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Error checking terminology count:', {
        code: countError.code,
        message: countError.message,
        details: countError.details,
        hint: countError.hint
      })
      throw countError
    }

    console.log('Current terminology count:', count)

    if (count === 0) {
      console.log('No existing terminology found. Please initialize database with SQL manually.')
    } else {
      console.log('Existing terminology found, skipping initialization')
    }
  } catch (error) {
    console.error('Unexpected error in initializeDefaultTerminology:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

export async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log('Testing Supabase connection...')
    
    // Test if our table exists and we have access
    const { error: tableError } = await supabase
      .from('terminology')
      .select('id')
      .limit(1)
    
    if (tableError) {
      console.error('Terminology table access error:', {
        code: tableError.code,
        message: tableError.message,
        details: tableError.details,
        hint: tableError.hint
      })
      
      if (tableError.code === 'PGRST204') {
        throw new Error('Terminology table not found. Please create the table in your Supabase database.')
      } else {
        throw new Error(`Table access error: ${tableError.message}`)
      }
    }

    console.log('Supabase connection and table access successful')
    return true
  } catch (error) {
    console.error('Connection test error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error // Let the calling code handle the error
  }
}

// Function to update formation concepts to match predefined list
export async function updateFormationConcepts(): Promise<void> {
  try {
    // Get all current formations
    const { data: currentFormations, error: fetchError } = await supabase
      .from('terminology')
      .select('*')
      .eq('category', 'formations')

    if (fetchError) {
      throw fetchError
    }

    if (!currentFormations) {
      return
    }

    // Create a map of current formations by concept
    const currentFormationsMap = new Map(
      currentFormations.map(f => [f.concept, f])
    )

    // Prepare updates for existing formations
    const updates: Array<{id: string, concept?: string, label?: string, is_enabled?: boolean}> = 
      FORMATION_CONCEPTS
        .map(formation => {
          const existingFormation = currentFormationsMap.get(formation.concept)
          if (existingFormation) {
            return {
              id: existingFormation.id,
              concept: formation.concept,
              label: formation.label
            }
          }
          return null
        })
        .filter((update): update is {id: string, concept: string, label: string} => update !== null)

    // Delete formations that are not in the predefined list
    const formationsToDelete = currentFormations
      .filter(f => !FORMATION_CONCEPTS.some(fc => fc.concept === f.concept))
      .map(f => f.id)

    // Add new formations that don't exist yet
    const newFormations = FORMATION_CONCEPTS
      .filter(formation => !currentFormationsMap.has(formation.concept))
      .map(formation => ({
        concept: formation.concept,
        label: formation.label,
        category: 'formations'
      }))

    // Execute updates
    if (updates.length > 0) {
      await batchUpdateTerminology(updates)
    }

    // Delete old formations
    if (formationsToDelete.length > 0) {
      await Promise.all(
        formationsToDelete.map(id => deleteTerminology(id))
      )
    }

    // Add new formations
    if (newFormations.length > 0) {
      await Promise.all(
        newFormations.map(formation => addTerminology(formation))
      )
    }

    // Update play pool to reflect changes
    await updatePlayPoolTerminology()
  } catch (error) {
    console.error('Error updating formation concepts:', error)
    throw error
  }
} 