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
  category: string;
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
  ].filter(Boolean);

  return components.join(" ");
}

// Helper function to normalize front/coverage names
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Helper function to format front beaters with percentages
function formatFrontBeaters(frontBeaters: string, frontPercentages: { front: string; percentage: number }[]): string {
  if (!frontBeaters) return '';
  
  const beatersList = frontBeaters.split(',').map(f => f.trim());
  
  // Log for debugging
  console.log('Front beaters debug:', {
    original: frontBeaters,
    normalized: beatersList.map(normalizeName),
    availableFronts: frontPercentages.map(fp => fp.front),
    normalizedFronts: frontPercentages.map(fp => normalizeName(fp.front))
  });

  const relevantBeaters = beatersList.filter(front => 
    frontPercentages.some(fp => normalizeName(fp.front) === normalizeName(front))
  );
  
  return relevantBeaters.join(', ');
}

// Helper function to format coverage beaters with percentages
function formatCoverageBeaters(coverageBeaters: string, coveragePercentages: { coverage: string; percentage: number }[]): string {
  if (!coverageBeaters) return '';
  
  const beatersList = coverageBeaters.split(',').map(c => c.trim());
  const relevantBeaters = beatersList.filter(coverage => 
    coveragePercentages.some(cp => normalizeName(cp.coverage) === normalizeName(coverage))
  );
  
  return relevantBeaters.join(', ');
}

// Helper function to determine if a play has motion components
function hasMotionComponents(play: any): boolean {
  return Boolean(play.shifts || play.to_motions || play.from_motions);
}

// Helper function to determine if a category is a pass play category
function isPassPlayCategory(category: string): boolean {
  return ['quick_game', 'dropback_game', 'shot_plays', 'screen_game'].includes(category);
}

