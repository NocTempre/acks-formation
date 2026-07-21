/**
 * Offline flow tests: execute the module's real transfer / deploy / reform /
 * cleanup code against mocked Foundry globals (the family's live-test
 * substitute — TOOLCHAIN.md §4a). These exist because every regression the
 * users hit was in a flow no static check exercises: hook interleaving,
 * whole-record setting writes, and document lifecycle.
 *
 * Run: node tools/test-flows.mjs   (also wired into `npm run validate`).
 */
import assert from "node:assert/strict";

/* -------------------------------------------- */
/*  Foundry mock                                */
/* -------------------------------------------- */

const sleep = (ms = 1) => new Promise((r) => setTimeout(r, ms));
let nextId = 0;
const uid = (p = "id") => `${p}${(++nextId).toString().padStart(4, "0")}`;

const hooks = new Map();
globalThis.Hooks = {
  on(name, fn) {
    if (!hooks.has(name)) hooks.set(name, []);
    hooks.get(name).push(fn);
  },
  once(name, fn) {
    const wrapper = (...args) => {
      hooks.get(name)?.splice(hooks.get(name).indexOf(wrapper), 1);
      return fn(...args);
    };
    this.on(name, wrapper);
  },
  call(name, ...args) {
    for (const fn of [...(hooks.get(name) ?? [])]) {
      try {
        fn(...args);
      } catch (err) {
        console.error(`hook ${name} threw`, err);
      }
    }
  },
};

class Coll extends Map {
  get contents() {
    return [...this.values()];
  }
  find(fn) {
    return this.contents.find(fn);
  }
  filter(fn) {
    return this.contents.filter(fn);
  }
  some(fn) {
    return this.contents.some(fn);
  }
  [Symbol.iterator]() {
    return this.values();
  }
}

const setProp = (obj, path, value) => {
  const parts = path.split(".");
  let at = obj;
  for (const p of parts.slice(0, -1)) at = at[p] ??= {};
  at[parts.at(-1)] = value;
};
const hasProp = (obj, path) => {
  let at = obj;
  for (const p of path.split(".")) {
    if (at == null || !(p in at)) return false;
    at = at[p];
  }
  return true;
};

class FieldStub {
  constructor(...args) {
    this.args = args;
  }
}

globalThis.foundry = {
  utils: {
    deepClone: (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v))),
    randomID: () => uid("rnd"),
    setProperty: setProp,
    hasProperty: hasProp,
    getProperty: (o, p) => p.split(".").reduce((a, k) => a?.[k], o),
    escapeHTML: (s) => String(s),
    isEmpty: (v) => v == null || (typeof v === "object" && !Object.keys(v).length),
    mergeObject: (a, b) => Object.assign(a, b),
  },
  abstract: { TypeDataModel: class {}, DataModel: class {} },
  data: {
    fields: new Proxy({}, { get: () => FieldStub }),
    regionBehaviors: { RegionBehaviorType: class {} },
  },
  applications: {
    api: {
      ApplicationV2: class {
        constructor(options = {}) {
          this.options = options;
        }
        render() {
          return this;
        }
      },
      HandlebarsApplicationMixin: (Base) => class extends Base {},
      DialogV2: { confirm: async () => true },
    },
    sheets: {
      ActorSheetV2: class {
        constructor(options = {}) {
          this.options = options;
        }
        render() {
          return this;
        }
      },
    },
    apps: {
      DocumentSheetConfig: { registerSheet() {} },
      FilePicker: { implementation: class {} },
    },
    handlebars: { loadTemplates: () => [] },
    ux: {
      DragDrop: { implementation: class {
        bind() {}
      } },
      TextEditor: { implementation: { getDragEventData: () => ({}) } },
    },
    instances: new Map(),
  },
};

globalThis.CONFIG = { Actor: { dataModels: {} }, RegionBehavior: { dataModels: {}, typeIcons: {} } };
globalThis.CONST = {
  DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OWNER: 3 },
  TOKEN_DISPLAY_MODES: { HOVER: 1 },
  TOKEN_DISPOSITIONS: { FRIENDLY: 1 },
  FOG_EXPLORATION_MODES: { DISABLED: 0, EXPLORED: 1, SHARED: 2 },
};

