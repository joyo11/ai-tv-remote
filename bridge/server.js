// Local bridge: HTTP API on your laptop (same Wi-Fi as the TV) that the
// AI TV Remote app calls. Keeps a token'd WebSocket to the Samsung TV and
// maps our intents to real remote keys / app launches.
//
// Run:  node bridge/server.js
// Then point the app's Samsung device at  http://<this-laptop-ip>:3000

const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");

const IP = process.env.TV_IP || "192.168.1.206";
const PORT = 3777;
const NAME = Buffer.from("AITVRemote").toString("base64");
const TOKEN_FILE = __dirname + "/token.txt";

function token() {
  return fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, "utf8").trim() : "";
}

// intent -> Samsung remote key
const KEY = {
  power_off: "KEY_POWER",
  volume_up: "KEY_VOLUP",
  volume_down: "KEY_VOLDOWN",
  mute: "KEY_MUTE",
  unmute: "KEY_MUTE",
  play: "KEY_PLAY",
  pause: "KEY_PAUSE",
  home: "KEY_HOME",
  back: "KEY_RETURN",
  switch_input: "KEY_SOURCE",
  up: "KEY_UP", down: "KEY_DOWN", left: "KEY_LEFT", right: "KEY_RIGHT", ok: "KEY_ENTER",
};

// app name -> Tizen app id
const APP_ID = {
  YouTube: "111299001912",
  Netflix: "11101200001",
  "Prime Video": "3201910019365",
  "Disney+": "3201901017640",
  Spotify: "3201606009684",
};

// one short-lived authorized socket per action (simple + reliable)
function withSocket(fn) {
  return new Promise((resolve, reject) => {
    const url = `wss://${IP}:8002/api/v2/channels/samsung.remote.control?name=${NAME}&token=${token()}`;
    const ws = new WebSocket(url, { rejectUnauthorized: false });
    const t = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("timeout")); }, 6000);
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.event === "ms.channel.connect") {
        Promise.resolve(fn(ws)).then(() => {
          clearTimeout(t);
          setTimeout(() => { try { ws.close(); } catch {} resolve(true); }, 400);
        }).catch((e) => { clearTimeout(t); reject(e); });
      }
    });
    ws.on("error", (e) => { clearTimeout(t); reject(e); });
  });
}

function sendKey(ws, key) {
  ws.send(JSON.stringify({
    method: "ms.remote.control",
    params: { Cmd: "Click", DataOfCmd: key, Option: "false", TypeOfRemote: "SendRemoteKey" },
  }));
}

function launchApp(ws, appId) {
  ws.send(JSON.stringify({
    method: "ms.channel.emit",
    params: { event: "ed.apps.launch", to: "host", data: { appId, action_type: "DEEP_LINK" } },
  }));
}

async function execute(cmd) {
  const { intent, app, value } = cmd;
  if (intent === "open_app" || intent === "open_and_search") {
    const id = APP_ID[app];
    if (!id) return { ok: false, message: `Unknown app: ${app}` };
    await withSocket((ws) => launchApp(ws, id));
    return { ok: true, message: `Launched ${app}` };
  }
  if (intent === "set_volume") {
    // No direct setVolume over local WS; step toward target from a nudge.
    const steps = Math.min(30, Math.max(1, Math.round((value ?? 10) / 2)));
    await withSocket(async (ws) => { for (let i = 0; i < steps; i++) { sendKey(ws, "KEY_VOLUP"); await sleep(60); } });
    return { ok: true, message: `Nudged volume up ~${steps} (precise set needs SmartThings)` };
  }
  const key = KEY[intent];
  if (!key) return { ok: false, message: `No key mapping for ${intent}` };
  await withSocket((ws) => sendKey(ws, key));
  return { ok: true, message: `Sent ${key}` };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, tv: IP, hasToken: !!token() }));
  }

  if (req.method === "POST" && req.url === "/command") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const cmd = JSON.parse(body || "{}");
        const result = await execute(cmd);
        res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, message: String(e && e.message || e) }));
      }
    });
    return;
  }
  res.writeHead(404); res.end("not found");
});

srv.listen(PORT, () => console.log(`Bridge on http://localhost:${PORT}  ->  TV ${IP}  (token: ${token() ? "yes" : "NO"})`));
