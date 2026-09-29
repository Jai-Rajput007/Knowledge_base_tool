import { clientKey, errorResponse, groqChat, rateLimit, requireDemoSession, VEDA_KNOWLEDGE, type ChatMessage } from "@/lib/demo/groq";

// Chat Simulator (demo deployment): answers come from Groq, grounded in what the
// robot knows about the product plus the active persona and the knowledge base.

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", bn: "Bengali", te: "Telugu", ta: "Tamil", kn: "Kannada",
  ml: "Malayalam", gu: "Gujarati", mr: "Marathi", pa: "Punjabi",
};

type Body = {
  message?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  persona?: { identity?: Record<string, string>; system_prompt?: string; conversation_rules?: unknown[] } | null;
  documents?: string[];
  language?: string;
};

export async function POST(req: Request) {
  try {
    await requireDemoSession();
    rateLimit(clientKey(req));

    const body = (await req.json()) as Body;
    const message = String(body.message || "").trim().slice(0, 2000);
    if (!message) return Response.json({ error: "Message is required" }, { status: 400 });

    const id = body.persona?.identity || {};
    const rules = Array.isArray(body.persona?.conversation_rules)
      ? body.persona!.conversation_rules!.map((r) => (typeof r === "string" ? r : JSON.stringify(r))).slice(0, 8)
      : [];
    const docs = (body.documents || []).slice(0, 20);
    const lang = LANGUAGE_NAMES[body.language || "en"];

    const system = [
      `You are ${id.name || "Veda"}, a Unitree G1 humanoid robot running the VEDA platform${id.company ? ` for ${id.company}` : ""}${id.location ? `, deployed at ${id.location}` : ""}${id.role ? `, working as a ${id.role}` : ""}.`,
      body.persona?.system_prompt ? `Persona instructions: ${body.persona.system_prompt}` : "",
      rules.length ? `Conversation rules:\n- ${rules.join("\n- ")}` : "",
      "This is the dashboard's Chat Simulator: operators use it to preview exactly how the robot will reply. Visitors may ask about you, the VEDA platform, or anything else.",
      `What you know about the platform you run on:\n${VEDA_KNOWLEDGE}`,
      docs.length ? `Documents indexed in your knowledge base: ${docs.join(", ")}.` : "",
      "Answer conversationally and concisely (usually 2–5 sentences), the way a friendly robot would speak. Use plain text without markdown headings. Never claim you performed a physical action during this chat; you can describe what you would do on the robot.",
      lang && body.language !== "en" ? `The robot's current language is ${lang}; reply in ${lang} unless the user writes in another language.` : "",
    ].filter(Boolean).join("\n\n");

    const history = (body.history || [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const messages: ChatMessage[] = [{ role: "system", content: system }, ...history, { role: "user", content: message }];
    const reply = await groqChat(messages, { maxTokens: 500, temperature: 0.5 });
    return Response.json({ reply });
  } catch (e) {
    return errorResponse(e);
  }
}
