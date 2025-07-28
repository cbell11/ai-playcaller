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
  openingScript: `
- Mix of run and pass plays
- Include at least one screen play
- Focus on high-percentage plays
- Avoid deep shots or risky plays`,
  basePackage1: `
- Core plays that form the foundation of the offense
- Balance between run and pass concepts`,
  basePackage2: `
- Complementary plays to base package 1
- Should work well in combination with base package 1 plays`,
  basePackage3: `
- Alternative formation or personnel grouping
- Distinct from base packages 1 and 2`,
  firstDowns: `
- Mix of run and pass plays
- Focus on gaining 4-6 yards
- Include some play-action passes`,
  shortYardage: `
- Focus on run plays and quick passes
- High percentage plays for 3rd and short
- Include QB sneaks and power runs`,
  thirdAndShort: `
- STRICTLY NO shot plays allowed
- Focus on run game, quick game, and RPO game plays
- Target distribution: 40% run game, 30% quick game, 30% RPO game
- High percentage plays for 3rd and 1-3 yards
- Quick-hitting plays that can gain 3-4 yards consistently
- Include QB runs and power concepts
- Avoid deep developing routes`,
  thirdAndMedium: `
- STRICTLY NO shot plays allowed
- Focus heavily on quick game and dropback game plays
- Target distribution: 50% quick game, 50% dropback game
- Routes should be at or just past the first down marker
- Include some screen game concepts
- Avoid deep developing routes
- Quick-hitting pass plays that can gain 4-7 yards`
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
      filteredPlayPool = playPool.filter(play => {
        console.log('Filtering screen play:', play);
        const isScreenPlay = play.category === 'screen_game';
        if (!isScreenPlay) {
          console.log('Rejected non-screen play:', play.name, play.category);
        }
        return isScreenPlay;
      });

      console.log('Filtered screen plays:', filteredPlayPool.length);

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No screen plays found in play pool' }, { status: 400 });
      }
    } else if (targetSection === 'goalline') {
      filteredPlayPool = playPool.filter(play => {
        return play.category !== 'shot_plays';
      });

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No valid plays found for goalline after filtering' }, { status: 400 });
      }
    } else if (targetSection === 'twoMinuteDrill') {
      filteredPlayPool = playPool.filter(play => {
        return !['run_game', 'rpo_game'].includes(play.category);
      });

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No valid plays found for two minute drill after filtering' }, { status: 400 });
      }
    } else if (targetSection === 'thirdAndShort') {
      filteredPlayPool = playPool.filter(play => {
        return play.category !== 'shot_plays';
      });

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No valid plays found for third and short after filtering' }, { status: 400 });
      }
    } else if (targetSection === 'thirdAndMedium') {
      filteredPlayPool = playPool.filter(play => {
        return play.category !== 'shot_plays';
      });

      if (filteredPlayPool.length === 0) {
        return NextResponse.json({ error: 'No valid plays found for third and medium after filtering' }, { status: 400 });
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
      ? `\n- Target category distribution (try to get close to these numbers):\n${
          Object.entries(categoryRequirements)
            .map(([category, percentage]) => 
              `  • About ${Math.round(percentage * sectionCount)} plays from ${category}`
            ).join('\n')
        }\n- It's okay if the distribution isn't exact, but try to include plays from all categories`
      : '';
    
    // Format plays with their categories
    const formattedPlays = filteredPlayPool.map(p => `${p.name} [${p.category}]`).join('\n');
    
    const prompt = `Generate ${sectionCount} football plays for the "${targetSection}" section from this play pool:\n\n${filteredPlayPool.map(p => p.name).join('\n')}\n\nSection Requirements:${baseRequirements}${conceptRequirement}\n\nGeneral Rules:\n- Select up to ${sectionCount} plays (use all available plays if less than ${sectionCount} are available)\n- Ensure variety: select different formations, motions, and directions\n- NO DUPLICATES: Each play must be unique\n- Return only JSON format: {"${targetSection}": ["play1", "play2", ...]}\n- Use exact play names from the pool` as const;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 1000,
      top_p: 0.95,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    // If we got fewer plays than requested, that's okay - use what we have
    if (result[targetSection] && result[targetSection].length < sectionCount) {
      console.log(`Warning: Only found ${result[targetSection].length} valid plays for ${targetSection} (requested ${sectionCount})`);
    }

    // Validate the response
    if (!result[targetSection] || !Array.isArray(result[targetSection])) {
      return NextResponse.json({ error: 'Invalid response format from AI' }, { status: 500 });
    }

    // For non-base package sections, enforce exact count
    if (!targetSection.startsWith('basePackage') && result[targetSection].length !== sectionCount) {
      return NextResponse.json({ 
        error: `AI returned wrong number of plays. Expected ${sectionCount}, got ${result[targetSection].length}` 
      }, { status: 500 });
    }

    // For base package sections, enforce minimum count
    if (targetSection.startsWith('basePackage') && result[targetSection].length < sectionCount) {
      return NextResponse.json({ 
        error: `AI returned too few plays for base package. Expected at least ${sectionCount}, got ${result[targetSection].length}` 
      }, { status: 500 });
    }

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
          targetCount: Math.round(percentage * sectionCount)
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