const chat = [];
globalThis.ChatMessage = {
  async create(d) {
    chat.push(d);
    return d;
  },
};
globalThis.Roll = class {
  constructor(formula) {
    this.formula = formula;
  }
  async evaluate() {
    this.total = 10;
    return this;
  }
};
const notices = [];
globalThis.ui = {
  notifications: {
    info: (m) => notices.push(["info", m]),
    warn: (m) => notices.push(["warn", m]),
    error: (m) => notices.push(["error", m]),
  },
};
globalThis.canvas = { scene: null, tokens: { controlled: [] } };

const uuidMap = new Map();
globalThis.fromUuid = async (u) => uuidMap.get(u) ?? null;
globalThis.fromUuidSync = (u) => uuidMap.get(u) ?? null;

/* --- documents --- */

class ItemMock {
  constructor(parent, data) {
    this.parent = parent;
    this.id = uid("itm");
    this.uuid = `Actor.${parent.id}.Item.${this.id}`;
    Object.assign(this, foundry.utils.deepClone(data));
    this.flags ??= {};
    uuidMap.set(this.uuid, this);
  }
  getFlag(ns, key) {
    return this.flags?.[ns]?.[key];
  }
  async setFlag(ns, key, value) {
    (this.flags[ns] ??= {})[key] = foundry.utils.deepClone(value);
    return this;
  }
}

class ActorMock {
  constructor(data) {
    this.id = uid("act");
    this.uuid = `Actor.${this.id}`;
    this.name = data.name ?? "Actor";
    this.type = data.type ?? "character";
    this.img = data.img ?? "";
    this.system = foundry.utils.deepClone(data.system ?? {});
    this.flags = foundry.utils.deepClone(data.flags ?? {});
    this.ownership = foundry.utils.deepClone(data.ownership ?? { default: 0 });
    this.prototypeToken = foundry.utils.deepClone(data.prototypeToken ?? { width: 1, height: 1 });
    this.items = new Coll();
    this.effects = [];
    this.sheet = { render() {}, close() {} };
    uuidMap.set(this.uuid, this);
  }
  static get implementation() {
    return ActorMock;
  }
  static async create(data) {
    const actor = new ActorMock(data);
    game.actors.set(actor.id, actor);
    await sleep();
    Hooks.call("createActor", actor);
    return actor;
  }
  getFlag(ns, key) {
    return this.flags?.[ns]?.[key];
  }
  async setFlag(ns, key, value) {
    (this.flags[ns] ??= {})[key] = foundry.utils.deepClone(value);
    return this;
  }
  async update(changes) {
    for (const [k, v] of Object.entries(changes)) setProp(this, k, v);
    await sleep(2);
    Hooks.call("updateActor", this, changes);
    return this;
  }
  async delete() {
    game.actors.delete(this.id);
    await sleep();
    Hooks.call("deleteActor", this);
  }
  async getTokenDocument(data = {}) {
    const src = {
      name: this.name,
      actorId: this.id,
      x: 0,
      y: 0,
      width: this.prototypeToken.width ?? 1,
      height: this.prototypeToken.height ?? 1,
      hidden: false,
      flags: {},
      light: { bright: 0, dim: 0 },
      texture: { src: this.img },
      ...foundry.utils.deepClone(data),
    };
    return { toObject: () => foundry.utils.deepClone(src) };
  }
  async createEmbeddedDocuments(type, arr) {
    assert.equal(type, "Item");
    return arr.map((d) => {
      const item = new ItemMock(this, d);
      this.items.set(item.id, item);
      return item;
    });
  }
  testUserPermission() {
    return true;
  }
}
globalThis.Actor = ActorMock;

