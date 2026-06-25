// Shared types for the AI TV Remote.

export type Intent =
  | "power_on"
  | "power_off"
  | "volume_up"
  | "volume_down"
  | "set_volume"
  | "mute"
  | "unmute"
  | "open_app"
  | "search_content"
  | "open_and_search"
  | "switch_input"
  | "play"
  | "pause"
  | "home"
  | "back"
  | "sleep_timer"
  | "clarify";

export type Brand = "sony" | "samsung" | "simulated";

// The structured command the AI parser produces (matches SYSTEM.md schema).
export type TVCommand = {
  intent: Intent;
  brand?: Brand;
  deviceId?: string;
  app?: string;
  query?: string;
  input?: string;
  value?: number;
  delaySeconds?: number;
  confidence: number;
  rawText: string;
};

export type Device = {
  id: string;
  brand: Brand;
  name: string;
  ip?: string;
  isDefault?: boolean;
};

// Optimistic on-device state we render in the UI.
export type TVState = {
  power: boolean;
  volume: number; // 0-100
  muted: boolean;
  input: string; // e.g. "HDMI 1", "TV"
  app: string | null;
  playing: boolean;
  sleepTimerMin: number | null;
};

export type ExecStatus = "ok" | "error" | "clarify";

export type HistoryItem = {
  id: string;
  rawText: string;
  command: TVCommand;
  status: ExecStatus;
  message: string;
  at: number;
};

export const DEFAULT_STATE: TVState = {
  power: true,
  volume: 18,
  muted: false,
  input: "TV",
  app: null,
  playing: false,
  sleepTimerMin: null,
};
