// AI intent parser: natural language -> structured TVCommand.
//
// This is a fast, offline, rule-based parser so the app works with no API key.
// It mirrors the system prompt in SYSTEM.md. For fuzzier language you can swap
// parseCommand() for an LLM call (see parseWithLLM stub at the bottom) that
// returns the same TVCommand shape.

import { Brand, Intent, TVCommand } from "./types";

const APPS: Record<string, string> = {
  youtube: "YouTube",
  netflix: "Netflix",
  prime: "Prime Video",
  "prime video": "Prime Video",
  amazon: "Prime Video",
  hulu: "Hulu",
  disney: "Disney+",
  "disney+": "Disney+",
  max: "Max",
  hbo: "Max",
  spotify: "Spotify",
  plex: "Plex",
  espn: "ESPN",
  peacock: "Peacock",
  apple: "Apple TV",
  "apple tv": "Apple TV",
};

function detectApp(t: string): string | undefined {
  for (const key of Object.keys(APPS)) {
    if (t.includes(key)) return APPS[key];
  }
  return undefined;
}

function detectBrand(t: string): Brand | undefined {
  if (t.includes("samsung")) return "samsung";
  if (t.includes("sony") || t.includes("bravia")) return "sony";
  return undefined;
}

function detectInput(t: string): string | undefined {
  const m = t.match(/hdmi\s*(\d)/);
  if (m) return `HDMI ${m[1]}`;
  if (t.includes("hdmi")) return "HDMI 1";
  if (/\b(tv|antenna|tuner|cable)\b/.test(t)) return "TV";
  return undefined;
}

function firstNumber(t: string): number | undefined {
  const m = t.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

function ok(
  intent: Intent,
  rawText: string,
  extra: Partial<TVCommand> = {},
  confidence = 0.95
): TVCommand {
  return { intent, rawText, confidence, brand: detectBrand(rawText.toLowerCase()), ...extra };
}

export function parseCommand(rawText: string): TVCommand {
  const t = rawText.toLowerCase().trim();
  if (!t) return ok("clarify", rawText, {}, 0.3);

  // ---- open + search (check before plain open/search) ----
  const app = detectApp(t);
  const searchVerb = /(search|find|play|look up|watch)/.test(t);
  if (app && searchVerb) {
    const query = extractQuery(t, app);
    if (query) return ok("open_and_search", rawText, { app, query });
    return ok("open_app", rawText, { app });
  }
  if (app && /(open|launch|go to|start)/.test(t)) {
    return ok("open_app", rawText, { app });
  }

  // ---- sleep timer (before power, so "turn off after 30 min" isn't power_off) ----
  if (/(sleep|turn off|shut off|power off).*(min|hour|after)|after\s*\d+\s*(min|hour)/.test(t)) {
    const n = firstNumber(t) ?? 30;
    const mins = /hour/.test(t) ? n * 60 : n;
    return ok("sleep_timer", rawText, { delaySeconds: mins * 60, value: mins });
  }

  // ---- power ----
  if (/(turn off|power off|shut (it |the tv )?down|switch off|good ?night)/.test(t)) {
    return ok("power_off", rawText);
  }
  if (/(turn on|power on|switch on|wake (up|the tv))/.test(t)) {
    return ok("power_on", rawText);
  }

  // ---- volume ----
  if (/(set|change|make).*(volume|sound)/.test(t) || /volume (to|at)\s*\d/.test(t)) {
    const value = firstNumber(t);
    if (value !== undefined) return ok("set_volume", rawText, { value: clamp(value) });
  }
  if (/(louder|volume up|turn (it )?up|increase (the )?(volume|sound)|raise)/.test(t)) {
    return ok("volume_up", rawText);
  }
  if (/(quieter|volume down|turn (it )?down|lower|decrease (the )?(volume|sound)|softer)/.test(t)) {
    return ok("volume_down", rawText);
  }

  // ---- mute ----
  if (/\bunmute\b|turn (the )?sound (back )?on/.test(t)) return ok("unmute", rawText);
  if (/\bmute\b|silence|turn (the )?sound off/.test(t)) return ok("mute", rawText);

  // ---- transport ----
  if (/\bpause\b|hold on/.test(t)) return ok("pause", rawText);
  if (/\b(play|resume|continue)\b/.test(t)) return ok("play", rawText);

  // ---- input ----
  const input = detectInput(t);
  if (input && /(switch|change|input|source|hdmi)/.test(t)) {
    return ok("switch_input", rawText, { input });
  }

  // ---- navigation ----
  if (/(go back|back|previous|return)/.test(t)) return ok("back", rawText);
  if (/(home|main menu|home screen)/.test(t)) return ok("home", rawText);

  // ---- bare open / search ----
  if (app) return ok("open_app", rawText, { app });
  if (searchVerb) {
    const query = extractQuery(t, undefined);
    if (query) return ok("search_content", rawText, { query }, 0.8);
  }

  // ---- fallback ----
  return ok("clarify", rawText, {}, 0.3);
}

function extractQuery(t: string, app?: string): string | undefined {
  let s = t;
  // strip leading verbs/app/brand words
  s = s.replace(
    /\b(open|launch|go to|start|search( for)?|find|play|look up|watch|on the|on|the|samsung|sony|bravia|tv|and)\b/g,
    " "
  );
  if (app) s = s.replace(new RegExp(app, "ig"), " ");
  for (const k of Object.keys(APPS)) s = s.replace(new RegExp(`\\b${k}\\b`, "ig"), " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.length >= 2 ? titleish(s) : undefined;
}

function titleish(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

// ---- Optional LLM upgrade path ----
// Swap parseCommand for this when you want to handle fuzzier phrasing.
// It must return the same TVCommand shape. Keep the rule-based parser as a
// fast offline fallback when there is no network / key.
export async function parseWithLLM(rawText: string): Promise<TVCommand> {
  // Example (pseudo): POST rawText to your /api/commands/parse endpoint, which
  // calls an LLM with the SYSTEM.md system prompt and returns strict JSON.
  // For now we delegate to the rule-based parser.
  return parseCommand(rawText);
}
