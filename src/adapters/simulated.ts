// Simulated TV: no hardware needed. Drives the full app flow for demos and
// for the web build (where a browser can't reach a TV on the LAN directly).

import { applyCommand } from "../router";
import { ExecStatus, TVCommand, TVState } from "../types";
import { TVAdapter } from "./index";

export class SimulatedAdapter implements TVAdapter {
  brand = "simulated" as const;

  async execute(cmd: TVCommand, state: TVState): Promise<{ state: TVState; status: ExecStatus; message: string }> {
    // Tiny delay so the UI feels like it's talking to a device.
    await new Promise((r) => setTimeout(r, 120));
    return applyCommand(state, cmd);
  }
}
