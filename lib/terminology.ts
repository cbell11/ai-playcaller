import { supabase } from './supabase'
import { updatePlayPoolTerminology } from './playpool'

export interface Terminology {
  id: string
  concept?: string
  label?: string
  category?: string
  is_enabled?: boolean
  image_url?: string
  team_id?: string
}

export interface TerminologyWithUI extends Terminology {
  isEditing?: boolean
  isNew?: boolean
  isDirty?: boolean
}

export async function getTerminology(teamId?: string): Promise<Terminology[]> {
  try {
    const defaultTeamId = '8feef3dc-942f-4bc5-b526-0b39e14cb683'
    
    // If no team ID provided, use default team immediately
    if (!teamId) {
      const { data, error } = await supabase
        .from('terminology')
        .select('*')
        .eq('team_id', defaultTeamId)
        .order('category')

      if (error) {
        console.error('Error fetching default team terminology:', error)
        throw error
      }

      return data || []
    }
    
    // Check which categories the team has
    const categories = ['formations', 'form_tags', 'shifts']
    const teamEntries: Record<string, Terminology[]> = {}
    const defaultEntries: Record<string, Terminology[]> = {}
    
    // Fetch all team's terminology
    const { data: allTeamTerminology, error: teamError } = await supabase
      .from('terminology')
      .select('*')
      .eq('team_id', teamId)
      .order('category')
      
    if (teamError) {
      console.error('Error fetching team terminology:', teamError)
      throw teamError
    }
    
    // Group by category
    allTeamTerminology?.forEach(term => {
      if (term.category) {
        if (!teamEntries[term.category]) {
          teamEntries[term.category] = []
        }
        teamEntries[term.category].push(term)
      }
    })
    
    // Fetch all default team terminology
    const { data: allDefaultTerminology, error: defaultError } = await supabase
      .from('terminology')
      .select('*')
      .eq('team_id', defaultTeamId)
      .order('category')
      
    if (defaultError) {
      console.error('Error fetching default terminology:', defaultError)
      throw defaultError
    }
    
    // Group by category
    allDefaultTerminology?.forEach(term => {
      if (term.category) {
        if (!defaultEntries[term.category]) {
          defaultEntries[term.category] = []
        }
        defaultEntries[term.category].push(term)
      }
    })
    
    // For each category, use team's entries if they exist, otherwise use default
    const result: Terminology[] = []
    
    // Check each category
    categories.forEach(category => {
      // If team has entries for this category, use them
      if (teamEntries[category] && teamEntries[category].length > 0) {
        result.push(...teamEntries[category])
      } 
      // Otherwise use default entries
      else if (defaultEntries[category]) {
        result.push(...defaultEntries[category])
      }
    })
    
    // Add any other categories the team might have
    Object.keys(teamEntries).forEach(category => {
      if (!categories.includes(category)) {
        result.push(...teamEntries[category])
      }
    })
    
    // Sort by category
    result.sort((a, b) => {
      if (!a.category || !b.category) return 0
      return a.category.localeCompare(b.category)
    })
    
    return result
  } catch (error) {
    console.error('Error in getTerminology:', error)
    throw error
  }
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
export async function batchUpdateTerminology(
  updates: Array<{id: string, concept?: string, label?: string, is_enabled?: boolean}>,
  teamId?: string
): Promise<void> {
  try {
    if (updates.length === 0) return;
    
    // If this is a formation update and we have a team ID, we need to create new records
    if (teamId) {
      const { data: existingFormations, error: fetchError } = await supabase
        .from('terminology')
        .select('*')
        .eq('category', 'formations')
        .eq('team_id', teamId)

      if (fetchError) {
        console.error('Error fetching team formations:', fetchError)
        throw fetchError
      }

      // If the team already has formations, update them
      if (existingFormations && existingFormations.length > 0) {
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
        
        await Promise.all(promises);
      } else {
        // If the team doesn't have formations, create new ones
        const newFormations = updates.map(update => ({
          concept: update.concept,
          label: update.label,
          category: 'formations',
          team_id: teamId,
          is_enabled: true
        }));

        const { error: insertError } = await supabase
          .from('terminology')
          .insert(newFormations);

        if (insertError) {
          console.error('Error creating team formations:', insertError)
          throw insertError
        }
      }
    } else {
      // Handle non-formation updates or updates without team ID
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
      
      await Promise.all(promises);
    }
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
    const defaultTeamId = '8feef3dc-942f-4bc5-b526-0b39e14cb683'
    
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

    // Get default team's formations
    const { data: defaultFormations, error: defaultError } = await supabase
      .from('terminology')
      .select('*')
      .eq('category', 'formations')
      .eq('team_id', defaultTeamId)

    if (defaultError) {
      throw defaultError
    }

    if (!defaultFormations) {
      return
    }

    // Create a map of current formations by concept
    const currentFormationsMap = new Map(
      currentFormations.map(f => [f.concept, f])
    )

    // Create a map of default formations by concept
    const defaultFormationsMap = new Map(
      defaultFormations.map(f => [f.concept, f])
    )

    // Prepare updates for existing formations
    const updates = Array.from(defaultFormationsMap.values())
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

    // Delete formations that are not in the default team's list
    const formationsToDelete = currentFormations
      .filter(f => !defaultFormationsMap.has(f.concept))
      .map(f => f.id)

    // Add new formations that don't exist yet
    const newFormations = Array.from(defaultFormationsMap.values())
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

export async function getDefaultTeamFormations(): Promise<Terminology[]> {
  try {
    const defaultTeamId = '8feef3dc-942f-4bc5-b526-0b39e14cb683'
    const { data, error } = await supabase
      .from('terminology')
      .select('*')
      .eq('category', 'formations')
      .eq('team_id', defaultTeamId)

    if (error) {
      console.error('Error fetching default team formations:', error)
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Error in getDefaultTeamFormations:', error)
    throw error
  }
} 