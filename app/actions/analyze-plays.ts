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
  motion_percentage: number;
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
function formatCompletePlay(play: any, includeMotion: boolean = true): string {
  const components = [
    includeMotion ? play.shifts : null,
    includeMotion ? play.to_motions : null,
    play.formations,
    play.tags,
    includeMotion ? play.from_motions : null,
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

// Helper function to determine if a play has motion components
function hasMotionComponents(play: any): boolean {
  return Boolean(play.shifts || play.to_motions || play.from_motions);
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
      .in('category', ['run_game', 'quick_game', 'front_beaters']);

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

    // Target number of plays to select (15 minus the number of locked plays for each category)
    const lockedRunPlays = lockedPlays?.filter(play => play.category === 'run_game') || [];
    const lockedQuickPlays = lockedPlays?.filter(play => play.category === 'quick_game') || [];
    
    const runPlaysToSelect = Math.max(0, TARGET_PLAYS - lockedRunPlays.length);
    const quickPlaysToSelect = Math.max(0, TARGET_PLAYS - lockedQuickPlays.length);

    // Separate available plays by category
    const availableRunPlays = availableMasterPlays.filter(play => play.category === 'run_game');
    const availableQuickPlays = availableMasterPlays.filter(play => play.category === 'quick_game');

    // Select plays based on front percentages
    let selectedRunPlays: any[] = [];
    let selectedQuickPlays: any[] = [];
    const selectedPlayIds = new Set<string>();

    // Helper function to select plays for a category
    const selectPlaysForCategory = (
      playsToSelect: number,
      availablePlays: any[],
      category: string,
      selectedPlaysArray: any[]
    ) => {
      for (const { front, percentage } of frontPercentages) {
        // Calculate how many plays we should select for this front
        const playsForFront = Math.round((percentage / 100) * playsToSelect);
        
        if (playsForFront === 0) continue;

        // Find plays that beat this front (excluding already selected plays)
        const frontBeaters = availablePlays.filter(play => {
          if (selectedPlayIds.has(play.play_id)) return false;
          const frontBeatersList = play.front_beaters ? play.front_beaters.split(',').map((f: string) => f.trim()) : [];
          return frontBeatersList.includes(front);
        });

        // If we don't have enough front beaters, also include some general plays
        const generalPlays = availablePlays.filter(play => 
          !selectedPlayIds.has(play.play_id) &&
          play.category === category && 
          (!play.front_beaters || play.front_beaters === '')
        );

        // Randomly select plays, prioritizing front beaters
        let playsToAdd: any[] = [];
        
        if (frontBeaters.length > 0) {
          // Use 70% front beaters and 30% general plays if possible
          const frontBeaterCount = Math.ceil(playsForFront * 0.7);
          const generalPlayCount = playsForFront - frontBeaterCount;

          // Randomly select front beaters
          for (let i = 0; i < frontBeaterCount && frontBeaters.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * frontBeaters.length);
            const selectedPlay = frontBeaters.splice(randomIndex, 1)[0];
            if (selectedPlay && !selectedPlayIds.has(selectedPlay.play_id)) {
              playsToAdd.push(selectedPlay);
              selectedPlayIds.add(selectedPlay.play_id);
            }
          }

          // Add some general plays
          for (let i = 0; i < generalPlayCount && generalPlays.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * generalPlays.length);
            const selectedPlay = generalPlays.splice(randomIndex, 1)[0];
            if (selectedPlay && !selectedPlayIds.has(selectedPlay.play_id)) {
              playsToAdd.push(selectedPlay);
              selectedPlayIds.add(selectedPlay.play_id);
            }
          }
        } else {
          // If no front beaters, just use general plays
          for (let i = 0; i < playsForFront && generalPlays.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * generalPlays.length);
            const selectedPlay = generalPlays.splice(randomIndex, 1)[0];
            if (selectedPlay && !selectedPlayIds.has(selectedPlay.play_id)) {
              playsToAdd.push(selectedPlay);
              selectedPlayIds.add(selectedPlay.play_id);
            }
          }
        }

        // Add selected plays to our final list
        selectedPlaysArray.push(...playsToAdd);
      }

      // Ensure we have enough plays by adding general plays if needed
      if (selectedPlaysArray.length < playsToSelect) {
        const remainingPlays = playsToSelect - selectedPlaysArray.length;
        const availableGeneralPlays = availablePlays.filter(play => 
          !selectedPlayIds.has(play.play_id) &&
          play.category === category
        );

        for (let i = 0; i < remainingPlays && availableGeneralPlays.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * availableGeneralPlays.length);
          const selectedPlay = availableGeneralPlays.splice(randomIndex, 1)[0];
          if (selectedPlay) {
            selectedPlaysArray.push(selectedPlay);
            selectedPlayIds.add(selectedPlay.play_id);
          }
        }
      }
    };

    // Select plays for both categories
    selectPlaysForCategory(runPlaysToSelect, availableRunPlays, 'run_game', selectedRunPlays);
    selectPlaysForCategory(quickPlaysToSelect, availableQuickPlays, 'quick_game', selectedQuickPlays);

    // Combine all selected plays
    const selectedPlays = [...selectedRunPlays, ...selectedQuickPlays];

    // Calculate how many plays should have motion
    const targetMotionPlays = Math.round((scoutingReport.motion_percentage / 100) * (runPlaysToSelect + quickPlaysToSelect));
    
    // Sort plays by whether they have motion components
    const playsWithMotion = selectedPlays.filter(play => hasMotionComponents(play));
    const playsWithoutMotion = selectedPlays.filter(play => !hasMotionComponents(play));
    
    // Determine which plays will show motion based on the target percentage
    const finalPlays = selectedPlays.map(play => {
      const hasMotion = hasMotionComponents(play);
      let shouldShowMotion = hasMotion;

      // If we have motion components but want less motion, sometimes hide them
      if (hasMotion && playsWithMotion.length > targetMotionPlays) {
        // Calculate probability of hiding motion to achieve target percentage
        const hideMotionProbability = 1 - (targetMotionPlays / playsWithMotion.length);
        shouldShowMotion = Math.random() > hideMotionProbability;
      }

      return {
        ...play,
        shouldShowMotion
      };
    });

    // Format complete play strings with motion control
    const formattedPlays = finalPlays.map(play => formatCompletePlay(play, play.shouldShowMotion));

    // Prepare plays for insertion into team's play pool
    const playsToInsert = finalPlays.map(play => {
      // Format front beaters with percentages
      const formattedFrontBeaters = formatFrontBeaters(play.front_beaters, frontPercentages);
      
      // Translate the concept to team's terminology
      const teamConcept = play.concept ? terminologyMap.get(play.concept.toLowerCase()) || play.concept : play.concept;
      
      return {
        team_id: teamId,
        opponent_id: scoutingReport.opponent_id,
        play_id: play.play_id,
        shifts: play.shouldShowMotion ? play.shifts : null,
        to_motions: play.shouldShowMotion ? play.to_motions : null,
        formations: play.formations,
        tags: play.tags,
        from_motions: play.shouldShowMotion ? play.from_motions : null,
        pass_protections: play.pass_protections,
        concept: teamConcept,
        combined_call: formatCompletePlay({...play, concept: teamConcept}, play.shouldShowMotion),
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

    // Delete any existing non-locked run and quick plays for this team AND opponent
    const { error: deleteError } = await supabase
      .from('playpool')
      .delete()
      .eq('team_id', teamId)
      .eq('opponent_id', scoutingReport.opponent_id)
      .in('category', ['run_game', 'quick_game', 'front_beaters'])
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

    // Update the analysis message to include motion information
    const actualMotionPercentage = (finalPlays.filter(p => p.shouldShowMotion).length / finalPlays.length) * 100;
    
    return {
      success: true,
      data: true,
      analysis: `Successfully rebuilt playpool:\n` +
        `- Kept ${lockedRunPlays.length} locked run plays and ${lockedQuickPlays.length} locked quick plays\n` +
        `- Added ${selectedRunPlays.length} new run plays and ${selectedQuickPlays.length} new quick plays\n` +
        `- Total run plays: ${lockedRunPlays.length + selectedRunPlays.length}\n` +
        `- Total quick plays: ${lockedQuickPlays.length + selectedQuickPlays.length}\n` +
        `- Target motion percentage: ${scoutingReport.motion_percentage}%\n` +
        `- Actual motion percentage: ${actualMotionPercentage.toFixed(1)}%\n\n` +
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