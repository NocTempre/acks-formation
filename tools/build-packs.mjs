/**
 * Build the module's compendium packs.
 *
 * Writes source JSON to packs/_source/<pack>/ (one file per RollTable, results
 * inline with their own `_key`) and compiles each into a Foundry LevelDB pack
 * at packs/<pack>/ using the official Foundry CLI.
 *
 * Usage:  node tools/build-packs.mjs   (requires dev deps, see package.json)
 */
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { THIEF_PROGRESSION } from "../scripts/constants.mjs";

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const MODULE_ID = "acks-formation";
const now = Date.now();
const STATS = { coreVersion: "13", createdTime: now, modifiedTime: now };


/* -------------------------------------------- */
/*  Builder                                     */
/* -------------------------------------------- */

/* -------------------------------------------- */
/*  Exploration proficiencies (RR pp. 102–121,  */
/*  JJ Custom Power Index)                      */
/* -------------------------------------------- */

/**
 * Ability items whose names match the module's automation matchers
 * (party-rolls.mjs, scene-sync.mjs, map-items.mjs). Where a rule uses a fixed
 * target, rollTarget ships preset; level-based thief-style skills ship with
 * rollTarget 0 for the GM to set per class level. See acks-rules/acks-formation/PROFICIENCIES.md.
 */
const PROFICIENCIES = [
  { id: "acksfmProfAlert0", name: "Alertness", target: 0,
    description: "+1 bonus to avoid surprise. When using Adventuring proficiency to search or listen, succeeds on 14+ (instead of 18+); if separately proficient in Searching or Listening, gains +2 to the throw instead. <em>Automated: the formation's Listen/Search party rolls detect this item and improve the member's target/bonus.</em>" },
  { id: "acksfmProfCaving", name: "Caving", target: 11,
    description: "Keeps a mental map underground: accurately estimates length, width, and depth while traveling. On a proficiency throw of 11+, automatically knows the route taken to his current position (if conscious for the journey). Can be selected multiple times. <em>Module note: a Caving member is your insurance against losing the way when the mapper falls.</em>" },
  { id: "acksfmProfClimb0", name: "Climbing", target: 6, skill: "climbing",
    description: "Climbs as a thief of his class level: one Climbing proficiency throw per 100' (minimum one). Failure = fall from the midpoint plus completed distance, 1d6 damage per 10'. Climb at exploration speed or 1/3 combat speed without penalty; -5 at 1/2 combat speed; -10 at full. <em>Auto-scales with the owner's class level in party rolls.</em>" },
  { id: "acksfmProfContor", name: "Contortionism", target: 18,
    description: "+4 bonus to Paralysis saves to escape being grabbed, restrained, stuck, or wrestled (and to Squeezing throws, RULES.md §12). Proficiency throw each round (18+ at 1st level, -1 per level) to escape shackles or slip through a portcullis." },
  { id: "acksfmProfEaves0", name: "Eavesdropping", target: 14, skill: "listening",
    description: "Listens for noises as a thief of his class level (Judge rolls in secret; once per turn if the party is moving). <em>Automated: the Listen party roll detects this item and auto-scales its target with the owner's class level.</em>" },
  { id: "acksfmProfEndur0", name: "Endurance", target: 0,
    description: "Nearly tireless: does not need to rest every 6 turns of strenuous activity; +4 to Paralysis saves against becoming winded; force marches without fatigue for extra days. <em>Automated: members with this item are skipped when the formation becomes winded, and may act while the party rests.</em>" },
  { id: "acksfmProfLandSv", name: "Land Surveying", target: 14,
    description: "Passively scans for collapses, deadfalls, rock slides, and sinkholes while moving at expedition or exploration speed (secret throw, 14+). Methodically survey up to 10,000 sq ft in one turn at 10+. Can assess hex land value and lair counts." },
  { id: "acksfmProfMappng", name: "Mapping", target: 11,
    description: "Understands and makes maps, even if illiterate. Creates useful maps by torchlight while moving at exploration speed or less. One turn + throw of 11+ to interpret complicated layouts, map from memory, or notice an irregularity in his own map. <em>Automated: with a proficient mapper the party's measurements are exact and Map items archive accurately; without one, distances fuzz and map records warp.</em>" },
  { id: "acksfmProfMountn", name: "Mountaineering", target: 0,
    description: "Uses mountaineering gear (grapple, hand axe, hammer, 6 iron spikes, 50' rope each) to lead up to 30 characters on climbs: the party climbs, rappels, and traverses as thieves of his class level; with Climbing too, his own throws fail only on an unmodified 1." },
  { id: "acksfmProfNavigt", name: "Navigation", target: 0,
    description: "Reads sun and stars: +4 bonus on proficiency throws to avoid getting lost in the wilderness. Stacks with Pathfinding. With Seafaring, can serve as ship's navigator." },
  { id: "acksfmProfPwoTrc", name: "Passing Without Trace", target: 0,
    description: "Leaves no sign of passage and cannot be tracked; covers the tracks of one additional companion per level. Concealed characters do not count against party size for evasion." },
  { id: "acksfmProfSkulk0", name: "Skulking", target: 0,
    description: "+2 bonus on Hiding and Sneaking proficiency throws. Sneaking above 1/2 combat speed at only -2 (instead of -5); sneaking while running at -5 (instead of -10)." },
  { id: "acksfmProfSwimm0", name: "Swimming", target: 0,
    description: "+4 bonus on Swimming proficiency throws; if that brings the throw to 0+ or better, no throw is needed at all (RULES.md §12)." },
  { id: "acksfmProfTrack0", name: "Tracking", target: 11,
    description: "Searches for tracks: one turn (10 minutes), throw of 11+, modified by numbers, ground, weather, and light. On failure, cannot retry in that area for one hour. A tracker in the party grants +4 to lair-searching throws in a hex. <em>Automated: the Track party roll detects this item and consumes the turn.</em>" },
  { id: "acksfmProfTrapfd", name: "Trapfinding", target: 0,
    description: "+2 bonus on Searching and Trapbreaking proficiency throws; triggers undetected traps only half as often (1 on 1d6 instead of 1–2). <em>Automated: the Search party rolls detect this item and add the +2.</em>" },
  { id: "acksfmProfTrappg", name: "Trapping", target: 0,
    description: "Finds and removes wilderness traps as a thief of half his class level (rounded up); +2 vs wilderness traps if also proficient in Searching or Trapfinding. Crafts crude wilderness traps at 1sp per hour." },
  { id: "acksfmProfWakefl", name: "Wakefulness", target: 0,
    description: "Rests by meditating instead of sleeping; immune to magical sleep. Can keep watch while the party rests without penalty. <em>Module note: pairs with Endurance for round-the-clock watches during rest turns.</em>" },
];

