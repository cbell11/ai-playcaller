import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { playPool, sectionSizes, singleSection, targetSection, selectedConcept, basePackageConcepts } = await req.json();

    if (!playPool || !Array.isArray(playPool)) {
      return NextResponse.json({ error: 'Invalid play pool data' }, { status: 400 });
    }

    // If generating a single section with a selected concept, use a more focused prompt
    if (singleSection && targetSection && selectedConcept) {
      const sectionCount = sectionSizes[targetSection] || 5;
      const prompt = `Generate ${sectionCount} football plays for the "${targetSection}" section that use the concept "${selectedConcept}" from this play pool:\n\n${playPool.join('\n')}\n\nRules:\n- Select exactly ${sectionCount} plays\n- Only select plays that use the concept "${selectedConcept}"\n- Choose plays appropriate for ${targetSection} situations\n- Ensure variety: select different formations, motions, and directions\n- NO DUPLICATES: Each play must be unique\n- Return only JSON format: {"${targetSection}": ["play1", "play2", ...]}\n- Use exact play names from the pool` as const;

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
    }
    
    // If generating a single section without a concept, use the original single section prompt
    if (singleSection && targetSection) {
      const sectionCount = sectionSizes[targetSection] || 5;
      
      // Add specific requirements for special sections
      let specificRequirements = '';
      if (targetSection === 'twoMinuteDrill') {
        specificRequirements = '\n- Focus on quick game and dropback game plays\n- NO motions or shifts allowed\n- Select plays that can be executed quickly';
      } else if (targetSection === 'twoPointPlays') {
        specificRequirements = '\n- Must include exactly 1 run play and 3 quick game plays\n- Select creative and distinct plays with high success potential\n- Prioritize unique formations and concepts';
      }
      
      const prompt = `Generate ${sectionCount} football plays for the "${targetSection}" section from this play pool:\n\n${playPool.join('\n')}\n\nRules:\n- Select exactly ${sectionCount} plays\n- Choose plays appropriate for ${targetSection} situations${specificRequirements}\n- Ensure variety: select different formations, concepts, motions, and directions\n- NO DUPLICATES: Each play must be unique\n- Return only JSON format: {"${targetSection}": ["play1", "play2", ...]}\n- Use exact play names from the pool` as const;

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
    }

    // For full game plan generation, use the comprehensive prompt with base package concepts
    const conceptRules = basePackageConcepts ? 
      Object.entries(basePackageConcepts)
        .filter(([_, concept]) => concept) // Only include sections with selected concepts
        .map(([section, concept]) => `  - ${section}: Must use concept "${concept}"`)
        .join('\n') : '';

    // Add specific section requirements
    const sectionRequirements = `\nSection-Specific Requirements:
- twoMinuteDrill: Mix of quick game and dropback game plays WITHOUT any motions or shifts
- twoPointPlays: Must include exactly 1 run play and 3 quick game plays, should be creative and distinct with high success potential
- All other sections: Choose plays appropriate for their typical game situations`;

    const prompt = `Generate a complete football game plan using plays from this play pool:\n\n${playPool.join('\n')}\n\nRules:\n- For each section, select the exact number of plays specified:\n${Object.entries(sectionSizes)
      .map(([section, count]) => `  - ${section}: ${count} plays`)
      .join('\n')}${conceptRules ? '\n\nConcept Requirements:\n' + conceptRules : ''}${sectionRequirements}\n\nVariety Requirements:\n- Ensure variety within each section: different formations, concepts, motions, and directions\n- NO DUPLICATES: Each play can only be used once across the entire game plan\n- Mix different play types appropriately for each section\n- Choose plays appropriate for each section's typical situations\n- Return only JSON format with sections as keys and arrays of play names as values\n- Use exact play names from the pool` as const;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 3000,
      top_p: 0.95,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error generating game plan:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate game plan' },
      { status: 500 }
    );
  }
} 