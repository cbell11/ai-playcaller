import { OpenAI } from 'openai'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export const runtime = 'edge'

interface Play {
  Play_ID: string
  Shifts?: string
  TO_Motions?: string
  Formations?: string
  Tags?: string
  From_Motions?: string
  Pass_Protections?: string
  Concept?: string
  Concept_Tag?: string
  RPO_Tag?: string
  Category: 'run_game' | 'quick_game' | 'dropback_game' | 'shot_plays' | 'screen_game'
  Third_S: boolean
  Third_M: boolean
  Third_L: boolean
  RZ: boolean
  GL: boolean
  Front_Beaters?: string[]
  Coverage_Beaters?: string[]
  Blitz_Beaters?: string[]
  Notes?: string
  Created_At?: string
  Updated_At?: string
}

interface ScoutingOption {
  id?: string
  name: string
  dominateDown: string
  fieldArea: string
}

interface ScoutingReport {
  fronts: ScoutingOption[]
  coverages: ScoutingOption[]
  blitzes: ScoutingOption[]
  fronts_pct: Record<string, number>
  coverages_pct: Record<string, number>
  blitz_pct: Record<string, number>
  overall_blitz_pct: number
  notes: string
}

interface AnalyzePlayResponse {
  run_game: Play[]
  quick_game: Play[]
  dropback_game: Play[]
  shot_plays: Play[]
  screen_game: Play[]
  analysis: string
}

export async function POST(req: Request) {
  try {
    const scoutingReport: ScoutingReport = await req.json()

    // Fetch all plays from the playpool table
    const { data: masterPlays, error: playsError } = await supabase
      .from('playpool')
      .select('*')

    if (playsError) {
      console.error('Error fetching plays:', playsError)
      return NextResponse.json({ error: 'Failed to fetch plays' }, { status: 500 })
    }

    // Use OpenAI to analyze the scouting report and match plays
    const systemPrompt = `
    You are an AI assistant for an offensive football coordinator.
    You need to analyze a scouting report and select appropriate plays from the Play Pool.
    The scouting report contains information about the opponent's defensive fronts, coverages, and blitzes.
    
    For each play in the play pool, you need to analyze if it would be effective against the fronts, coverages, and blitzes mentioned in the scouting report.
    
    Consider the following factors:
    1. Front_Beaters: How well the play works against specific defensive fronts
    2. Coverage_Beaters: How well the play works against specific coverages
    3. Blitz_Beaters: How well the play works against specific blitzes
    4. Situational Effectiveness:
       - Third_S: Short yardage situations
       - Third_M: Medium yardage situations
       - Third_L: Long yardage situations
       - RZ: Red zone situations
       - GL: Goal line situations
    
    Select plays that are effective against the most frequently used defensive schemes.
    Prioritize plays that beat the most common fronts and coverages shown in the scouting report.
    Consider the situational effectiveness based on the scouting report's down and distance tendencies.
    `

    const userPrompt = `
    SCOUTING REPORT:
    
    FRONTS:
    ${scoutingReport.fronts.map(f => `• ${f.name}: ${scoutingReport.fronts_pct[f.name] || 0}%
      - Down: ${f.dominateDown}
      - Area: ${f.fieldArea}`).join('\n')}
    
    COVERAGES:
    ${scoutingReport.coverages.map(c => `• ${c.name}: ${scoutingReport.coverages_pct[c.name] || 0}%
      - Down: ${c.dominateDown}
      - Area: ${c.fieldArea}`).join('\n')}
    
    PRESSURE:
    Overall Blitz Rate: ${scoutingReport.overall_blitz_pct}%
    ${scoutingReport.blitzes.map(b => `• ${b.name}: ${scoutingReport.blitz_pct[b.name] || 0}% of pressures
      - Down: ${b.dominateDown}
      - Area: ${b.fieldArea}`).join('\n')}
    
    ${scoutingReport.notes ? `ADDITIONAL NOTES:
    ${scoutingReport.notes}` : ''}
    
    PLAY POOL:
    ${JSON.stringify(masterPlays)}
    
    For each play category (run_game, quick_game, dropback_game, shot_plays, screen_game), select plays that are most effective against the defense described in the scouting report.
    
    Prioritize plays that:
    1. Beat the most frequently used fronts, coverages, and blitzes
    2. Are particularly effective in the situations (downs and field areas) where these defensive schemes are used
    3. Match the situational needs (Third_S, Third_M, Third_L, RZ, GL) based on the scouting report
    
    Also provide a brief analysis of your selections and why they're effective against this defense.
    
    Return your response as a JSON object with the following structure:
    {
      "run_game": [...selected run plays],
      "quick_game": [...selected quick game plays],
      "dropback_game": [...selected dropback plays],
      "shot_plays": [...selected shot plays],
      "screen_game": [...selected screen plays],
      "analysis": "Your analysis here"
    }
    `

    const response = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      model: "gpt-4-turbo-preview",
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 4000
    })

    const playSelections = JSON.parse(response.choices[0].message.content || '{}') as AnalyzePlayResponse

    return NextResponse.json(playSelections)
  } catch (error) {
    console.error('Error analyzing plays:', error)
    return NextResponse.json({ error: 'Failed to analyze plays' }, { status: 500 })
  }
} 