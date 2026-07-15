import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key_since_we_do_not_have_one_yet',
});

export async function POST(req: Request) {
  try {
    const { profile, dailyStatus, workouts, injuries } = await req.json();

    const prompt = `
      Act as an elite sports scientist and medical advisor for athletes.
      
      Athlete Profile:
      - Sport: ${profile?.sport || 'Unknown'}
      - Weight: ${profile?.weight || 'Unknown'} kg
      - Training Frequency: ${profile?.trainingFreq || 'Unknown'} times/week
      - Average Sleep: ${profile?.sleepHours || 'Unknown'} hours
      
      Recent Status:
      - Mood: ${dailyStatus?.[0]?.mood || 'N/A'}/5
      - Energy: ${dailyStatus?.[0]?.energy || 'N/A'}/5
      - Stress: ${dailyStatus?.[0]?.stress || 'N/A'}/5
      
      Active Injuries: ${injuries?.length > 0 ? injuries.map((i: any) => i.bodyPart).join(', ') : 'None'}
      
      Based on this data, provide a structured JSON response with exactly these fields:
      {
        "shouldRest": boolean,
        "restReason": "string (why they should rest, or empty if they shouldn't)",
        "recoveryPlan": "string (actionable recovery advice like stretching, icing)",
        "medicalAdvice": "string (whether they need to see a doctor for their injuries)"
      }
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const recommendation = JSON.parse(response.choices[0].message.content || '{}');
    return NextResponse.json(recommendation);
  } catch (error: any) {
    console.error('AI API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
