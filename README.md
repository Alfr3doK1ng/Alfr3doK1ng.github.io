# alfredcodes.icu — Director's Cut

Personal site of Hanzhe "Alfred" Long, built to play like a film you scrub through: a viewfinder HUD, a timecode
that follows the scroll, and an editing timeline that doubles as the chapter nav.

Static HTML/CSS/JS, no framework and no build step. GitHub Pages serves the repo root (`.nojekyll` turns Jekyll off);
the custom domain is in `CNAME`.

## Run locally

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173. The page uses ES modules, so it has to be served over HTTP, not opened as a file.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | All content, scene by scene (SC.01 cold open → SC.10 end credits) |
| `assets/css/main.css` | Design tokens, layout, CSS-only preview art, responsive and reduced-motion rules |
| `assets/js/main.js` | Boot, Lenis smooth scroll, intro leader, hero type field, timeline/timecode, scroll choreography |
| `assets/js/hero-gl.js` | Raw WebGL light-leak / anamorphic-flare shader behind the hero |
| `assets/js/cursor.js` | Viewfinder cursor that locks onto links and buttons |
| `assets/js/media.js` | Screening room loops, theater playback, VFX compare slider, draggable polaroids |
| `assets/vendor/` | GSAP 3.14.2 (+ ScrollTrigger, SplitText) and Lenis 1.3.23, vendored |
| `assets/media/` | Web encodes of the reels: `<id>.mp4` (720p, sound), `<id>-loop.mp4` (6 s silent preview), `<id>.jpg` (poster) |
| `assets/img/` | Favicon, Open Graph image, `life/` photos for the Off camera wall |

## Adding a reel

Encode a full cut, a silent loop and a poster into `assets/media/` (720p H.264 with `+faststart` keeps them small),
then copy one of the `<li class="daily ...">` blocks in the Screening room and change `data-play`, the title and the
copy. The theater picks the file up from `data-play` automatically.

## Accessibility and motion

`prefers-reduced-motion` turns off smooth scrolling, the intro, pinning and scrubbed animation, and the shader
renders a single still frame. The **Pause motion** button in the timeline freezes grain, loops and the shader for
everyone else. Everything is readable without JavaScript.
