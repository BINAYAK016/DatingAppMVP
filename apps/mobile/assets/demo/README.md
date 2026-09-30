# Fictional demo artwork

These five portraits were generated with the built-in image generation tool on 1 October 2026 for the server's existing, explicitly fictional local demo accounts. They are not real users, verification evidence or profile uploads. `src/lib/demoArt.ts` requires both the demo flag and one of the fixed demo IDs. Authenticated user photos take precedence. Real accounts never receive a generated fallback portrait.

Final files: `aarav.jpg`, `anaya.jpg`, `samira.jpg`, `rohan.jpg`, `nisha.jpg`. Originals remain at the tool's generated-image destination. Project copies are resized to 900 pixels wide and JPEG-compressed for bundled mobile performance.

## Prompt set

Shared prompt: "Use case: photorealistic-natural. Asset type: portrait for a clearly labeled fictional demo profile in Sangai's private beta. [Subject below] Original invented person, not a real person's likeness. Editorial candid photograph, vertical 2:3 portrait, head and upper torso visible, natural skin texture, soft afternoon daylight, face in upper middle with enough breathing room for profile card cropping. Elegant authentic casual mood, warm neutral palette, gentle depth of field. No text, logos, watermark, UI, border or fashion-ad glamour. Adult fully clothed. Single portrait only."

- Aarav: "Fictional Nepali man, age 28, short textured black hair, warm candid smile, light olive overshirt, sitting outside a quiet cafe with soft greenery."
- Anaya: "Fictional Nepali woman, age 28, shoulder-length dark hair, warm candid smile, cream linen shirt, standing near a pottery studio with subtle sunlit terracotta background."
- Samira: "Fictional Nepali woman, age 28, long dark hair loosely tied, cheerful natural smile, muted rose casual top, candid outdoor portrait in a leafy Kathmandu courtyard."
- Rohan: "Fictional Nepali man, age 28, medium-length dark hair, light stubble, relaxed warm smile, cream knit casual shirt, coastal Sydney garden background softly blurred."
- Nisha: "Fictional Nepali woman, age 28, long wavy dark hair, thoughtful warm smile, light peach casual shirt, quiet lakeside greenery and softly blurred hills."
