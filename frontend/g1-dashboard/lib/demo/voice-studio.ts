/**
 * Demo Voice Studio player. On the real platform the robot speaks the playlist
 * through its own speaker (g1-nlp voice_studio/player.py); in the demo the
 * browser's speech engine plays the same queue, and status() reports the same
 * StudioStatus shape the UI polls.
 */

type ItemState = "queued" | "playing" | "done" | "stopped" | "error";

interface Item {
  id: string;
  text: string;
  state: ItemState;
}

const player = {
  session_id: null as string | null,
  state: "idle" as "idle" | "preparing" | "playing" | "paused" | "error",
  language: null as string | null,
  items: [] as Item[],
  current: -1,
  started_at: null as number | null,
  error: null as string | null,
};

const LANG_TAGS: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", bn: "bn-IN", te: "te-IN", ta: "ta-IN", kn: "kn-IN", ml: "ml-IN", gu: "gu-IN", mr: "mr-IN", pa: "pa-IN",
  ja: "ja-JP", zh: "zh-CN", es: "es-ES", fr: "fr-FR", it: "it-IT", pt: "pt-BR", de: "de-DE", ar: "ar-SA", ru: "ru-RU", ko: "ko-KR",
};

const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

function speakFrom(index: number) {
  const s = synth();
  player.current = index;
  if (index >= player.items.length) {
    player.state = "idle";
    player.current = -1;
    return;
  }
  const item = player.items[index];
  item.state = "playing";
  player.state = "playing";
  if (!s) {
    // No speech engine (e.g. some in-app browsers): advance on a realistic timer instead.
    const ms = Math.max(1500, item.text.split(/\s+/).length * 380);
    setTimeout(() => {
      if (player.items[index] !== item || item.state !== "playing") return;
      item.state = "done";
      speakFrom(index + 1);
    }, ms);
    return;
  }
  const u = new SpeechSynthesisUtterance(item.text);
  const tag = LANG_TAGS[player.language || "en"] || "en-IN";
  u.lang = tag;
  const voice = s.getVoices().find((v) => v.lang === tag) || s.getVoices().find((v) => v.lang.startsWith(tag.slice(0, 2)));
  if (voice) u.voice = voice;
  u.onend = () => {
    if (player.items[index] !== item || item.state !== "playing") return;
    item.state = "done";
    speakFrom(index + 1);
  };
  u.onerror = () => {
    if (item.state === "playing") {
      item.state = "done";
      speakFrom(index + 1);
    }
  };
  s.speak(u);
}

export function studioStatus() {
  const item = player.items[player.current];
  return {
    session_id: player.session_id,
    state: player.state,
    language: player.language,
    voice: null,
    current_item_id: item?.id ?? null,
    segment_index: Math.max(0, player.current),
    segment_count: player.items.length,
    items: player.items.map((i) => ({ id: i.id, state: i.state })),
    error: player.error,
    started_at: player.started_at,
    elapsed_s: player.started_at ? Math.round((Date.now() - player.started_at) / 100) / 10 : 0,
  };
}

export function studioPlay(items: { id?: string; text: string }[], language: string) {
  synth()?.cancel();
  player.session_id = Math.random().toString(36).slice(2, 10);
  player.language = language;
  player.items = items.map((i, n) => ({ id: i.id || `item-${n}`, text: i.text, state: "queued" }));
  player.started_at = Date.now() / 1000;
  player.error = null;
  player.state = "preparing";
  setTimeout(() => speakFrom(0), 600); // TTS synthesis of the first segment
  return studioStatus();
}

export function studioControl(action: "pause" | "resume" | "stop") {
  const s = synth();
  if (action === "pause" && player.state === "playing") {
    s?.pause();
    player.state = "paused";
  } else if (action === "resume" && player.state === "paused") {
    s?.resume();
    player.state = "playing";
  } else if (action === "stop") {
    for (const i of player.items) if (i.state === "playing" || i.state === "queued") i.state = "stopped";
    s?.cancel();
    player.state = "idle";
    player.current = -1;
  }
  return studioStatus();
}
