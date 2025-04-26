"use server";

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface ScoutingData {
  fronts: Record<string, number>;
  coverages: Record<string, number>;
  blitz: Record<string, number>;
  terms: string[];
  preferences: {
    motionPercentage: number;
    runPassRatio: number;
    specificConcepts: string[];
  };
}

export async function makeGamePlan(data: ScoutingData) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are an offensive coordinator. Based on the defensive scouting data, generate a game plan with 5-7 run concepts exploiting front weaknesses, 5-7 pass concepts attacking coverage tendencies, and 3-5 key tendencies to exploit. Return a JSON object with keys: runConcepts (array), passConcepts (array), and tendencies (array)."
        },
        {
          role: "user",
          content: JSON.stringify(data)
        }
      ]
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating game plan:', error);
    throw new Error('Failed to generate game plan');
  }
} 