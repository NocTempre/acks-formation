# Abilities Integration Audit (2026-07-19, v0.18.4)

Audit of how acks-formation interfaces with abilities, against the three-module
abilities program: **acks-lib** (shared effect vocabulary), **acks-abilities**
(binding target / flag model), **acks-content** (the cookbook that materializes
values per seat). Covers (1) whether the library carries the mechanical concepts
this module needs, (2) a per-entry audit of the shipped
`exploration-proficiencies` compendium against what content currently extracts,
and (3) the retirement plan for that compendium.

**Headline:** all 25 compendium entries exist upstream in the cookbook, and the
library covers nearly every mechanical concept this module hand-rolls — usually
better. The compendium is ready to retire on a phased path. Three correctness
defects and one IP exposure were found on this side and are listed in §4.

---

## 1. What this module needs from an ability

acks-formation reads abilities for exactly five purposes:

| # | Purpose | Where | Today's mechanism |
|---|---|---|---|
| 1 | Bind an ability to a party roll (listen/search/bash/track) | `party-rolls.mjs` `skillCandidates()` | `checkKey` flag, else **name regex** (`cfg.pattern`) |
| 2 | Scale a skill target by owner level | `scaledSkillTarget()` | `thiefSkill` + `levelFactor` flags → hardcoded `THIEF_PROGRESSION` |
| 3 | Stack conditional bonuses onto a throw | `resolveCheck()` | hardcoded `ALERTNESS_PATTERN`, `ATTUNEMENT_PATTERN`, `TRAPFINDING_PATTERN` |
| 4 | Detect operating without light | `formation-model.mjs` `canSeeInDark()` | hardcoded `DARK_SENSE_PATTERN` (PCs) / monster extras (monsters) |
| 5 | Detect role competence (mapping, poles) | `hasAbility()`, `hasPoleItem()` | name regex |

Every one of these is a name-match or a hardcoded constant. That is the thing
the program exists to replace.

---

## 2. Library validation — does acks-lib carry the concepts?

### Covered, and better than the local version

