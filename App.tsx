import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform, StatusBar,
} from "react-native";
import { parseCommand } from "./src/intentParser";
import { getAdapter } from "./src/adapters";
import { Device, HistoryItem, TVState, DEFAULT_STATE } from "./src/types";

const C = {
  bg: "#0B0E13", surface: "#151A22", surface2: "#1C232E", line: "#283041",
  ink: "#EAF0F8", mute: "#8A97AB", accent: "#4F8CFF", on: "#37D67A",
  warn: "#F2B53C", off: "#E25767",
};

const QUICK = [
  { label: "Power", cmd: "toggle power", icon: "⏻", tone: "off" },
  { label: "Mute", cmd: "mute", icon: "🔇", tone: "" },
  { label: "Vol +", cmd: "volume up", icon: "＋", tone: "" },
  { label: "Vol −", cmd: "volume down", icon: "－", tone: "" },
  { label: "Play", cmd: "play", icon: "▶", tone: "" },
  { label: "Pause", cmd: "pause", icon: "⏸", tone: "" },
  { label: "Home", cmd: "home", icon: "⌂", tone: "" },
  { label: "Back", cmd: "go back", icon: "↩", tone: "" },
];
const APPS = ["YouTube", "Netflix", "Prime Video", "Disney+"];
const INPUTS = ["HDMI 1", "HDMI 2", "HDMI 3", "TV"];
const SUGGESTIONS = [
  "Open YouTube and play cricket highlights",
  "Set volume to 25",
  "Switch to HDMI 1",
  "Turn off after 30 minutes",
  "Mute the TV",
];

