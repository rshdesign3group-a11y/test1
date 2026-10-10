# Rabbit Run: Carrot Trials

A dependency-free browser runner prototype designed for GitHub Pages and future embedding as a mini-game inside another web game.

## Run locally
Open `index.html` in a modern browser. No build step or server is required.

## Publish with GitHub Pages
1. Create a GitHub repository.
2. Upload `index.html`, `style.css`, `game.js`, and `README.md` to the repository root.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Open the Pages URL shown by GitHub.

## Gameplay
- English UI and a canvas-drawn rabbit.
- Endless stages cycling through five visual biomes: Clover Woods, Amber Caves, Moonlit Marsh, Berry Thicket, and Dreaming Burrow.
- Hazards: stumps, spikes, flying birds, wasps, slimes, and foxes.
- Obstacles get faster and more frequent as the run progresses.
- Each run costs 5 carrots. Stage clears award carrot points.
- A very early loss in Stage 1 refunds the entry fee, but awards no profit.
- Best score, furthest stage, and carrot balance persist locally.
- Keyboard: `Space` / `↑` jump; `↓` duck while grounded. Tap/click the game to jump.

## Embedding in another game/site
The game can be embedded in an iframe. Example:

```html
<iframe
  id="carrot-minigame"
  src="https://YOUR-USERNAME.github.io/YOUR-REPO/?embed=1"
  title="Rabbit Run mini-game"
  width="960"
  height="560"
  allow="fullscreen"
></iframe>
```

The embedded game emits `window.postMessage` events to its parent. Messages use `channel: "CARROT_TRIALS"`.

### Host → mini-game
After the iframe loads, send the host's current carrot balance:

```js
const frame = document.getElementById("carrot-minigame");
frame.contentWindow.postMessage({
  channel: "CARROT_TRIALS",
  type: "INIT",
  balance: 100
}, "*");
```

To synchronize the balance later, send `type: "SET_BALANCE"` with a numeric `balance`.

### Mini-game → host
The mini-game can send:
- `READY` — mini-game is ready; includes current balance.
- `RUN_START` — a run began; includes `entryFee`.
- `STAGE_CLEAR` — stage cleared; includes `stage`, `reward`, and `score`.
- `CARROT_BALANCE` — balance changed; includes `balance`, `delta` where applicable, and `reason`.
- `RUN_END` — run ended; includes `stage`, `score`, and `earlyLoss`.

Example host listener:

```js
window.addEventListener("message", (event) => {
  // IMPORTANT: replace this with your trusted GitHub Pages origin.
  if (event.origin !== "https://YOUR-USERNAME.github.io") return;
  const msg = event.data;
  if (!msg || msg.channel !== "CARROT_TRIALS") return;

  if (msg.type === "CARROT_BALANCE") {
    // Update the host UI after validating the event and game session.
    console.log("Reported carrot balance:", msg.balance, msg.reason);
  }
});
```

The page also exposes a convenience API inside the mini-game frame:
- `window.CarrotTrials.getBalance()`
- `window.CarrotTrials.setBalance(number)`
- `window.CarrotTrials.addCarrots(number)`
- `window.CarrotTrials.start()`

## Important integration/security note
This is a prototype integration bridge, not a secure economy. Browser-side messages and local storage can be spoofed by a player. For a real shared carrot wallet, your main game/server must own the authoritative balance and validate entry fees and stage rewards server-side. Do not blindly trust `CARROT_BALANCE` from the iframe; treat gameplay events as requests/evidence to validate. Use a strict `event.origin`, session identifiers, and server-side reward checks before adding/subtracting shared points. The wildcard target origin in the sample is for simple cross-origin prototyping only.

## Suggested next milestones
1. Test obstacle balance on desktop and mobile.
2. Add sprite sheets and sound effects.
3. Add a stage intro/transition and unique stage mechanics.
4. Add host-issued session tokens and server-authoritative carrot transactions.
