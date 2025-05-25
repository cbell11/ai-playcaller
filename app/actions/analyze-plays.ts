"use server";

import { createClient } from '@supabase/supabase-js';

interface ScoutingOption {
  id?: string;
  name: string;
  dominateDown?: string;
  fieldArea?: string;
  notes?: string;
}

interface ScoutingReport {
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

interface AnalyzePlayResponse {
  success: boolean;
  data?: any;
  error?: string;
  plays?: string[];
  analysis?: string;
}

interface Terminology {
  concept: string;
  label: string;
}

// Helper function to format a complete play string
function formatCompletePlay(play: any): string {
  const components = [
    play.shifts,
    play.to_motions,
    play.formations,
    play.tags,
    play.from_motions,
    play.pass_protections,
    play.concept,
    play.concept_tag,
    play.concept_direction,
    play.rpo_tag
  ].filter(Boolean); // Remove any null/undefined/empty values

  return components.join(" ");
}

// Helper function to format front beaters with percentages
function formatFrontBeaters(frontBeaters: string, frontPercentages: { front: string; percentage: number }[]): string {
  if (!frontBeaters) return '';
  
  const beatersList = frontBeaters.split(',').map(f => f.trim());
  return beatersList.map(front => {
    const matchingFront = frontPercentages.find(fp => fp.front === front);
    return matchingFront ? `${front} (${matchingFront.percentage}%)` : front;
  }).join(', ');
}

export async function analyzeAndUpdatePlays(scoutingReport: ScoutingReport): Promise<AnalyzePlayResponse> {
  try {
    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const teamId = scoutingReport.team_id;
    if (!teamId) throw new Error('No team_id provided');

    // Constants
    const TARGET_PLAYS = 15;

    // Fetch team's terminology
    const { data: teamTerminology, error: terminologyError } = await supabase
      .from('terminology')
      .select('concept, label')
      .eq('team_id', teamId);

    if (terminologyError) {
      throw new Error(`Failed to fetch team terminology: ${terminologyError.message}`);
    }

    // Create a map of master concepts to team labels
    const terminologyMap = new Map<string, string>();
    teamTerminology?.forEach((term: Terminology) => {
      terminologyMap.set(term.concept.toLowerCase(), term.label);
    });

    // First, get all locked plays for this team
    const { data: lockedPlays, error: lockedPlaysError } = await supabase
      .from('playpool')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_locked', true);

    if (lockedPlaysError) {
      throw new Error(`Failed to fetch locked plays: ${lockedPlaysError.message}`);
    }

    // Get all fronts and their percentages
    const frontPercentages = Object.entries(scoutingReport.fronts_pct)
      .map(([front, percentage]) => ({ front, percentage }))
      .sort((a, b) => b.percentage - a.percentage);

    // Query master play pool for all run plays
    const { data: allMasterPlays, error: queryError } = await supabase
      .from('master_play_pool')
      .select('*')
      .in('category', ['run_game', 'front_beaters']);

    if (queryError) {
      throw new Error(`Failed to query master plays: ${queryError.message}`);
    }

    if (!allMasterPlays) {
      throw new Error('No plays found in master play pool');
    }

    // Filter out any plays that are already locked
    const lockedPlayIds = new Set(lockedPlays?.map(play => play.play_id) || []);
    let availableMasterPlays = allMasterPlays.filter(play => !lockedPlayIds.has(play.play_id));

    // Modify the play selection logic to check terminology
    availableMasterPlays = availableMasterPlays.filter(play => {
      // Skip plays without concepts
      if (!play.concept) return false;
      
      // Check if the concept exists in team's terminology
      return terminologyMap.has(play.concept.toLowerCase());
    });

    // If we don't have enough plays with matching terminology, log a warning
    if (availableMasterPlays.length < TARGET_PLAYS) {
      console.warn(`Warning: Only ${availableMasterPlays.length} plays found with matching terminology out of ${allMasterPlays.length} total plays`);
    }

    // Target number of plays to select (15 minus the number of locked run plays)
    const lockedRunPlays = lockedPlays?.filter(play => play.category === 'run_game') || [];
    const playsToSelect = Math.max(0, TARGET_PLAYS - lockedRunPlays.length);

    // Select plays based on front percentages
    let selectedPlays: any[] = [];
    const selectedPlayIds = new Set<string>();

    for (const { front, percentage } of frontPercentages) {
      // Calculate how many plays we should select for this front
      const playsForFront = Math.round((percentage / 100) * playsToSelect);
      
      if (playsForFront === 0) continue;

      // Find plays that beat this front (excluding already selected plays)
      const frontBeaters = availableMasterPlays.filter(play => {
        if (selectedPlayIds.has(play.play_id)) return false;
        const frontBeatersList = play.front_beaters ? play.front_beaters.split(',').map((f: string) => f.trim()) : [];
        return frontBeatersList.includes(front);
      });

      // If we don't have enough front beaters, also include some general run plays
      const generalRunPlays = availableMasterPlays.filter(play => 
        !selectedPlayIds.has(play.play_id) &&
        play.category === 'run_game' && 
        (!play.front_beaters || play.front_beaters === '')
      );

      // Randomly select plays, prioritizing front beaters
      let playsToAdd: any[] = [];
      
      if (frontBeaters.length > 0) {
        // Use 70% front beaters and 30% general runs if possible
        const frontBeaterCount = Math.ceil(playsForFront * 0.7);
        const generalRunCount = playsForFront - frontBeaterCount;

        // Randomly select front beaters
        for (let i = 0; i < frontBeaterCount && frontBeaters.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * frontBeaters.length);
          const selectedPlay = frontBeaters.splice(randomIndex, 1)[0];
          if (selectedPlay && !selectedPlayIds.has(selectedPlay.play_id)) {
            playsToAdd.push(selectedPlay);
            selectedPlayIds.add(selectedPlay.play_id);
          }
        }

        // Add some general run plays
        for (let i = 0; i < generalRunCount && generalRunPlays.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * generalRunPlays.length);
          const selectedPlay = generalRunPlays.splice(randomIndex, 1)[0];
          if (selectedPlay && !selectedPlayIds.has(selectedPlay.play_id)) {
            playsToAdd.push(selectedPlay);
            selectedPlayIds.add(selectedPlay.play_id);
          }
        }
      } else {
        // If no front beaters, just use general run plays
        for (let i = 0; i < playsForFront && generalRunPlays.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * generalRunPlays.length);
          const selectedPlay = generalRunPlays.splice(randomIndex, 1)[0];
          if (selectedPlay && !selectedPlayIds.has(selectedPlay.play_id)) {
            playsToAdd.push(selectedPlay);
            selectedPlayIds.add(selectedPlay.play_id);
          }
        }
      }

