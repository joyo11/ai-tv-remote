// Adapter contract + factory. The command router calls execute(); each brand
// adapter performs the real side effect (or simulates it) and returns the new
// optimistic state plus a human message.

import { Brand, ExecStatus, TVCommand, TVState } from "../types";
import { SimulatedAdapter } from "./simulated";
import { SamsungAdapter } from "./samsung";
import { SonyAdapter } from "./sony";

export interface TVAdapter {
  brand: Brand;
  // Optional network address for real devices.
  ip?: string;
  execute(cmd: TVCommand, state: TVState): Promise<{ state: TVState; status: ExecStatus; message: string }>;
}

export function getAdapter(brand: Brand, ip?: string): TVAdapter {
  if (brand === "samsung") return new SamsungAdapter(ip);
  if (brand === "sony") return new SonyAdapter(ip);
  return new SimulatedAdapter();
}
