// One-time connectivity test: connect to the Samsung TV, get the auth token
// (you must approve the popup ON THE TV), then send MUTE.
const { Samsung, KEYS } = require("samsung-tv-control");

const control = new Samsung({
  name: "AITVRemote",
  ip: "192.168.1.206",
  mac: "F4:DD:06:69:77:BA",
  port: 8002,
  debug: false,
  saveToken: true, // writes the token to disk so we only approve once
});

(async () => {
  try {
    console.log(">> Connecting to TV. WATCH THE TV: approve the 'Allow' popup with your physical remote.");
    const token = await control.getTokenPromise();
    console.log(">> TOKEN:", token || "(none returned)");
    await control.sendKeyPromise(KEYS.KEY_MUTE);
    console.log(">> Sent KEY_MUTE. Did the TV mute or unmute?");
  } catch (e) {
    console.error(">> ERROR:", (e && e.message) || e);
  }
  process.exit(0);
})();
