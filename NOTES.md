# OpenAI model

`gpt-5.6-luna`

# StudyAssistant Version 1

## How to run

```text
node server.js
```

Then open http://localhost:3000 in a browser.

## What's done

- Saved the competition and safety plan in `BRIEF.md`.
- Added a plain HTML/CSS/JavaScript Phaser 3 game with a start screen, score, one short obby level, touch controls, keyboard controls, and Game Over / Play Again screens.
- Connected the Proofread and Make a worksheet actions to the OpenAI API through `server.js`; the key stays in `.env` and the game pauses on “Thinking…”.
- Added safety reminders and prompts that ask for hints, outlines, and feedback instead of doing the student’s work.
- Tested the end-to-end AI-to-game flow with a sample question; the game pauses while thinking and then starts the playable level.

## Maybe Later

- Add the color pack and decoration pack coin shop.
- Expand the short obby into an infinite level system.
- Add student testing, more levels, sound, art, and a reward inventory.
- Prepare the short competition video and written PDF entry before the December deadlines.
