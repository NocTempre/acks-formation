# ACKS II — Exploration Formations

A Foundry VTT module for the [ACKS II system](https://github.com/AutarchLLC/foundryvtt-acks-core) that condenses the party into an **exploration formation** for cleaner dungeon-delve movement, and automates the ACKS II dungeon-turn bookkeeping: time, light, rest, wandering monsters, spell durations, and rations.

The rules implemented here are summarized exhaustively in the local rules extract (`acks-rules/acks-formation/RULES.md`) (RR Adventures chapter, Judges Journal sequence of play, and the Dungeon Delves reference sheets).

## Installation

In Foundry: **Add-on Modules → Install Module**, and paste this manifest URL:

```
https://github.com/NocTempre/acks-formation/releases/latest/download/module.json
```

(Releases are cut by pushing a version tag, e.g. `git tag v0.2.0 && git push origin v0.2.0`; the tag must match `module.json`'s `version`.)

## What it does

### Formations & the party token

- **One window: the party sheet.** Select tokens and click the **Add to party** button on any token's HUD (right-click a token) — a formation is created if the scene has none, the tokens fold in, and the party sheet opens. You can also create a **Party Formation** actor from the Create Actor dialog and drag its token out; `/formation` in chat opens the sheet.
- Drag more actors or tokens straight into the sheet to add them.
- The **first member's token is replaced by a single party token** at its position; every further member's token is stashed and the member appears in the formation window instead.
- The party token is backed by a dedicated party actor whose speed mirrors the **slowest member's exploration speed** (recomputed automatically when members' encumbrance changes).
- Marching order is the list order (reorder with the arrows). Special roles — **Mapper**, **Scout**, **Rear Guard**, **10' Pole**, **Non-combatant** — are toggled per member, with rule reminders (mapper needs bright light, is vulnerable, etc.).
- **Frontage** (single file / two abreast / three abreast, per RR p. 264) lays the marching order out as a **2D grid of ranks** with left/right/up/down repositioning, and shapes combat deployment and disband placement. The party token itself stays **1×1** — a single collision/vision profile so tight dungeon corridors stay navigable. **Blank slots** can be added and swapped anywhere in the grid — gaps carry through to combat deployment. **Auto-arrange** builds an **I-formation** from roles and sheet data: a full front line of the best fighters and a full back line of rear guard / missile users are staffed first, with non-combatants, the vulnerable mapper, and spellcasters holding the middle ranks, centered by blanks so the utility core never walks the flanks.
- **Pace & shuttered lights** (RR p. 263 / equipment): careful exploration is already the quiet pace — the **Hurried** toggle explores at combat speed instead (~3× the ground per turn, much more noise, and mapping, 10' poles, and hasty searching are lost — enforced). **Lanterns can be closed** (burn oil, shed nothing): a closed lantern doesn't reveal the party, doesn't light the canvas, and doesn't satisfy the mapper's bright-light requirement.
- **Skill Audit** (checklist button on the Marching Order header): a per-member table of exactly how every party roll resolves — item vs Adventuring, auto-scaled level, bonuses — plus the editor for **custom skills**: flag any ability item to participate in a party roll, follow a thief progression, and scale at a fraction of the owner's level.
- The **Formation Macros** compendium ships hotbar macros (open the party sheet; mark off a dungeon turn).
- Removing a member (or disbanding) restores the stashed tokens around the party token.

### Dungeon turn automation (primary feature)

Moving the party token consumes distance on a **round-level clock**: every tenth of an exploration move is one bookkeeping round (1 minute; 10 per turn), so movement, hasty 1-round actions (listening, hasty searches, door bashing, lighting a torch — marked off automatically), and combat rounds all spend the same currency; full-turn bookkeeping fires whenever a turn completes. **Wandering-monster throws are made at the turn boundary but *fire* when the clock reaches the rolled minute** — the GM gets the pre-rolled encounter up front, then a "the encounter occurs NOW" whisper at the right round mid-movement. Each turn:

- **World time advances 10 minutes** (optional) so Active Effect durations and calendar modules stay in sync; effects that expire are called out in chat.
- **Light sources burn down** (torch/candle 6 turns, lantern 24 per flask) with guttering warnings and burnout announcements. Lighting a source can consume the matching inventory item.
- **Rest is tracked**: after 5 turns of exploration without rest the party becomes **winded** (a marker Active Effect is applied to members, skipping those with Endurance). The **Rest** button spends a turn resting and clears it.
- **Wandering monster throws** are made every 2 turns (1d6, 6+; both configurable), whispered to the GM; a hit pre-rolls encounter distance (2d6×10 ft) and the minute of the turn (1d10), and **draws privately from your encounter RollTable** if one is configured.
- **Day boundaries** prompt ration consumption; the **Rations** button decrements one ration item per member and reports who's out.

### Customizable encounter tables — keyed to map zones

Encounter tables resolve in this order:

1. **ACKS Encounter Zone** (map zone): draw a Region on the scene (Region layer), add the **ACKS Encounter Zone** behavior to it, and drop a RollTable onto its *Encounter table* field. You can also override the throw frequency and target value per zone (0 = inherit). Whichever zone the party token is standing in wins — so a crypt wing, a flooded level, and goblin warrens on the same map can each roll on their own table at their own cadence.
2. **Formation default table**: picked in the formation window's *Encounter table* dropdown.
3. **None**: the throw is still made and announced; the GM rolls on their own tables manually.

#### Bring your own tables

The module ships **no encounter tables of its own** — which creatures inhabit a
dungeon is the Judge's to decide. Point an Encounter Zone (or the formation's
default) at any Foundry **RollTable** you build or import, and the throw draws
from it privately. Because table draws recurse into linked RollTable results, a
"dungeon level" table whose results link to per-level creature tables will roll
straight through both levels automatically.

### Fog of war follows the mapper

Per the rules, the party only keeps an accurate record of where it has been if someone is mapping. When *Tie fog of war to the mapper* is enabled (default):

- While a formation on the scene has a member with the **Mapper** role (and a lit light source, unless you disable that requirement), the scene records explored fog as normal.
- Lose the mapper — or their light burns out — and fog exploration is **fully disabled: nothing is shown and nothing is recorded**. Players still see the party's current surroundings (the party token has vision and automatically emits the brightest lit light source's glow), but no map memory accumulates while no one is drawing it.
- Re-assigning a mapper re-enables the scene's original fog mode; the setting is restored when the formation disbands or leaves. Scenes whose fog the GM already turned off are never touched.
- Players who **own a member** of a formation automatically get vision through (and control of) the party token while their character is inside it.
- Previously recorded exploration still resurfaces when mapping resumes; making each mapped area its own **tradeable Map item** (blank slate after falling through a hole, maps that merge only when physically connected, purchasable partially-revealed maps) is designed in [docs/FOG-DESIGN.md](docs/FOG-DESIGN.md).

