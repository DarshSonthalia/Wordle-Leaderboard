# Minimal Custom Wordle + Live Leaderboard

A deliberately simple custom Wordle clone inspired by the straightforward flow of mywordle.strivemath.com, with an automatic leaderboard.

## What is intentionally minimal

- No accounts
- No player-name field
- No "submit score" button
- No separate leaderboard page/button
- Players automatically receive a random two-word alias such as `Swift Panda`
- The leaderboard starts completely empty — there is no sample data
- A score is added only when a real player successfully solves that specific shared Wordle
- Rankings are ordered by fewest guesses first
- The creator's leaderboard refreshes automatically every 3 seconds
- Each generated Wordle receives its own invisible game ID, so two creators using the same answer do not share scores
- Replaying the same puzzle from the same browser does not create duplicate entries; the best guess count is kept


## Demo

A 17-second product walkthrough is included at:

```text
demo/wordle-leaderboard-demo.mp4
```

It shows the full minimal flow: create a custom Wordle → generated link + empty leaderboard → first player solves it → a second player opens the same link in a separate window → both sessions show the same live leaderboard.

## Run locally

Requirements: Node.js 18 or newer.

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

No `npm install` is required because the project uses only Node's built-in modules and plain HTML/CSS/JavaScript.

## How it works

1. Click **Make your own wordle**.
2. Enter a word and click **Generate Link**.
3. A unique game ID is silently added to the share link.
4. Copy/open the generated link.
5. The player is assigned a random alias automatically.
6. They play the six-guess Wordle.
7. On a successful solve, their alias + guess count is stored in `data/scores.json` under that game ID.
8. The leaderboard is generated entirely from those real stored results.
9. The creator's open leaderboard checks for new scores every 3 seconds.

## Important localhost note

The leaderboard is live for everyone who can reach the same running Node server. If you open the app from `localhost`, that normally means browsers on your own computer only. If you access the server through your computer's LAN address, other devices on the same network can use the generated link. For a public internet link, deploy the Node app to a host such as Render, Railway, Fly.io, or similar.

The answer is still lightly obfuscated in the URL for this prototype. For a production competition, store the answer server-side and expose only the game ID.