class TokenMock {
  constructor(scene, data) {
    this.parent = scene;
    this.id = data._id ?? uid("tok");
    const { _id, ...rest } = foundry.utils.deepClone(data);
    Object.assign(this, rest);
    this.flags ??= {};
    this.width ??= 1;
    this.height ??= 1;
    this.light ??= { bright: 0, dim: 0 };
    this.x ??= 0;
    this.y ??= 0;
  }
  get actor() {
    return game.actors.get(this.actorId) ?? null;
  }
  getFlag(ns, key) {
    return this.flags?.[ns]?.[key];
  }
  async setFlag(ns, key, value) {
    (this.flags[ns] ??= {})[key] = foundry.utils.deepClone(value);
    const changes = { flags: { [ns]: { [key]: value } } };
    Hooks.call("updateToken", this, changes, {}, "GM1");
    return this;
  }
  toObject() {
    const { parent, ...rest } = this;
    return foundry.utils.deepClone({ ...rest, _id: this.id });
  }
  async update(changes) {
    for (const [k, v] of Object.entries(changes)) setProp(this, k, v);
    await sleep();
    Hooks.call("updateToken", this, changes, {}, "GM1");
    return this;
  }
}

class SceneMock {
  constructor(name) {
    this.id = uid("scn");
    this.name = name;
    this.grid = { size: 100, distance: 5 };
    this.tokens = new Coll();
    this.regions = new Coll();
    this.fog = { mode: CONST.FOG_EXPLORATION_MODES.EXPLORED };
    this.environment = { darknessLevel: 0 };
    this.flags = {};
  }
  getFlag(ns, key) {
    return this.flags?.[ns]?.[key];
  }
  async setFlag(ns, key, value) {
    (this.flags[ns] ??= {})[key] = foundry.utils.deepClone(value);
    return this;
  }
  async unsetFlag(ns, key) {
    delete this.flags?.[ns]?.[key];
    return this;
  }
  async update(changes) {
    for (const [k, v] of Object.entries(changes)) setProp(this, k, v);
    await sleep(2);
    return this;
  }
  async createEmbeddedDocuments(type, arr) {
    assert.equal(type, "Token");
    const out = [];
    for (const data of arr) {
      const token = new TokenMock(this, data);
      this.tokens.set(token.id, token);
      out.push(token);
      await sleep();
      Hooks.call("createToken", token);
    }
    return out;
  }
  async deleteEmbeddedDocuments(type, ids) {
    assert.equal(type, "Token");
    for (const id of ids) {
      const token = this.tokens.get(id);
      if (!token) continue;
      this.tokens.delete(id);
      await sleep();
      Hooks.call("deleteToken", token);
    }
  }
}

class CombatantMock {
  constructor(combat, data) {
    this.parent = combat;
    this.id = uid("cbt");
    Object.assign(this, foundry.utils.deepClone(data));
  }
  get token() {
    return game.scenes.get(this.sceneId)?.tokens.get(this.tokenId) ?? null;
  }
  async delete() {
    this.parent.combatants.delete(this.id);
    await sleep();
  }
}

class CombatMock {
  constructor() {
    this.id = uid("cmb");
    this.round = 0;
    this.combatants = new Coll();
  }
  async createEmbeddedDocuments(type, arr) {
    assert.equal(type, "Combatant");
    const out = [];
    for (const data of arr) {
      const combatant = new CombatantMock(this, data);
      this.combatants.set(combatant.id, combatant);
      out.push(combatant);
      await sleep();
      Hooks.call("createCombatant", combatant, {}, "GM1");
    }
    return out;
  }
  async setRound(round) {
    this.round = round;
    await sleep();
    Hooks.call("updateCombat", this, { round }, {}, "GM1");
  }
  async delete() {
    game.combats.delete(this.id);
    await sleep();
    Hooks.call("deleteCombat", this);
  }
}

/* --- game --- */