Buttons also let the GM advance turns manually (for searching, lock-picking, etc.), make an encounter check on demand, undo a turn, or pause movement tracking while repositioning tokens.

### Spells, saves, and the party sheet

- **Tracked spells**: track any ongoing spell or effect against the dungeon-turn clock — pick a member's spell (duration auto-parsed when it reads like "6 turns") or enter one manually. Each counts down per turn with a final-turn warning and an expiry announcement, and can be nudged ±1 turn for caster level.
- **Party saves**: the save row (D/W/P/B/S) rolls the saving throw for **every member automatically** using the system's own roller.
- **Party rolls from the sheets**: Listen, Hasty Search, Methodical Search, and Bash Door buttons roll for every member using **their own character-sheet numbers** — a matching skill/class-power item's target (e.g. a thief's Searching) when they have one, otherwise the sheet's Adventuring target. Results arrive as one GM-whispered card (these are Judge-secret throws). RAW is baked in: hasty searching is skill-users only, methodical searching gives skill users +4 and automatically marks off its turn, listening is tracked to once per turn while moving, and bashing applies ±4 per point of STR modifier.
- **Party actor type — one UI**: party tokens are backed by a dedicated *Party Formation* actor type. Double-clicking the party token opens the **same full formation UI** the manager window shows — GM-only controls (clock, saves, rolls, lights, spells, maps, roles, reordering) are simply hidden from players, who instead get the declaration panel. Both windows scroll and resize. Assigning the **Mapper role is the "start mapping" action** (a working map session opens automatically; "New Map" remains the fog-wiping reset), and **mapping deactivates during combat** (nothing is shown or recorded while deployed; measurements stay exact for tactics).

### Map sessions & Map items (v0.6.0)

