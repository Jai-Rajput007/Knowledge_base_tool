import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { name, robotName, context, location, role } = data;

    const prompt = `You are an expert AI persona designer. Your task is to generate a comprehensive configuration for a physical robot based on the following user request.
    
User Request:
- Internal Profile Name: ${name}
- Robot Name: ${robotName}
- Robot Role: ${role}
- Location: ${location}
- Context/Description: ${context}

You must output ONLY raw JSON matching this exact structure:
{
  "robotName": "${robotName || 'A catchy name for the robot'}",
  "robotCompany": "A suitable company name",
  "robotLocation": "${location}",
  "robotRole": "${role}",
  "systemPrompt": "A highly detailed, 3-5 sentence master instruction prompt dictating the robot's exact personality, tone, and goals.",
  "conversationRules": [
    "Rule 1 about what it must do",
    "Rule 2 about what it must never do",
    "Rule 3 about its communication style",
    "Rule 4 about safety or privacy"
  ]
}`;

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        prompt: prompt,
        stream: false,
        format: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Parse the generated JSON response
    let generatedJson;
    try {
      generatedJson = JSON.parse(result.response);
    } catch (e) {
      console.error('Failed to parse Ollama JSON:', result.response);
      throw new Error('LLM did not return valid JSON');
    }

    // Create the persona in the database
    const dbPersona = await prisma.persona.create({
      data: {
        name: name || generatedJson.robotName + ' Generated Profile',
        robotName: generatedJson.robotName || '',
        robotCompany: generatedJson.robotCompany || '',
        robotLocation: generatedJson.robotLocation || location,
        robotRole: generatedJson.robotRole || role,
        systemPrompt: generatedJson.systemPrompt || '',
        conversationRules: generatedJson.conversationRules || [],
        isActive: false,
        syncStatus: 'not_synced'
      }
    });

    return NextResponse.json({ success: true, persona: dbPersona });
  } catch (error) {
    console.error('Generative persona error:', error);
    return NextResponse.json({ error: 'Failed to generate persona' }, { status: 500 });
  }
}
