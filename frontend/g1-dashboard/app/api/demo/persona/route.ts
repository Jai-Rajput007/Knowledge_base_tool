import { clientKey, errorResponse, groqChat, rateLimit, requireDemoSession } from "@/lib/demo/groq";

// Generative Persona (demo deployment): the same prompt the backend sends to its
// local model (backend/app/api/v1/endpoints/personas.py), answered by Groq.

type Body = { name?: string; robotName?: string; role?: string; location?: string; context?: string };

export async function POST(req: Request) {
  try {
    await requireDemoSession();
    rateLimit(clientKey(req));

    const b = (await req.json()) as Body;
    const clip = (v: unknown, n = 300) => String(v ?? "").slice(0, n);
    const name = clip(b.name, 120), robotName = clip(b.robotName, 80), role = clip(b.role, 120), location = clip(b.location, 120), context = clip(b.context, 1500);
    if (!context.trim()) return Response.json({ error: "Please describe the persona" }, { status: 400 });

    const prompt = `You are an expert AI persona designer. Your task is to generate a comprehensive configuration for a physical robot based on the following user request.

User Request:
- Internal Profile Name: ${name}
- Robot Name: ${robotName}
- Robot Role: ${role}
- Location: ${location}
- Context/Description: ${context}

You must output ONLY raw JSON matching this exact structure:
{
  "robotName": "${robotName || "A catchy name for the robot"}",
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

    const raw = await groqChat([{ role: "user", content: prompt }], { maxTokens: 700, temperature: 0.7, json: true });
    let generated: Record<string, unknown>;
    try {
      generated = JSON.parse(raw);
    } catch {
      return Response.json({ error: "The model did not return valid JSON — please try again." }, { status: 502 });
    }
    return Response.json({
      robotName: String(generated.robotName || robotName || ""),
      robotCompany: String(generated.robotCompany || ""),
      robotLocation: String(generated.robotLocation || location || ""),
      robotRole: String(generated.robotRole || role || ""),
      systemPrompt: String(generated.systemPrompt || ""),
      conversationRules: Array.isArray(generated.conversationRules) ? generated.conversationRules.map(String).slice(0, 8) : [],
    });
  } catch (e) {
    return errorResponse(e);
  }
}
