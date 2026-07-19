/**
 * Static rules data for ACKS II dungeon delves (exploration formations).
 * Sourced from the Revised Rulebook "Adventures" chapter (pp. 263–271), the
 * Judges Journal sequence of play (pp. 35–37), and the Dungeon Delves I/II
 * reference sheets. See acks-rules/acks-formation/RULES.md for the exhaustive rules summary.
 *
 * All user-facing labels are localization keys resolved via game.i18n; see
 * lang/en.json.
 */

export const MODULE_ID = "acks-formation";

/** Flag on the party TokenDocument / party Actor pointing back at a formation. */
export const FLAG_FORMATION_ID = "formationId";
/** Flag on member actors while the party is winded (marker Active Effect id). */
export const WINDED_EFFECT_NAME = "Winded";

/** One dungeon turn is 10 minutes; 10 rounds per turn; 6 turns per hour. */
export const TURN_SECONDS = 600;
export const TURNS_PER_HOUR = 6;
export const TURNS_PER_DAY = 144;

/** All adventurers must rest 1 turn per 5 turns of exploration and combat. */
export const REST_INTERVAL = 5;

/** Default wandering-monster cadence: 1d6 every 2 turns, encounter on 6+. */
export const DEFAULT_ENCOUNTER_EVERY = 2;
export const DEFAULT_ENCOUNTER_TARGET = 6;

/** Special formation roles (marching order itself is the member list order). */
export const ROLES = Object.freeze({
  MAPPER: "mapper",
  SCOUT: "scout",
  REARGUARD: "rearguard",
  POLE: "pole",
  NONCOMBATANT: "noncombatant",
  CARRIER: "carrier",
});

export const ROLE_ORDER = Object.freeze([
  ROLES.SCOUT,
  ROLES.MAPPER,
  ROLES.POLE,
  ROLES.REARGUARD,
  ROLES.NONCOMBATANT,
  ROLES.CARRIER,
]);

export const ROLE_LABELS = Object.freeze({
  [ROLES.MAPPER]: "ACKS-FORMATION.role.mapper",
  [ROLES.SCOUT]: "ACKS-FORMATION.role.scout",
  [ROLES.REARGUARD]: "ACKS-FORMATION.role.rearguard",
  [ROLES.POLE]: "ACKS-FORMATION.role.pole",
  [ROLES.NONCOMBATANT]: "ACKS-FORMATION.role.noncombatant",
  [ROLES.CARRIER]: "ACKS-FORMATION.role.carrier",
});

export const ROLE_HINTS = Object.freeze({
  [ROLES.MAPPER]: "ACKS-FORMATION.role.mapperHint",
  [ROLES.SCOUT]: "ACKS-FORMATION.role.scoutHint",
  [ROLES.REARGUARD]: "ACKS-FORMATION.role.rearguardHint",
  [ROLES.POLE]: "ACKS-FORMATION.role.poleHint",
  [ROLES.NONCOMBATANT]: "ACKS-FORMATION.role.noncombatantHint",
  [ROLES.CARRIER]: "ACKS-FORMATION.role.carrierHint",
});

/** ACKS II saving throw keys (system: actor.system.saves[key].value). */
export const SAVE_KEYS = Object.freeze(["paralysis", "death", "breath", "implements", "spell"]);

/** Combat rounds per dungeon turn for time-keeping (RR p. 263). */
export const ROUNDS_PER_TURN = 10;

/**
 * Thief skill targets by level 1–14 (RR p. 31). Ability items flagged
 * `acks-formation.thiefSkill: <key>` auto-scale their throw target from the
 * owner's class level (× the optional `levelFactor` flag, e.g. 0.5 for
 * "as a thief of half his class level").
 */
export const THIEF_PROGRESSION = Object.freeze({
  climbing: [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7],
  hiding: [19, 18, 17, 16, 15, 14, 12, 10, 8, 6, 4, 2, 0, -2],
  listening: [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  lockpicking: [18, 17, 16, 15, 14, 13, 11, 9, 7, 5, 3, 1, -1, -3],
  pickpocketing: [17, 16, 15, 14, 13, 12, 10, 8, 6, 4, 2, 0, -2, -4],
  searching: [18, 17, 16, 15, 14, 13, 11, 9, 7, 5, 3, 1, -1, -3],
  sneaking: [17, 16, 15, 14, 13, 12, 10, 8, 6, 4, 2, 0, -2, -4],
  trapbreaking: [18, 17, 16, 15, 14, 13, 11, 9, 7, 5, 3, 2, 2, 1],
});

/**
 * Light sources (RR p. 265): bright/dim radii in feet and burn duration in
 * turns. `consumes` matches an inventory item to decrement when lit.
 */
export const LIGHT_SOURCES = Object.freeze({
  torch: {
    label: "ACKS-FORMATION.light.torch",
    turns: 6,
    bright: 15,
    dim: 30,
    consumes: /torch/i,
  },
  lantern: {
    label: "ACKS-FORMATION.light.lantern",
    turns: 24,
    bright: 15,
    dim: 30,
    consumes: /\boil\b/i,
    // RR (equipment): "Lanterns can be closed to conceal the light" — burns on.
    shieldable: true,
  },
  candle: {
    label: "ACKS-FORMATION.light.candle",
    turns: 6,
    bright: 5,
    dim: 10,
    consumes: /candle/i,
  },
});


/** A 10' pole needs the physical implement: a pole item or a polearm. */
export const POLE_ITEM_PATTERN = /pole|polearm|spear|pike|halberd|glaive|lance/i;

/**
 * Carrying a body: the carried character counts as 7 3/6 stone plus half of
 * their equipment encumbrance (RULES.md §12, the rescue rule — the only
 * quantified carrying figure in the references).
 */
export const BODY_STONE = 7.5;

/**
 * Senses that work in TOTAL darkness: shadowy senses (thief power), lightless
 * vision / infravision, or spell effects granting the equivalent. Matched on
 * item AND active-effect names.
 *
 * Night Vision is deliberately NOT here: it upgrades dim light but fails in
 * total dark (MM Overview pp. 12–13), which is how `monster-traits.mjs` treats
 * it — one rule, one answer on both paths. Content corroborates: the register
 * provides `kw:lightlessvision` on Infravision and Lightless Vision only.
 */
export const DARK_SENSE_PATTERN = /shadowy\s*sense|lightless\s*vision|infravision|darkvision|dark\s*sight/i;

/** Inventory name matcher for ration items (1-day preferred over 1-week). */
export const RATION_PATTERN = /ration/i;

/** Default image used for the party token / party actor. */
export const DEFAULT_PARTY_IMAGE = "icons/environment/people/group.webp";

/**
 * Exploration speed tiers by encumbrance in stone (RR / reference sheet).
 * Used only for display; the authoritative per-actor value is
 * `actor.system.movementacks.exploration`, computed by the acks system.
 */
export const SPEED_TIERS = Object.freeze([
  { maxStone: 5, exploration: 120, combat: 40, running: 120 },
  { maxStone: 7, exploration: 90, combat: 30, running: 90 },
  { maxStone: 10, exploration: 60, combat: 20, running: 60 },
  { maxStone: Infinity, exploration: 30, combat: 10, running: 30 },
]);
