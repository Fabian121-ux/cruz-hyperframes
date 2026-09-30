# Cruz HyperFrames

This repository renders the uploaded Cruz MP4 through HyperFrames using GitHub Actions.

## Current automatic edit pass

The workflow:

- detects the uploaded MP4 automatically;
- installs FFmpeg and HyperFrames on a GitHub runner;
- transcribes English dialogue with HyperFrames/whisper.cpp when available;
- creates animated pop-up captions from word timestamps;
- detects visual scene cuts with FFmpeg;
- adds restrained flash/zoom emphasis at detected cuts;
- adds small punch zooms on emphatic caption lines;
- preserves the original video and original audio;
- renders a high-quality MP4;
- uploads the finished render as a GitHub Actions artifact named `cruz-hyperframes-render`.

This is the first technical pass. Meme/reaction overlays and hand-tuned comedic effects should be added after we inspect the transcript and first render instead of inserting random memes blindly.

## Input

The current uploaded source video is:

`093001_1790756792421.mp4`

## Output

After the workflow finishes, open the repository's **Actions** tab, open the latest **Render Cruz with HyperFrames** run, then download the **cruz-hyperframes-render** artifact.