export async function analyzeAndUpdatePlays(scoutingReport: ScoutingReport): Promise<AnalyzePlayResponse> {
  try {
    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const teamId = scoutingReport.team_id;
    const opponentId = scoutingReport.opponent_id;

    if (!teamId) throw new Error('No team_id provided');
    if (!opponentId) throw new Error('No opponent_id provided');

    console.log('Analyzing plays for:', { teamId, opponentId });

    // Verify scouting report data
    if (!scoutingReport.fronts || !scoutingReport.coverages || 
        !scoutingReport.fronts_pct || !scoutingReport.coverages_pct) {
      throw new Error('Invalid scouting report: missing required defensive data');
    }

    // Log defensive data for verification
    console.log('Defensive data:', {
      fronts: scoutingReport.fronts.map(f => f.name),
      coverages: scoutingReport.coverages.map(c => c.name),
      frontsPct: Object.keys(scoutingReport.fronts_pct),
      coveragesPct: Object.keys(scoutingReport.coverages_pct)
    });

    // Constants
    const TARGET_PLAYS = {
      run_game: 15,
      rpo_game: 5,
      quick_game: 15,
      dropback_game: 15,
      shot_plays: 15,
      screen_game: 15
    };

    // Fetch team's terminology
    const { data: teamTerminology, error: terminologyError } = await supabase
      .from('terminology')
      .select('concept, label, category')
      .eq('team_id', teamId);

    if (terminologyError) {
      throw new Error(`Failed to fetch team terminology: ${terminologyError.message}`);
    }

    // Log terminology by category
    const terminologyByCategory = {
      run_game: teamTerminology?.filter(t => t.category === 'run_game').length || 0,
      rpo_game: teamTerminology?.filter(t => t.category === 'rpo_game').length || 0,
      quick_game: teamTerminology?.filter(t => t.category === 'quick_game').length || 0,
      dropback_game: teamTerminology?.filter(t => t.category === 'dropback_game').length || 0,
      shot_plays: teamTerminology?.filter(t => t.category === 'shot_plays').length || 0,
      screen_game: teamTerminology?.filter(t => t.category === 'screen_game').length || 0
    };
    console.log('Terminology by category:', terminologyByCategory);

    // Create a map of master concepts to team labels
    const terminologyMap = new Map<string, string>();
    teamTerminology?.forEach((term: Terminology) => {
      terminologyMap.set(term.concept.toLowerCase(), term.label);
    });

    // First, get all locked plays for this team AND opponent
    const { data: lockedPlays, error: lockedPlaysError } = await supabase
      .from('playpool')
      .select('*')
      .eq('team_id', teamId)
      .eq('opponent_id', opponentId)
      .eq('is_locked', true);

    if (lockedPlaysError) {
      throw new Error(`Failed to fetch locked plays: ${lockedPlaysError.message}`);
    }

    // Get all fronts and their percentages
    const frontPercentages = Object.entries(scoutingReport.fronts_pct)
      .map(([front, percentage]) => ({ front, percentage }))
      .sort((a, b) => b.percentage - a.percentage);

    console.log('Available fronts:', frontPercentages);

    // Get all coverages and their percentages
    const coveragePercentages = Object.entries(scoutingReport.coverages_pct)
      .map(([coverage, percentage]) => ({ coverage, percentage }))
      .sort((a, b) => b.percentage - a.percentage);

    console.log('Available coverages:', coveragePercentages);

    // Query master play pool for all plays including screen plays
    const { data: allMasterPlays, error: queryError } = await supabase
      .from('master_play_pool')
      .select('*')
      .in('category', ['run_game', 'rpo_game', 'quick_game', 'dropback_game', 'shot_plays', 'screen_game']);

    if (queryError) {
      throw new Error(`Failed to query master plays: ${queryError.message}`);
    }

    if (!allMasterPlays) {
      throw new Error('No plays found in master play pool');
    }

    // Filter out any plays that are already locked
    const lockedPlayIds = new Set(lockedPlays?.map(play => play.play_id) || []);
    let availableMasterPlays = allMasterPlays.filter(play => !lockedPlayIds.has(play.play_id));

    // Log all screen plays from master pool for debugging
    console.log('All screen plays from master pool:', availableMasterPlays.filter(p => p.category === 'screen_game'));

    // Modify the play selection logic to check terminology and defensive matchups
    availableMasterPlays = availableMasterPlays.filter(play => {
      // Skip plays without required fields
      if (!play.concept || !play.formations) {
        console.log('Skipping play due to missing required fields:', play);
        return false;
      }

      // Special handling for screen plays - allow them through without strict terminology matching
      if (play.category === 'screen_game') {
        return true;
      }

      // Check if the concept exists in team's terminology
      const hasTerminology = terminologyMap.has(play.concept.toLowerCase());
      if (!hasTerminology) {
        console.log('Skipping play due to missing terminology:', {
          category: play.category,
          concept: play.concept,
          availableTerminology: Array.from(terminologyMap.keys())
        });
      }
      return hasTerminology;
    });

    // Log available plays by category before defensive filtering
    console.log('Available plays before defensive filtering:', {
      run_game: availableMasterPlays.filter(p => p.category === 'run_game').length,
      rpo_game: availableMasterPlays.filter(p => p.category === 'rpo_game').length,
      quick_game: availableMasterPlays.filter(p => p.category === 'quick_game').length,
      dropback_game: availableMasterPlays.filter(p => p.category === 'dropback_game').length,
      shot_plays: availableMasterPlays.filter(p => p.category === 'shot_plays').length,
      screen_game: availableMasterPlays.filter(p => p.category === 'screen_game').length
    });

    // Filter plays based on defensive matchups
    availableMasterPlays = availableMasterPlays.filter(play => {
      const isPassPlay = ['quick_game', 'dropback_game', 'shot_plays', 'screen_game'].includes(play.category);
      
      if (isPassPlay && play.coverage_beaters) {
        const beatersList = play.coverage_beaters.split(',').map((c: string) => c.trim().toLowerCase());
        const availableCoverages = scoutingReport.coverages.map((c: ScoutingOption) => c.name.toLowerCase());
        return beatersList.some((beater: string) => availableCoverages.includes(beater));
      } else if (!isPassPlay && play.front_beaters) {
        const beatersList = play.front_beaters.split(',').map((f: string) => f.trim().toLowerCase());
        const availableFronts = scoutingReport.fronts.map((f: ScoutingOption) => f.name.toLowerCase());
        return beatersList.some((beater: string) => availableFronts.includes(beater));
      }
      
      // If no beaters specified, include the play
      return true;
    });

    // Log available plays after defensive filtering
    console.log('Available plays after defensive filtering:', {
      run_game: availableMasterPlays.filter(p => p.category === 'run_game').length,
      rpo_game: availableMasterPlays.filter(p => p.category === 'rpo_game').length,
      quick_game: availableMasterPlays.filter(p => p.category === 'quick_game').length,
      dropback_game: availableMasterPlays.filter(p => p.category === 'dropback_game').length,
      shot_plays: availableMasterPlays.filter(p => p.category === 'shot_plays').length,
      screen_game: availableMasterPlays.filter(p => p.category === 'screen_game').length
    });

    // If we don't have enough plays with matching terminology, log a warning
    if (availableMasterPlays.length < TARGET_PLAYS.run_game) {
      console.warn(`Warning: Only ${availableMasterPlays.length} plays found with matching terminology out of ${allMasterPlays.length} total plays`);
    }

    // Target number of plays to select (15 minus the number of locked plays for each category)
    const lockedRunPlays = lockedPlays?.filter(play => play.category === 'run_game') || [];
    const lockedRpoPlays = lockedPlays?.filter(play => play.category === 'rpo_game') || [];
    const lockedQuickPlays = lockedPlays?.filter(play => play.category === 'quick_game') || [];
    const lockedDropbackPlays = lockedPlays?.filter(play => play.category === 'dropback_game') || [];
    const lockedShotPlays = lockedPlays?.filter(play => play.category === 'shot_plays') || [];
    const lockedScreenPlays = lockedPlays?.filter(play => play.category === 'screen_game') || [];
    
    const runPlaysToSelect = Math.max(0, TARGET_PLAYS.run_game - lockedRunPlays.length);
    const rpoPlaysToSelect = Math.max(5, TARGET_PLAYS.rpo_game - lockedRpoPlays.length);
    const quickPlaysToSelect = Math.max(0, TARGET_PLAYS.quick_game - lockedQuickPlays.length);
    const dropbackPlaysToSelect = Math.max(0, TARGET_PLAYS.dropback_game - lockedDropbackPlays.length);
    const shotPlaysToSelect = Math.max(0, TARGET_PLAYS.shot_plays - lockedShotPlays.length);
    const screenPlaysToSelect = Math.max(0, TARGET_PLAYS.screen_game - lockedScreenPlays.length);

    // Separate available plays by category
    const availableRunPlays = availableMasterPlays.filter(play => play.category === 'run_game');
    const availableRpoPlays = availableMasterPlays.filter(play => play.category === 'rpo_game');
    const availableQuickPlays = availableMasterPlays.filter(play => play.category === 'quick_game');
    const availableDropbackPlays = availableMasterPlays.filter(play => play.category === 'dropback_game');
    const availableShotPlays = availableMasterPlays.filter(play => play.category === 'shot_plays');
    const availableScreenPlays = availableMasterPlays.filter(play => play.category === 'screen_game');

    console.log('Screen plays available for selection:', availableScreenPlays.length);

    // Select plays based on defensive tendencies
    let selectedRunPlays: any[] = [];
    let selectedRpoPlays: any[] = [];
    let selectedQuickPlays: any[] = [];
    let selectedDropbackPlays: any[] = [];
    let selectedShotPlays: any[] = [];
    let selectedScreenPlays: any[] = [];
    const selectedPlayIds = new Set<string>();

    const selectPlaysForCategory = (
      playsToSelect: number,
      availablePlays: any[],
      category: string,
      selectedPlaysArray: any[]
    ) => {
      const isPassPlay = isPassPlayCategory(category);
      const defensePercentages = isPassPlay ? coveragePercentages : frontPercentages;
      
      // Special handling for RPO plays to ensure minimum of 5
      const minimumPlays = category === 'rpo_game' ? 5 : playsToSelect;
      
      // Special handling for screen plays
      if (category === 'screen_game') {
        console.log('Selecting screen plays:', {
          playsToSelect,
          availablePlays: availablePlays.length,
          defensePercentages: defensePercentages.length
        });
      }

      for (const defenseItem of defensePercentages) {
        // Calculate how many plays we should select for this defense
        const playsForDefense = Math.round((defenseItem.percentage / 100) * playsToSelect);
        
        if (playsForDefense === 0) continue;

        // Find plays that beat this defense (excluding already selected plays)
        const defenseBeaters = availablePlays.filter(play => {
          if (selectedPlayIds.has(play.play_id)) return false;
          
          // For screen plays, be more lenient with coverage beaters
          if (play.category === 'screen_game') {
            return true; // Include all screen plays as potential options
          }
          
          const beatersList = isPassPlay
            ? (play.coverage_beaters ? play.coverage_beaters.split(',').map((c: string) => c.trim()) : [])
            : (play.front_beaters ? play.front_beaters.split(',').map((f: string) => f.trim()) : []);
          
          const defenseValue = isPassPlay ? (defenseItem as { coverage: string }).coverage : (defenseItem as { front: string }).front;
          return beatersList.includes(defenseValue);
        });

        // If we don't have enough defense beaters, also include some general plays
        const generalPlays = availablePlays.filter(play => 
          !selectedPlayIds.has(play.play_id) &&
          play.category === category
        );

        // For screen plays or RPO plays, combine all available plays
        const playsPool = category === 'screen_game' || category === 'rpo_game'
          ? Array.from(new Set([...defenseBeaters, ...generalPlays]))
          : defenseBeaters;

        // Randomly select plays
        let playsToAdd: any[] = [];
        
        if (playsPool.length > 0) {
          const targetCount = category === 'screen_game' || category === 'rpo_game'
            ? playsForDefense  // For screen plays and RPO plays, just take what we need
            : Math.ceil(playsForDefense * 0.7); // For other plays, use 70% defense beaters

          // Randomly select plays
          for (let i = 0; i < targetCount && playsPool.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * playsPool.length);
            const selectedPlay = playsPool.splice(randomIndex, 1)[0];
            if (selectedPlay && !selectedPlayIds.has(selectedPlay.play_id)) {
              playsToAdd.push(selectedPlay);
              selectedPlayIds.add(selectedPlay.play_id);
            }
          }

          // For non-screen plays and non-RPO plays, add some general plays to reach the target
          if (category !== 'screen_game' && category !== 'rpo_game' && generalPlays.length > 0) {
            const remainingCount = playsForDefense - playsToAdd.length;
            for (let i = 0; i < remainingCount && generalPlays.length > 0; i++) {
              const randomIndex = Math.floor(Math.random() * generalPlays.length);
              const selectedPlay = generalPlays.splice(randomIndex, 1)[0];
              if (selectedPlay && !selectedPlayIds.has(selectedPlay.play_id)) {
                playsToAdd.push(selectedPlay);
                selectedPlayIds.add(selectedPlay.play_id);
              }
            }
          }
        }

        // Add selected plays to our final list
        selectedPlaysArray.push(...playsToAdd);
      }

      // Ensure we have enough plays by adding any remaining available plays if needed
      if (selectedPlaysArray.length < minimumPlays) {
        const remainingPlays = minimumPlays - selectedPlaysArray.length;
        const remainingAvailablePlays = availablePlays.filter(play => 
          !selectedPlayIds.has(play.play_id) &&
          play.category === category
        );

        // Log for screen plays
        if (category === 'screen_game') {
          console.log('Filling remaining screen plays:', {
            needed: remainingPlays,
            available: remainingAvailablePlays.length
          });
        }

        // For RPO plays, log the count
        if (category === 'rpo_game') {
          console.log('Filling remaining RPO plays:', {
            currentCount: selectedPlaysArray.length,
            needed: remainingPlays,
            available: remainingAvailablePlays.length,
            minimumRequired: minimumPlays
          });
        }

        for (let i = 0; i < remainingPlays && remainingAvailablePlays.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * remainingAvailablePlays.length);
          const selectedPlay = remainingAvailablePlays.splice(randomIndex, 1)[0];
          if (selectedPlay) {
            selectedPlaysArray.push(selectedPlay);
            selectedPlayIds.add(selectedPlay.play_id);
          }
        }

        // If we still don't have enough RPO plays, create duplicates from existing ones
        if (category === 'rpo_game' && selectedPlaysArray.length < minimumPlays) {
          const playsStillNeeded = minimumPlays - selectedPlaysArray.length;
          const existingPlays = [...selectedPlaysArray];
          
          for (let i = 0; i < playsStillNeeded && existingPlays.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * existingPlays.length);
            const playToDuplicate = existingPlays[randomIndex];
            if (playToDuplicate) {
              const duplicatedPlay = {
                ...playToDuplicate,
                play_id: `${playToDuplicate.play_id}_duplicate_${i}`,
                notes: `${playToDuplicate.notes} (Duplicate to meet minimum RPO requirement)`
              };
              selectedPlaysArray.push(duplicatedPlay);
              selectedPlayIds.add(duplicatedPlay.play_id);
            }
          }
        }
      }
    };

    // Select plays for all categories
    selectPlaysForCategory(runPlaysToSelect, availableRunPlays, 'run_game', selectedRunPlays);
    selectPlaysForCategory(rpoPlaysToSelect, availableRpoPlays, 'rpo_game', selectedRpoPlays);
    selectPlaysForCategory(quickPlaysToSelect, availableQuickPlays, 'quick_game', selectedQuickPlays);
    selectPlaysForCategory(dropbackPlaysToSelect, availableDropbackPlays, 'dropback_game', selectedDropbackPlays);
    selectPlaysForCategory(shotPlaysToSelect, availableShotPlays, 'shot_plays', selectedShotPlays);
    selectPlaysForCategory(screenPlaysToSelect, availableScreenPlays, 'screen_game', selectedScreenPlays);

    console.log('Final screen plays selected:', selectedScreenPlays.length);

    // Combine all selected plays
    const selectedPlays = [
      ...selectedRunPlays,
      ...selectedRpoPlays,
      ...selectedQuickPlays,
      ...selectedDropbackPlays,
      ...selectedShotPlays,
      ...selectedScreenPlays
    ];

    // Calculate how many plays should have motion
    const totalSelectedPlays = selectedPlays.length;
    const targetMotionPlays = Math.round((scoutingReport.motion_percentage / 100) * totalSelectedPlays);
    
    // Sort plays by whether they have motion components and priority
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
        // Use the play's category to influence motion probability
        const categoryMotionPriority = play.category === 'run_game' ? 0.7 : 0.3; // Favor motion in run plays
        shouldShowMotion = Math.random() > (hideMotionProbability * categoryMotionPriority);
      }

      return {
        ...play,
        shouldShowMotion
      };
    });

    // Verify we have plays for each category
    const finalPlaysByCategory = {
      run_game: finalPlays.filter(p => p.category === 'run_game').length,
      rpo_game: finalPlays.filter(p => p.category === 'rpo_game').length,
      quick_game: finalPlays.filter(p => p.category === 'quick_game').length,
      dropback_game: finalPlays.filter(p => p.category === 'dropback_game').length,
      shot_plays: finalPlays.filter(p => p.category === 'shot_plays').length,
      screen_game: finalPlays.filter(p => p.category === 'screen_game').length
    };

    console.log('Final plays by category:', finalPlaysByCategory);
    console.log('Motion percentage target:', scoutingReport.motion_percentage);
    console.log('Actual motion plays:', finalPlays.filter(p => p.shouldShowMotion).length);
    console.log('Total plays:', finalPlays.length);

    // Format complete play strings with motion control
    const formattedPlays = finalPlays.map(play => formatCompletePlay(play, play.shouldShowMotion));

    // Prepare plays for insertion into team's play pool
    const playsToInsert = finalPlays.map(play => {
      const isPassPlay = isPassPlayCategory(play.category);
      
      // Format beaters with percentages based on play type
      let formattedBeaters = '';
      if (isPassPlay) {
        // For pass plays, ensure we have at least one coverage beater
        formattedBeaters = play.coverage_beaters ? 
          formatCoverageBeaters(play.coverage_beaters, coveragePercentages) : 
          coveragePercentages[0]?.coverage || ''; // Use most common coverage as default beater
      } else {
        // For run plays, ensure we have at least one front beater
        formattedBeaters = play.front_beaters ? 
          formatFrontBeaters(play.front_beaters, frontPercentages) : 
          frontPercentages[0]?.front || ''; // Use most common front as default beater
      }
      
      // Get team concept from terminology map
      const teamConcept = play.concept ? terminologyMap.get(play.concept.toLowerCase()) || play.concept : play.concept;
      
      return {
        team_id: teamId,
        opponent_id: opponentId,
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
        front_beaters: !isPassPlay ? formattedBeaters : play.front_beaters,
        coverage_beaters: isPassPlay ? formattedBeaters : play.coverage_beaters,
        blitz_beaters: play.blitz_beaters,
        concept_direction: play.concept_direction,
        notes: `Selected based on ${isPassPlay ? 'defensive coverages' : 'defensive fronts'}: ${
          isPassPlay 
            ? coveragePercentages.map(cp => cp.coverage).join(', ')
            : frontPercentages.map(fp => fp.front).join(', ')
        }`,
        is_enabled: true,
        is_locked: false,
        is_favorite: false
      };
    });

    // Delete any existing non-locked plays for this team AND opponent
    const { error: deleteError } = await supabase
      .from('playpool')
      .delete()
      .eq('team_id', teamId)
      .eq('opponent_id', opponentId)
      .in('category', ['run_game', 'rpo_game', 'quick_game', 'dropback_game', 'shot_plays', 'screen_game'])
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
        `- Kept ${lockedPlays?.length || 0} locked plays for opponent ${opponentId}\n` +
        `- Selected plays based on:\n` +
        `  * ${scoutingReport.fronts.length} defensive fronts\n` +
        `  * ${scoutingReport.coverages.length} coverages\n` +
        `  * ${frontPercentages.length} front percentages\n` +
        `  * ${coveragePercentages.length} coverage percentages\n` +
        `- Motion percentage: ${scoutingReport.motion_percentage}%\n` +
        `- Available plays after filtering: ${availableMasterPlays.length}`
    };

  } catch (error) {
    console.error('Error in analyzeAndUpdatePlays:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      type: typeof error
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
} 