const settingsStore = new Map();
const settingsDefaults = new Map();
globalThis.game = {
  settings: {
    register(ns, key, cfg) {
      settingsDefaults.set(`${ns}.${key}`, cfg?.default);
    },
    get(ns, key) {
      const k = `${ns}.${key}`;
      if (settingsStore.has(k)) return settingsStore.get(k);
      return foundry.utils.deepClone(settingsDefaults.get(k));
    },
    async set(ns, key, value) {
      const k = `${ns}.${key}`;
      const existed = settingsStore.has(k);
      settingsStore.set(k, foundry.utils.deepClone(value));
      Hooks.call(existed ? "updateSetting" : "createSetting", { key: k, value });
      await sleep();
      return value;
    },
  },
  i18n: { localize: (k) => k, format: (k, d) => `${k}${d ? " " + JSON.stringify(d) : ""}` },
  user: { id: "GM1", isGM: true },
  users: (() => {
    const users = [{ id: "GM1", isGM: true, isSelf: true }];
    // NOT Object.assign: that would evaluate the getter once at copy time.
    Object.defineProperty(users, "activeGM", { get: () => users[0] });
    return users;
  })(),
  actors: new Coll(),
  scenes: new Coll(),
  combats: new Coll(),
  tables: { contents: [], get: () => null },
  folders: new Coll(),
  modules: { get: () => ({ active: true }) },
  system: { id: "acks" },
  time: { advance: async () => sleep() },
  paused: false,
  socket: { emit() {} },
};

/* -------------------------------------------- */
/*  Load the module (registers all hooks)        */
/* -------------------------------------------- */

await import("../scripts/module.mjs");
const model = await import("../scripts/formation-model.mjs");
Hooks.call("init");
Hooks.call("ready");
await sleep(10);

const MODULE_ID = "acks-formation";
const readFormations = () => game.settings.get(MODULE_ID, "formations") ?? {};
const onlyFormation = () => {
  const all = Object.values(readFormations());
  assert.equal(all.length, 1, `expected exactly one formation, found ${all.length}`);
  return all[0];
};
/** Settle every unawaited async hook chain. */
const drain = async () => {
  for (let i = 0; i < 12; i++) await sleep(3);
};

const member = (name) =>
  ActorMock.create({
    name,
    type: "character",
    system: {
      hp: { value: 10, max: 10 },
      details: { level: 3 },
      movementacks: { exploration: 120 },
      movement: { base: 120 },
      encumbrance: { value: 5, max: 20 },
      scores: { str: { mod: 1 } },
      adventuring: { listening: 18, searching: 18, dungeonbashing: 18 },
    },
  });

