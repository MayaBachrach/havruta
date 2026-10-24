# GitHub Pages edition

The repository supports two separate builds. `npm run build` retains the Node/SQLite server and real multi-user collaboration. `npm run build:pages` builds an isolated static edition into `out/`, with assets under `/havruta/` (override with `PAGES_BASE_PATH` for a renamed repository).

The static edition never calls Havruta's API. It saves a personal profile, circles, plans, poll choices, checklist assignments and favorites in this browser's localStorage. A persistent banner explains the device-local behavior. Demo mode remains separate and is not saved. Clearing site storage removes personal data. Storage errors leave the current state unchanged and show an error. This is not cloud backup or recoverable authentication.

GitHub Pages cannot run the SQLite server. Invitations, real group collaboration, remote chat require the server edition. Google free/busy can run directly in the browser after the operator configures its OAuth client. The static edition disables joining invitations; generated calendar files and calendar links still work. The app does not claim local changes reach friends.

## Enable publication

1. The account must support Pages for the repository's visibility. GitHub Free requires a public repository; a private repository requires an eligible paid plan. Do not change visibility without the owner's explicit approval.
2. Open the repository's Settings → Pages and choose GitHub Actions as the source.
3. Run the **Publish GitHub Pages** workflow from Actions. Its deployment result provides the authoritative site URL.

After Pages activation, publication runs on pushes to main and can also be started manually. Repository visibility is an independent owner setting. The generated artifact includes only static application assets, never `.env` files, SQLite databases or server API routes. On ordinary individual accounts the Pages website itself is public even if its source repository is private.
