"use server";

import { createClient } from '@supabase/supabase-js';

// Define types
interface MasterBlitz {
  id: string;
  name: string;
  created_at: string;
}

interface FetchMasterBlitzesResult {
  success: boolean;
  data?: MasterBlitz[];
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

interface RemoveBlitzesResult {
  success: boolean;
  data?: MasterBlitz[];
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

// Function to fetch all master blitzes without any filtering or modification
export async function listAllBlitzes(): Promise<FetchMasterBlitzesResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all master blitzes
    const { data, error } = await supabase
      .from('master_blitzes')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching master blitzes:', error);
      return {
        success: false,
        error: {
          message: error.message,
          details: error.details,
          code: error.code
        }
      };
    }

    console.log("All blitzes in database:", data);
    
    // Return success response
    return {
      success: true,
      data: data as MasterBlitz[]
    };
  } catch (error) {
    console.error('Unexpected error when fetching master blitzes:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
}

// Function to fetch all master blitzes
export async function getMasterBlitzes(): Promise<FetchMasterBlitzesResult> {
  // Use the listAllBlitzes function to ensure we don't modify anything
  return await listAllBlitzes();
}

// DISABLED: Function to remove default blitzes from the master_blitzes table
export async function removeDefaultBlitzes(): Promise<RemoveBlitzesResult> {
  console.log("DISABLED: removeDefaultBlitzes function has been disabled to prevent accidental data loss");
  return { success: true };
}

// Function to remove specific problematic blitzes
export async function removeProblematicBlitzes(): Promise<RemoveBlitzesResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Problematic blitzes to be removed
    const problematicBlitzes = ['Strong Outside', 'Weak Outside'];
    
    console.log("Looking for problematic blitzes to remove:", problematicBlitzes);
    
    // Check if these blitzes exist
    const { data: existingBlitzes, error: checkError } = await supabase
      .from('master_blitzes')
      .select('*')
      .in('name', problematicBlitzes);
      
    if (checkError) {
      console.error('Error checking for problematic blitzes:', checkError);
      return {
        success: false,
        error: {
          message: checkError.message,
          details: checkError.details,
          code: checkError.code
        }
      };
    }
    
    if (existingBlitzes && existingBlitzes.length > 0) {
      console.log(`Found ${existingBlitzes.length} problematic blitzes to remove:`, existingBlitzes);
      
      // Delete the problematic blitzes
      const { error } = await supabase
        .from('master_blitzes')
        .delete()
        .in('id', existingBlitzes.map(b => b.id));
      
      if (error) {
        console.error('Error removing problematic blitzes:', error);
        return {
          success: false,
          error: {
            message: error.message,
            details: error.details,
            code: error.code
          }
        };
      }
      
      console.log("Successfully removed problematic blitzes");
      return { 
        success: true,
        data: existingBlitzes
      };
    } else {
      console.log("No problematic blitzes found in database");
      return { success: true };
    }
  } catch (error) {
    console.error('Unexpected error when removing problematic blitzes:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
} 