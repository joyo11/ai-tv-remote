// Command router: applies a parsed TVCommand to TV state and returns feedback.
// Pure function, so it drives both the simulated adapter and optimistic UI.

import { ExecStatus, TVCommand, TVState } from "./types";

const VOL_STEP = 3;

export function applyCommand(
  state: TVState,
  cmd: TVCommand
): { state: TVState; status: ExecStatus; message: string } {
  const s = { ...state };

  // Low-confidence commands ask for clarification instead of guessing.
  if (cmd.intent === "clarify" || cmd.confidence < 0.4) {
    return { state: s, status: "clarify", message: "I didn't catch that. Try \"open Netflix\" or \"volume up\"." };
  }

  // Most actions require the TV to be on.
  const needsPower = !["power_on", "power_off"].includes(cmd.intent);
  if (needsPower && !s.power) {
    return { state: s, status: "error", message: "The TV is off. Say \"turn on the TV\" first." };
  }

  switch (cmd.intent) {
    case "power_on":
      s.power = true;
      return done(s, "TV is on.");
    case "power_off":
      s.power = false;
      s.app = null;
      s.playing = false;
      return done(s, "TV is off.");
    case "volume_up":
      s.muted = false;
      s.volume = clamp(s.volume + VOL_STEP);
      return done(s, `Volume ${s.volume}.`);
    case "volume_down":
      s.muted = false;
      s.volume = clamp(s.volume - VOL_STEP);
      return done(s, `Volume ${s.volume}.`);
    case "set_volume":
      s.muted = false;
      s.volume = clamp(cmd.value ?? s.volume);
      return done(s, `Volume set to ${s.volume}.`);
    case "mute":
      s.muted = true;
      return done(s, "Muted.");
    case "unmute":
      s.muted = false;
      return done(s, "Unmuted.");
    case "open_app":
      s.app = cmd.app ?? s.app;
      s.input = "TV";
      return done(s, `Opened ${s.app}.`);
    case "search_content":
      return done(s, `Searching for "${cmd.query}".`);
    case "open_and_search":
      s.app = cmd.app ?? s.app;
      s.input = "TV";
      return done(s, `Opened ${s.app} and searched "${cmd.query}".`);
    case "switch_input":
      s.input = cmd.input ?? s.input;
      s.app = null;
      return done(s, `Switched to ${s.input}.`);
    case "play":
      s.playing = true;
      return done(s, "Playing.");
    case "pause":
      s.playing = false;
      return done(s, "Paused.");
    case "home":
      s.app = null;
      return done(s, "Home.");
    case "back":
      return done(s, "Back.");
    case "sleep_timer":
      s.sleepTimerMin = cmd.value ?? 30;
      return done(s, `Sleep timer set for ${s.sleepTimerMin} min.`);
    default:
      return { state: s, status: "error", message: "That command isn't supported yet." };
  }
}

function done(state: TVState, message: string): { state: TVState; status: ExecStatus; message: string } {
  return { state, status: "ok", message };
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
