/**
 * Initial data for the demo deployment. Everything here mirrors the shapes the
 * real FastAPI backend returns (see backend/app/api/v1/endpoints/*), so the UI
 * code runs unchanged. A fresh copy is created for every browser session.
 */

import { DEMO_TENANT, DEMO_USER } from "./config";

const now = () => Date.now();
const iso = (msAgo: number) => new Date(now() - msAgo).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

let idCounter = 1000;
export const nextId = () => ++idCounter;
export const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

// ── Personas ──────────────────────────────────────────────────────────────────
// Templates mirror backend/app/core/seed.py; conversationRules is a JSON string, as in the DB.
const TEMPLATES: [string, string, string, string, string, string[]][] = [
  ["Campus Guide", "Campus Guide", "University Campus", "Female", "You are an enthusiastic Campus Guide robot. You help students and visitors navigate the university campus, find buildings, and learn about campus history.", ["Always be welcoming to new students", "Provide clear directions to buildings"]],
  ["Shopping Assistant", "Shopping Assistant", "Retail Store", "Female", "You are a helpful Shopping Assistant robot. You help customers find products, check prices, and navigate the store aisles. Always be polite and offer alternatives if an item is out of stock.", ["Always ask if they need help finding anything else", "Direct customers to the exact aisle number"]],
  ["Tour Guide", "Tour Guide", "Tourist Attraction", "Male", "You are an engaging Tour Guide robot. You provide interesting facts, historical context, and directions for tourists. Make the history come alive and encourage questions.", ["Speak clearly and slightly slower than normal", "Encourage questions from the group"]],
  ["Medical Assistant", "Medical Assistant", "Hospital Clinic", "Female", "You are a professional Medical Assistant robot. You help patients with scheduling, triage, and basic health inquiries. Always remind patients that you are not a doctor and cannot provide medical advice.", ["Always maintain patient confidentiality", "Advise them to see a doctor for serious issues"]],
  ["Receptionist", "Receptionist", "Front Desk", "Female", "You are a friendly and efficient Receptionist robot. You welcome visitors, answer basic questions, and help with check-ins. Keep answers brief, clear, and very polite.", ["Always say 'Welcome' when greeting", "Keep answers brief and clear"]],
  ["Museum Assistant", "Museum Assistant", "Museum Exhibit Hall", "Male", "You are a knowledgeable Museum Assistant robot. You provide facts about exhibits, guide visitors, and answer historical questions. Be enthusiastic about the artifacts.", ["Do not touch the exhibits", "Provide deep historical context when asked"]],
  ["Warehouse Assistant", "Warehouse Inventory Assistant", "Warehouse Floor", "Male", "You are an efficient warehouse assistant. Your goal is to help workers find items, check stock levels, and navigate the warehouse. Be direct and concise.", ["Provide exact aisle and bin numbers", "Do not use unnecessary pleasantries"]],
  ["Classroom Tutor", "Classroom Teaching Assistant", "School Classroom", "Female", "You are a patient and encouraging tutor. Help students understand concepts by asking leading questions. Do not just give them the final answer.", ["Praise students for correct intermediate steps", "Use the Socratic method"]],
  ["Security Guard", "Security Patrol Robot", "Facility Perimeter", "Male", "You are a security patrol robot. You report anomalies and gently remind people of the facility rules (like wearing badges). Be authoritative but polite.", ["Always ask to see identification if not visible", "Report any unknown items immediately"]],
  ["Companion / Entertainment", "Entertainment Companion", "Waiting Area", "Female", "You are a fun and engaging companion. Tell jokes, offer to play simple word games, and keep people entertained in waiting areas.", ["Keep the mood light and cheerful", "Always have a family-friendly joke ready"]],
];

export function personaRecord(p: Partial<DemoPersona> & { name: string }): DemoPersona {
  return {
    id: uuid(),
    version: 1,
    isActive: false,
    isTemplate: false,
    robotName: "Jarvis",
    robotCompany: "",
    robotLocation: "",
    robotRole: "",
    robotVoice: "Male",
    systemPrompt: "",
    conversationRules: "[]",
    wakeWord: "hey_jarvis",
    llmMode: "local",
    asrMode: "parakeet",
    ttsMode: "g1_direct",
    syncStatus: "not_synced",
    lastSyncedAt: null,
    createdById: null,
    createdAt: iso(20 * DAY),
    updatedAt: iso(2 * DAY),
    ...p,
  };
}

