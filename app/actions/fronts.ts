"use server";

import { createClient } from '@supabase/supabase-js';

// Define types
interface MasterFront {
  id: string;
  name: string;
  created_at: string;
}

interface FetchMasterFrontsResult {
  success: boolean;
  data?: MasterFront[];
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

interface RemoveFrontsResult {
  success: boolean;
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

// Function to fetch all master fronts
export async function getMasterFronts(): Promise<FetchMasterFrontsResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all master fronts
    const { data, error } = await supabase
      .from('master_fronts')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching master fronts:', error);
      return {
        success: false,
        error: {
          message: error.message,
          details: error.details,
          code: error.code
        }
      };
    }

    // Return success response
    return {
      success: true,
      data: data as MasterFront[]
    };
  } catch (error) {
    console.error('Unexpected error when fetching master fronts:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
}

// Function to remove specific fronts from the master_fronts table
export async function removeSpecificFronts(): Promise<RemoveFrontsResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fronts to be removed
    const frontsToRemove = ['Even', 'Odd', 'Bear'];
    
    // Delete the specified fronts
    const { error } = await supabase
      .from('master_fronts')
      .delete()
      .in('name', frontsToRemove);
    
    if (error) {
      console.error('Error removing fronts:', error);
      return {
        success: false,
        error: {
          message: error.message,
          details: error.details,
          code: error.code
        }
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Unexpected error when removing fronts:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
} 