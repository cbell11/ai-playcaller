import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define section-specific requirements
const sectionRequirements: Record<string, string> = {
  twoMinuteDrill: `
- STRICTLY NO run_game or rpo_game plays allowed
- Majority focus on quick game and dropback game plays
- Only 1 or 2 shot plays allowed
- NO motions or shifts allowed
- Select plays that can be executed quickly
- Focus on sideline routes and clock management
- Quick-hitting pass concepts only`,
  twoPointPlays: `
- Must include exactly 1 run play and 3 quick game plays
- STRICTLY NO shot plays or deep passing concepts allowed
- Only use quick game, RPO, or run plays
- Maximum pass depth of 10 yards
- Select creative and distinct plays with high success potential
- Prioritize unique formations and concepts`,
  highRedZone: `
- STRICTLY NO shot plays allowed
- Focus on run game, quick game, dropback game, and screen game plays
- Target distribution: 30% run game, 30% quick game, 20% dropback game, 20% screen game
- Plays designed for 10-20 yard line
- Quick-hitting plays that can score or get first downs
- Include misdirection concepts`,
  lowRedZone: `
- STRICTLY NO shot plays or screen game plays allowed
- Focus heavily on run game and quick game plays
- Target distribution: 50% run game, 50% quick game
- Plays designed for 5-10 yard line
- Quick-hitting plays that can score
- Include power run concepts and quick passes`,
  goalline: `
- STRICTLY NO shot plays allowed
- Focus on power run plays and quick passes
- Plays designed for tight spaces and short yardage
- Include QB sneaks and power runs
- Quick-hitting pass plays under 10 yards
- High percentage plays only`,
  backedUp: `
- Conservative plays
- Focus on gaining some yards safely
- Avoid risky plays`,
  screens: `
- STRICTLY ONLY use plays from screen_game category
- NO plays from shot_plays, quick_game, dropback_game, or run_game categories
- Mix of RB, WR, and TE screens
- Include RPO screens if available
- Various formations and looks
- Focus on misdirection and deception`,
  playAction: `
- Must be set up by run game
- Mix of short and deep concepts
- Include bootlegs and rollouts`,
  deepShots: `
- Focus on vertical passing concepts
- Include play-action shots
- Multiple deep route combinations`,
  firstSecondCombos: `
- Pairs of plays that work together
- First down sets up second down
- Mix of run and pass combinations`,
  coverage0Beaters: `
- Quick-hitting plays
- Hot routes and sight adjustments
- Plays that beat all-out blitz`
};

