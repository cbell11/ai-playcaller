"use server";

/*
 * IMPORTANT: 
 * For these server actions to work properly, you need the following environment variables:
 * 
 * NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL
 * NEXT_PUBLIC_SUPABASE_ANON_KEY - Your Supabase anonymous key 
 * SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
 * 
 * Create a .env.local file in the root of your project with these variables.
 * The service role key can be found in your Supabase dashboard under Project Settings > API.
 */

import { createClient } from '@supabase/supabase-js';

// Define types
interface Opponent {
  id: string;
  name: string;
  team_id: string;
  created_at: string;
}

interface AddOpponentInput {
  id: string;
  name: string;
  team_id: string;
}

interface AddOpponentResult {
  success: boolean;
  data?: Opponent;
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

interface GetOpponentsResult {
  success: boolean;
  data?: Opponent[];
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

export async function addOpponent(input: AddOpponentInput): Promise<AddOpponentResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Prepare the opponent data with created_at timestamp
    const opponent = {
      id: input.id,
      name: input.name,
      team_id: input.team_id,
      created_at: new Date().toISOString()
    };

    // Insert the opponent
    const { data, error } = await supabase
      .from('opponents')
      .insert(opponent)
      .select();

    if (error) {
      console.error('Error adding opponent:', error);
      return {
        success: false,
        error: {
          message: error.message,
          details: error.details,
          code: error.code
        }
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: {
          message: 'No data returned after insert'
        }
      };
    }

    // Return success response
    return {
      success: true,
      data: data[0] as Opponent
    };
  } catch (error) {
    console.error('Unexpected error when adding opponent:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
}

// Add a function to fetch opponents by team_id
export async function getOpponentsByTeamId(teamId: string): Promise<GetOpponentsResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch opponents for the team
    const { data, error } = await supabase
      .from('opponents')
      .select('*')
      .eq('team_id', teamId)
      .order('name');

    if (error) {
      console.error('Error fetching opponents:', error);
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
      data: data as Opponent[]
    };
  } catch (error) {
    console.error('Unexpected error when fetching opponents:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
}

// Add a function to get a specific opponent by ID
export async function getOpponentById(id: string): Promise<AddOpponentResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch opponent by ID
    const { data, error } = await supabase
      .from('opponents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching opponent by ID:', error);
      return {
        success: false,
        error: {
          message: error.message,
          details: error.details,
          code: error.code
        }
      };
    }

    if (!data) {
      return {
        success: false,
        error: {
          message: 'Opponent not found'
        }
      };
    }

    // Return success response
    return {
      success: true,
      data: data as Opponent
    };
  } catch (error) {
    console.error('Unexpected error when fetching opponent by ID:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
} 