"use server";

import { createClient } from '@supabase/supabase-js';

// Define types
interface MasterCoverage {
  id: string;
  name: string;
  created_at: string;
}

interface FetchMasterCoveragesResult {
  success: boolean;
  data?: MasterCoverage[];
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

interface RemoveCoveragesResult {
  success: boolean;
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

// Function to fetch all master coverages
export async function getMasterCoverages(): Promise<FetchMasterCoveragesResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all master coverages
    const { data, error } = await supabase
      .from('master_coverages')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching master coverages:', error);
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
      data: data as MasterCoverage[]
    };
  } catch (error) {
    console.error('Unexpected error when fetching master coverages:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
}

// Function to remove default coverages from the master_coverages table
export async function removeDefaultCoverages(): Promise<RemoveCoveragesResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Coverages to be removed
    const coveragesToRemove = ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'];
    
    // Delete the specified coverages
    const { error } = await supabase
      .from('master_coverages')
      .delete()
      .in('name', coveragesToRemove);
    
    if (error) {
      console.error('Error removing coverages:', error);
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
    console.error('Unexpected error when removing coverages:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
} 