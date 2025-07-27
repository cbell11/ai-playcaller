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
  thirdAndLong: `
- Focus on pass plays
- Include screen plays
- Routes should reach past the first down marker`,
  redZone: `
- Quick-hitting plays
- Include specific red zone concepts
- Mix of run and pass plays`,
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
    if (targetSection === 'screens') {
      filteredPlayPool = playPool.filter(play => {
        return play.category === 'screen_game';
      });

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
    }
    
    // Build the prompt with section-specific requirements
    const baseRequirements = sectionRequirements[targetSection] || '- Choose plays appropriate for this situation';
    const conceptRequirement = selectedConcept ? `\n- Only select plays that use the concept "${selectedConcept}"` : '';
    
    const prompt = `Generate ${sectionCount} football plays for the "${targetSection}" section from this play pool:\n\n${filteredPlayPool.map(p => p.name).join('\n')}\n\nSection Requirements:${baseRequirements}${conceptRequirement}\n\nGeneral Rules:\n- Select exactly ${sectionCount} plays\n- Ensure variety: select different formations, motions, and directions\n- NO DUPLICATES: Each play must be unique\n- Return only JSON format: {"${targetSection}": ["play1", "play2", ...]}\n- Use exact play names from the pool` as const;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 1000,
      top_p: 0.95,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error generating plays:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate plays' },
      { status: 500 }
    );
  }
} 