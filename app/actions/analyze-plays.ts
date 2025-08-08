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
  motion_percentage: number;
  notes: string;
  keep_locked_plays: boolean;
  play_counts?: {
    run_game: number;
    rpo_game: number;
    quick_game: number;
    dropback_game: number;
    shot_plays: number;
    screen_game: number;
  };
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
  // Keep special characters like + and - but remove spaces and make lowercase
  return name.toLowerCase().replace(/\s+/g, '');
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
  // RPO plays are treated like run plays since they beat fronts, not coverages
  return ['quick_game', 'dropback_game', 'shot_plays', 'screen_game'].includes(category);
}

function isRunBasedCategory(category: string): boolean {
  // RPO plays and run plays both beat fronts
  return ['run_game', 'rpo_game'].includes(category);
}

export async function analyzeAndUpdatePlays(scoutingReport: ScoutingReport): Promise<AnalyzePlayResponse> {
  try {
    console.log('🚀 STARTING PLAYPOOL ANALYSIS');
    console.log('Received scouting report:', {
      team_id: scoutingReport.team_id,
      opponent_id: scoutingReport.opponent_id,
      fronts_count: scoutingReport.fronts?.length || 0,
      fronts_names: scoutingReport.fronts?.map(f => f.name) || [],
      coverages_count: scoutingReport.coverages?.length || 0,
      coverages_names: scoutingReport.coverages?.map(c => c.name) || []
    });
    
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

    // No longer using play count limits - we'll return all viable plays

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
    console.log('🔍 Querying master play pool...');
    const { data: allMasterPlays, error: queryError } = await supabase
      .from('master_play_pool')
      .select('*')
      .in('category', ['run_game', 'rpo_game', 'quick_game', 'dropback_game', 'shot_plays', 'screen_game']);

    if (queryError) {
      console.error('❌ Master play pool query error:', queryError);
      throw new Error(`Failed to query master plays: ${queryError.message}`);
    }

    if (!allMasterPlays) {
      console.error('❌ No plays found in master play pool');
      throw new Error('No plays found in master play pool');
    }

    console.log('✅ Master play pool query successful:', {
      total_plays: allMasterPlays.length,
      by_category: {
        run_game: allMasterPlays.filter(p => p.category === 'run_game').length,
        rpo_game: allMasterPlays.filter(p => p.category === 'rpo_game').length,
        quick_game: allMasterPlays.filter(p => p.category === 'quick_game').length,
        dropback_game: allMasterPlays.filter(p => p.category === 'dropback_game').length,
        shot_plays: allMasterPlays.filter(p => p.category === 'shot_plays').length,
        screen_game: allMasterPlays.filter(p => p.category === 'screen_game').length
      }
    });

    // Log all RPO plays before any filtering
    const allRpoPlays = allMasterPlays.filter(p => p.category === 'rpo_game');
    console.log('\n=== ALL RPO PLAYS BEFORE FILTERING ===');
    allRpoPlays.forEach(play => {
      console.log({
        play_id: play.play_id,
        concept: play.concept,
        front_beaters: play.front_beaters,
        coverage_beaters: play.coverage_beaters
      });
      
      // Special check for the user's specific play
      if (play.play_id === '263' || play.concept === 'IZ -') {
        console.log('🔍 FOUND USER\'S SPECIFIC PLAY IN MASTER LIST:', {
          play_id: play.play_id,
          concept: play.concept,
          category: play.category,
          front_beaters: play.front_beaters,
          has_front_beaters: !!play.front_beaters,
          front_beaters_includes_3_4_split_plus: play.front_beaters?.includes('3-4 Split +')
        });
      }
    });
    console.log(`Total RPO plays before filtering: ${allRpoPlays.length}`);
    console.log('=== END RPO PLAYS LIST ===\n');

    // Filter out any plays that are already locked
    const lockedPlayIds = new Set(lockedPlays?.map(play => play.play_id) || []);
    let availableMasterPlays = allMasterPlays.filter(play => !lockedPlayIds.has(play.play_id));

    // Log RPO plays after locked plays filtering
    const rpoPlaysAfterLocked = availableMasterPlays.filter(p => p.category === 'rpo_game');
    console.log('\n=== RPO PLAYS AFTER LOCKED FILTERING ===');
    console.log(`RPO plays remaining: ${rpoPlaysAfterLocked.length}`);
    console.log('Removed by locked filtering:', 
      allRpoPlays.filter(p => !rpoPlaysAfterLocked.some(rp => rp.play_id === p.play_id))
        .map(p => ({ play_id: p.play_id, concept: p.concept }))
    );

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
          concept_lowercase: play.concept.toLowerCase(),
          availableTerminology: Array.from(terminologyMap.keys())
        });
        
        // Special check for RPO plays
        if (play.category === 'rpo_game') {
          console.log('🔍 RPO PLAY FAILED TERMINOLOGY CHECK:', {
            play_id: play.play_id,
            concept: play.concept,
            concept_lowercase: play.concept.toLowerCase(),
            terminology_map_has_concept: terminologyMap.has(play.concept.toLowerCase()),
            all_terminology_keys: Array.from(terminologyMap.keys()),
            rpo_terminology: Array.from(terminologyMap.keys()).filter(key => 
              teamTerminology?.some(t => t.category === 'rpo_game' && t.concept.toLowerCase() === key)
            )
          });
        }
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
      const isPassPlay = isPassPlayCategory(play.category);
      const isRunPlay = !isPassPlay && play.category !== 'rpo_game';
      const isRPO = play.category === 'rpo_game';
      
      console.log(`\n--- Analyzing Play: ${play.concept} (${play.category}) ---`);
      console.log('Play details:', {
        play_id: play.play_id,
        concept: play.concept,
        category: play.category,
        front_beaters: play.front_beaters,
        coverage_beaters: play.coverage_beaters,
        isPassPlay,
        isRunPlay,
        isRPO
      });
      
      // For RPO plays, check both front_beaters AND coverage_beaters
      if (isRPO) {
        let hasMatchingBeater = false;
        
        // Special debugging for the specific play mentioned by user
        if (play.play_id === '263' || play.concept === 'IZ -') {
          console.log('\n🔍 DEBUGGING SPECIFIC RPO PLAY:', {
            play_id: play.play_id,
            concept: play.concept,
            front_beaters_raw: play.front_beaters,
            category: play.category
          });
        }
        
        // Check front_beaters
        if (play.front_beaters) {
          const frontBeatersList = play.front_beaters.split(',').map((f: string) => f.trim());
          const availableFronts = scoutingReport.fronts.map((f: any) => f.name);
          
          console.log('RPO Front check:', {
            play_concept: play.concept,
            front_beaters: frontBeatersList,
            available_fronts: availableFronts
          });
          
          // Special debugging for the specific play
          if (play.play_id === '263' || play.concept === 'IZ -') {
            console.log('🔍 DETAILED FRONT MATCHING for IZ -:', {
              front_beaters_list: frontBeatersList,
              available_fronts_list: availableFronts,
              looking_for: '3-4 Split +',
              found_in_beaters: frontBeatersList.includes('3-4 Split +'),
              found_in_available: availableFronts.includes('3-4 Split +')
            });
            
            // Check each beater individually
            frontBeatersList.forEach((beater: string, index: number) => {
              console.log(`  Beater ${index}: "${beater}" - Match found: ${availableFronts.includes(beater)}`);
            });
          }
          
          for (const beater of frontBeatersList) {
            if (availableFronts.includes(beater)) {
              console.log(`✓ RPO Play ${play.concept} INCLUDED - matches front: ${beater}`);
              hasMatchingBeater = true;
              return true;
            }
          }
        }

        // Check coverage_beaters
        if (play.coverage_beaters) {
          const coverageBeatersList = play.coverage_beaters.split(',').map((c: string) => c.trim());
          const availableCoverages = scoutingReport.coverages.map((c: any) => c.name);
          
          console.log('RPO Coverage check:', {
            coverage_beaters: coverageBeatersList,
            available_coverages: availableCoverages
          });
          
          for (const beater of coverageBeatersList) {
            if (availableCoverages.includes(beater)) {
              console.log(`✓ RPO Play ${play.concept} INCLUDED - matches coverage: ${beater}`);
              hasMatchingBeater = true;
              return true;
            }
          }
        }

        // If no beaters or no matches found
        if (!play.front_beaters && !play.coverage_beaters) {
          console.log(`✗ RPO Play ${play.concept} EXCLUDED - no beaters specified`);
        } else {
          console.log(`✗ RPO Play ${play.concept} EXCLUDED - no matching beaters`);
        }
        return false;
      }
      
      // For pass plays, check coverage_beaters
      if (isPassPlay) {
        if (!play.coverage_beaters) {
          console.log(`✗ Pass Play ${play.concept} EXCLUDED - no coverage_beaters specified`);
          return false;
        }
        
        const beatersList = play.coverage_beaters.split(',').map((c: string) => c.trim());
        const availableCoverages = scoutingReport.coverages.map((c: any) => c.name);
        
        console.log('Pass Coverage check:', {
          coverage_beaters: beatersList,
          available_coverages: availableCoverages
        });
        
        for (const beater of beatersList) {
          if (availableCoverages.includes(beater)) {
            console.log(`✓ Pass Play ${play.concept} INCLUDED - matches coverage: ${beater}`);
            return true;
          }
        }
        
        console.log(`✗ Pass Play ${play.concept} EXCLUDED - no matching coverage beaters`);
        return false;
      }
      
      // For run plays, check front_beaters
      if (isRunPlay) {
        if (!play.front_beaters) {
          console.log(`✗ Run Play ${play.concept} EXCLUDED - no front_beaters specified`);
          return false;
        }
        
        const beatersList = play.front_beaters.split(',').map((f: string) => f.trim());
        const availableFronts = scoutingReport.fronts.map((f: any) => f.name);
        
        console.log('Run Front check:', {
          front_beaters: beatersList,
          available_fronts: availableFronts
        });
        
        for (const beater of beatersList) {
          if (availableFronts.includes(beater)) {
            console.log(`✓ Run Play ${play.concept} INCLUDED - matches front: ${beater}`);
            return true;
          }
        }
        
        console.log(`✗ Run Play ${play.concept} EXCLUDED - no matching front beaters`);
        return false;
      }
      
      // Should not reach here, but exclude by default
      console.log(`✗ Play ${play.concept} EXCLUDED - unknown category or no valid beaters`);
      return false;
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

    // Log available plays with matching terminology
    console.log(`Found ${availableMasterPlays.length} plays with matching terminology out of ${allMasterPlays.length} total plays`);

    // Get currently locked plays by category
    const lockedRunPlays = lockedPlays?.filter(play => play.category === 'run_game') || [];
    const lockedRpoPlays = lockedPlays?.filter(play => play.category === 'rpo_game') || [];
    const lockedQuickPlays = lockedPlays?.filter(play => play.category === 'quick_game') || [];
    const lockedDropbackPlays = lockedPlays?.filter(play => play.category === 'dropback_game') || [];
    const lockedShotPlays = lockedPlays?.filter(play => play.category === 'shot_plays') || [];
    const lockedScreenPlays = lockedPlays?.filter(play => play.category === 'screen_game') || [];

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
    // Add all available plays for each category
    selectedRunPlays.push(...availableRunPlays);
    selectedRpoPlays.push(...availableRpoPlays);
    selectedQuickPlays.push(...availableQuickPlays);
    selectedDropbackPlays.push(...availableDropbackPlays);
    selectedShotPlays.push(...availableShotPlays);
    selectedScreenPlays.push(...availableScreenPlays);

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

    // Keep all motion components, no filtering
    const finalPlays = selectedPlays.map(play => ({
      ...play,
      shouldShowMotion: true // Always show motion if it exists
    }));

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