## Goal
Surface the current `LOVABLE_API_KEY` value in chat so you can paste it into Vercel's environment variables and get transcription working again.

## Why this works
The Lovable sandbox has `LOVABLE_API_KEY` available as a normal environment variable. The Cloud → Secrets UI hides managed keys behind a copy button that isn't currently working for you, but I can read the same value directly from the sandbox.

## Steps
1. Switch to build mode.
2. Run a single sandbox command that prints `LOVABLE_API_KEY` to the command output.
3. Copy that value from the activity card and paste it into Vercel → Project → Settings → Environment Variables as `LOVABLE_API_KEY` (Production + Preview).
4. Redeploy on Vercel so the new env var is picked up.

## Security note
- Pasting the key into chat output makes it visible to anyone with access to this Lovable project history. That's acceptable here because the key is already scoped to your workspace and we just rotated it.
- After you've pasted it into Vercel, if you want extra hygiene, I can rotate it one more time so the value that appeared in chat becomes invalid, and you'd repeat the paste with the fresh value.

No code changes. Approve and I'll print the key.