let failures = 0;
async function scenario(name, fn) {
  try {
    await fn();
    console.log(`ok    ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
  }
}

/* -------------------------------------------- */
/*  Scenarios                                   */
/* -------------------------------------------- */

const scene = new SceneMock("Dungeon");
game.scenes.set(scene.id, scene);

const alice = await member("Alice");
const bob = await member("Bob");
await drain();

const [tokenA] = await scene.createEmbeddedDocuments("Token", [
  { name: "Alice", actorId: alice.id, x: 500, y: 500 },
]);
const [tokenB] = await scene.createEmbeddedDocuments("Token", [
  { name: "Bob", actorId: bob.id, x: 600, y: 500 },
]);

await scenario("transfer: adding members converts tokens into the formation", async () => {
  let formation = await model.createFormation("Test Party");
  formation = await model.addMember(formation, alice, tokenA);
  await drain();

  let stored = onlyFormation();
  assert.equal(stored.members.length, 1, "member persisted");
  assert.ok(stored.members[0].tokenData, "token stashed");
  assert.ok(!scene.tokens.get(tokenA.id), "canvas token removed");
  assert.ok(stored.tokenId && scene.tokens.get(stored.tokenId), "party token created");
  assert.ok(stored.actorId && game.actors.get(stored.actorId), "party actor exists");

  formation = model.getFormation(stored.id);
  await model.addMember(formation, bob, tokenB);
  await drain();

  stored = onlyFormation();
  assert.equal(stored.members.length, 2, "second member persisted (no clobber)");
  assert.ok(!scene.tokens.get(tokenB.id), "second canvas token removed");
  const partyActors = game.actors.filter((a) => a.type === `${MODULE_ID}.party`);
  assert.equal(partyActors.length, 1, `exactly one party actor (found ${partyActors.length})`);
});

await scenario("deploy survives the environment-sync interleave (mapper active)", async () => {
  // Reproduce the historical race: a mapper with a lit torch makes the
  // settings-triggered environment sync take the ensureMapSession write path —
  // the one that erased deploy's combat flag. Fog management is switched off
  // while the mapper is assigned so no session opens EARLY; re-enabling it
  // just before combat means the only sync that can open one is the sync
  // launched by deploy's own first write, mid-deploy, holding a stale copy.
  await game.settings.set(MODULE_ID, "manageFog", false);
  await model.patchFormation(onlyFormation().id, (rec) => {
    rec.members[0].roles = ["mapper"];
    rec.lights = [{ id: "l1", type: "torch", bearerId: alice.id, remaining: 6, lit: true, shielded: false }];
  });
  await drain();
  assert.ok(!onlyFormation().mapSession, "no session before combat (fog management off)");
  await game.settings.set(MODULE_ID, "manageFog", true);

  const combat = new CombatMock();
  globalThis.__combat = combat;
  game.combats.set(combat.id, combat);
  const stored = onlyFormation();
  await combat.createEmbeddedDocuments("Combatant", [
    { tokenId: stored.tokenId, sceneId: scene.id, actorId: stored.actorId, hidden: false },
  ]);
  await drain();

  const after = onlyFormation();
  assert.ok(after.combat?.active, "combat flag survived the concurrent map-session write");
  assert.equal(after.combat.combatId, combat.id, "combat id recorded");
  const deployed = after.members.filter((m) => m.deployedTokenId);
  assert.equal(deployed.length, 2, "both members deployed");
  for (const m of deployed) assert.ok(scene.tokens.get(m.deployedTokenId), "deployed token on scene");
  assert.equal(combat.combatants.contents.length, 2, "party combatant swapped for member combatants");
  assert.ok(scene.tokens.get(after.tokenId)?.hidden, "party token hidden during combat");
  assert.ok(!after.mapSession, "map session NOT open mid-combat (stale write declined or clobber-safe)");
});

await scenario("combat rounds tick the clock live", async () => {
  const before = onlyFormation().clock.roundsPartial ?? 0;
  await globalThis.__combat.setRound(2);
  await drain();
  const stored = onlyFormation();
  assert.equal(stored.combat.roundsCounted, 2, "rounds counted");
  assert.equal((stored.clock.roundsPartial ?? 0) - before, 2, "clock advanced 2 rounds");
});

await scenario("reform on combat end restores the party", async () => {
  await globalThis.__combat.delete();
  await drain();

  const stored = onlyFormation();
  assert.equal(stored.combat, null, "combat cleared");
  for (const m of stored.members) {
    assert.ok(!m.deployedTokenId, "deployedTokenId cleared");
    assert.ok(m.tokenData, "member token re-stashed");
  }
  const partyToken = scene.tokens.get(stored.tokenId);
  assert.ok(partyToken && !partyToken.hidden, "party token visible again");
  const strays = scene.tokens.filter((t) => t.actorId === alice.id || t.actorId === bob.id);
  assert.equal(strays.length, 0, "no member tokens left on the field");
  // With combat over, the deferred auto map session may now open legally.
  assert.ok(onlyFormation().mapSession, "map session opens once combat is over");
});

await scenario("a second combat deploys again (regroup round-trip)", async () => {
  const combat = new CombatMock();
  game.combats.set(combat.id, combat);
  const stored = onlyFormation();
  await combat.createEmbeddedDocuments("Combatant", [
    { tokenId: stored.tokenId, sceneId: scene.id, actorId: stored.actorId, hidden: false },
  ]);
  await drain();
  assert.ok(onlyFormation().combat?.active, "second deploy succeeded");
  assert.equal(onlyFormation().members.filter((m) => m.deployedTokenId).length, 2, "both redeployed");
  await combat.delete();
  await drain();
  assert.equal(onlyFormation().combat, null, "second reform succeeded");
});

await scenario("reform still fires if the combat flag was lost (evidence path)", async () => {
  const combat = new CombatMock();
  game.combats.set(combat.id, combat);
  const stored = onlyFormation();
  await combat.createEmbeddedDocuments("Combatant", [
    { tokenId: stored.tokenId, sceneId: scene.id, actorId: stored.actorId, hidden: false },
  ]);
  await drain();
  // Simulate the historical clobber: something erased the combat flag.
  await model.patchFormation(stored.id, (rec) => {
    rec.combat = null;
  });
  await combat.delete();
  await drain();
  const after = onlyFormation();
  for (const m of after.members) assert.ok(!m.deployedTokenId, "reform gathered deployed members anyway");
  assert.equal(
    scene.tokens.filter((t) => t.actorId === alice.id || t.actorId === bob.id).length,
    0,
    "no member tokens stranded",
  );
});

await scenario("deleting a member actor removes it from the formation", async () => {
  const charlie = await member("Charlie");
  await drain();
  let formation = model.getFormation(onlyFormation().id);
  await model.addMember(formation, charlie, null);
  await drain();
  assert.equal(onlyFormation().members.length, 3, "third member added");
  await charlie.delete();
  await drain();
  const stored = onlyFormation();
  assert.equal(stored.members.length, 2, "deleted member dropped from the formation");
});

await scenario("deleting the party actor dissolves the formation (no phantoms)", async () => {
  const stored = onlyFormation();
  const partyActor = game.actors.get(stored.actorId);
  await partyActor.delete();
  await drain();

  assert.equal(Object.keys(readFormations()).length, 0, "formation record deleted with its actor");
  assert.ok(!scene.tokens.get(stored.tokenId), "party token removed");
  const restored = scene.tokens.filter((t) => t.actorId === alice.id || t.actorId === bob.id);
  assert.equal(restored.length, 2, "stashed member tokens restored to the scene");
  assert.equal(game.actors.filter((a) => a.type === `${MODULE_ID}.party`).length, 0, "no phantom party actor");
});

await scenario("prune clears dead records and rescues their stashes", async () => {
  const all = readFormations();
  const ghost = {
    id: "ghost01",
    name: "Ghost Party",
    actorId: "act-deleted",
    sceneId: scene.id,
    tokenId: null,
    members: [
      {
        actorId: alice.id,
        roles: [],
        tokenData: { name: "Alice", actorId: alice.id, x: 900, y: 900, width: 1, height: 1, flags: {} },
      },
    ],
    lights: [],
    spells: [],
    clock: { turnsTotal: 0, turnsSinceRest: 0, encounterCounter: 0, carryFeet: 0, winded: false, paused: false },
  };
  all[ghost.id] = ghost;
  await game.settings.set(MODULE_ID, "formations", all);
  const aliceTokensBefore = scene.tokens.filter((t) => t.actorId === alice.id).length;

  await model.pruneFormations();
  await drain();

  assert.ok(!readFormations().ghost01, "dead record pruned");
  assert.equal(
    scene.tokens.filter((t) => t.actorId === alice.id).length,
    aliceTokensBefore + 1,
    "stashed token rescued from the dead record",
  );
});

await scenario("disband tears everything down", async () => {
  // Build a fresh party from the restored tokens, then disband it.
  const aliceToken = scene.tokens.find((t) => t.actorId === alice.id);
  let formation = await model.createFormation("Second Party");
  formation = await model.addMember(formation, alice, aliceToken);
  await drain();
  const stored = onlyFormation();
  await model.disband(model.getFormation(stored.id));
  await drain();

  assert.equal(Object.keys(readFormations()).length, 0, "record deleted");
  assert.ok(!game.actors.get(stored.actorId), "party actor deleted");
  assert.ok(scene.tokens.some((t) => t.actorId === alice.id), "member token restored");
});

if (failures) {
  console.error(`test-flows: ${failures} scenario(s) FAILED`);
  process.exit(1);
}
console.log("test-flows: all scenarios passed");