export interface DemoPersona {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  isTemplate: boolean;
  robotName: string;
  robotCompany: string;
  robotLocation: string;
  robotRole: string;
  robotVoice: string;
  systemPrompt: string;
  conversationRules: string;
  wakeWord: string;
  llmMode: string;
  asrMode: string;
  ttsMode: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

function seedPersonas(): DemoPersona[] {
  const templates = TEMPLATES.map(([name, role, location, voice, prompt, rules]) =>
    personaRecord({
      name,
      robotName: role,
      robotRole: role,
      robotLocation: location,
      robotVoice: voice,
      systemPrompt: prompt,
      conversationRules: JSON.stringify(rules),
      isTemplate: true,
    })
  );
  const personal = [
    personaRecord({
      name: "Veda Reception",
      robotName: "Veda",
      robotCompany: DEMO_TENANT.name,
      robotLocation: "Noida HQ — Main Lobby",
      robotRole: "Front desk receptionist",
      robotVoice: "Female",
      wakeWord: "hey_veda",
      systemPrompt:
        "You are Veda, the humanoid receptionist at Bidyut Innovation's Noida headquarters. Greet every visitor warmly, help them check in, guide them to meeting rooms, and answer questions about the company using the knowledge base. Keep replies short, clear and friendly.",
      conversationRules: JSON.stringify([
        "Greet visitors with 'Namaste' and ask how you can help",
        "Never share employee phone numbers or personal details",
        "Offer to walk visitors to their meeting room",
        "Switch to the visitor's language if they speak Hindi or another Indian language",
      ]),
      isActive: true,
      version: 4,
      syncStatus: "synced",
      lastSyncedAt: iso(2 * HOUR),
      updatedAt: iso(2 * HOUR),
    }),
    personaRecord({
      name: "Expo Booth Guide",
      robotName: "Veda",
      robotCompany: DEMO_TENANT.name,
      robotLocation: "India Mobile Congress — Hall 5",
      robotRole: "Product demo host",
      robotVoice: "Male",
      wakeWord: "namaste_veda",
      systemPrompt:
        "You are Veda, a humanoid robot hosting the Bidyut Innovation booth at a technology expo. Explain the VEDA platform with enthusiasm, invite visitors to try a conversation, and collect interest for demos.",
      conversationRules: JSON.stringify([
        "Keep explanations under 30 seconds unless asked for more",
        "Invite the visitor to try a gesture or a question",
        "Never make pricing commitments — refer pricing questions to the sales team",
      ]),
      version: 2,
      syncStatus: "not_synced",
      updatedAt: iso(3 * DAY),
    }),
  ];
  return [...templates, ...personal];
}

// ── Knowledge hub ─────────────────────────────────────────────────────────────
export interface DemoDocument {
  id: number;
  name: string;
  file_type: string;
  file_size: number;
  status: "uploaded" | "processing" | "indexed" | "error";
  chunks_count: number;
  created_at: string;
  processingStartedAt?: number;
}

function seedDocuments(): DemoDocument[] {
  return [
    { id: 1, name: "VEDA Platform Overview.pdf", file_type: "pdf", file_size: 2_457_600, status: "indexed", chunks_count: 184, created_at: iso(18 * DAY) },
    { id: 2, name: "Unitree G1 Safety & Operations Manual.pdf", file_type: "pdf", file_size: 6_082_560, status: "indexed", chunks_count: 412, created_at: iso(15 * DAY) },
    { id: 3, name: "Visitor FAQ.docx", file_type: "docx", file_size: 186_880, status: "indexed", chunks_count: 46, created_at: iso(9 * DAY) },
    { id: 4, name: "Office Directory & Meeting Rooms.csv", file_type: "csv", file_size: 24_576, status: "indexed", chunks_count: 18, created_at: iso(6 * DAY) },
    { id: 5, name: "Company Policies 2026.md", file_type: "md", file_size: 58_368, status: "indexed", chunks_count: 37, created_at: iso(2 * DAY) },
  ];
}

// ── Chat sessions ─────────────────────────────────────────────────────────────
export interface DemoSession {
  id: string;
  title: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  messages: { id: number; role: "user" | "assistant"; content: string; created_at: string }[];
}

function seedSessions(): DemoSession[] {
  const s1Time = 26 * HOUR;
  const s2Time = 3 * DAY;
  return [
    {
      id: uuid(),
      title: "What can Veda do at a reception desk?",
      user_id: 1,
      created_at: iso(s1Time),
      updated_at: iso(s1Time - 4 * MIN),
      is_pinned: false,
      messages: [
        { id: nextId(), role: "user", content: "What can Veda do at a reception desk?", created_at: iso(s1Time) },
        {
          id: nextId(),
          role: "assistant",
          content:
            "At a reception desk, Veda can greet visitors by name using face recognition (FRS), check them in, answer questions from your uploaded documents, give directions to meeting rooms, and even walk visitors there using the navigation maps. It speaks English and 10 Indian languages, and uses natural gestures like a wave or namaste while talking.",
          created_at: iso(s1Time - 1 * MIN),
        },
      ],
    },
    {
      id: uuid(),
      title: "Battery and safety guidelines",
      user_id: 1,
      created_at: iso(s2Time),
      updated_at: iso(s2Time - 6 * MIN),
      is_pinned: false,
      messages: [
        { id: nextId(), role: "user", content: "How long does the G1 battery last and what are the safety rules?", created_at: iso(s2Time) },
        {
          id: nextId(),
          role: "assistant",
          content:
            "According to the G1 Safety & Operations Manual, a full charge gives roughly 2 hours of mixed walking and interaction. Keep a 1-metre clearance while the robot walks, never lift it by the arms, and always use the damping/stop command before charging or transporting it. The Robot Health page shows live battery, cell voltages and joint temperatures.",
          created_at: iso(s2Time - 1 * MIN),
        },
      ],
    },
  ];
}

// ── FRS (face recognition) ────────────────────────────────────────────────────
export interface DemoEmployee {
  id: number;
  employee_id: string;
  username: string;
  email: string;
  department: string | null;
  face_id: string | null;
  photo_count: number;
  is_enrolled: boolean;
  is_active: number;
  created_at: string;
}

function seedEmployees(): DemoEmployee[] {
  return [
    { id: 101, employee_id: "BI-0001", username: "Jai_Rajput", email: "jai@gmail.com", department: "Engineering", face_id: "face_bi0001", photo_count: 5, is_enrolled: true, is_active: 1, created_at: iso(30 * DAY) },
    { id: 102, employee_id: "BI-0014", username: "Priya_Sharma", email: "priya.sharma@bidyut.ai", department: "Product", face_id: "face_bi0014", photo_count: 4, is_enrolled: true, is_active: 1, created_at: iso(21 * DAY) },
    { id: 103, employee_id: "BI-0027", username: "Arjun_Mehta", email: "arjun.mehta@bidyut.ai", department: "Operations", face_id: "face_bi0027", photo_count: 3, is_enrolled: true, is_active: 1, created_at: iso(7 * DAY) },
  ];
}

// ── Integrations (MCP) ────────────────────────────────────────────────────────
const MCPS: [string, string, string, string, string][] = [
  ["Weather", "utility", "Current weather and forecasts.", "public", "{}"],
  ["Local Search", "utility", "Search local places and events.", "public", "{}"],
  ["News", "news", "Latest news articles.", "public", "{}"],
  ["Wikipedia", "knowledge", "Wikipedia encyclopedia search.", "public", "{}"],
  ["Currency Converter", "utility", "Currency conversion.", "public", "{}"],
  ["Web search", "search", "General web search.", "public", "{}"],
  ["Gmail", "communication", "Read, send, draft and manage your Gmail emails and labels.", "composio", '{"app": "gmail"}'],
  ["Google Calendar", "productivity", "Create, view, and manage Google Calendar events and schedules.", "composio", '{"app": "googlecalendar"}'],
  ["Google Drive", "productivity", "Upload, download, search and organize files in Google Drive.", "composio", '{"app": "googledrive"}'],
  ["Google Sheets", "productivity", "Read, write and format data in Google Sheets spreadsheets.", "composio", '{"app": "googlesheets"}'],
  ["Google Docs", "productivity", "Create, edit and manage Google Docs documents.", "composio", '{"app": "googledocs"}'],
  ["Google Slides", "productivity", "Create and manage Google Slides presentations.", "composio", '{"app": "googleslides"}'],
  ["Google Tasks", "productivity", "Manage your task lists and to-dos in Google Tasks.", "composio", '{"app": "googletasks"}'],
  ["Google Chat", "communication", "Send messages, search conversations and manage Google Chat spaces.", "composio", '{"app": "googlechat"}'],
  ["Google Classroom", "education", "Manage courses, assignments and student work in Google Classroom.", "composio", '{"app": "googleclassroom"}'],
  ["Google Forms", "productivity", "Create forms, manage questions, and retrieve responses from Google Forms.", "composio", '{"app": "googleforms"}'],
  ["Google Maps", "utility", "Search places, get directions and location details via Google Maps.", "composio", '{"app": "googlemaps"}'],
  ["Slack", "communication", "Post messages, search channels and manage Slack workspaces.", "composio", '{"app": "slack"}'],
  ["Microsoft Teams", "communication", "Send messages, manage meetings and collaborate in Microsoft Teams.", "composio", '{"app": "microsoftteams"}'],
  ["Zoom", "communication", "Schedule, manage and interact with Zoom meetings and team chats.", "composio", '{"app": "zoom"}'],
  ["WhatsApp", "communication", "Send and receive WhatsApp messages programmatically.", "composio", '{"app": "whatsapp"}'],
  ["Outlook", "communication", "Read, send and manage emails and calendar via Microsoft Outlook.", "composio", '{"app": "outlook"}'],
  ["Jira", "productivity", "Create, update and track Jira issues, sprints and projects.", "composio", '{"app": "jira"}'],
  ["Twitter", "social", "Post tweets, search timelines and manage Twitter/X interactions.", "composio", '{"app": "twitter"}'],
  ["LinkedIn", "social", "Post updates, search profiles and manage LinkedIn connections.", "composio", '{"app": "linkedin"}'],
  ["Instagram", "social", "Manage Instagram posts, stories and media content.", "composio", '{"app": "instagram"}'],
  ["Pinterest", "social", "Create and manage Pinterest pins and boards.", "composio", '{"app": "pinterest"}'],
  ["Spotify", "entertainment", "Search tracks, manage playlists and control Spotify playback.", "composio", '{"app": "spotify"}'],
  ["Tripadvisor Content", "travel", "Fetch hotel, restaurant and attraction content from the Tripadvisor Content API.", "composio", '{"app": "tripadvisorcontent"}'],
  ["Context7", "knowledge", "Fetch up-to-date library documentation and code examples via Context7.", "composio", '{"app": "context7"}'],
];
const ENABLED_MCPS = new Set(["Weather", "Wikipedia", "Web search", "News", "Google Calendar", "Gmail"]);

export interface DemoMcp {
  id: string;
  name: string;
  category: string;
  description: string;
  tier: string;
  provider: string;
  providerConfig: string;
  isEnabled: boolean;
  isUnlocked: boolean;
  credentials: string | null;
}

function seedMcps(): DemoMcp[] {
  return MCPS.map(([name, category, description, provider, providerConfig]) => ({
    id: uuid(),
    name,
    category,
    description,
    tier: "BASIC",
    provider,
    providerConfig,
    isEnabled: ENABLED_MCPS.has(name),
    isUnlocked: true,
    credentials: null,
  }));
}

// ── Wake word ─────────────────────────────────────────────────────────────────
export interface DemoWakeJob {
  id: number;
  wake_phrase: string;
  model_name: string;
  backend: string;
  robot_ip: string | null;
  quality: string;
  steps: number;
  n_samples: number;
  sample_count: number;
  status: string;
  optimal_threshold: number | null;
  recall: number | null;
  fpph: number | null;
  onnx_path: string | null;
  kaggle_kernel: string | null;
  kaggle_log_url: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  /** Demo simulation: epoch ms when training started, and its simulated duration. */
  simStart?: number;
  simDurationMs?: number;
}

export const AGX_IP = "192.168.123.18";

function seedWakeJobs(): DemoWakeJob[] {
  const base = { backend: "local_agx", robot_ip: AGX_IP, kaggle_kernel: null, kaggle_log_url: null, error_message: null };
  return [
    { ...base, id: 3, wake_phrase: "namaste veda", model_name: "namaste_veda", quality: "standard", steps: 50000, n_samples: 10000, sample_count: 12, status: "ready", optimal_threshold: 0.62, recall: 91.4, fpph: 0.214, onnx_path: "/models/wakeword/namaste_veda.onnx", created_at: iso(4 * DAY), started_at: iso(4 * DAY - 2 * MIN), completed_at: iso(4 * DAY - 150 * MIN) },
    { ...base, id: 2, wake_phrase: "hey veda", model_name: "hey_veda", quality: "production", steps: 100000, n_samples: 25000, sample_count: 20, status: "deployed", optimal_threshold: 0.58, recall: 94.8, fpph: 0.121, onnx_path: "/models/wakeword/hey_veda.onnx", created_at: iso(12 * DAY), started_at: iso(12 * DAY - 2 * MIN), completed_at: iso(12 * DAY - 270 * MIN) },
    { ...base, id: 1, wake_phrase: "hello robot", model_name: "hello_robot", quality: "draft", steps: 30000, n_samples: 5000, sample_count: 0, status: "cancelled", optimal_threshold: null, recall: null, fpph: null, onnx_path: null, created_at: iso(16 * DAY), started_at: iso(16 * DAY - 2 * MIN), completed_at: null },
  ];
}

// ── Gestures ──────────────────────────────────────────────────────────────────
export interface DemoGesture {
  id: string;
  name: string;
  duration_s: number;
  sample_count: number;
  created_at: string;
}

function seedGestures(): DemoGesture[] {
  return [
    { id: uuid(), name: "namaste_greeting", duration_s: 4.2, sample_count: 210, created_at: iso(10 * DAY) },
    { id: uuid(), name: "point_to_reception", duration_s: 6.8, sample_count: 340, created_at: iso(8 * DAY) },
    { id: uuid(), name: "explain_both_hands", duration_s: 14.5, sample_count: 725, created_at: iso(5 * DAY) },
    { id: uuid(), name: "presentation_sweep", duration_s: 32.0, sample_count: 1600, created_at: iso(3 * DAY) },
  ];
}

// ── Navigation ────────────────────────────────────────────────────────────────
export interface DemoMap {
  id: string;
  name: string;
  file_path: string;
  waypoints: { name: string; x: number; y: number }[];
  created_at: string;
}

function seedMaps(): DemoMap[] {
  return [
    {
      id: uuid(), name: "noida_hq_floor_1", file_path: "/home/unitree/maps/noida_hq_floor_1.pcd", created_at: iso(14 * DAY),
      waypoints: [{ name: "Reception", x: 0, y: 0 }, { name: "Conference Room A", x: 6.4, y: 2.1 }, { name: "Cafeteria", x: 11.2, y: -3.5 }],
    },
    {
      id: uuid(), name: "expo_hall_5", file_path: "/home/unitree/maps/expo_hall_5.pcd", created_at: iso(4 * DAY),
      waypoints: [{ name: "Booth Entrance", x: 0, y: 0 }, { name: "Demo Stage", x: 3.2, y: 4.8 }],
    },
  ];
}

// ── Support tickets ───────────────────────────────────────────────────────────
export interface DemoTicket {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  subject: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  /** Demo simulation: when the support team "picks up" this ticket. */
  simAdvanceAt?: number;
}

function seedTickets(): DemoTicket[] {
  return [
    {
      id: uuid(), tenantId: DEMO_TENANT.id, name: DEMO_TENANT.host, email: DEMO_TENANT.hostEmail,
      subject: "Right knee joint running warm after long demos",
      description: "During a 3-hour expo session the right knee joint reached 58°C. Can you confirm whether this is within the normal range and whether we should schedule cool-down breaks?",
      status: "IN_PROGRESS", createdAt: iso(2 * DAY), updatedAt: iso(20 * HOUR),
    },
    {
      id: uuid(), tenantId: DEMO_TENANT.id, name: DEMO_TENANT.host, email: DEMO_TENANT.hostEmail,
      subject: "Enable Marathi voice for the Pune office robot",
      description: "Please enable the Marathi voice pack for our second robot deployed at the Pune office.",
      status: "RESOLVED", createdAt: iso(9 * DAY), updatedAt: iso(8 * DAY),
    },
  ];
}

// ── RBAC users ────────────────────────────────────────────────────────────────
export interface DemoUser {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: number;
  created_at: string;
  tenant_id: string;
  requires_password_change: number;
}

function seedUsers(): DemoUser[] {
  const t = DEMO_TENANT.id;
  return [
    { id: 1, username: DEMO_USER.name, email: DEMO_USER.email, role: "admin", is_active: 1, created_at: iso(60 * DAY), tenant_id: t, requires_password_change: 0 },
    { id: 2, username: "Priya Sharma", email: "priya.sharma@bidyut.ai", role: "editor", is_active: 1, created_at: iso(40 * DAY), tenant_id: t, requires_password_change: 0 },
    { id: 3, username: "Rahul Verma", email: "rahul.verma@bidyut.ai", role: "user", is_active: 1, created_at: iso(22 * DAY), tenant_id: t, requires_password_change: 0 },
    { id: 4, username: "Front Desk Tablet", email: "frontdesk@bidyut.ai", role: "viewer", is_active: 0, created_at: iso(11 * DAY), tenant_id: t, requires_password_change: 0 },
  ];
}

// ── Audit & notifications ─────────────────────────────────────────────────────
export interface DemoAudit {
  id: string;
  action: string;
  endpoint: string;
  method: string;
  status: string;
  timestamp: string;
  name: string;
  email: string;
  details: Record<string, unknown>;
}

export interface DemoNotification {
  id: number;
  type: "info" | "success" | "warning" | "error";
  message: string;
  is_read: boolean;
  date: string;
}

function seedAudit(): DemoAudit[] {
  const rows: [string, string, string, number, Record<string, unknown>][] = [
    ["DEPLOY_PERSONA", "/api/v1/personas/6f1c2a90/deploy", "POST", 2 * HOUR, { persona: "Veda Reception", robot_synced: true }],
    ["UPDATE_LANGUAGE", "/api/v1/settings/language", "PUT", 5 * HOUR, { language: "en" }],
    ["UPLOAD_DOCUMENT", "/api/v1/documents/upload", "POST", 2 * DAY, { file: "Company Policies 2026.md" }],
    ["ENROLL_EMPLOYEE", "/api/v1/employees", "POST", 7 * DAY, { employee_id: "BI-0027", photos: 3 }],
    ["RECORD_GESTURE", "/api/v1/gestures/custom/record/stop", "POST", 3 * DAY, { gesture: "presentation_sweep" }],
    ["CONFIGURE_MCP", "/api/v1/mcp/configure", "POST", 4 * DAY, { integration: "Google Calendar", enabled: true }],
    ["DEPLOY_WAKEWORD", "/api/v1/wakeword/jobs/2/deploy", "POST", 11 * DAY, { wake_phrase: "hey veda" }],
    ["LOGIN", "/api/v1/auth/login", "POST", 26 * HOUR, { ip: "103.21.58.14" }],
  ];
  return rows.map(([action, endpoint, method, ago, details]) => ({
    id: uuid(), action, endpoint, method, status: method === "POST" && endpoint.endsWith("/employees") ? "201" : "200", timestamp: iso(ago),
    name: DEMO_USER.name, email: DEMO_USER.email, details,
  }));
}

function seedNotifications(): DemoNotification[] {
  return [
    { id: 1, type: "success", message: "Persona 'Veda Reception' deployed and hot-reloaded on the robot.", is_read: false, date: iso(2 * HOUR) },
    { id: 2, type: "info", message: "Support ticket 'Right knee joint running warm after long demos' is now IN_PROGRESS.", is_read: false, date: iso(20 * HOUR) },
    { id: 3, type: "warning", message: "Right knee joint reached 58°C during the last session — consider a cool-down break.", is_read: true, date: iso(2 * DAY) },
    { id: 4, type: "info", message: "Super Admin has updated your platform features.", is_read: true, date: iso(6 * DAY) },
  ];
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const DEFAULT_VOICE_PARAMS = {
  english: { voice: "af_heart", speed: 1.0, gain: 2.0 },
  indic: {
    pace: 1.0, temperature: 0.6, gain: 5.0,
    language_voices: { hi: "shubh", ta: "ratan", te: "rohan", gu: "priya", bn: "ritu", kn: "ishita", ml: "suhani", mr: "ashutosh", pa: "mani", or: "neha" },
  },
  international: {
    kokoro_language_voices: { ja: "jf_alpha", zh: "zf_xiaoxiao", es: "ef_dora", fr: "ff_siwis", it: "if_sara", pt: "pf_dora" },
    omnivoice: {
      default_voice: "female", num_step: 32, gain: 2.0,
      language_voices: { de: "male", ar: "female", ru: "male", ko: "female", vi: "male", th: "female" },
    },
  },
};

export const DEFAULT_APP_SETTINGS = {
  autoSave: true, showSources: true, streamingEnabled: true, darkModeDefault: true,
  llmProvider: "groq", llmModel: "llama-3.3-70b-versatile", temperature: 0.4, maxTokens: 1024, topP: 0.9,
  systemPrompt: "You are Veda, a helpful humanoid robot assistant.",
  embeddingProvider: "local", embeddingModel: "bge-m3", embeddingDimensions: 1024,
  chunkSize: 800, chunkOverlap: 120, chunkingStrategy: "hierarchical", batchSize: 32,
  vectorDbType: "qdrant", topK: 5, similarityThreshold: 0.35,
};

export const DEFAULT_VISION = {
  enabled: true,
  model: "qwen2.5vl:7b",
  ollama_url: "http://127.0.0.1:11434",
  snapshot_url: "http://192.168.123.164:8080/snapshot",
  timeout_s: 20,
  num_predict: 160,
  max_side: 768,
  filler: { en: "Let me take a look…", hi: "एक पल, मैं देखती हूँ…" },
};

// ── Whole state ───────────────────────────────────────────────────────────────
export function createSeedState() {
  return {
    version: 1,
    startedAt: now(),
    personas: seedPersonas(),
    documents: seedDocuments(),
    sessions: seedSessions(),
    employees: seedEmployees(),
    mcps: seedMcps(),
    wakeJobs: seedWakeJobs(),
    wakeModels: [
      { filename: "hey_jarvis.onnx", name: "hey_jarvis" },
      { filename: "hey_veda.onnx", name: "hey_veda" },
      { filename: "namaste_veda.onnx", name: "namaste_veda" },
    ],
    maintenanceMode: false,
    gestures: seedGestures(),
    communication: {
      enabled: true,
      mode: "recorded" as "recorded" | "unitree_app",
      names: ["namaste_greeting", "explain_both_hands"],
      unitree_roles: { short: "", medium: "", long: "" },
      min_reply_chars: 120,
    },
    recording: null as null | { name: string; startedAt: number },
    maps: seedMaps(),
    mapping: false,
    pose: { x: 0.0, y: 0.0, targetX: 0.0, targetY: 0.0 },
    tickets: seedTickets(),
    ticketSeq: 1,
    users: seedUsers(),
    audit: seedAudit(),
    notifications: seedNotifications(),
    language: "en",
    voiceModel: "af_heart",
    voiceParams: JSON.parse(JSON.stringify(DEFAULT_VOICE_PARAMS)),
    appSettings: { ...DEFAULT_APP_SETTINGS },
    vision: { ...DEFAULT_VISION },
    tenant: { ...DEMO_TENANT },
    studio: {
      session_id: null as string | null,
      state: "idle",
      language: null as string | null,
      items: [] as { id: string; text: string; state: string }[],
      current_item_id: null as string | null,
      segment_index: 0,
      segment_count: 0,
      started_at: null as number | null,
      pausedAt: null as number | null,
      pausedTotal: 0,
    },
  };
}

export type DemoState = ReturnType<typeof createSeedState>;
