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
      console.log('No existing terminology found, initializing defaults...')
      const defaultTerminology = [
        // Formations
        { concept: "Trips", label: "trps", category: "formations" },
        { concept: "Deuce", label: "duce", category: "formations" },
        { concept: "Trey", label: "trey", category: "formations" },
        { concept: "Empty", label: "mt", category: "formations" },
        { concept: "Queen", label: "q", category: "formations" },
        { concept: "Sam", label: "sam", category: "formations" },
        { concept: "Will", label: "will", category: "formations" },
        { concept: "Bunch", label: "bunch", category: "formations" },
        
        // Formation Tags
        { concept: "Over", label: "ovr", category: "tags" },
        { concept: "Slot", label: "slot", category: "tags" },
        { concept: "Closed", label: "clsd", category: "tags" },
        { concept: "Flip", label: "flip", category: "tags" },
        
        // Motions/Shifts
        { concept: "Jet", label: "jet", category: "motions" },
        { concept: "Orbit", label: "orb", category: "motions" },
        { concept: "Zoom", label: "zm", category: "motions" },
        { concept: "Flash", label: "fl", category: "motions" },
        
        // Shifts
        { concept: "Dodge", label: "dodge", category: "shifts" },
        { concept: "Texas", label: "texas", category: "shifts" },
        { concept: "Exchange", label: "xchg", category: "shifts" },
        { concept: "Swap", label: "swap", category: "shifts" },
        
        // Pass Protections
        { concept: "Base", label: "base", category: "pass_protections" },
        { concept: "Slide", label: "slide", category: "pass_protections" },
        { concept: "Max", label: "max", category: "pass_protections" },
        { concept: "Half", label: "half", category: "pass_protections" },
        
        // Run Game
        { concept: "Inside Zone", label: "iz", category: "run_game" },
        { concept: "Outside Zone", label: "oz", category: "run_game" },
        { concept: "Power", label: "pwr", category: "run_game" },
        { concept: "Counter", label: "ctr", category: "run_game" },
        { concept: "Draw", label: "drw", category: "run_game" },
        
        // Quick Game
        { concept: "Hoss", label: "hoss", category: "quick_game" },
        { concept: "Stick", label: "stick", category: "quick_game" },
        { concept: "Quick Out", label: "qo", category: "quick_game" },
        { concept: "Slot Fade", label: "slfade", category: "quick_game" },
        { concept: "Snag", label: "snag", category: "quick_game" },
        
        // Dropback Game
        { concept: "Curl", label: "curl", category: "dropback" },
        { concept: "Dig", label: "dig", category: "dropback" },
        { concept: "Dagger", label: "dger", category: "dropback" },
        { concept: "Flood", label: "fl", category: "dropback" },
        
        // Shot Plays
        { concept: "Go", label: "go", category: "shot_plays" },
        { concept: "Post/Wheel", label: "pw", category: "shot_plays" },
        { concept: "Double Move", label: "dbm", category: "shot_plays" },
        { concept: "Yankee", label: "yanke", category: "shot_plays" },
        
        // Screen Game
        { concept: "Bubble", label: "bub", category: "screens" },
        { concept: "Tunnel", label: "tnl", category: "screens" },
        { concept: "RB Screen", label: "rbs", category: "screens" },
        { concept: "Double Screen", label: "dbl screen", category: "screens" },
      ]

      const { data, error: insertError } = await supabase
        .from('terminology')
        .insert(defaultTerminology)
        .select()

      if (insertError) {
        console.error('Error initializing default terminology:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        })
        throw insertError
      }

      console.log('Successfully initialized default terminology:', data)
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