"use server";

import { createClient } from '@supabase/supabase-js';

// Define types
interface ScoutingOption {
  id?: string;
  name: string;
  dominateDown: string;
  fieldArea: string;
}

interface ScoutingReport {
  id?: string;
  team_id: string;
  opponent_id: string;
  fronts: ScoutingOption[];
  coverages: ScoutingOption[];
  blitzes: ScoutingOption[];
  fronts_pct: Record<string, number>;
  coverages_pct: Record<string, number>;
  blitz_pct: Record<string, number>;
  overall_blitz_pct: number;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

interface SaveScoutingReportParams {
  team_id: string;
  opponent_id: string;
  fronts: ScoutingOption[];
  coverages: ScoutingOption[];
  blitzes: ScoutingOption[];
  fronts_pct: Record<string, number>;
  coverages_pct: Record<string, number>;
  blitz_pct: Record<string, number>;
  overall_blitz_pct: number;
  notes: string;
}

interface SaveScoutingReportResult {
  success: boolean;
  data?: ScoutingReport;
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

interface GetScoutingReportResult {
  success: boolean;
  data?: ScoutingReport | null;
  error?: {
    message: string;
    details?: string;
    code?: string;
  };
}

// Function to save a scouting report
export async function saveScoutingReport(params: SaveScoutingReportParams): Promise<SaveScoutingReportResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Filter out unwanted fronts, coverages, and blitzes before saving
    const filteredFronts = params.fronts.filter(front => !['Even', 'Odd'].includes(front.name));
    const filteredCoverages = params.coverages.filter(coverage => 
      !['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].includes(coverage.name)
    );
    const filteredBlitzes = params.blitzes.filter(blitz => {
      const name = blitz.name.toLowerCase();
      return !(
        name === 'inside' || 
        name === 'outside' || 
        name === 'corner' || 
        name === 'safety'
      );
    });
    
    // Clean up percentages for unwanted items
    const filteredFrontPct = { ...params.fronts_pct };
    ['Even', 'Odd'].forEach(frontName => {
      delete filteredFrontPct[frontName];
    });
    
    const filteredCoverPct = { ...params.coverages_pct };
    ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'].forEach(coverageName => {
      delete filteredCoverPct[coverageName];
    });
    
    const filteredBlitzPct = { ...params.blitz_pct };
    ['Inside', 'Outside', 'Corner', 'Safety', 'inside', 'outside', 'corner', 'safety'].forEach(blitzName => {
      delete filteredBlitzPct[blitzName];
    });

    // Prepare report data
    const reportData = {
      team_id: params.team_id,
      opponent_id: params.opponent_id,
      fronts: filteredFronts,
      coverages: filteredCoverages,
      blitzes: filteredBlitzes,
      fronts_pct: filteredFrontPct,
      coverages_pct: filteredCoverPct,
      blitz_pct: filteredBlitzPct,
      overall_blitz_pct: params.overall_blitz_pct,
      notes: params.notes
    };

    // Upsert the record (insert if not exists, update if exists)
    const { data, error } = await supabase
      .from('scouting_reports')
      .upsert(reportData, { 
        onConflict: 'team_id,opponent_id'
      });

    if (error) {
      console.error('Error saving scouting report:', error);
      return {
        success: false,
        error: {
          message: error.message,
          details: error.details,
          code: error.code
        }
      };
    }

    // Return success response with data or undefined if no data returned
    return {
      success: true,
      data: data?.[0] as ScoutingReport | undefined
    };
  } catch (error) {
    console.error('Unexpected error when saving scouting report:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
}

// Function to get a scouting report by team_id and opponent_id
export async function getScoutingReport(
  team_id: string, 
  opponent_id: string
): Promise<GetScoutingReportResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the scouting report
    const { data, error } = await supabase
      .from('scouting_reports')
      .select('*')
      .eq('team_id', team_id)
      .eq('opponent_id', opponent_id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
      console.error('Error fetching scouting report:', error);
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
      data: data as ScoutingReport | null
    };
  } catch (error) {
    console.error('Unexpected error when fetching scouting report:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
}

// Function to list all scouting reports for a team
export async function listTeamScoutingReports(team_id: string): Promise<GetScoutingReportResult> {
  try {
    // Initialize the Supabase client with server-side credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all scouting reports for the team
    const { data, error } = await supabase
      .from('scouting_reports')
      .select(`
        *,
        opponents:opponent_id (
          id,
          name
        )
      `)
      .eq('team_id', team_id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching team scouting reports:', error);
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
      data: data as any
    };
  } catch (error) {
    console.error('Unexpected error when fetching team scouting reports:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    };
  }
} 