/**
 * Thief skills (RR pp. 30–32) as class-power ability items. Items are flagged
 * so the module's party rolls AUTO-SCALE the target from the owner's class
 * level (the stored rollTarget is only the level-1 value, for manual rolls
 * from the sheet).
 */
const prog = (key) =>
  `<p><em>Auto-scales with the owner's class level in party rolls (RR p. 31):</em> ${THIEF_PROGRESSION[key]
    .map((v, i) => `L${i + 1}: ${v}+`)
    .join(" · ")}. <em>For a class using the skill at half level, set the module's levelFactor flag to 0.5.</em></p>`;

const THIEF_SKILLS = [
  { id: "acksfmSklSearch0", name: "Searching", key: "searching",
    description: "Finds concealed traps, secret doors, obscured objects, buried treasure, and other hidden features (Judge rolls in secret). <strong>Hastily</strong>: 1 round, 5' reach (10' with a pole); a failed hasty search cannot be repeated until the next level; automatic while moving at exploration speed when passing within reach of a hidden feature. <strong>Methodically</strong>: 1 turn, +4 bonus, repeatable. <em>Automated: matched by the Search party rolls.</em>" },
  { id: "acksfmSklListen0", name: "Listening", key: "listening",
    description: "Listens at doors, passageways, and intersections (Judge rolls in secret). Requires quiet; the thief must be the closest party member to the sound; 1 round, once per turn while the party is moving. <em>Automated: matched by the Listen party roll.</em>" },
  { id: "acksfmSklTrapbrk", name: "Trapbreaking", key: "trapbreaking",
    description: "Disarms or harmlessly discharges traps with thieves' tools. <strong>Hastily</strong>: 1 round; botch on natural 1–3 triggers the trap; a failed hasty attempt cannot be repeated until the next level. <strong>Methodically</strong>: 1 turn, +4 bonus, repeatable; botch only on natural 1. <em>Detection pattern for the linked traps module: /trapbreak/i.</em>" },
  { id: "acksfmSklLockpck", name: "Lockpicking", key: "lockpicking",
    description: "Picks mechanical locks with thieves' tools. <strong>Hastily</strong>: 1 round; natural 1–3 jams the lock permanently; a failed hasty attempt cannot be repeated until the next level. <strong>Methodically</strong>: 1 turn, +4 bonus, repeatable; jams only on natural 1." },
  { id: "acksfmSklHiding0", name: "Hiding", key: "hiding",
    description: "Skulks unseen in cover, dim light, or darkness (begin as a combat action; Judge rolls in secret — the thief always believes he succeeded). While stationary in concealment, opponents suffer -2 to surprise regardless. Hidden: no line of sight may be claimed; melee vs the thief at -4 if his general location is known. Expires on moving or attacking." },
  { id: "acksfmSklSneak00", name: "Sneaking", key: "sneaking",
    description: "Prowls in total silence (begin as a movement action; Judge rolls in secret — the thief always believes he succeeded). Sneak at exploration speed or 1/2 combat speed freely; -5 above that; -10 running. Success = literally no noise, even for successful Listeners; engaging an unengaged opponent from the rear denies its free facing change. Opponents suffer -2 to surprise while the thief is out of sight." },
  { id: "acksfmSklPickpkt", name: "Pickpocketing", key: "pickpocketing",
    description: "Picks pockets and cuts purses within 5': +4 if the target is unaware. Success lifts one pocket's contents or one hung item/tiny/small weapon. On a natural 1 or a roll below half the target value, the victim notices (reaction roll at -3)." },
  { id: "acksfmSklShadowS", name: "Shadowy Senses", key: null,
    description: "Night-vision, keen hearing and smell, and echolocation: at combat or exploration speed the thief \"sees\" as if carrying a source shedding dim light in a 30' radius. Usable to fight and probe for traps; cannot discern colors, faces, markings, flat images, or writing. Does not function while charging or running, deafened, in bright light, or in magical darkness/silence. Opponents can hide from it (counts as dim light)." },
];

