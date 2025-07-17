import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI()

export async function POST(req: Request) {
  try {
    const { playPool, sectionSizes } = await req.json()

    if (!playPool || !Array.isArray(playPool)) {
      return NextResponse.json({ error: 'Invalid play pool data' }, { status: 400 })
    }

    if (!sectionSizes || typeof sectionSizes !== 'object') {
      return NextResponse.json({ error: 'Invalid section sizes' }, { status: 400 })
    }

    // Format the plays into a string for the prompt
    const playsText = playPool.join('\n')

    // Create a prompt that includes the section sizes
    const prompt = `You are an expert football offensive coordinator. Given the following play pool, create a game plan by organizing these plays into different sections. Each section should have exactly the number of plays specified in the requirements below. Only use plays from the provided play pool.

Play Pool:
${playsText}

Section Requirements:
- Opening Script: ${sectionSizes.openingScript} plays
- Base Package 1: ${sectionSizes.basePackage1} plays
- Base Package 2: ${sectionSizes.basePackage2} plays
- Base Package 3: ${sectionSizes.basePackage3} plays
- First Downs: ${sectionSizes.firstDowns} plays
- Short Yardage: ${sectionSizes.shortYardage} plays
- Third and Long: ${sectionSizes.thirdAndLong} plays
- Red Zone: ${sectionSizes.redZone} plays
- Goalline: ${sectionSizes.goalline} plays
- Backed Up: ${sectionSizes.backedUp} plays
- Screens: ${sectionSizes.screens} plays
- Play Action: ${sectionSizes.playAction} plays
- Deep Shots: ${sectionSizes.deepShots} plays

Guidelines:
1. Opening Script: Mix of runs and passes to establish tempo
2. Base Packages: Core plays grouped by formation families
3. First Downs: Reliable plays that typically gain 4+ yards
4. Short Yardage: High percentage plays for 3rd/4th and short
5. Third and Long: Pass plays designed for 7+ yards
6. Red Zone: High percentage scoring plays inside the 20
7. Goalline: Plays from inside the 5-yard line
8. Backed Up: Safe plays when starting inside own 10-yard line
9. Screens: Various screen plays
10. Play Action: Play action passes
11. Deep Shots: Vertical passing plays

Return the game plan as a JSON object with each section as a key and an array of plays as the value. Each section should contain exactly the number of plays specified in the requirements. Example format:
{
  "openingScript": ["play1", "play2"],
  "basePackage1": ["play3", "play4"],
  ...
}`

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert football offensive coordinator helping to organize plays into a game plan. You will return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "gpt-4-turbo-preview",
      response_format: { type: "json_object" },
      temperature: 0.7,
    })

    if (!completion.choices[0].message.content) {
      return NextResponse.json(
        { error: 'Failed to generate game plan: No content received from AI' },
        { status: 500 }
      );
    }

    const gamePlan = JSON.parse(completion.choices[0].message.content)
    return NextResponse.json(gamePlan)

  } catch (error) {
    console.error('Error generating game plan:', error)
    return NextResponse.json({ error: 'Failed to generate game plan' }, { status: 500 })
  }
} 