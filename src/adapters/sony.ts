// Sony (Bravia / Android TV) adapter , real local IP control.
//
// Sony Bravia exposes an IP control API. Remote keys go through the IRCC
// SOAP endpoint, and app/power state through the REST API:
//   POST http://<ip>/sony/IRCC      (SOAP body with an IRCC code)
//   POST http://<ip>/sony/system    ({"method":"setPowerStatus",...})
//   POST http://<ip>/sony/appControl ({"method":"setActiveApp",...})
// All requests need the "X-Auth-PSK" header set to the Pre-Shared Key you set
// on the TV (Settings > Network > Home network > IP control > Authentication).
//
// Runs from a phone or a Node bridge on the TV's network. A browser will be
// blocked by CORS/LAN, so the app falls back to optimistic state.

import { applyCommand } from "../router";
import { ExecStatus, TVCommand, TVState } from "../types";
import { TVAdapter } from "./index";

// IRCC codes for Sony Bravia remote keys.
const IRCC: Record<string, string | undefined> = {
  power_off: "AAAAAQAAAAEAAAAvAw==",
  volume_up: "AAAAAQAAAAEAAAASAw==",
  volume_down: "AAAAAQAAAAEAAAATAw==",
  mute: "AAAAAQAAAAEAAAAUAw==",
  unmute: "AAAAAQAAAAEAAAAUAw==",
  play: "AAAAAgAAAJcAAAAaAw==",
  pause: "AAAAAgAAAJcAAAAZAw==",
  home: "AAAAAQAAAAEAAABgAw==",
  back: "AAAAAgAAAJcAAAAjAw==",
};

export class SonyAdapter implements TVAdapter {
  brand = "sony" as const;
  ip?: string;
  psk: string;

  constructor(ip?: string, psk = "0000") {
    this.ip = ip;
    this.psk = psk;
  }

  private async ircc(code: string) {
    const body =
      `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ` +
      `s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>` +
      `<u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">` +
      `<IRCCCode>${code}</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>`;
    await fetch(`http://${this.ip}/sony/IRCC`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=UTF-8",
        SOAPACTION: '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
        "X-Auth-PSK": this.psk,
      },
      body,
    });
  }

  private async rest(path: string, method: string, params: any[] = []) {
    await fetch(`http://${this.ip}/sony/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Auth-PSK": this.psk },
      body: JSON.stringify({ method, params, id: 1, version: "1.0" }),
    });
  }

  async execute(cmd: TVCommand, state: TVState): Promise<{ state: TVState; status: ExecStatus; message: string }> {
    const result = applyCommand(state, cmd);
    if (!this.ip) return result;

    try {
      if (cmd.intent === "power_on") {
        await this.rest("system", "setPowerStatus", [{ status: true }]);
      } else if (cmd.intent === "set_volume") {
        await this.rest("audio", "setAudioVolume", [{ target: "speaker", volume: String(cmd.value ?? state.volume) }]);
      } else if (IRCC[cmd.intent]) {
        await this.ircc(IRCC[cmd.intent]!);
      }
      // open_app would use setActiveApp with the app's URI (model-specific).
      return result;
    } catch {
      return { ...result, message: result.message + " (sent optimistically; TV not reachable here)" };
    }
  }
}
