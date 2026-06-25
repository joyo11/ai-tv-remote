// Direct Samsung Tizen handshake with full logging + self-signed cert allowed.
const WebSocket = require("ws");
const fs = require("fs");

const IP = "192.168.1.206";
const NAME = Buffer.from("AITVRemote").toString("base64");
const TOKEN_FILE = __dirname + "/token.txt";
const savedToken = fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, "utf8").trim() : "";

let url = `wss://${IP}:8002/api/v2/channels/samsung.remote.control?name=${NAME}`;
if (savedToken) url += `&token=${savedToken}`;
console.log(">> connecting:", url.replace(savedToken, savedToken ? "***" : ""));

const ws = new WebSocket(url, { rejectUnauthorized: false });

const timer = setTimeout(() => { console.log(">> TIMEOUT (no response in 35s)"); process.exit(0); }, 35000);

ws.on("open", () => console.log(">> socket OPEN. If you see a popup on the TV, approve it."));

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  console.log(">> message:", JSON.stringify(msg));
  if (msg.event === "ms.channel.connect") {
    const token = msg.data && msg.data.token;
    if (token) { fs.writeFileSync(TOKEN_FILE, token); console.log(">> TOKEN SAVED:", token); }
    // we are authorized — send MUTE
    ws.send(JSON.stringify({
      method: "ms.remote.control",
      params: { Cmd: "Click", DataOfCmd: "KEY_MUTE", Option: "false", TypeOfRemote: "SendRemoteKey" },
    }));
    console.log(">> sent KEY_MUTE — did the TV mute/unmute?");
    setTimeout(() => { clearTimeout(timer); process.exit(0); }, 1500);
  }
});

ws.on("error", (e) => { console.log(">> ERROR:", e.message); clearTimeout(timer); process.exit(0); });
ws.on("close", (c, r) => console.log(">> closed", c, r.toString()));
