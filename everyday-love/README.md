# Everyday Love

A small, phone-first pocket reference for everyday affection and courtship. Six daily stages emphasize the Always ritual and show Optional examples beneath it. The second tab contains one ordered Courtship list. All supplied wording is preserved.

Courtship ideas can be marked used and unmarked. Marks stay in this browser's local storage, keyed by stable item IDs; they never reorder or hide the list. Clearing site data removes marks, and another device or domain has its own marks. The daily roadmap has no completion state. No accounts, backend, notifications, analytics, external fonts, or environment variables are needed.

## Development

Use Node 22 or later. From this repository's root:

```sh
cd everyday-love
npm ci
npm run dev
```

Open http://localhost:3000. The service worker is registered only in production. Use a separate browser profile or clear the site's service worker before switching a production preview origin to development.

## Checks and build

```sh
npm run typecheck
npm test
npm run build
```

The build statically exports Next.js to `out/`, then generates `out/sw.js`. The lightweight test checks deterministic cache generation and CSS-only invalidation. To inspect the actual production site (including offline support):

```sh
python3 -m http.server 3000 --directory out
```

## Vercel deployment

Import `jkfrydendahl/jkfrydendahl.github.io` into a **separate Vercel project**, selecting **Root Directory: everyday-love** and Node **22.x** or later. Select **Other** as the framework preset. The included `vercel.json` specifies `framework: null`, build command `npm run build`, and output directory `out`.

This serves the static export without expecting Next.js server metadata such as `out/routes-manifest.json`. No environment variables are required. Existing projects and repository-root deployment settings are unaffected.

The source lives in a repository subfolder, but the app is served at `/` on its own Vercel domain. Merely committing these Next.js sources does not publish a working app at the GitHub Pages `/everyday-love/` URL. A Pages deployment would require a separate subpath-aware build/deployment configuration; this project targets the requested Vercel setup.

## Installation and offline updates

Visit the deployed HTTPS site online and allow its initial asset download to finish. On iPhone, use Safari's Share → Add to Home Screen; on Android, use the browser's Install app / Add to Home screen option. The manifest, standalone metadata, 192/512 PNG icons, and Apple touch icon are included.

After the first successful service-worker installation, both sections, icons, scripts, and CSS work offline. The worker precaches the root HTML and runtime assets. Its cache name hashes the entire export plus the generator itself, so content, CSS, icon, and worker changes invalidate it. Installation bypasses the HTTP cache. Only obsolete `everyday-love-` caches are removed.

A new worker waits until all existing app windows/tabs close. After opening online to download an update, fully close its windows and reopen to use the new version. There is no forced reload during reading. Saved Courtship marks survive these updates. If the browser evicts offline storage, reopen online to restore the cache.

## Editing the content

Edit `src/content/love.json`:

- `stages`: title, descriptor, Always action, and Optional examples.
- `courtship`: the single list of idea text and stable IDs. Keep an existing idea's ID when editing its text, so its used mark survives. Give new ideas unique IDs.

Rebuild/redeploy after changes. Presentation is in `app/page.tsx` and `app/globals.css`; the offline generator is `scripts/build-service-worker.mjs`.
