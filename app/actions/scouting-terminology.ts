'use server'

import { createClient } from '@supabase/supabase-js'

// Define the scouting terminology interface
export interface ScoutingTerminology {
  id: string
  name: string
  category: 'front' | 'coverage' | 'blitz'
  description: string | null
  is_enabled: boolean
  created_at: string
  updated_at: string
}

// Result interfaces
interface FetchScoutingTerminologyResult {
  success: boolean
  data?: ScoutingTerminology[]
  error?: {
    message: string
    details?: string
    code?: string
  }
}

// Function to fetch scouting terminology by category
export async function getScoutingTerminologyByCategory(category: 'front' | 'coverage' | 'blitz'): Promise<FetchScoutingTerminologyResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch enabled terminology for the specified category
    const { data, error } = await supabase
      .from('scouting_terminology')
      .select('*')
      .eq('category', category)
      .eq('is_enabled', true)
      .order('name')

    if (error) {
      console.error(`Error fetching ${category} terminology:`, error)
      return {
        success: false,
        error: {
          message: error.message,
          details: error.details,
          code: error.code
        }
      }
    }

    // Return success response
    return {
      success: true,
      data: data as ScoutingTerminology[]
    }
  } catch (error) {
    console.error(`Unexpected error when fetching ${category} terminology:`, error)
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    }
  }
}

// Convenience functions for each category
export async function getScoutingFronts(): Promise<FetchScoutingTerminologyResult> {
  return getScoutingTerminologyByCategory('front')
}

export async function getScoutingCoverages(): Promise<FetchScoutingTerminologyResult> {
  return getScoutingTerminologyByCategory('coverage')
}

export async function getScoutingBlitzes(): Promise<FetchScoutingTerminologyResult> {
  return getScoutingTerminologyByCategory('blitz')
}

// Function to fetch all scouting terminology
export async function getAllScoutingTerminology(): Promise<FetchScoutingTerminologyResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch all enabled terminology
    const { data, error } = await supabase
      .from('scouting_terminology')
      .select('*')
      .eq('is_enabled', true)
      .order('category')
      .order('name')

    if (error) {
      console.error('Error fetching all scouting terminology:', error)
      return {
        success: false,
        error: {
          message: error.message,
          details: error.details,
          code: error.code
        }
      }
    }

    // Return success response
    return {
      success: true,
      data: data as ScoutingTerminology[]
    }
  } catch (error) {
    console.error('Unexpected error when fetching all scouting terminology:', error)
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    }
  }
} 