| Need | acks-lib primitive | Assessment |
|---|---|---|
| Bind ability → party roll (#1) | `kw:<slug>` **capability tokens**; `satisfies()`, `satisfiesAll()`, `capabilityForId()` | **Strictly better.** A capability catches every route to a mechanic — *Searching* is a thief skill, a proficiency, and several class powers. `kw:searching` matches all; my regex matches whatever the item happens to be named. An ability implicitly provides its own id's capability, so gates resolve before anything is tagged. |
| Level scaling (#2) | `LevelValue` `{kind:"progression", as, atLevel}` + `resolveLevelValue()` | Covered — but the resolver deliberately returns `null` for `progression` and defers to the class table. **The table is not in lib**; content materializes it (§3). Correct division: lib owns semantics, content owns page values. |
| `levelFactor` (#2) | `PROGRESSION_LEVELS` = `full \| half \| third \| quarter` | **Better.** My `levelFactor` is a free float (0.25–2.0) that accepts nonsense like 1.75 and cannot express "as a thief of one-third level" as a named concept. |
| Bonus stacking (#3) | `modifier` / `modifies` effects with `mode: add\|replace\|set`, `ifHas`, `stacksWith`, `notStacksWith`; `MODIFIER_TARGETS.proficiencyThrow` | Covered exactly. `proficiencyThrow` is precisely my target. Non-stacking falls out of shared capabilities rather than being asserted per pair. |
| Roll polarity | `ROLL_TYPES` = `result \| above \| below` | Covered. Worth adopting: I assume roll-high everywhere; ACKS runs both ways. |
| Dark operation (#4) | `VISION_TYPES` / `SENSE_TYPES` (shared with acks-monsters) | Covered, already consumed on the monster path via `monster-traits.mjs`. |
| Rerolls, companions, defenses, spell-likes | `reroll`/`resolveReroll`, `companion`, `defensesField`, `spellLike` | Covered; not needed here yet. |

### Genuine gaps for this module

These are **not** defects in acks-lib — they are exploration-domain concepts the
library was never scoped to hold. Recording them so the boundary is explicit:

| Gap | Detail | Where it should live |
|---|---|---|
| **Action time cost** | `PARTY_CHECKS` carries `consumesRound` / `consumesTurn` / `oncePerTurn` / `blockedWhenHurried`. Nothing in `EFFECT_TYPES` models action economy or time cost. | Stays here. It is dungeon-turn procedure, not ability vocabulary. |
| **Exploration vs combat speed** | `MODIFIER_TARGETS.speed` is undifferentiated; ACKS speed is `[combat] / [exploration]`. An ability modifying one, not both, cannot be expressed. | Candidate lib refinement if any ability ever modifies exploration speed specifically. Not blocking. |
| **Group/party rolls** | Rolling one check across N members with per-member resolution. | Stays here — squarely this module's job. |

**Verdict: the library is sufficient.** No lib change is required to migrate
this module. The two gaps above are correctly outside its scope.

---

## 3. Per-entry audit — 25 compendium entries vs. cookbook

**All 25 resolve to cookbook nodes. Zero missing.** Mechanic extraction is
partial and almost entirely unaudited, which governs the retirement timing.

Legend: **prog** = `op:"progression"` instruction · **eff** = count of `effects.specs` ·
**roll** = count of `rolls.specs` · **aud** = chef sign-off

| My entry | Cookbook id | prog | eff | roll | aud | Notes |
|---|---|---|---|---|---|---|
| Alertness | `def.prof.alertness` | – | – | 1 | – | **Two nodes** (see below) |
| Alertness | `def.power.alertness` | – | – | – | – | `provides: [kw:alertness]` |
| Caving | `def.prof.caving` | – | – | – | **Y** | `repeatable` |
| Climbing | `def.prof.climbing` | – | – | – | – | |
| Climbing | `def.skill.climbing` | **Y** | 1 | – | – | Two nodes (prof + skill) |
| Contortionism | `def.prof.contortionism` | – | – | – | – | |
| Eavesdropping | `def.prof.eavesdropping` | – | – | – | – | |
| Endurance | `def.prof.endurance` | – | – | – | – | |
| Hiding | `def.skill.hiding` | **Y** | – | – | – | |
| Land Surveying | `def.prof.landSurveying` | – | – | – | – | |
| Listening | `def.skill.listening` | **Y** | – | – | – | |
| Lockpicking | `def.skill.lockpicking` | **Y** | 1 | – | – | |
| Mapping | `def.prof.mapping` | – | – | – | – | `repeatable` |
| Mountaineering | `def.prof.mountaineering` | – | – | – | – | |
| Navigation | `def.prof.navigation` | – | – | – | – | |
| Passing Without Trace | `def.prof.passingWithoutTrace` | – | – | – | – | |
| Pickpocketing | `def.skill.pickpocketing` | **Y** | – | – | – | |
| Searching | `def.skill.searching` | **Y** | 1 | – | – | methodical `+N` as `modifier/proficiencyThrow/add` |
| Shadowy Senses | `def.skill.shadowySenses` | – | – | – | – | **no `provides`** — see §4.1 |
| Skulking | `def.prof.skulking` | – | – | – | – | |
| Sneaking | `def.skill.sneaking` | **Y** | 1 | – | – | |
| Swimming | `def.prof.swimming` | – | 1 | – | – | Two nodes (prof + power) |
| Swimming | `def.power.swimming` | – | – | – | – | |
| Tracking | `def.prof.tracking` | – | – | 1 | – | `repeatable` |
| Trapbreaking | `def.skill.trapbreaking` | **Y** | 1 | – | – | |
| Trapfinding | `def.prof.trapfinding` | – | 1 | – | – | targets `kw:searching` **and** `kw:trapbreaking` |
| Trapping | `def.prof.trapping` | – | 1 | 2 | – | |
| Wakefulness | `def.prof.wakefulness` | – | – | – | – | |

**Totals:** 28 nodes for 25 names (3 names carry two nodes each) · 8 progression
instructions · 8 effects specs · 4 rolls specs · **1 of 28 audited (Caving)**.

### What this replaces, concretely

- **The 8 `progression` instructions are exactly my 8 `THIEF_PROGRESSION` rows**
  (climbing, hiding, listening, lockpicking, pickpocketing, searching, sneaking,
  trapbreaking). The cookbook ships level/value box coordinates; the runtime
  reads the ladder out of the seat's own PDF. My hardcoded table becomes dead.
- **`def.skill.searching` effects** carry the methodical search bonus as
  `{type:"modifier", target:"proficiencyThrow", mode:"add", condition:"methodical
  attempt (one turn); not a hasty attempt"}` with a `from.pattern` locator —
  structurally identical to my `skillBonus: 4`, with the digit read per seat.
- **`def.prof.alertness` rolls** carry the Adventuring 14+ target with the note
  *"Used in place of the usual Adventuring search/listen target, not added to
  it."* — **confirming my unskilled-path implementation is correct** (I treat it
  as a target change, not a bonus).
- **`def.prof.trapfinding` effects** target `kw:searching` **and**
  `kw:trapbreaking` — see §4.3.

### Modelling mismatches to resolve on migration

1. **One item, two nodes.** Alertness, Climbing and Swimming each exist as both
   a proficiency and a class power/skill. My compendium collapses each to one
   item. On migration the binding must pick the right node per character, not
   merge them.
2. **`checkKey` is unset on all 25 shipped entries.** Binding runs entirely on
   name regex today. This is the exact fragility `kw:` tokens fix.
3. **Only `kw:alertness`, `kw:lightlessvision`, `kw:scalyhide` exist** of the 36
   capabilities registered. The tokens I need — `kw:searching`, `kw:listening`,
   `kw:trapbreaking` — are **referenced** by Trapfinding's spec but not yet
   *provided* by their own nodes. Migration of party-roll binding must wait on
   those, or supply them locally.

---

## 4. Defects found in acks-formation

### 4.1 `DARK_SENSE_PATTERN` contradicts this module's own monster rule — **bug**

`constants.mjs` matches `night\s*vision` as a dark sense for PCs:

```js
export const DARK_SENSE_PATTERN = /shadowy\s*sense|lightless\s*vision|infravision|darkvision|night\s*vision|dark\s*sight/i;
```

But `monster-traits.mjs` (shipped v0.18.0) **deliberately excludes** Night
Vision, because the MM states it fails in total darkness ("moonlight → daylight;
indoors 2× light range; **not total dark**"). The same rule is implemented twice
with opposite answers: a monster with Night Vision is correctly blinded in a
dark dungeon; a PC with an ability named "Night Vision" is incorrectly granted
dark sight. `night\s*vision` should be removed from the pattern.

Corroborating: content registers `kw:lightlessvision` on `def.power.infravision`
and `def.power.lightlessVision` only — Night Vision is not among them.

*Also noted:* `def.skill.shadowySenses` carries no `provides`, so it is not yet
tagged `kw:lightlessvision` upstream. My pattern does treat Shadowy Senses as a
dark sense. That is a **content gap, not necessarily my error** — flagging it for
the chef pass rather than changing behavior here.

### 4.2 Attunement to Nature `+4` on Listening is unverified — **likely invented rule**

`party-rolls.mjs` grants `+4` (not `+2`) on listening when the actor has
Attunement to Nature:

```js
const ATTUNEMENT_PATTERN = /attunement to nature/i;
```

The register lists `kw:alertness` as provided by **alertness, alienSenses,
keenInsectSenses, mindfulness** — and **not** `attunementToNature`, whose node
carries no `provides`, no effects and no rolls. So there is no upstream evidence
that Attunement to Nature is an Alertness-equivalent at all, let alone at +4.

That node is unaudited, so this is not proof of absence — but under *"never
invent a rule"* the burden is on the claim. Recommend demoting to a clearly
labelled optional house rule (or removing) pending the chef pass on
`def.power.attunementToNature`.

By contrast the **Alertness `+2`-when-separately-skilled branch is sound** — it
appears verbatim in the entry text and matches the acks-lib worked example
(`modifies … mode:"replace"`).

### 4.3 Trapfinding implements half its effect

Register spec targets `kw:searching` **and** `kw:trapbreaking`. My `TRAPFINDING_PATTERN`
is applied only to the two search checks; there is no Trapbreaking party check,
so the trapbreaking half is unimplemented. Low impact (trap resolution is the
separate traps module's job) but it should be a deliberate scope note rather
than an omission.

### 4.4 The compendium ships book values and close-paraphrase prose from a PUBLIC repo — **IP exposure**

This is the most urgent finding and the strongest driver for retirement.

`packs/_source/exploration-proficiencies/` ships, for 25 named proficiencies:

- **exact printed throw targets** (`system.rollTarget`: Searching 18, Listening
  14, Hiding 19, Pickpocketing 17, …);
- **~8.7 KB of mechanical prose** (mean 350, max 703 chars/entry) that closely
  paraphrases each proficiency's rules text — e.g. Alertness: *"+1 bonus to
  avoid surprise. When using Adventuring proficiency to search or listen,
  succeeds on 14+ (instead of 18+); if separately proficient in Searching or
  Listening, gains +2 to the throw instead."*

Plus `scripts/constants.mjs` reproduces the **entire thief-skill progression
table** (8 skills × 14 levels) as a literal array.

`NocTempre/acks-formation` is **PUBLIC**. This is the same class of exposure that
caused the sibling rules extracts to be purged and their repos made private on
2026-07-16. It also directly violates the content pipeline's governing
principle 2 — *values are assisted, never prebaked; a stat block's selection and
arrangement of values is grey-zone IP; imported values live in the GM's world,
never in the shipped artifact.*

The cookbook exists precisely so these numbers materialize from each seat's own
PDF. Retiring the compendium resolves the exposure; it is not merely cleanup.

**`npm run validate` reports `ip-scan: clean` on this — a false negative.**
`tools/ip-scan.mjs` is deliberately structural (it holds no book text, so it
cannot match known passages). It flags a prose leaf only above
`PROSE_CHARS = 1500`; the longest description here is **778 chars**, so all 25
pass individually while aggregating to **9.3 KB**. The scan also does not
inspect numeric values, so `rollTarget` is invisible to it by design. Two
template-level gaps worth raising against `acks-module-template` (the file is
synced — **do not hand-edit it here**):

1. **No aggregate check.** N sub-cap prose leaves in one pack is the
   death-by-a-thousand-cuts case the per-leaf cap cannot see.
2. **No value-density signal.** A pack of items each carrying a printed target
   number is exactly the "compilation of values" principle 2 forbids, and no
   structural signal currently reaches it.

Neither is a criticism of the scan's design — a structural gate cannot detect
paraphrase. It does mean **a clean scan is not evidence this pack is safe**,
which is the operative point for the Phase 0 decision.

---

## 5. Retirement plan

Phased, because deleting the pack breaks worlds whose actors reference its items,
and because the upstream mechanics are 1-of-28 audited — migrating binding onto
unaudited data would trade a known-correct hardcode for an unverified one.

**Phase 0 — contain the exposure (do first, independent of everything else).**
Decide on the public-repo question in §4.4: strip values + prose from
`packs/_source` and `THIEF_PROGRESSION`, or take the repo private, or both.
This does not depend on the migration and should not wait for it.

**Phase 1 — fix the local defects (no dependency on upstream).**
Remove `night vision` from `DARK_SENSE_PATTERN` (§4.1); demote or remove the
Attunement `+4` (§4.2); record the Trapfinding scope note (§4.3).

**Phase 2 — soft-deprecate the pack.**
Mark `exploration-proficiencies` deprecated in `module.json`/docs and add
`acks-abilities` + `acks-content` to `relationships.recommends`. Keep shipping
it so existing worlds keep working. Stop adding entries.

**Phase 3 — capability-based binding (gated on upstream).**
Replace `skillCandidates()` name-regex matching with `acksLib.satisfies()`
against `kw:` tokens, reading `provides` from the acks-abilities `extras` flag,
falling back to the current regex when a token is absent. **Blocked until**
`kw:searching`, `kw:listening`, `kw:trapbreaking` are provided by their own
nodes (§3 mismatch 3).

**Phase 4 — drop the local tables.**
Replace `THIEF_PROGRESSION` with the progression values materialized by
acks-content, and `levelFactor` with `PROGRESSION_LEVELS`. **Gated on** the
relevant entries carrying `audited` sign-off — the burn-down is `1/28` today.

**Phase 5 — remove the pack** once no shipped content references it and a
migration path exists for worlds still holding its items.

---

## Appendix — audit method

- Cookbook read from `C:\Proj\acks-content\cookbook\` (`proficiencies.json` 120
  entries, `skills.json` 13, `powers.json` 327, `registers.json`).
- Every one of the 25 `packs/_source/exploration-proficiencies/*.json` entries
  was matched by name and its cookbook node's `fields` (progression/effects/rolls)
  and `meta` (category, general, repeatable, provides, notStacksWith, audited)
  read in full — no sampling, per the recipes-not-rules audit doctrine.
- Library surface read from `acks-lib/docs/API.md` + `scripts/vocab.mjs`
  (enum key extraction), `acks-abilities/docs/MODEL.md` + `scripts/*.mjs`.
- This audit reads upstream data only; it asserts no sign-off on any cookbook
  entry. `audited` remains content's to set.
