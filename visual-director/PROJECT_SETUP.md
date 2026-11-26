# ChatGPT Visual Director setup

1. Add the master prompt, design system, motion guide, and golden SVG or PNG to your Visual Director ChatGPT Project.
2. Set its project instructions to follow the dashboard's current production contract and the shared visual guides. For interactive requests, return one fenced `json` code block containing the complete object with no surrounding prose. The automated pipeline requests raw JSON through its own adapter.
3. Open a job with saved script, voiceover and word timings. Select Manual, click Copy Visual Prompt, and paste it into ChatGPT. Paste the whole response into SocialStudio and click Generate Visuals.
4. For unresolved validation errors, use Copy Repair Prompt in the same chat and submit the complete repaired response. The per-job prompt includes the active schema, renderer capabilities, cue IDs and bindings.

Keep credentials and private file paths out of Project sources.
