import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { playPool } = await req.json();

    const prompt = `Generate a football game plan using only plays from the following play pool:
${playPool.map((p: any) => p).join('\n')}

Requirements for each section:

openingScript (7-10 plays):
- First plays to start the game
- Feature motion and variety of formations
- Include one shot play
- Mix of run and pass concepts

basePackage1 (4-8 plays):
- Group of related concepts or formations
basePackage2 (4-8 plays):
- Different group of related concepts or formations
basePackage3 (4-8 plays):
- Different group of related concepts or formations

firstDowns (5 plays):
- Similar to opening script but no shot plays
- 50/50 run to pass ratio

shortYardage (5 plays):
- Designed for 2-4 yards
- 3 run plays
- 2 quick passes or screens

thirdAndLong (5 plays):
- Designed for 8+ yards
- 3 dropback plays
- 1 screen play
- 1 shot play

redZone (5 plays):
- Effective within 20 yard line
- No shot plays

goalline (5 plays):
- Designed for 5 yards or less
- 2-3 run plays
- 2-3 quick game plays
- No shot plays or dropback passes

backedUp (5 plays):
- For avoiding safety situations
- 3 run plays
- 2 quick game plays

screens (5 plays):
- All screen plays

playAction (5 plays):
- Mix of RPO and dropback
- Include 1 shot play

deepShots (5 plays):
- All shot plays

IMPORTANT: You must return a JSON object with ALL of these exact section names as keys (openingScript, basePackage1, basePackage2, basePackage3, firstDowns, shortYardage, thirdAndLong, redZone, goalline, backedUp, screens, playAction, deepShots). Each section must contain an array of play names from the provided play pool. Do not skip any sections.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a football offensive coordinator AI. Your task is to select appropriate plays from a given play pool to create a game plan that matches specific requirements. Only use plays exactly as they appear in the provided play pool."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    if (!completion.choices[0].message.content) {
      return NextResponse.json(
        { error: 'Failed to generate game plan: No content received from AI' },
        { status: 500 }
      );
    }

    const gamePlan = JSON.parse(completion.choices[0].message.content);
    return NextResponse.json(gamePlan);

  } catch (error) {
    console.error('Error in generate-gameplan:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate game plan' },
      { status: 500 }
    );
  }
} 