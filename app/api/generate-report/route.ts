import { OpenAI } from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { fronts, coverages, blitzes, frontPct, coverPct, blitzPct, overallBlitzPct, notes } = await req.json()

    const prompt = `As an experienced offensive coordinator, analyze this defense and provide a quick, actionable scouting report. Focus on exploitable tendencies and key matchups.

BASE STRUCTURE:
${fronts.map((f: any) => `• ${f.name}: ${frontPct[f.name] || 0}%
  - Down: ${f.dominateDown}
  - Area: ${f.fieldArea}`).join('\n')}

COVERAGE SHELLS:
${coverages.map((c: any) => `• ${c.name}: ${coverPct[c.name] || 0}%
  - Down: ${c.dominateDown}
  - Area: ${c.fieldArea}`).join('\n')}

PRESSURE:
Overall Blitz Rate: ${overallBlitzPct}%
${blitzes.map((b: any) => `• ${b.name}: ${blitzPct[b.name] || 0}% of pressures
  - Down: ${b.dominateDown}
  - Area: ${b.fieldArea}`).join('\n')}

${notes ? `ADDITIONAL NOTES (IMPORTANT - incorporate these insights into your analysis):
${notes}` : ''}

Provide your analysis in the following format, ensuring each bullet point is on its own line with a line break after it:

### QUICK HITS

• First key tendency

• Second key tendency

• Third key tendency

• Fourth key tendency

### BASE DEFENSE

• Primary front analysis point

• Situational front usage

### COVERAGE BREAKDOWN

• Main coverage tendencies

• Situational coverage adjustments

### PRESSURE SCHEMES

• Blitz tendency analysis

• Pressure package breakdown

### ATTACK PLAN

• First attack concept

• Second attack concept

• Third attack concept

Remember:
1. Start each bullet point with "• "
2. Put each bullet point on its own line
3. Add a blank line between bullet points
4. Keep insights clear and actionable
5. CRITICALLY IMPORTANT: Directly incorporate any information from the ADDITIONAL NOTES section into your analysis`

    const stream = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an experienced offensive coordinator breaking down defensive tendencies. Be direct and specific. Format your response exactly as shown in the prompt, with each bullet point on its own line and a blank line between points. Use ### for section headers. Make sure to incorporate any additional notes from the user into your analysis."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "gpt-4-turbo-preview",
      temperature: 0.7,
      max_tokens: 2000,
      stream: true
    })

    const encoder = new TextEncoder()
    const stream_response = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          controller.enqueue(encoder.encode(text))
        }
        controller.close()
      }
    })

    return new Response(stream_response, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
} 