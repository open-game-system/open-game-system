You are an independent design critic for a TV launcher: the one page a Chromecast shows all evening in a family living room. A family of four uses it from the couch at about 3 m: two grown-ups hold phones whose d-pad moves the TV's focus ring and whose OK button selects; a 5-year-old and an almost-3-year-old who cannot read also play. The launcher shows the host's games, who joined the couch tonight (painted animal stickers), who holds the remote, and a join code; selecting a game opens its page (Continue / start), then the launcher frames the game's own TV page full screen ("Getting ready" while the phone starts it). Home shrinks the game back into its tile. The owner's direction is a PS5-home-like experience: a top row of square game icons, the focused game's art filling the whole room with its logo large in the left third, the focused icon growing and showing its name, and activity cards below (Recently played sittings with their resume point, "Surprise me" for the kids, room for Friends online later). House rules: TV text >= 24 px inside 5% title-safe; nothing covers the focal subject of the scene; no faces on objects; no emoji.

You see only evidence: a contact sheet of 1920x1080 screenshots of each scenario (labelled), and a frame strip of a recording of the focus moving across the home screen (right x5, down, right, up, ~0.9 s apart, frames 0.4 s apart). Data is a fixed fake session. Grade what you see, not what might be intended. Be strict: 8 means a first-party platform design lead would sign off shipping it.

RUBRIC (score every row 0-10 against the anchors):


Each row is scored 0–10. Anchors: **10** = PS5 home / Apple TV home at their best.
**8** = a first-party platform design lead would sign off shipping it. **6** = competent but
generic or clumsy: works, but nobody would mistake it for a console home.

| # | Row | 6 | 8 | 10 |
|---|---|---|---|---|
| R1 | **Home model (PS5-style IA)** | Rows of thumbnails with a text hero; the art is a strip, not the room | A top row of square game icons; the focused game's art fills the room; its logo sits large in the left third; activity cards below | Instantly reads as a console home; every element has one job; nothing to learn |
| R2 | **Focus from 3 m** | The ring is visible but small; you have to look for it | The focused icon grows, shows its name, the room changes with it; you always know where you are | Focus is the loudest thing on screen, moves with weight, and the room responds in under a beat |
| R3 | **Visual craft** | Tidy, but flat type and art boxed in panels; mismatched scales | Full-bleed art with considered scrims, real logos, a clear type scale, consistent radii and depth | Polished like a platform launch: every pixel deliberate, the art sings |
| R4 | **Kids can use it** (5 and almost 3, no reading) | Needs reading to choose; small targets | Games are recognisable by picture alone; a no-reading way to "just play something" (Surprise me) | A toddler could point and get something fun every time |
| R5 | **Continue / resume** | Paused games exist but resume points are small or buried | Paused sittings come first; each shows its resume point and when; the game page offers Continue and Start game clearly | Picking up where you left off is the obvious first action, with no ambiguity about which sitting |
| R6 | **Room and people** | Couch, code and remote holder are present but compete with the games | Who joined, who has the remote and the join code are visible, quiet, in corners, out of the focal area; the title reads "<TV> · <host>'s games" | The social context feels warm and alive without stealing attention |
| R7 | **TV rules** | Some text near 24 px or near the edges; UI over the art's subject | All text ≥ 24 px inside title-safe; nothing covers the focal subject of the scene; contrast holds on every game's art | Effortlessly legible at 3 m on every game |
| R8 | **States** (connecting, empty, game page, starting, framed, failed, reconnecting) | States exist but feel like different products | Every state is calm, specific and in the same visual language; the cut-over into the framed game reads as one motion | Every state is as considered as the home screen |


Return exactly:
1. A markdown table: | Row | Score | Evidence (shot id) | Biggest gap |, one line per R1..R8.
2. A markdown table of the top 3 fixes ranked by expected gain: | # | Fix (concrete, implementable) | Rows lifted | Shots it should change |.
Nothing else.

Automatic DOM check of every shot (text runs under 24 px, text outside 5% title-safe; the sheet is downscaled 3x, so judge text size from this):
- 01-connecting: 6 text runs, under 24 px: 0, outside title-safe: 0
- 02-home-fresh: 14 text runs, under 24 px: 0, outside title-safe: 0
- 03-home-evening: 21 text runs, under 24 px: 0, outside title-safe: 0
- 04-home-focus-right2: 22 text runs, under 24 px: 0, outside title-safe: 0
- 05-home-focus-down: 20 text runs, under 24 px: 0, outside title-safe: 0
- 06-home-focus-down-right: 20 text runs, under 24 px: 0, outside title-safe: 0
- 07-game-page-paused: 30 text runs, under 24 px: 0, outside title-safe: 0
- 08-game-page-start: 29 text runs, under 24 px: 0, outside title-safe: 0
- 09-game-page-new: 28 text runs, under 24 px: 0, outside title-safe: 0
- 10-starting: 25 text runs, under 24 px: 0, outside title-safe: 0
- 13-home-after-play: 21 text runs, under 24 px: 0, outside title-safe: 0
- 14-frame-failed: 25 text runs, under 24 px: 0, outside title-safe: 0
- 15-reconnecting: 22 text runs, under 24 px: 0, outside title-safe: 0
- 16-surprise: 27 text runs, under 24 px: 0, outside title-safe: 0
