# Cruz HyperFrames

Quote.mp4 is enhanced through the existing HyperFrames, GSAP, FFmpeg, and GitHub Actions pipeline. The workflow explicitly selects Quote.mp4, never another MP4.

## Editable animation
- `quote.config.json`: exact quotation, text layout, camera keyframes, duration and original pose selection.
- `scripts/prepare-quote.py`: separates the original character and pointing arm, removing baked text and source arm trails.
- `scripts/build-composition.mjs`: existing entry point; dispatches Quote.mp4 to `scripts/build-quote.mjs`.
- `scripts/build-quote.mjs`: deterministic GSAP composition with eased shoulder movement, camera motion and independent word layers.
- `scripts/preview-quote.mjs`: browser previews, exact text, blue emphasis, readability and per-frame continuity checks.
- `scripts/verify-quote.mjs`: complete MP4 decode, dimensions, frame rate, frame count, duration and source audio checks.

The 1.75-second source contains 21 decoded poses at 12 FPS and no audio. This edit uses its original pointing artwork as separate raster layers, rather than manufacturing optical-flow poses or repeating the abrupt final transition. Generated layers and HTML remain available in the workflow's review diagnostics.

## Timeline
0–1s gentle character zoom; 1–2s eased pointing gesture and camera follow; 2–3.5s progressive quotation reveal; 3.5–5s readable hold with a subtle push-in.

## Delivery
The workflow renders `Quote-Enhanced.mp4` at 1920x1080, 30 FPS, H.264 with fast-start metadata. A separate publishing job receives only that verified MP4 and has `contents: write`; rendering has only `contents: read`. It publishes an individual GitHub Release video asset, downloads it without authentication, and compares the downloaded bytes to the verified render.

The original generic builder is retained for other videos, but the Quote workflow does not select or render them.
