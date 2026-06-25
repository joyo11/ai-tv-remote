// Samsung (Tizen) adapter , real local WebSocket remote control.
//
// Protocol: connect to the TV's remote-control websocket and send key events.
//   ws://<ip>:8001/api/v2/channels/samsung.remote.control?name=<base64 name>
//   (newer TVs use wss://<ip>:8002 and require a one-time on-TV "Allow")
// Key event payload:
//   {"method":"ms.remote.control","params":{
//      "Cmd":"Click","DataOfCmd":"KEY_VOLUP","Option":"false",
//      "TypeOfRemote":"SendRemoteKey"}}
//
// This runs on a real phone (React Native has WebSocket) or a Node bridge on the
// same Wi-Fi as the TV. In a desktop browser the LAN connection is blocked, so
// the app falls back to optimistic state. Power-on needs Wake-on-LAN (not over WS).

import { applyCommand } from "../router";
import { ExecStatus, TVCommand, TVState } from "../types";
import { TVAdapter } from "./index";

// Maps our intents to Samsung remote key codes.
const KEY: Record<string, string | undefined> = {
  power_off: "KEY_POWER",
  volume_up: "KEY_VOLUP",
  volume_down: "KEY_VOLDOWN",
  mute: "KEY_MUTE",
  unmute: "KEY_MUTE", // toggle
  play: "KEY_PLAY",
  pause: "KEY_PAUSE",
  home: "KEY_HOME",
  back: "KEY_RETURN",
};

export class SamsungAdapter implements TVAdapter {
  brand = "samsung" as const;
  ip?: string;
  private ws: any = null;

  constructor(ip?: string) {
    this.ip = ip;
  }

  private url(): string {
    const name = b64("AI TV Remote");
    return `ws://${this.ip}:8001/api/v2/channels/samsung.remote.control?name=${name}`;
  }

  private connect(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const ws: any = new (globalThis as any).WebSocket(this.url());
        const timer = setTimeout(() => reject(new Error("timeout")), 3000);
        ws.onopen = () => { clearTimeout(timer); resolve(ws); };
        ws.onerror = (e: any) => { clearTimeout(timer); reject(e); };
      } catch (e) {
        reject(e);
      }
    });
  }

  private sendKey(ws: any, key: string) {
    ws.send(
      JSON.stringify({
        method: "ms.remote.control",
        params: { Cmd: "Click", DataOfCmd: key, Option: "false", TypeOfRemote: "SendRemoteKey" },
      })
    );
  }

  async execute(cmd: TVCommand, state: TVState): Promise<{ state: TVState; status: ExecStatus; message: string }> {
    // Optimistic UI result first.
    const result = applyCommand(state, cmd);
    if (!this.ip) return result; // no device wired; UI-only

    try {
      const ws = await this.connect();
      const key = KEY[cmd.intent];
      if (key) {
        this.sendKey(ws, key);
      } else if (cmd.intent === "open_app" || cmd.intent === "open_and_search") {
        // Launching apps uses the ms.channel app API (app IDs vary by model).
        // Left as a hook; many setups deep-link via the app's known ID.
      }
      ws.close?.();
      return result;
    } catch {
      // Could not reach the TV (e.g. browser LAN block) , keep optimistic state.
      return { ...result, message: result.message + " (sent optimistically; TV not reachable here)" };
    }
  }
}

function b64(s: string): string {
  if (typeof (globalThis as any).btoa === "function") return (globalThis as any).btoa(s);
  // RN/Node fallback
  const B = (globalThis as any).Buffer;
  if (B) return B.from(s, "utf-8").toString("base64");
  return s;
}
