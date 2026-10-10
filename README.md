# Rabbit Run: Carrot Trials

A small, dependency-free browser game prototype. It is designed to be hosted on GitHub Pages and expanded in later iterations.

## Run locally
Open `index.html` in a modern browser. No build step or server is required.

## Publish with GitHub Pages
1. Create a new GitHub repository.
2. Upload `index.html`, `style.css`, and `game.js` (or upload this ZIP and extract it first).
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Wait for the Pages URL to appear.

## Current prototype
- English UI and an original canvas-drawn rabbit.
- Endless runner with stumps, spikes, and flying enemies.
- Hard from the first stage; obstacle speed and density ramp over time.
- Stage-clear rewards: carrot points.
- Each run costs 5 carrots.
- If the player loses very early in Stage 1, the entry fee is returned, so there is no net gain. Otherwise, the entry fee is spent.
- Best score, furthest stage, and carrot balance persist in the browser's local storage.
- No backend, accounts, payments, or real-money rewards.

## Controls
- `Space` or `↑`: jump
- `↓`: duck while grounded (helps with low flying enemies)
- Touch/click the game area: jump

## Notes for the next iteration
This is a playable first prototype, not a production economy. The balance is stored locally and can be reset or edited by the player; it is not secure for competitive play. Before adding leaderboards, accounts, or transferable points, move game state and reward validation to a server. Test difficulty on desktop and mobile and tune the obstacle spacing after playtesting.
