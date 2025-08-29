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
  
  // Comment out front beaters debug
  // console.log('Front beaters debug:', {
  //   original: frontBeaters,
  //   normalized: beatersList.map(normalizeName),
  //   availableFronts: frontPercentages.map(fp => fp.front),
  //   normalizedFronts: frontPercentages.map(fp => normalizeName(fp.front))
  // });

  const relevantFrontBeaters = beatersList.filter(front => 
    frontPercentages.some(fp => normalizeName(fp.front) === normalizeName(front))
  );
  
  return relevantFrontBeaters.join(', ');
}

// Helper function to format coverage beaters with percentages
function formatCoverageBeaters(coverageBeaters: string, coveragePercentages: { coverage: string; percentage: number }[]): string {
  if (!coverageBeaters) return '';
  
  const beatersList = coverageBeaters.split(',').map(c => c.trim());
  const relevantCoverageBeaters = beatersList.filter(coverage => 
    coveragePercentages.some(cp => normalizeName(cp.coverage) === normalizeName(coverage))
  );
  
  return relevantCoverageBeaters.join(', ');
}

// Helper function to determine if a play has motion components
function hasMotionComponents(play: any): boolean {
  return Boolean(play.shifts || play.to_motions || play.from_motions);
}

// Helper function to determine if a category is a pass play category
function isPassPlayCategory(category: string): boolean {
  // RPO plays are treated like run plays since they beat fronts, not coverages
  return ['quick_game', 'dropback_game', 'shot_plays', 'screen_game', 'moving_pocket'].includes(category);
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

    // Fetch default team's terminology (contains default labels like "Deuce +")
    const defaultTeamId = '8feef3dc-942f-4bc5-b526-0b39e14cb683'
    const { data: defaultTerminology, error: defaultError } = await supabase
      .from('terminology')
      .select('concept, label, category')
      .eq('team_id', defaultTeamId);

    if (defaultError) {
      throw new Error(`Failed to fetch default team terminology: ${defaultError.message}`);
    }

    // Fetch user team's terminology (contains user's custom labels like "Ace T +")
    const { data: teamTerminology, error: terminologyError } = await supabase
      .from('terminology')
      .select('concept, label, category')
      .eq('team_id', teamId);

    if (terminologyError) {
      throw new Error(`Failed to fetch team terminology: ${terminologyError.message}`);
    }

    // Comment out noisy terminology logs
    // console.log('Terminology by category:', terminologyByCategory);
    
    // Build global terminology mapping
    const terminologyMap = new Map<string, string>();
    defaultTerminology?.forEach((defaultTerm: Terminology) => {
      if (!defaultTerm.concept || !defaultTerm.label) return
      
      // Find the user's terminology for the same concept
      const userTerm = teamTerminology?.find(userTerm => 
        userTerm.concept === defaultTerm.concept && 
        userTerm.category === defaultTerm.category
      )
      
      if (userTerm && userTerm.label) {
        // Map: default team label → user team label
        terminologyMap.set(defaultTerm.label.toLowerCase(), userTerm.label);
        // console.log(`Global terminology mapping: ${defaultTerm.category} | "${defaultTerm.label}" → "${userTerm.label}"`)
      }
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
      .in('category', ['run_game', 'rpo_game', 'quick_game', 'dropback_game', 'shot_plays', 'screen_game', 'moving_pocket']);

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
        screen_game: allMasterPlays.filter(p => p.category === 'screen_game').length,
        moving_pocket: allMasterPlays.filter(p => p.category === 'moving_pocket').length
      }
    });

    // Debug: Log all run game plays from master pool
    const allRunPlays = allMasterPlays.filter(p => p.category === 'run_game');
    console.log('\n=== ALL RUN GAME PLAYS FROM MASTER POOL ===');
    allRunPlays.forEach(play => {
      console.log({
        play_id: play.play_id,
        concept: play.concept,
        front_beaters: play.front_beaters,
        has_front_beaters: !!play.front_beaters
      });
    });
    console.log(`Total run game plays in master pool: ${allRunPlays.length}`);
    console.log('=== END RUN GAME PLAYS LIST ===\n');

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

    // Add prominent moving pocket analysis
    console.log('\n🎯 MOVING POCKET ANALYSIS 🎯');
    console.log('----------------------------------------');
    
    // Debug: Log all moving pocket plays from master pool
    const allMovingPocketPlays = allMasterPlays.filter(p => p.category === 'moving_pocket');
    console.log('Initial Moving Pocket Plays:', {
      count: allMovingPocketPlays.length,
      plays: allMovingPocketPlays.map(play => ({
        play_id: play.play_id,
        concept: play.concept,
        formations: play.formations,
        coverage_beaters: play.coverage_beaters
      }))
    });

    // After terminology mapping, check moving pocket plays again
    const movingPocketAfterTerminology = availableMasterPlays.filter(p => p.category === 'moving_pocket');
    console.log('\nMoving Pocket Plays After Terminology:', {
      count: movingPocketAfterTerminology.length,
      plays: movingPocketAfterTerminology.map(play => ({
        play_id: play.play_id,
        concept: play.concept,
        formations: play.formations,
        coverage_beaters: play.coverage_beaters
      }))
    });

    // Log available plays by category before defensive filtering
    console.log('Available plays before defensive filtering:', {
      run_game: availableMasterPlays.filter(p => p.category === 'run_game').length,
      rpo_game: availableMasterPlays.filter(p => p.category === 'rpo_game').length,
      quick_game: availableMasterPlays.filter(p => p.category === 'quick_game').length,
      dropback_game: availableMasterPlays.filter(p => p.category === 'dropback_game').length,
      shot_plays: availableMasterPlays.filter(p => p.category === 'shot_plays').length,
      screen_game: availableMasterPlays.filter(p => p.category === 'screen_game').length,
      moving_pocket: availableMasterPlays.filter(p => p.category === 'moving_pocket').length
    });

    // Debug: Log run game plays after terminology filtering
    const runPlaysAfterTerminology = availableMasterPlays.filter(p => p.category === 'run_game');
    console.log('\n=== RUN GAME PLAYS AFTER TERMINOLOGY FILTERING ===');
    console.log(`Run game plays remaining: ${runPlaysAfterTerminology.length}`);
    runPlaysAfterTerminology.forEach(play => {
      console.log({
        play_id: play.play_id,
        concept: play.concept,
        front_beaters: play.front_beaters
      });
    });
    console.log('=== END RUN GAME PLAYS AFTER TERMINOLOGY ===\n');

    // Filter plays based on defensive matchups
    availableMasterPlays = availableMasterPlays.filter(play => {
      const isPassPlay = isPassPlayCategory(play.category);
      const isRunPlay = !isPassPlay && play.category !== 'rpo_game';
      const isRPO = play.category === 'rpo_game';
      const isMovingPocket = play.category === 'moving_pocket';
      
      // Temporarily treat moving pocket plays like regular pass plays
      if (isMovingPocket) {
        // If no coverage beaters, include the play anyway for now
        if (!play.coverage_beaters) {
          return true; // Include plays without coverage beaters for debugging
        }
        
        const beatersList = play.coverage_beaters.split(',').map((c: string) => c.trim());
        const availableCoverages = scoutingReport.coverages.map((c: any) => c.name);
        
        for (const beater of beatersList) {
          for (const availableCoverage of availableCoverages) {
            if (normalizeName(beater) === normalizeName(availableCoverage)) {
              return true;
            }
          }
        }
        
        // If no coverage matches found, still include for debugging
        return true;
      }

      // Rest of the existing filtering logic for other play types
      if (isPassPlay) {
        if (!play.coverage_beaters) {
          // console.log(`✗ Pass Play ${play.concept} EXCLUDED - no coverage_beaters specified`);
          return false;
        }
        
        const beatersList = play.coverage_beaters.split(',').map((c: string) => c.trim());
        const availableCoverages = scoutingReport.coverages.map((c: any) => c.name);
        
        // console.log('Pass Coverage check:', {
        //   coverage_beaters: beatersList,
        //   available_coverages: availableCoverages
        // });
        
        for (const beater of beatersList) {
          for (const availableCoverage of availableCoverages) {
            if (normalizeName(beater) === normalizeName(availableCoverage)) {
              // console.log(`✓ Pass Play ${play.concept} INCLUDED - matches coverage: "${beater}" === "${availableCoverage}" (normalized)`);
              return true;
            }
          }
        }
        
        // console.log(`✗ Pass Play ${play.concept} EXCLUDED - no matching coverage beaters`);
        return false;
      }

      // For RPO plays, check both front_beaters AND coverage_beaters
      if (isRPO) {
        let hasMatchingBeater = false;
        
        // Check front_beaters
        if (play.front_beaters) {
          const frontBeatersList = play.front_beaters.split(',').map((f: string) => f.trim());
          const availableFronts = scoutingReport.fronts.map((f: any) => f.name);
          
          for (const beater of frontBeatersList) {
            for (const availableFront of availableFronts) {
              if (normalizeName(beater) === normalizeName(availableFront)) {
                hasMatchingBeater = true;
                return true;
              }
            }
          }
        }

        // Check coverage_beaters
        if (play.coverage_beaters) {
          const coverageBeatersList = play.coverage_beaters.split(',').map((c: string) => c.trim());
          const availableCoverages = scoutingReport.coverages.map((c: any) => c.name);
          
          for (const beater of coverageBeatersList) {
            for (const availableCoverage of availableCoverages) {
              if (normalizeName(beater) === normalizeName(availableCoverage)) {
                hasMatchingBeater = true;
                return true;
              }
            }
          }
        }

        return false;
      }
      
      // For run plays, check front_beaters
      if (isRunPlay) {
        // console.log(`🏃 ANALYZING RUN PLAY: ${play.concept} (category: ${play.category})`);
        // console.log('Run play details:', {
        //   play_id: play.play_id,
        //   concept: play.concept,
        //   category: play.category,
        //   front_beaters: play.front_beaters,
        //   has_front_beaters: !!play.front_beaters
        // });
        
        if (!play.front_beaters) {
          // console.log(`⚠️  Run Play ${play.concept} has no front_beaters - including anyway to debug`);
          // For now, include run plays without front_beaters to help debug the issue
          return true;
        }
        
        const beatersList = play.front_beaters.split(',').map((f: string) => f.trim());
        const availableFronts = scoutingReport.fronts.map((f: any) => f.name);
        
        // console.log('Run Front check:', {
        //   play_concept: play.concept,
        //   front_beaters: beatersList,
        //   available_fronts: availableFronts
        // });
        
        // Use case-insensitive matching for fronts
        for (const beater of beatersList) {
          for (const availableFront of availableFronts) {
            if (normalizeName(beater) === normalizeName(availableFront)) {
              // console.log(`✓ Run Play ${play.concept} INCLUDED - matches front: "${beater}" === "${availableFront}" (normalized)`);
              return true;
            }
          }
        }
        
        // console.log(`✗ Run Play ${play.concept} EXCLUDED - no matching front beaters`);
        // console.log('  Available fronts:', availableFronts);
        // console.log('  Available fronts (normalized):', availableFronts.map(normalizeName));
        // console.log('  Play front beaters:', beatersList);
        // console.log('  Play front beaters (normalized):', beatersList.map(normalizeName));
        return false;
      }
      
      // Should not reach here, but exclude by default
      // console.log(`✗ Play ${play.concept} EXCLUDED - unknown category or no valid beaters`);
      return false;
    });

    // After defensive filtering, check moving pocket plays one final time
    const finalMovingPocketPlays = availableMasterPlays.filter(p => p.category === 'moving_pocket');
    console.log('\nFinal Moving Pocket Plays:', {
      count: finalMovingPocketPlays.length,
      plays: finalMovingPocketPlays.map(play => ({
        play_id: play.play_id,
        concept: play.concept,
        formations: play.formations,
        coverage_beaters: play.coverage_beaters
      }))
    });
    console.log('----------------------------------------\n');

    // Log available plays after defensive filtering
    console.log('Available plays after defensive filtering:', {
      run_game: availableMasterPlays.filter(p => p.category === 'run_game').length,
      rpo_game: availableMasterPlays.filter(p => p.category === 'rpo_game').length,
      quick_game: availableMasterPlays.filter(p => p.category === 'quick_game').length,
      dropback_game: availableMasterPlays.filter(p => p.category === 'dropback_game').length,
      shot_plays: availableMasterPlays.filter(p => p.category === 'shot_plays').length,
      screen_game: availableMasterPlays.filter(p => p.category === 'screen_game').length,
      moving_pocket: availableMasterPlays.filter(p => p.category === 'moving_pocket').length
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
    let selectedMovingPocketPlays: any[] = [];
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
        // console.log('Selecting screen plays:', {
        //   playsToSelect,
        //   availablePlays: availablePlays.length,
        //   defensePercentages: defensePercentages.length
        // });
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
          // console.log('Filling remaining screen plays:', {
          //   needed: remainingPlays,
          //   available: remainingAvailablePlays.length
          // });
        }

        // For RPO plays, log the count
        if (category === 'rpo_game') {
          // console.log('Filling remaining RPO plays:', {
          //   currentCount: selectedPlaysArray.length,
          //   needed: remainingPlays,
          //   available: remainingAvailablePlays.length,
          //   minimumRequired: minimumPlays
          // });
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

    // Select moving pocket plays
    const availableMovingPocketPlays = availableMasterPlays.filter(p => p.category === 'moving_pocket');
    selectedMovingPocketPlays.push(...availableMovingPocketPlays);

    console.log('Final screen plays selected:', selectedScreenPlays.length);
    console.log('Final moving pocket plays selected:', selectedMovingPocketPlays.length);

    // Combine all selected plays
    const selectedPlays = [
      ...selectedRunPlays,
      ...selectedRpoPlays,
      ...selectedQuickPlays,
      ...selectedDropbackPlays,
      ...selectedShotPlays,
      ...selectedScreenPlays,
      ...selectedMovingPocketPlays
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
      
      // Create terminology maps by category for translation
      const terminologyMaps = {
        formations: new Map<string, string>(),
        form_tags: new Map<string, string>(),
        shifts: new Map<string, string>(),
        to_motions: new Map<string, string>(),
        from_motions: new Map<string, string>(),
        pass_protections: new Map<string, string>(),
        concept_tags: new Map<string, string>(),
        rpo_tag: new Map<string, string>(),
        run_game: new Map<string, string>(),
        quick_game: new Map<string, string>(),
        dropback_game: new Map<string, string>(),
        shot_plays: new Map<string, string>(),
        screen_game: new Map<string, string>()
      }

      // Populate the category-specific maps using default team labels → user team labels
      defaultTerminology?.forEach(defaultTerm => {
        if (!defaultTerm.concept || !defaultTerm.label) return
        
        const category = defaultTerm.category as keyof typeof terminologyMaps
        if (terminologyMaps[category]) {
          // Find the user's terminology for the same concept
          const userTerm = teamTerminology?.find(userTerm => 
            userTerm.concept === defaultTerm.concept && 
            userTerm.category === defaultTerm.category
          )
          
          if (userTerm && userTerm.label) {
            // Map: default team label → user team label
            terminologyMaps[category].set(defaultTerm.label.toLowerCase(), userTerm.label)
            // console.log(`Added terminology mapping: ${defaultTerm.category} | "${defaultTerm.label}" → "${userTerm.label}"`)
          }
        } else {
          // console.log(`Skipped terminology for unknown category: ${defaultTerm.category}`)
        }
      })

      // Debug: Show all terminology maps
      // console.log('Final terminology maps:', {
      //   formations: Array.from(terminologyMaps.formations.entries()),
      //   form_tags: Array.from(terminologyMaps.form_tags.entries()),
      //   pass_protections: Array.from(terminologyMaps.pass_protections.entries()),
      //   concept_tags: Array.from(terminologyMaps.concept_tags.entries()),
      //   rpo_tag: Array.from(terminologyMaps.rpo_tag.entries()),
      //   run_game: Array.from(terminologyMaps.run_game.entries()),
      //   quick_game: Array.from(terminologyMaps.quick_game.entries()),
      //   dropback_game: Array.from(terminologyMaps.dropback_game.entries()),
      //   shot_plays: Array.from(terminologyMaps.shot_plays.entries()),
      //   screen_game: Array.from(terminologyMaps.screen_game.entries())
      // })

      // Helper function to translate terminology
      const translateField = (value: string | null, map: Map<string, string>): string | null => {
        if (!value) return value
        const lowerValue = value.toLowerCase()
        const translated = map.get(lowerValue)
        
        // Debug logging for failed translations
        if (!translated && map.size > 0) {
          // console.log(`🔍 Translation MISS for "${value}":`, {
          //   lowercase: lowerValue,
          //   available_keys: Array.from(map.keys()).slice(0, 5), // First 5 keys
          //   map_size: map.size
          // })
          
          // Special debug for formations to see what concepts are actually used
          // if (map === terminologyMaps.formations) {
          //   console.log(`🔧 Formations debug - Need to map concept "${value}" to your terminology`)
          // }
        }
        
        return translated || value
      }

      // Get team translations for all terminology fields
      // Special case: RPO games use run_game terminology for concepts since they're run plays with RPO tags
      const conceptMap = play.category === 'rpo_game' 
        ? terminologyMaps.run_game 
        : terminologyMaps[play.category as keyof typeof terminologyMaps] || new Map();
      const teamConcept = translateField(play.concept, conceptMap);
      const teamFormations = translateField(play.formations, terminologyMaps.formations);
      const teamTags = translateField(play.tags, terminologyMaps.form_tags);
      const teamShifts = translateField(play.shifts, terminologyMaps.shifts);
      const teamToMotions = translateField(play.to_motions, terminologyMaps.to_motions);
      const teamFromMotions = translateField(play.from_motions, terminologyMaps.from_motions);
      const teamPassProtections = translateField(play.pass_protections, terminologyMaps.pass_protections);
      const teamConceptTag = translateField(play.concept_tag, terminologyMaps.concept_tags);
      const teamRpoTag = translateField(play.rpo_tag, terminologyMaps.rpo_tag);

      // Special debug for screen game plays
      if (play.category === 'screen_game') {
        // console.log(`🎬 Screen game debug for play ${play.play_id}:`, {
        //   original_concept: play.concept,
        //   original_concept_lowercase: play.concept?.toLowerCase(),
        //   translated_concept: teamConcept,
        //   category: play.category,
        //   screen_map_size: terminologyMaps.screen_game.size,
        //   screen_map_has_key: terminologyMaps.screen_game.has(play.concept?.toLowerCase() || ''),
        //   screen_map_entries: Array.from(terminologyMaps.screen_game.entries())
        // });
      }

      // Special debug for RPO game plays
      if (play.category === 'rpo_game') {
        // console.log(`🏈 RPO game debug for play ${play.play_id}:`, {
        //   original_concept: play.concept,
        //   translated_concept: teamConcept,
        //   original_rpo_tag: play.rpo_tag,
        //   translated_rpo_tag: teamRpoTag,
        //   category: play.category,
        //   using_run_game_map: true,
        //   run_game_map_size: terminologyMaps.run_game.size,
        //   rpo_tag_map_size: terminologyMaps.rpo_tag.size
        // });
      }

      // Debug logging for terminology translation
      // console.log('Terminology translation debug for play:', play.play_id, {
      //   original: {
      //     formations: play.formations,
      //     tags: play.tags,
      //     pass_protections: play.pass_protections,
      //     concept_tag: play.concept_tag,
      //     rpo_tag: play.rpo_tag,
      //     concept: play.concept,
      //     category: play.category
      //   },
      //   translated: {
      //     formations: teamFormations,
      //     tags: teamTags,
      //     pass_protections: teamPassProtections,
      //     concept_tag: teamConceptTag,
      //     rpo_tag: teamRpoTag,
      //     concept: teamConcept
      //   },
      //   terminology_maps_sizes: {
      //     formations: terminologyMaps.formations.size,
      //     form_tags: terminologyMaps.form_tags.size,
      //     pass_protections: terminologyMaps.pass_protections.size,
      //     concept_tags: terminologyMaps.concept_tags.size,
      //     rpo_tag: terminologyMaps.rpo_tag.size
      //   }
      // });
      
      return {
        team_id: teamId,
        opponent_id: opponentId,
        play_id: play.play_id,
        shifts: play.shouldShowMotion ? teamShifts : null,
        to_motions: play.shouldShowMotion ? teamToMotions : null,
        formations: teamFormations,
        tags: teamTags,
        from_motions: play.shouldShowMotion ? teamFromMotions : null,
        pass_protections: teamPassProtections,
        concept: teamConcept,
        combined_call: formatCompletePlay({
          ...play, 
          concept: teamConcept,
          formations: teamFormations,
          tags: teamTags,
          shifts: teamShifts,
          to_motions: teamToMotions,
          from_motions: teamFromMotions,
          pass_protections: teamPassProtections,
          concept_tag: teamConceptTag,
          rpo_tag: teamRpoTag
        }, play.shouldShowMotion),
        concept_tag: teamConceptTag,
        rpo_tag: teamRpoTag,
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