All live exploration belongs to a **map session** backed by a **Map item** in the mapper's inventory — carried, looted, bought, and sold like any item:

- **New Map** archives the current exploration, wipes the scene's fog, and starts from black — falling through a hole means no memory of the entrance or its distance.
- The working map archives the explored bitmap **each dungeon turn** (while the GM views the scene). If the mapper lacks **Mapping proficiency, the record is warped by a hidden deterministic distortion** — the live view stays true, but the *map* is wrong.
- **Anchor** (GM-judged, when the party connects its position to charted territory): the map's recorded areas light up for everyone — and a distorted map **misaligns** against the real dungeon.
- **Snapshot** saves the GM's own fog view as an accurate Map item for authoring merchant maps; partial reveals are just partial exploration.
- Without a proficient mapper, players' **ruler and drag-measurement labels are fuzzed** (a hidden consistent per-scene factor, "?" with no mapper at all); GMs always see true values. Players can still count grid squares — it's a deterrent, not a lock.

### Party rolls, saves & player declarations (v0.5.0–0.6.0)

- **Party rolls** (Listen / Hasty & Methodical Search / Bash Door / Track) roll every member with **their own sheet's numbers** — thief-skill ability items first, else the sheet's Adventuring targets — GM-whispered as one card, with RAW timing enforced (methodical search and tracking consume the turn; listening once per turn while moving). **Alertness** (14+/+2) and **Trapfinding** (+2) are detected automatically; the **ACKS Exploration Proficiencies** compendium ships drag-and-drop items for all of it (see the local proficiencies extract (`acks-rules/acks-formation/PROFICIENCIES.md`)).
- **Party saves** (Paralysis / Death / Blast / Implements / Spells) roll for all members against their own targets, with a **Magical toggle** applying each member's Bonus-vs-Magic and WIS modifier only for magical sources. GM-side only.
- **Players declare actions** from the party sheet: light a torch/lantern/candle their character carries, track a spell they cast, declare a rest, or call for a search/listen/bash/track — relayed to the Judge's client, validated by ownership, announced publicly, executed by the automation.

### Combat integration

- **Add the party token to a combat** (toggle combat / drag it into the tracker) and the formation deploys: member tokens are placed around the party token in marching order and each becomes a combatant. Members flagged **Non-combatant** stay inside the party token and out of the initiative; the party token hides if nobody stays behind.
- **When the combat ends**, the party reforms automatically: member tokens are re-stashed (keeping any changes) — **including the fallen**, who are gathered up with the party. Down members (0 hp, dead or dying) can't walk: assign the **Carrier** role — the carried count as 7 3/6 stone plus half their equipment (the rescue rule), split among Carriers, and the load recomputes the carriers' pace and thus the party's — or remove them from the formation to abandon the body. The **10' Pole** role requires an actual pole or polearm in inventory, and **listening while moving is enforced at once per turn** (a stationary party may keep listening).
- **Combat rounds count toward the rest clock**: 10 rounds = 1 dungeon turn, with leftover rounds carried over to the next fight.

## Notes & limitations

- Requires Foundry **v14+**.
- Turn processing runs on the active GM's client; a GM must be connected for movement to consume turns.
- Distance is measured in a straight line between the start and end of each token move and assumes the scene grid is in feet (standard for ACKS dungeon scenes).
- Members added without a canvas token (dragged from the sidebar) are flagged in the list and won't be re-placed on disband.

## API

```js
game.modules.get("acks-formation").api.open();          // open the window
globalThis.acksFormation.open();                        // same, macro-safe
```

## License

**Code:** © NocTempre — proprietary; all rights reserved except as granted to
Autarch LLC under the **ACKS II App License**. This module is **not** open source
or Open Game Content, and no license is granted to copy, redistribute, or reuse
its code. See [`LICENSE`](LICENSE).

**ACKS II content** is used under the **ACKS II App License**. ACKS, ACKS II, and
Adventurer Conqueror King System are trademarks of **Autarch LLC**.

**Unofficial** — this is an unofficial fan module, not published or endorsed by
Autarch LLC.

**Registration #:** _[pending registration]_

**Requires:** a legitimate copy of the ACKS II rules this module draws on —
Adventurer Conqueror King System II (ACKS II), dungeon exploration & delving rules
_[confirm exact publication title(s)]_. The module is not a substitute for the
books and is free to use.
