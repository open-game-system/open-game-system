# Art kit and catalogue

Every game in the OGS catalogue ships an **art kit**: four images the app and the TV launcher use for
the Library, the game page and the launcher's Home. Then it is listed by adding its manifest to the
catalogue.

## The art kit

| Field | Image | Shape | Size we use | Rules |
|---|---|---|---|---|
| `art.icon` | Icon | 1:1 | 512×512 PNG | The game at a glance; readable at 48 px |
| `art.cover` | Cover | 2:3 | 600×900 JPG | **With the title** lettered in |
| `art.logo` | Logo | any, transparent | about 1200 px wide PNG with alpha | The title alone, on transparency |
| `art.heroClean` | Clean hero | 16:9 | 1920×1080 JPG | **No text and no HUD**: the launcher draws its own title and buttons over it |

Older fields, still in the manifest:

- `art.tile` (required): a 16:9 screenshot of the TV page (1920×1080).
- `art.hero`: another 16:9 screenshot.
- `art.safe` (`scale`, `ox`, `oy`): crops a HUD out of `tile`/`hero` when there is no clean art.

Taste, for every image:

- Your game's **own art direction**. Don't borrow another OGS game's look.
- **No faces on objects** (rockets, planets, props). Characters may have faces; things don't.
- No UI, no buttons, no score in `heroClean` and `icon`.
- Check the kit next to the other games: the catalogue's contact sheet is
  [apps/tv/public/art/KIT-SHEET.jpg](../../../apps/tv/public/art/KIT-SHEET.jpg).

The images live in the OGS repo at `apps/tv/public/art/<appId>/` and the manifest refers to them by
path from that folder's root:

```json
"art": {
  "icon": "/art/space-bakery/icon.png",
  "cover": "/art/space-bakery/cover.jpg",
  "logo": "/art/space-bakery/logo.png",
  "heroClean": "/art/space-bakery/hero-clean.jpg",
  "tile": "/art/space-bakery/tv.jpg"
}
```

### Theme music (optional)

`art.theme` is a 20–40 s seamless loop of your game's music (music only: no effects or voice).
The launcher's Home plays it quietly while your game is focused and crossfades as focus moves;
every other screen is silent. Ship MP3 (~128 kbps; every browser and the cloud renderer decode it),
loudness around −20 dB with peaks below −1 dB, and fade the seam so the loop is gapless, e.g.
`"theme": "/art/space-bakery/theme.mp3"`. No theme means Home is silent on your game.

## Submit to the catalogue

The catalogue is the list of manifests in
[services/api/src/catalogue.ts](../../../services/api/src/catalogue.ts), served at
`GET /api/v1/catalogue`; the app's Library reads it from there. There is no self-serve form yet:
games are added by pull request to
[open-game-system/open-game-system](https://github.com/open-game-system/open-game-system).

1. **Red:** add your `appId` to the expected list in
   [services/api/test/catalogue.test.ts](../../../services/api/test/catalogue.test.ts) (`GAMES`), plus
   whatever your game does differently from the defaults that test assumes: your own domain
   (`OWN_DOMAIN`), a game for grown-ups only (`ADULT_GAMES`; otherwise a role must suit a kid), or a
   static `tvUrl`. Run `pnpm --filter @open-game-system/api test` and see it fail.
2. **Art:** add the four images (and `tv.jpg`) under `apps/tv/public/art/<appId>/`. The catalogue test
   fails if any kit field is missing or a file does not exist.
3. **Green:** add your manifest to `SEED` in `services/api/src/catalogue.ts`. Every field is checked by
   `ManifestSchema` ([fields](messages.md#manifest)).
4. Run the repo's gates: `pnpm typecheck && pnpm lint && pnpm test`.
5. Open the pull request. Say in it which of the [rules](rules.md) you checked and how (tests, a
   real TV), and link your game's seam tests.

Don't add games to `apps/mobile/services/game-directory.ts`: that is the old static list.

For local development, the API's `CATALOGUE_START_URLS` (JSON `{ "appId": "url" }`) swaps in local
`startUrl`s for games already in the catalogue; it never adds games.
