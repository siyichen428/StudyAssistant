# OpenAI model

`gpt-5.6-luna`

# StudyAssistant Version 1

After each save point, push it to GitHub.

## How to run

```text
node server.js
```

Then open http://localhost:3000 in a browser.

## What's done

- Saved the competition and safety plan in `BRIEF.md`.
- Added a plain HTML/CSS/JavaScript Phaser 3 game with a start screen, score, one short obby level, touch controls, keyboard controls, and Game Over / Play Again screens.
- Connected the Proofread and Make a worksheet actions to the OpenAI API through a server-side endpoint; the key stays off the game page and the game pauses on “Thinking…”.
- Added safety reminders and prompts that ask for hints, outlines, and feedback instead of doing the student’s work.
- Tested the end-to-end AI-to-game flow with a sample question; the game pauses while thinking and then starts the playable level.
- Required the student to submit their own attempt before the obby unlocks.
- Made the obby longer and different each run with 24 generated platforms, reachable gap limits, spikes below and on some platforms, coins, and color crates.
- Added a 3D-style perspective using beveled platform faces, a white starting character, and a click-to-open picker for colors unlocked from crates.
- Updated the player to a colored circle with two eyes and a smiling mouth; changing the selected color updates the in-game character.
- Added a subject selector for Math, History, Writing, Science, Reading, and Other so worksheet and proofreading help can be tailored across subjects.
- Added an on-demand step-by-step help button that guides students through a problem without simply giving the final answer.
- Made the obby slightly easier, strengthened its 3D-style perspective, and added a coin shop for color and decoration packs.
- Added a retry button so students can request a fresh AI answer when the previous answer seems incorrect.
- Added answer checking before the obby unlocks; incorrect attempts show “Sorry, try again” with an explanation.
- Strengthened the AI guidance so it teaches with hints and methods without giving final answers.

## Put it online with Vercel

1. Push this repository to GitHub and import it into Vercel.
2. Keep the Vercel project settings at their defaults. `vercel.json` sets `public` as the static output and disables the build command; `api/ai.js` is the only server function.
3. In Vercel Project Settings → Environment Variables, add these two names for the Production environment:
   - `KEYGEN_URL` — the server-side URL for the key service.
   - `KEYGEN_TOKEN` — the server-side token for that service.
4. Redeploy. The browser sends requests to `/api/ai`; only the Vercel function calls the key service and OpenAI. Neither secret is sent to the browser.

No other Vercel setting is required. Do not add `OPENAI_API_KEY` to Vercel for the online deployment: local `server.js` still uses the ignored `.env` file on this computer, while Vercel uses `getKey()` with `KEYGEN_URL` and `KEYGEN_TOKEN`.

## Maybe Later

- Add the color pack and decoration pack coin shop.
- Expand the short obby into an infinite level system.
- Add student testing, more levels, sound, art, and a reward inventory.
- Prepare the short competition video and written PDF entry before the December deadlines.