export async function POST(req: Request) {
  try {
    const { playPool, sectionSizes, targetSection, selectedConcept } = await req.json();

    if (!playPool || !Array.isArray(playPool) || !targetSection) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

      const sectionCount = sectionSizes[targetSection] || 5;
    
    // Filter play pool for specific sections
    let filteredPlayPool = playPool;
    let categoryRequirements: Record<string, number> | null = null;

    if (targetSection === 'screens') {
      console.log('Processing screens section. Total plays received:', playPool.length);
      console.log('Sample plays received:', playPool.slice(0, 5).map(p => ({ name: p.name, category: p.category })));
      
      filteredPlayPool = playPool.filter(play => {
        console.log('Filtering screen play:', { name: play.name, category: play.category });
        const isScreenPlay = play.category === 'screen_game';
        if (!isScreenPlay) {
          console.log('Rejected non-screen play:', play.name, play.category);
        }
        return isScreenPlay;
      });

      console.log('Filtered screen plays:', filteredPlayPool.length);
      if (filteredPlayPool.length > 0) {
        console.log('Screen plays found:', filteredPlayPool.map(p => ({ name: p.name, category: p.category })));
      }

      if (filteredPlayPool.length === 0) {
        console.log('All plays by category:');
        const categoryCounts = playPool.reduce((acc, play) => {
          acc[play.category] = (acc[play.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(categoryCounts);
        return NextResponse.json({ error: 'No screen plays found in play pool' }, { status: 400 });
      }
    } else if (targetSection === 'thirdAndShort') {
      // Filter plays where third_s is true
      filteredPlayPool = playPool.filter(play => play.third_s === true);

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No plays found marked for third and short situations' }, { status: 400 });
      }

      // Randomly shuffle the filtered plays
      const shuffled = [...filteredPlayPool].sort(() => Math.random() - 0.5);
      
      // Take only the number of plays we need
      const selectedPlays = shuffled.slice(0, sectionSizes[targetSection] || 0);
      
      // Return the selected plays in the expected format
      return NextResponse.json({
        [targetSection]: selectedPlays.map(play => play.name)
      });
    } else if (targetSection === 'thirdAndMedium') {
      // Filter plays where third_m is true
      filteredPlayPool = playPool.filter(play => play.third_m === true);

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No plays found marked for third and medium situations' }, { status: 400 });
      }

      // Randomly shuffle the filtered plays
      const shuffled = [...filteredPlayPool].sort(() => Math.random() - 0.5);
      
      // Take only the number of plays we need
      const selectedPlays = shuffled.slice(0, sectionSizes[targetSection] || 0);
      
      // Return the selected plays in the expected format
      return NextResponse.json({
        [targetSection]: selectedPlays.map(play => play.name)
      });
    } else if (targetSection === 'thirdAndLong') {
      // Filter plays where third_l is true
      filteredPlayPool = playPool.filter(play => play.third_l === true);

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No plays found marked for third and long situations' }, { status: 400 });
      }

      // Randomly shuffle the filtered plays
      const shuffled = [...filteredPlayPool].sort(() => Math.random() - 0.5);
      
      // Take only the number of plays we need
      const selectedPlays = shuffled.slice(0, sectionSizes[targetSection] || 0);
      
      // Return the selected plays in the expected format
      return NextResponse.json({
        [targetSection]: selectedPlays.map(play => play.name)
      });
    } else if (targetSection === 'highRedZone' || targetSection === 'lowRedZone') {
      // Filter plays where rz is true
      filteredPlayPool = playPool.filter(play => play.rz === true);

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No plays found marked for red zone situations' }, { status: 400 });
      }

      // Randomly shuffle the filtered plays
      const shuffled = [...filteredPlayPool].sort(() => Math.random() - 0.5);
      
      // Take only the number of plays we need
      const selectedPlays = shuffled.slice(0, sectionSizes[targetSection] || 0);
      
      // Return the selected plays in the expected format
      return NextResponse.json({
        [targetSection]: selectedPlays.map(play => play.name)
      });
    } else if (targetSection === 'goalline') {
      // Filter plays where gl is true
      filteredPlayPool = playPool.filter(play => play.gl === true);

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No plays found marked for goalline situations' }, { status: 400 });
      }

      // Randomly shuffle the filtered plays
      const shuffled = [...filteredPlayPool].sort(() => Math.random() - 0.5);
      
      // Take only the number of plays we need
      const selectedPlays = shuffled.slice(0, sectionSizes[targetSection] || 0);
      
      // Return the selected plays in the expected format
      return NextResponse.json({
        [targetSection]: selectedPlays.map(play => play.name)
      });
    } else if (targetSection === 'twoMinuteDrill') {
      filteredPlayPool = playPool.filter(play => {
        return !['run_game', 'rpo_game'].includes(play.category);
      });

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No valid plays found for two minute drill after filtering' }, { status: 400 });
      }
    }

    // Log if we have fewer plays than requested, but don't throw an error
    if (filteredPlayPool.length < sectionCount) {
      console.log(`Warning: Only ${filteredPlayPool.length} valid plays available for ${targetSection} (requested ${sectionCount})`);
    }
    
    // Build the prompt with section-specific requirements
    const baseRequirements = sectionRequirements[targetSection] || '- Choose plays appropriate for this situation';
    const conceptRequirement = selectedConcept ? `\n- Only select plays that use the concept "${selectedConcept}"` : '';
    
    // Add strict count requirement to the prompt
    const countRequirement = targetSection.startsWith('basePackage') 
      ? `\n- Generate AT LEAST ${sectionCount} plays`
      : `\n- Generate EXACTLY ${sectionCount} plays - no more, no less`;

    // Add category distribution if applicable
    const distributionRequirement = categoryRequirements 
      ? `
- Target category distribution (try to get close to these numbers):
${
          Object.entries(categoryRequirements)
            .map(([category, percentage]) => 
              `  • About ${Math.round((percentage as number) * sectionCount)} plays from ${category}`
            ).join('\n')
        }
- It's okay if the distribution isn't exact, but try to include plays from all categories`
      : '';
    
    // Format plays with their categories
    const formattedPlays = filteredPlayPool.map(p => `${p.name} [${p.category}]`).join('\n');
    
    const prompt = `Generate ${sectionCount} football plays for the "${targetSection}" section from this play pool:\n\n${filteredPlayPool.map(p => p.name).join('\n')}\n\nSection Requirements:${baseRequirements}${conceptRequirement}\n\nGeneral Rules:\n- Select up to ${sectionCount} plays (use all available plays if less than ${sectionCount} are available)\n- Ensure variety: select different formations, motions, and directions\n- NO DUPLICATES: Each play must be unique\n- Return only JSON format: {"${targetSection}": ["play1", "play2", ...]}\n- Use exact play names from the pool` as const;

    console.log('Sending prompt to OpenAI for section:', targetSection);
    if (targetSection === 'screens') {
      console.log('Screen section prompt:', prompt);
    }

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 1000,
      top_p: 0.95,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    console.log('OpenAI response for section:', targetSection, result);
    if (targetSection === 'screens') {
      console.log('Raw OpenAI response for screens:', completion.choices[0].message.content);
      console.log('Parsed screens result:', result);
    }

    // If we got fewer plays than requested, that's okay - use what we have
    if (result[targetSection] && result[targetSection].length < sectionCount) {
      console.log(`Warning: Only found ${result[targetSection].length} valid plays for ${targetSection} (requested ${sectionCount})`);
    }

    // Validate the response
    if (!result[targetSection] || !Array.isArray(result[targetSection])) {
      return NextResponse.json({ error: 'Invalid response format from AI' }, { status: 500 });
    }

    // For base package sections, we no longer enforce a minimum count
    // It's better to get some plays than none at all

    // Log category distribution if requirements exist, but don't enforce it
    if (categoryRequirements) {
      const categoryCounts: Record<string, number> = {};
      result[targetSection].forEach((playName: string) => {
        const play = filteredPlayPool.find(p => p.name === playName);
        if (!play) {
          console.log('Failed to find play:', playName);
          console.log('Available plays:', filteredPlayPool.map(p => ({ name: p.name, category: p.category })));
        }
        if (play && play.category) {
          categoryCounts[play.category] = (categoryCounts[play.category] || 0) + 1;
        }
      });

      console.log('Category distribution:', {
        section: targetSection,
        targetDistribution: Object.entries(categoryRequirements).map(([category, percentage]) => ({
          category,
          targetCount: Math.round((percentage as number) * sectionCount)
        })),
        actualDistribution: categoryCounts,
        plays: result[targetSection]
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error generating plays:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate plays' },
      { status: 500 }
    );
  }
} 