function thiefSkillDoc(s) {
  const target = s.key ? THIEF_PROGRESSION[s.key][0] : 0;
  return {
    _id: s.id,
    _key: `!items!${s.id}`,
    name: s.name,
    type: "ability",
    img: "icons/svg/daze.svg",
    system: {
      proficiencytype: "class",
      favorite: false,
      pattern: "white",
      requirements: "",
      roll: s.key ? "1d20" : "",
      rollType: "above",
      rollTarget: target,
      blindroll: false,
      description: `<p>${s.description}</p>${s.key ? prog(s.key) : ""}`,
      save: "",
      _schemaVersion: 3,
    },
    effects: [],
    flags: { [MODULE_ID]: s.key ? { thiefSkill: s.key, levelFactor: 1 } : {} },
    ownership: { default: 0 },
    sort: 0,
    _stats: { ...STATS },
  };
}

function proficiencyDoc(p) {
  return {
    _id: p.id,
    _key: `!items!${p.id}`,
    name: p.name,
    type: "ability",
    img: "icons/svg/book.svg",
    system: {
      proficiencytype: "general",
      favorite: false,
      pattern: "white",
      requirements: "",
      roll: p.target > 0 ? "1d20" : "",
      rollType: "above",
      rollTarget: p.target,
      blindroll: false,
      description: `<p>${p.description}</p>`,
      save: "",
      _schemaVersion: 3,
    },
    effects: [],
    flags: {
      [MODULE_ID]: {
        explorationProficiency: true,
        ...(p.skill ? { thiefSkill: p.skill, levelFactor: p.factor ?? 1 } : {}),
      },
    },
    ownership: { default: 0 },
    sort: 0,
    _stats: { ...STATS },
  };
}

/* -------------------------------------------- */
/*  Macros                                      */
/* -------------------------------------------- */

const MACROS = [
  {
    _id: "acksfmMacroSheet",
    name: "Party Sheet",
    img: "icons/svg/combat.svg",
    command: `// Open the exploration party sheet.
const api = game.modules.get("acks-formation")?.api ?? globalThis.acksFormation;
if (api?.open) api.open();
else ui.notifications.error("ACKS Exploration Formations is not active.");`,
  },
  {
    _id: "acksfmMacroTurn0",
    name: "Dungeon Turn (+10 min)",
    img: "icons/svg/clockwork.svg",
    command: `// Mark off one dungeon turn for the (first) formation — GM only.
const api = game.modules.get("acks-formation")?.api ?? globalThis.acksFormation;
if (!api) return ui.notifications.error("ACKS Exploration Formations is not active.");
const formation = Object.values(api.getFormations())[0];
if (!formation) return ui.notifications.warn("No formation exists yet.");
api.advanceTurns(formation, 1, { reason: "manual" });`,
  },
];

function macroDoc(m) {
  return {
    _id: m._id,
    _key: `!macros!${m._id}`,
    name: m.name,
    type: "script",
    img: m.img,
    scope: "global",
    command: m.command,
    folder: null,
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: { ...STATS },
  };
}

async function buildPack(packName, docs) {
  const srcDir = path.join(ROOT, "packs", "_source", packName);
  const dbDir = path.join(ROOT, "packs", packName);

  fs.mkdirSync(srcDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir).filter((f) => f.endsWith(".json"))) fs.rmSync(path.join(srcDir, f));
  for (const doc of docs) {
    const slug = doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    fs.writeFileSync(path.join(srcDir, `${slug}.json`), JSON.stringify(doc, null, 2) + "\n");
  }

  fs.rmSync(dbDir, { recursive: true, force: true });
  await compilePack(srcDir, dbDir, { recursive: false, log: false });
  console.log(`Built pack "${packName}": ${docs.length} document(s) -> ${dbDir}`);
}

await buildPack("exploration-proficiencies", [
  ...PROFICIENCIES.map(proficiencyDoc),
  ...THIEF_SKILLS.map(thiefSkillDoc),
]);
await buildPack("macros", MACROS.map(macroDoc));