      // Add selected plays to our final list
      selectedPlays = [...selectedPlays, ...playsToAdd];
    }

    // Ensure we have enough plays by adding general run plays if needed
    if (selectedPlays.length < playsToSelect) {
      const remainingPlays = playsToSelect - selectedPlays.length;
      const availableRunPlays = availableMasterPlays.filter(play => 
        !selectedPlayIds.has(play.play_id) &&
        play.category === 'run_game'
      );

      for (let i = 0; i < remainingPlays && availableRunPlays.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableRunPlays.length);
        const selectedPlay = availableRunPlays.splice(randomIndex, 1)[0];
        if (selectedPlay) {
          selectedPlays.push(selectedPlay);
          selectedPlayIds.add(selectedPlay.play_id);
        }
      }
    }

    // Format complete play strings
    const formattedPlays = selectedPlays.map(play => formatCompletePlay(play));

    // Modify the playsToInsert mapping to translate concepts
    const playsToInsert = selectedPlays.map(play => {
      // Format front beaters with percentages
      const formattedFrontBeaters = formatFrontBeaters(play.front_beaters, frontPercentages);
      
      // Translate the concept to team's terminology
      const teamConcept = play.concept ? terminologyMap.get(play.concept.toLowerCase()) || play.concept : play.concept;
      
      return {
        team_id: teamId,
        opponent_id: scoutingReport.opponent_id,
        play_id: play.play_id,
        shifts: play.shifts,
        to_motions: play.to_motions,
        formations: play.formations,
        tags: play.tags,
        from_motions: play.from_motions,
        pass_protections: play.pass_protections,
        concept: teamConcept,
        combined_call: formatCompletePlay({...play, concept: teamConcept}),
        concept_tag: play.concept_tag,
        rpo_tag: play.rpo_tag,
        category: play.category,
        third_s: play.third_s,
        third_m: play.third_m,
        third_l: play.third_l,
        rz: play.rz,
        gl: play.gl,
        front_beaters: formattedFrontBeaters,
        coverage_beaters: play.coverage_beaters,
        blitz_beaters: play.blitz_beaters,
        concept_direction: play.concept_direction,
        notes: `Selected based on defensive fronts: ${frontPercentages.map(fp => `${fp.front} (${fp.percentage}%)`).join(', ')}`,
        is_enabled: true,
        is_locked: false,
        is_favorite: false
      };
    });

    // Delete any existing non-locked run plays for this team AND opponent
    const { error: deleteError } = await supabase
      .from('playpool')
      .delete()
      .eq('team_id', teamId)
      .eq('opponent_id', scoutingReport.opponent_id)
      .in('category', ['run_game', 'front_beaters'])
      .eq('is_locked', false);

    if (deleteError) {
      throw new Error(`Failed to clear existing plays: ${deleteError.message}`);
    }

    // Insert the new plays into the team's play pool
    if (playsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('playpool')
        .insert(playsToInsert);

      if (insertError) {
        throw new Error(`Failed to insert new plays: ${insertError.message}`);
      }
    }

    // Return success with analysis
    const lockedCount = lockedRunPlays.length;
    const newCount = selectedPlays.length;
    
    return {
      success: true,
      data: true,
      analysis: `Successfully rebuilt playpool:\n` +
        `- Kept ${lockedCount} locked run plays\n` +
        `- Added ${newCount} new run plays\n` +
        `- Total run plays: ${lockedCount + newCount}\n\n` +
        `New plays were selected based on defensive front percentages and effectiveness.`
    };

  } catch (error) {
    console.error('Error in analyzeAndUpdatePlays:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
} 