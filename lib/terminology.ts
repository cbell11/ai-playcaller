import { supabase } from './supabase'
import { updatePlayPoolTerminology } from './playpool'

export interface Terminology {
  id: string
  concept: string
  label: string
  category: string
  isEditing?: boolean  // Optional property for UI state
}

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

    // After terminology is updated, update all plays that use this terminology
    await updatePlayPoolTerminology()
  } catch (error) {
    console.error('Error in updateTerminology:', error)
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