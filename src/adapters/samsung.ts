// Samsung adapter , talks to the local bridge (bridge/server.js), which holds
// the token'd WebSocket to the TV. The app cannot reach a token-auth Tizen TV
// directly from a browser, so control flows: app -> bridge (same Wi-Fi) -> TV.
//
// Set the device's "ip" to the BRIDGE host (the laptop running bridge/server.js):
//   - app running on that same laptop (expo web)      -> localhost
//   - phone app / another device                      -> the laptop's LAN IP
// The bridge listens on port 3777.

import { applyCommand } from "../router";
import { ExecStatus, TVCommand, TVState } from "../types";
import { TVAdapter } from "./index";

const BRIDGE_PORT = 3777;

export class SamsungAdapter implements TVAdapter {
  brand = "samsung" as const;
  ip?: string; // bridge host

  constructor(ip?: string) {
    this.ip = ip;
  }

  async execute(cmd: TVCommand, state: TVState): Promise<{ state: TVState; status: ExecStatus; message: string }> {
    const result = applyCommand(state, cmd); // optimistic UI
    if (result.status !== "ok") return result; // clarify / blocked, nothing to send

    const host = this.ip && this.ip.trim() ? this.ip.trim() : "localhost";
    try {
      const r = await fetch(`http://${host}:${BRIDGE_PORT}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cmd),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.ok === false) {
        return { ...result, status: "error", message: data.message || "Bridge could not reach the TV." };
      }
      return result;
    } catch {
      return {
        ...result,
        status: "error",
        message: `Can't reach the bridge at ${host}:${BRIDGE_PORT}. Start bridge/server.js on the TV's Wi-Fi.`,
      };
    }
  }
}
