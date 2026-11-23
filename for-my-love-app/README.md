# For My Love

One shared daily quote, nickname, emoji pair, and Spotify soundtrack for every
visitor to this app. The frontend stays on GitHub Pages; the existing Vercel
backend and KV database hold the current entry and selection history.

## Deploy

1. Deploy `for-my-love-app/vercel-backend` to the existing Vercel project with
   that directory as its **Root Directory**. Keep the existing KV and push
   environment variables. No new storage service or dependency is required.
2. Add **`DISPLAY_WRITE_TOKEN`** to the Vercel production environment. Use a
   separate, random code of 16–256 characters without surrounding whitespace;
   32 random bytes encoded as hex is suitable. Never use `NOTIFY_TOKEN`,
   `CRON_SECRET`, a VAPID key, or a KV credential as this code.
3. Redeploy the backend after setting the variable. Check
   `https://for-my-love-app.vercel.app/api/display`: it should return JSON with
   `slot`, `revision`, `quote`, `nickname`, emojis, and `soundtrack`.
4. Publish the frontend through the repository's normal GitHub Pages deployment
   and reload the installed app on each device. Deploying the backend first
   also allows the previous frontend to keep working during rollout.
5. On each device that should be able to change the entry, click **Get Another**
   and enter the change code once. A successful change saves the code in that
   browser. **Forget change code** removes it from that device. Viewing needs
   no code. Rotate the environment variable and redeploy to revoke saved codes.

`DISPLAY_WRITE_TOKEN` is intentionally separate from administrative secrets.
The code is stored in the device's browser storage, so use it only on devices
you trust. Reads remain public, matching this app's existing public content.
Until the code is configured, viewing and daily rollover work, but replacement
requests return 503 and the app explains that changes are not configured.

## Sync behavior

- The server uses **08:00 Europe/Copenhagen**, including daylight saving time.
  The day's entry is created on the first read at/after that time. No extra cron
  is needed; the existing push-notification schedule remains unchanged.
- Open devices refresh every 30 seconds while visible, and immediately when
  opened, focused, resumed, or reconnected. Background devices catch up when
  opened. A push still announces that the daily quote is ready.
- **Get Another** updates the entry for everyone. Requests carry the revision
  they replace. Redis atomically saves the selection and its usage history;
  concurrent/stale requests receive the winner rather than consuming another
  selection. Only the server generates new entries.
- Quote/nickname weighted usage limits, soundtrack theme matching, and the
  110-track nonrepeating cycle now operate centrally. Usage counters reset at
  the new daily-slot year; soundtrack cycles continue across New Year.
- After a successful visit, the service worker caches the app shell and browser
  storage keeps the last synced entry. Offline reloads show that entry with a
  saved/waiting label, including its date if outdated. An offline first visit
  has no saved entry. Replacements require a connection and are not queued.
- A failed/timed-out replacement may have reached the server. Reconnect to read
  the shared entry before trying another change.
- The initial shared history starts fresh. Existing devices' local selections
  and usage counts are not uploaded or merged. They were independent and
  cannot establish a single authoritative history.

The shared state lives in `love-display:v1`, independently of the push
subscription hash `subs`. Do not delete that key during routine deployments.

## Content and development

Edit quotes/nicknames/emojis in `content.js` and tracks in `soundtracks.js`, then
regenerate the backend catalog and commit it alongside the source changes:

```sh
node for-my-love-app/scripts/build-catalog.mjs
node for-my-love-app/validate.mjs
node --test for-my-love-app/tests/*.test.mjs
```

`vercel-backend/lib/catalog.json` is a generated, versioned copy so Vercel never
needs files outside its configured Root Directory. Validation fails if it is
stale. When the catalog version changes, the server creates a new entry and
starts fresh usage history to avoid applying old array indices to new content.

The API is `GET /api/display` for reads and `POST /api/display` with
`Authorization: Bearer <change-code>` and JSON `{ "revision": 123 }` for changes.
Responses disable caching. POST requires the current revision, enforces a small
body size, checks the code, and limits attempts to 20 per 15 minutes per client
address. A 409 includes the current entry in `display`; a 503 leaves cached
content available. Cross-origin browser access is limited to
`https://jkfrydendahl.github.io`.
