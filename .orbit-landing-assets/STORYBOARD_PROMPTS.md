# lets-scroll Asset Generation Spec for Orbit Universal Runtime
# Architecture: Continuous Forward Walkthrough (Architecture A)
# Palette: Emerald #34d399 (CLI), Blue #60a5fa (Desktop), Rose #fb7185 (Mobile), Dark Canvas #050505
# Aspect: 3:2 landscape (1536x1024 or 1920x1080), 24fps

================================================================================
SECTION 1: ORBIT CLI (The Terminal Core)
================================================================================

[Scene 1 Still: still_cli.png]
Prompt:
Isometric low-poly 3D diorama floating as a sleek high-tech obsidian island on a plain solid #050505 background with a soft contact shadow beneath it. Soft matte clay and dark glass 3D render, rounded futuristic developer workstation, illuminated glowing emerald neon code syntax, floating terminal matrices, gentle warm studio lighting, tilt-shift miniature look. Cohesive color palette of deep obsidian #050505, vibrant emerald green #34d399, soft graphite #1a1a1a, and crisp white highlights. Render a wide 3:2 landscape image, at least 1536 px wide. The background stays a plain solid #050505 across the whole frame — a completely empty backdrop: no sky, no clouds, no horizon, no gradient. Centered composition with headroom. Absolutely no text, no letters, no numbers, no logos.

[Leg 1 Clip: dive_cli.mp4]
Start Frame: still_cli.png
Duration: ~5-6 seconds (24fps, 1080p, no audio)
Prompt:
Single continuous cinematic camera move, no cuts. Start high and far looking down at the obsidian developer terminal island. Slowly glide forward and descend gracefully toward the glowing emerald terminal core. In the final second, settle into a calm, steady forward glide passing straight through the illuminated command portal toward the next workspace chamber. Deep dark aesthetic with glowing emerald #34d399 accents and soft volumetric lighting. Smooth, slow motion, subtle parallax. No text, no captions.

================================================================================
SECTION 2: ORBIT DESKTOP (The Multi-Agent Visual Studio)
================================================================================

[Scene 2 Still: still_desktop.png]
Prompt:
Isometric low-poly 3D diorama floating as a multi-layered glass workspace island on a plain solid #050505 background with a soft contact shadow beneath it. Soft matte clay and frosted glass 3D render, multi-monitor floating UI cards, holographic agent nodes connecting via sleek blue neon fiber threads, modern developer studio interior, gentle warm studio lighting, tilt-shift miniature look. Cohesive color palette of deep obsidian #050505, sapphire electric blue #60a5fa, cool titanium #22272e, and crisp white accents. Render a wide 3:2 landscape image, at least 1536 px wide. The background stays a plain solid #050505 across the whole frame — a completely empty backdrop: no sky, no clouds, no horizon, no gradient. Centered composition. Absolutely no text, no letters, no numbers, no logos.

[Connector 1 Clip: conn_cli_desktop.mp4]
Start Frame: Last frame of dive_cli.mp4
Duration: ~3-4 seconds (24fps, 1080p, no audio)
Prompt:
Single continuous cinematic camera move, no cuts. Continue the same slow, steady forward glide straight out from the emerald terminal portal across an expansive dark digital void, smoothly transitioning into the floating sapphire blue glass desktop workspace. In the final second, settle into a steady forward glide aligned with the desktop workspace's central nexus. Deep dark background #050505, glowing sapphire blue #60a5fa highlights. Smooth, graceful slow motion. No text, no cuts.

[Leg 2 Clip: dive_desktop.mp4]
Start Frame: still_desktop.png (or last frame of conn_cli_desktop.mp4)
Duration: ~5-6 seconds (24fps, 1080p, no audio)
Prompt:
Single continuous cinematic camera move, no cuts. Continue steady forward glide moving right into the heart of the multi-agent visual workspace, sweeping gracefully over glowing blue modular canvases and floating session streams. In the final second, settle back into a slow steady forward glide heading toward a luminous glass doorway leading to the companion chamber. Sleek dark aesthetic with sapphire blue accents #60a5fa. Smooth motion, subtle parallax. No text, no captions.

================================================================================
SECTION 3: ORBIT MOBILE (The Companion Remote Control)
================================================================================

[Scene 3 Still: still_mobile.png]
Prompt:
Isometric low-poly 3D diorama floating as an ultra-compact minimalist handheld station on a plain solid #050505 background with a soft contact shadow beneath it. Soft matte clay and polished obsidian 3D render, miniature glowing wireless beacon, floating holographic status rings with warm rose and magenta neon pulses, cozy portable dock, gentle warm studio lighting, tilt-shift miniature look. Cohesive color palette of deep obsidian #050505, vibrant rose red #fb7185, warm amber, and clean silver highlights. Render a wide 3:2 landscape image, at least 1536 px wide. The background stays a plain solid #050505 across the whole frame — a completely empty backdrop: no sky, no clouds, no horizon, no gradient. Centered composition. Absolutely no text, no letters, no numbers, no logos.

[Connector 2 Clip: conn_desktop_mobile.mp4]
Start Frame: Last frame of dive_desktop.mp4
Duration: ~3-4 seconds (24fps, 1080p, no audio)
Prompt:
Single continuous cinematic camera move, no cuts. Continue the same slow, steady forward glide out of the blue desktop studio across the void, entering into the warm rose-lit handheld command station. In the final second, settle into a gentle forward glide focusing upon the portable remote nexus. Dark solid background #050505 with rose #fb7185 and magenta light accents. Smooth and cinematic. No text, no cuts.

[Leg 3 Clip: dive_mobile.mp4]
Start Frame: still_mobile.png (or last frame of conn_desktop_mobile.mp4)
Duration: ~5-6 seconds (24fps, 1080p, no audio)
Prompt:
Single continuous cinematic camera move, no cuts. Camera sweeps closely past the floating rose holographic status orbs and compact mobile dock, slowly decelerating into a majestic resting hero angle that frames the complete unified Orbit ecosystem. Dark velvet background #050505 with gentle ambient rose glow #fb7185. Slow motion, elegant settle. No text, no captions.

================================================================================
HOW TO PREPARE FILES FOR THE SCRUBBER:
================================================================================
Place the exported video files into `public/orbit-scroll/`:
- `public/orbit-scroll/dive_cli.mp4`
- `public/orbit-scroll/conn_cli_desktop.mp4`
- `public/orbit-scroll/dive_desktop.mp4`
- `public/orbit-scroll/conn_desktop_mobile.mp4`
- `public/orbit-scroll/dive_mobile.mp4`
- Optional stills: `still_cli.png`, `still_desktop.png`, `still_mobile.png`

Encoding command (recommended for buttery-smooth scrub performance):
ffmpeg -i input.mp4 -vf "scale=1920:1080" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -g 8 -movflags +faststart -an output.mp4
