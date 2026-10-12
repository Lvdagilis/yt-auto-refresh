# YouTube Auto-Refresh (Brave Fix)

A small browser extension that detects when a YouTube watch page loads into the
broken "blinking screen / 0:00 duration" state and automatically refreshes the
page until the video plays correctly.

## Install in Brave

1. Unzip this folder somewhere permanent (don't delete it after — Brave loads it
   from this location).
2. Go to `brave://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped `yt-auto-refresh` folder.
5. Open a YouTube video. If it loads broken, you'll see a small notice and the
   page will refresh itself.

## How it detects "broken"

A working video — even one you haven't pressed play on, even with autoplay
blocked — always reports a real `video.duration`. The broken state leaves the
duration at 0 / NaN (which is why you see `0:00`). So the rule is:

> No valid duration after a short grace period = broken = refresh.

It also treats YouTube's explicit error overlay as broken, and correctly ignores
ads and live streams (which are working states).

## Loop protection

Each video gets a reload counter stored per browser tab. After `Max refreshes /
video` attempts (default 3) it stops and leaves the page for you, so a genuinely
unplayable video (premiere not started, region-blocked, age-gated) can't refresh
forever. The counter resets the moment a video loads correctly.

## Settings (toolbar popup)

- **Enabled** — master on/off.
- **Wait before refresh** (`graceMs`, default 4000 ms) — how long to wait before
  deciding a video is broken. Raise it if you're on a slow connection and see
  unnecessary refreshes.
- **Max refreshes / video** — the retry cap described above.
- **Show on-page notice** — the little toast that appears when it refreshes.

Changes apply to the next video you open.

## Notes / limitations

- Works on both hard loads and in-page navigation (clicking a thumbnail). When a
  broken player is found after an in-page navigation, it does a full reload of
  that video's URL, which is what actually clears the bug.
- It can't tell a genuinely slow load from a broken one with 100% certainty —
  that's what the grace period and retry cap are for. The defaults are tuned for
  a fast connection where the player breaks on a race condition rather than on
  network speed.
- No data leaves your browser; the only permission used is `storage` for your
  settings.
