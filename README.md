# AI TV Remote

Control Sony and Samsung smart TVs with natural language, by voice or text. One
Expo codebase that runs as a **phone app** (the "hold it like a remote"
experience) and a **web app**.

Say or type things like:
- "Open YouTube and play cricket highlights"
- "Set volume to 25"
- "Switch to HDMI 1"
- "Turn off after 30 minutes"
- "Mute the TV"

## How it works

```
You (voice / text)
   -> AI intent parser        natural language to a structured command
   -> command router          applies the command, returns feedback
   -> TV adapter              Simulated / Samsung / Sony
   -> TV                      action happens, app shows the new state
```

- **AI intent parser** (`src/intentParser.ts`) turns natural language into a
  structured `TVCommand` (16 intents: power, volume, mute, open app, search,
  open-and-search, switch input, play, pause, home, back, sleep timer, clarify).
  It is fast and offline (rule-based, no API key), with an `parseWithLLM` hook to
  swap in an LLM for fuzzier phrasing.
- **Command router** (`src/router.ts`) is a pure function that applies a command
  to TV state and returns a human message, with guards (for example, it tells
  you to turn the TV on first).
- **Adapters** (`src/adapters/`):
  - `simulated` , default, needs no hardware, drives the full flow for demos and
    for the web build.
  - `samsung` , real Tizen local WebSocket remote control.
  - `sony` , real Bravia IP control (IRCC + REST).

## Run it

Install once:

```bash
cd ai-tv-remote
npm install
```

Web (opens in the browser):

```bash
npx expo start --web
```

Phone (the real remote experience):

```bash
npx expo start
```

Then scan the QR code with the **Expo Go** app on your phone.

## Controlling a real TV

Real Sony/Samsung control only works when the app is on the **same Wi-Fi as the
TV** (the phone app, or a small local bridge). In a desktop browser the LAN
connection is blocked, so commands run against the **simulated TV**.

1. Open the **Devices** tab.
2. Pick Samsung or Sony and enter the TV's IP address.
3. Samsung asks you to approve the connection on the TV the first time. Sony
   needs IP control enabled with a Pre-Shared Key (Settings > Network > Home
   network > IP control).

Power-on over the network needs Wake-on-LAN, which varies by model.

## Project structure

```
ai-tv-remote/
  App.tsx                 mobile-first remote UI (Remote / Devices / History)
  src/
    types.ts              shared types (TVCommand, TVState, ...)
    intentParser.ts       natural language -> structured command
    router.ts             apply command to state + feedback
    adapters/
      index.ts            adapter contract + factory
      simulated.ts        no-hardware demo TV
      samsung.ts          Tizen WebSocket control
      sony.ts             Bravia IP control
```

## Stack

Expo, React Native, React Native Web, TypeScript. Voice uses the Web Speech API
in the browser.

## Status

MVP: text and voice commands, the full intent set, live TV state, command
history, device management, and a simulated TV so the whole flow is demoable
today. Real Samsung/Sony adapters are written and ready for a TV on the network.