export default function App() {
  const [devices, setDevices] = useState<Device[]>([
    { id: "sim", brand: "simulated", name: "Living Room TV (Demo)", isDefault: true },
  ]);
  const [currentId, setCurrentId] = useState("sim");
  const [tv, setTv] = useState<TVState>(DEFAULT_STATE);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; status: string }>({ msg: "Ready.", status: "ok" });
  const [tab, setTab] = useState<"remote" | "devices" | "history">("remote");
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const current = devices.find((d) => d.id === currentId) ?? devices[0];

  async function run(raw: string) {
    const cmd = parseCommand(raw);
    if (raw.toLowerCase().includes("toggle power")) {
      cmd.intent = tv.power ? "power_off" : "power_on";
      cmd.confidence = 0.99;
    }
    const adapter = getAdapter(current.brand, current.ip);
    const res = await adapter.execute(cmd, tv);
    setTv(res.state);
    setFeedback({ msg: res.message, status: res.status });
    setHistory((h) =>
      [
        { id: String(Date.now()), rawText: raw, command: cmd, status: res.status, message: res.message, at: Date.now() },
        ...h,
      ].slice(0, 50)
    );
  }

  function submit() {
    const t = text.trim();
    if (!t) return;
    run(t);
    setText("");
  }

  function toggleMic() {
    const SR = (globalThis as any).webkitSpeechRecognition || (globalThis as any).SpeechRecognition;
    if (!SR) {
      setFeedback({ msg: "Voice needs the mobile app or a supported browser. Type a command for now.", status: "clarify" });
      return;
    }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => { const said = e.results[0][0].transcript; setText(said); run(said); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  }

  return (
    <View style={s.app}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <View style={s.brandRow}>
          <View style={s.logo}><Text style={{ fontSize: 16 }}>📺</Text></View>
          <View>
            <Text style={s.brand}>AI TV Remote</Text>
            <Pressable onPress={() => setTab("devices")}>
              <Text style={s.brandSub}>{current.name} ▾</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1 }} />
          <View style={[s.dot, { backgroundColor: tv.power ? C.on : C.off }]} />
          <Text style={s.statusTxt}>{tv.power ? "ON" : "OFF"}</Text>
        </View>
        <View style={s.stateRow}>
          <StatePill label="Volume" value={tv.muted ? "Muted" : String(tv.volume)} />
          <StatePill label="Input" value={tv.input} />
          <StatePill label="App" value={tv.app ?? "—"} />
          <StatePill label="Playback" value={tv.playing ? "Playing" : "Paused"} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
        {tab === "remote" && (
          <>
            <View style={[s.feedback, { borderColor: feedback.status === "ok" ? C.line : feedback.status === "error" ? C.off : C.warn }]}>
              <Text style={s.feedbackTxt}>{feedback.msg}</Text>
            </View>

            <View style={s.cmdRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Tell the TV what to do…"
                placeholderTextColor={C.mute}
                style={s.input}
                onSubmitEditing={submit}
                returnKeyType="send"
              />
              <Pressable onPress={toggleMic} style={[s.mic, listening && { backgroundColor: C.off }]}>
                <Text style={{ fontSize: 18 }}>{listening ? "■" : "🎤"}</Text>
              </Pressable>
              <Pressable onPress={submit} style={s.send}><Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text></Pressable>
            </View>

            <View style={s.chips}>
              {SUGGESTIONS.map((sug) => (
                <Pressable key={sug} style={s.chip} onPress={() => run(sug)}>
                  <Text style={s.chipTxt}>{sug}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.section}>QUICK CONTROLS</Text>
            <View style={s.grid}>
              {QUICK.map((q) => (
                <Pressable key={q.label} style={s.qbtn} onPress={() => run(q.cmd)}>
                  <Text style={[s.qicon, q.tone === "off" && { color: C.off }]}>{q.icon}</Text>
                  <Text style={s.qlabel}>{q.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.section}>APPS</Text>
            <View style={s.rowWrap}>
              {APPS.map((a) => (
                <Pressable key={a} style={s.pill} onPress={() => run(`open ${a}`)}>
                  <Text style={s.pillTxt}>{a}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.section}>INPUTS</Text>
            <View style={s.rowWrap}>
              {INPUTS.map((i) => (
                <Pressable key={i} style={[s.pill, tv.input === i && { borderColor: C.accent }]} onPress={() => run(`switch to ${i}`)}>
                  <Text style={[s.pillTxt, tv.input === i && { color: C.accent }]}>{i}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {tab === "devices" && (
          <DevicesTab devices={devices} currentId={currentId} setCurrentId={setCurrentId} addDevice={(d: Device) => setDevices((x) => [...x, d])} />
        )}

        {tab === "history" && <HistoryTab history={history} rerun={run} />}
      </ScrollView>

      <View style={s.tabs}>
        <Tab label="Remote" active={tab === "remote"} onPress={() => setTab("remote")} icon="🎛" />
        <Tab label="Devices" active={tab === "devices"} onPress={() => setTab("devices")} icon="📡" />
        <Tab label="History" active={tab === "history"} onPress={() => setTab("history")} icon="🕘" />
      </View>
    </View>
  );
}

function StatePill({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.spill}>
      <Text style={s.spillL}>{label}</Text>
      <Text style={s.spillV} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Tab({ label, active, onPress, icon }: any) {
  return (
    <Pressable style={s.tab} onPress={onPress}>
      <Text style={{ fontSize: 18, opacity: active ? 1 : 0.5 }}>{icon}</Text>
      <Text style={[s.tabTxt, active && { color: C.accent }]}>{label}</Text>
    </Pressable>
  );
}

function DevicesTab({ devices, currentId, setCurrentId, addDevice }: any) {
  const [brand, setBrand] = useState<"samsung" | "sony">("samsung");
  const [ip, setIp] = useState("");
  return (
    <View>
      <Text style={s.section}>YOUR DEVICES</Text>
      {devices.map((d: Device) => (
        <Pressable key={d.id} style={[s.deviceRow, d.id === currentId && { borderColor: C.accent }]} onPress={() => setCurrentId(d.id)}>
          <Text style={{ fontSize: 20 }}>{d.brand === "simulated" ? "🧪" : "📺"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.devName}>{d.name}</Text>
            <Text style={s.devSub}>{d.brand}{d.ip ? ` · ${d.ip}` : ""}</Text>
          </View>
          {d.id === currentId && <Text style={{ color: C.accent, fontWeight: "700" }}>✓</Text>}
        </Pressable>
      ))}
      <Text style={s.section}>ADD A REAL TV</Text>
      <View style={s.rowWrap}>
        <Pressable style={[s.pill, brand === "samsung" && { borderColor: C.accent }]} onPress={() => setBrand("samsung")}><Text style={[s.pillTxt, brand === "samsung" && { color: C.accent }]}>Samsung</Text></Pressable>
        <Pressable style={[s.pill, brand === "sony" && { borderColor: C.accent }]} onPress={() => setBrand("sony")}><Text style={[s.pillTxt, brand === "sony" && { color: C.accent }]}>Sony</Text></Pressable>
      </View>
      <TextInput value={ip} onChangeText={setIp} placeholder="TV IP address (e.g. 192.168.1.42)" placeholderTextColor={C.mute} style={[s.input, { marginTop: 10 }]} />
      <Pressable
        style={[s.send, { marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 18 }]}
        onPress={() => { if (ip.trim()) { addDevice({ id: String(Date.now()), brand, name: `${brand === "samsung" ? "Samsung" : "Sony"} TV`, ip: ip.trim() }); setIp(""); } }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Add device</Text>
      </Pressable>
      <Text style={s.note}>Real control needs the app on the same Wi-Fi as the TV (phone app or a local bridge). In a browser, commands run on the simulated TV.</Text>
    </View>
  );
}

function HistoryTab({ history, rerun }: { history: HistoryItem[]; rerun: (s: string) => void }) {
  if (!history.length) return <Text style={s.note}>No commands yet. Try the remote tab.</Text>;
  return (
    <View>
      <Text style={s.section}>RECENT COMMANDS</Text>
      {history.map((h) => (
        <Pressable key={h.id} style={s.histRow} onPress={() => rerun(h.rawText)}>
          <View style={[s.hdot, { backgroundColor: h.status === "ok" ? C.on : h.status === "error" ? C.off : C.warn }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.histRaw}>{h.rawText}</Text>
            <Text style={s.histMsg}>{h.command.intent} · {h.message}</Text>
          </View>
          <Text style={s.histReuse}>↻</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === "web" ? 0 : 44 },
  header: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line, padding: 16, paddingTop: 14 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  brand: { color: C.ink, fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
  brandSub: { color: C.mute, fontSize: 12, marginTop: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusTxt: { color: C.mute, fontSize: 11, fontWeight: "700", marginLeft: 5 },
  stateRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  spill: { flex: 1, backgroundColor: C.surface2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 9 },
  spillL: { color: C.mute, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  spillV: { color: C.ink, fontSize: 14, fontWeight: "700", marginTop: 3 },
  feedback: { borderWidth: 1, borderRadius: 12, padding: 13, backgroundColor: C.surface, marginBottom: 14 },
  feedbackTxt: { color: C.ink, fontSize: 14 },
  cmdRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 12, color: C.ink, paddingHorizontal: 14, height: 48, fontSize: 15 },
  mic: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  send: { height: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  chipTxt: { color: C.mute, fontSize: 12.5 },
  section: { color: C.mute, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  qbtn: { width: "22.7%", aspectRatio: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 6 },
  qicon: { fontSize: 22, color: C.ink },
  qlabel: { color: C.mute, fontSize: 11, fontWeight: "600" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  pillTxt: { color: C.ink, fontSize: 13.5, fontWeight: "600" },
  tabs: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingBottom: Platform.OS === "web" ? 8 : 24, paddingTop: 8 },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  tabTxt: { color: C.mute, fontSize: 11, fontWeight: "700" },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 13, marginBottom: 8 },
  devName: { color: C.ink, fontSize: 14, fontWeight: "700" },
  devSub: { color: C.mute, fontSize: 12, marginTop: 2, textTransform: "capitalize" },
  note: { color: C.mute, fontSize: 12, lineHeight: 18, marginTop: 14 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginBottom: 8 },
  hdot: { width: 8, height: 8, borderRadius: 4 },
  histRaw: { color: C.ink, fontSize: 14, fontWeight: "600" },
  histMsg: { color: C.mute, fontSize: 12, marginTop: 2 },
  histReuse: { color: C.accent, fontSize: 18 },
});
