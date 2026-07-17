/* global game, foundry, fromUuidSync, Hooks, document */
import { MODULE_ID, THIEF_PROGRESSION } from "./constants.mjs";
import { getFormation, getMemberActor, realMembers } from "./formation-model.mjs";
import { PARTY_CHECKS, resolveCheck } from "./party-rolls.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Skill Audit (GM): full transparency into how every party roll resolves for
 * every member — which item or Adventuring target is used, the auto-scaled
 * level and factor, and the bonuses applied. Also the editor for **custom
 * skills**: any ability item can be flagged to participate in a party roll
 * (`checkKey`), auto-scale on a thief progression (`thiefSkill`), and scale
 * at a fraction of the owner's level (`levelFactor`, e.g. 0.5 for "as a
 * thief of half his class level").
 */
export default class SkillAuditApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #formationId;

  constructor(options = {}) {
    super(options);
    this.#formationId = options.formationId;
  }

  static DEFAULT_OPTIONS = {
    id: "acks-formation-skill-audit",
    classes: ["acks-formation", "skill-audit"],
    window: { resizable: true, title: "ACKS-FORMATION.audit.title" },
    position: { width: 640, height: 640 },
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/skill-audit.hbs`, scrollable: [""] },
  };

  get formation() {
    return getFormation(this.#formationId);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const formation = this.formation;
    context.formation = formation;
    if (!formation) return context;

    const checks = Object.entries(PARTY_CHECKS).map(([key, cfg]) => ({
      key,
      label: game.i18n.localize(cfg.label),
    }));
    context.checkColumns = checks;

    const checkOptions = [
      { value: "", label: game.i18n.localize("ACKS-FORMATION.audit.flagNone") },
      ...Object.values(
        Object.entries(PARTY_CHECKS).reduce((acc, [key, cfg]) => {
          acc[cfg.flagKey] ??= { value: cfg.flagKey, label: game.i18n.localize(cfg.label) };
          return acc;
        }, {}),
      ),
    ];
    const progressionOptions = [
      { value: "", label: game.i18n.localize("ACKS-FORMATION.audit.fixedTarget") },
      ...Object.keys(THIEF_PROGRESSION).map((key) => ({ value: key, label: key })),
    ];

    context.members = realMembers(formation)
      .map((member) => getMemberActor(member))
      .filter(Boolean)
      .map((actor) => ({
        name: actor.name,
        img: actor.img,
        level: actor.system?.details?.level ?? "—",
        resolutions: Object.entries(PARTY_CHECKS).map(([key, cfg]) => {
          const check = resolveCheck(actor, cfg);
          if (!check) return { label: "—", source: "" };
          const bonus = check.bonus ? (check.bonus > 0 ? ` +${check.bonus}` : ` ${check.bonus}`) : "";
          return { label: `${check.target}+${bonus}`, source: check.source };
        }),
        items: actor.items
          .filter((i) => i.type === "ability")
          .map((item) => ({
            uuid: item.uuid,
            name: item.name,
            target: item.system?.rollTarget ?? 0,
            checkKey: item.getFlag(MODULE_ID, "checkKey") ?? "",
            thiefSkill: item.getFlag(MODULE_ID, "thiefSkill") ?? "",
            levelFactor: item.getFlag(MODULE_ID, "levelFactor") ?? 1,
            checkOptions: checkOptions.map((o) => ({
              ...o,
              active: o.value === (item.getFlag(MODULE_ID, "checkKey") ?? ""),
            })),
            progressionOptions: progressionOptions.map((o) => ({
              ...o,
              active: o.value === (item.getFlag(MODULE_ID, "thiefSkill") ?? ""),
            })),
          })),
      }));

    context.progressionTable = Object.entries(THIEF_PROGRESSION).map(([key, values]) => ({
      key,
      values: values.join(" / "),
    }));
    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!game.user.isGM) return;
    for (const el of this.element.querySelectorAll("[data-item-uuid][data-field]")) {
      el.addEventListener("change", async (event) => {
        const { itemUuid, field } = event.currentTarget.dataset;
        const item = fromUuidSync(itemUuid);
        if (!item) return;
        let value = event.currentTarget.value;
        if (field === "levelFactor") value = Number(value) || 1;
        if (value === "" || value === null) await item.unsetFlag(MODULE_ID, field);
        else await item.setFlag(MODULE_ID, field, value);
        // Binding an item to a party roll makes it a skill (turns on its tab).
        if ((field === "checkKey" || field === "thiefSkill") && value) {
          await item.setFlag(MODULE_ID, "isSkill", true);
        }
        this.render();
      });
    }
  }
}

/* -------------------------------------------- */
/*  Item-sheet Skill tab                        */
/* -------------------------------------------- */

const TAB_ID = "afmskill";

function loc(key, data = {}) {
  return game.i18n.format(`ACKS-FORMATION.${key}`, data);
}

/**
 * An ability is "a skill" when explicitly checked on its sheet, or (for items
 * flagged before the checkbox existed) when it carries party-roll flags.
 */
export function isSkillItem(item) {
  const explicit = item.getFlag(MODULE_ID, "isSkill");
  if (explicit !== undefined) return !!explicit;
  return !!(item.getFlag(MODULE_ID, "checkKey") || item.getFlag(MODULE_ID, "thiefSkill"));
}

/**
 * Ability item sheets grow a "Skill" checkbox on the details pane; checking it
 * turns on a **Skill tab** showing the party-roll binding (Used for), the
 * thief progression with the owner's current row highlighted, the level
 * factor, and the live resolved target with every stacked bonus itemized.
 * GMs edit; owners of a flagged skill see the tab read-only.
 */
export function registerSkillFlagEditor() {
  Hooks.on("renderApplicationV2", (app, element) => {
    try {
      const item = app?.document;
      if (item?.documentName !== "Item" || item.type !== "ability") return;
      const root = element instanceof HTMLElement ? element : element?.[0];
      if (!root) return;
      injectSkillUI(app, root, item);
    } catch (err) {
      console.error(`${MODULE_ID} | skill tab injection failed`, err);
    }
  });
}

function injectSkillUI(app, root, item) {
  // Rebuild from scratch on every render: the injected tab section survives
  // part replacement (it is not an application part) while the nav anchor and
  // details checkbox do not, so removal + re-insertion keeps all three fresh.
  for (const el of root.querySelectorAll(".acks-formation-skill-anchor, .acks-formation-skill-tab, .acks-formation-skill-check")) el.remove();

  const gm = game.user.isGM;
  const skill = isSkillItem(item);

  // "Skill" checkbox on the details pane turns the tab on and off.
  const fieldSet = root.querySelector('.tab[data-tab="description"] .field-set');
  if (fieldSet && gm) {
    const group = document.createElement("div");
    group.className = "form-group form-group--row acks-formation-skill-check";
    group.innerHTML = `
      <label class="form-group__label" data-tooltip="${loc("audit.isSkillHint")}">${loc("audit.isSkill")}</label>
      <div class="form-group__fields"><input type="checkbox" ${skill ? "checked" : ""}/></div>`;
    group.querySelector("input").addEventListener("change", async (event) => {
      event.stopPropagation();
      await item.setFlag(MODULE_ID, "isSkill", event.currentTarget.checked);
    });
    fieldSet.appendChild(group);
  }

  const nav = root.querySelector("nav.tabs");
  const sections = root.querySelectorAll('section.tab[data-group="primary"]');
  if (!nav || !sections.length) return;

  if (!skill) {
    // The tab just disappeared while active: fall back to the description tab.
    if (app.tabGroups?.primary === TAB_ID) {
      try {
        app.changeTab("description", "primary", { force: true });
      } catch (err) {
        console.warn(`${MODULE_ID} | could not restore description tab`, err);
      }
    }
    return;
  }

  const active = app.tabGroups?.primary === TAB_ID;

  const anchor = document.createElement("a");
  anchor.className = `acks-formation-skill-anchor${active ? " active" : ""}`;
  anchor.dataset.action = "tab";
  anchor.dataset.group = "primary";
  anchor.dataset.tab = TAB_ID;
  anchor.innerHTML = `<i class="fa-solid fa-graduation-cap" inert></i><span>${loc("audit.tab")}</span>`;
  nav.appendChild(anchor);

  const section = document.createElement("section");
  section.className = `tab acks-formation-skill-tab${active ? " active" : ""}`;
  section.dataset.group = "primary";
  section.dataset.tab = TAB_ID;
  section.innerHTML = buildSkillTabHTML(item, gm);
  sections[sections.length - 1].after(section);

  for (const el of section.querySelectorAll("[data-field]")) {
    el.disabled = !gm;
    el.addEventListener("change", async (event) => {
      event.stopPropagation();
      const field = event.currentTarget.dataset.field;
      let value = event.currentTarget.value;
      if (field === "levelFactor") value = Number(value) || 1;
      if (value === "" || value === null) await item.unsetFlag(MODULE_ID, field);
      else await item.setFlag(MODULE_ID, field, value);
    });
  }
}

function buildSkillTabHTML(item, gm) {
  const esc = foundry.utils.escapeHTML;
  const checkKey = item.getFlag(MODULE_ID, "checkKey") ?? "";
  const thiefSkill = item.getFlag(MODULE_ID, "thiefSkill") ?? "";
  const levelFactor = item.getFlag(MODULE_ID, "levelFactor") ?? 1;
  const dis = gm ? "" : "disabled";
  const owner = item.parent;

  const flagKeys = [...new Set(Object.values(PARTY_CHECKS).map((c) => c.flagKey))];
  const checkOpts = [`<option value="">${loc("audit.flagNone")}</option>`]
    .concat(flagKeys.map((k) => `<option value="${k}" ${k === checkKey ? "selected" : ""}>${k}</option>`))
    .join("");
  const progOpts = [`<option value="">${loc("audit.fixedTarget")}</option>`]
    .concat(
      Object.keys(THIEF_PROGRESSION).map(
        (k) => `<option value="${k}" ${k === thiefSkill ? "selected" : ""}>${k}</option>`,
      ),
    )
    .join("");

  let html = `<div class="content">`;
  html += `<fieldset class="acks-formation-flags"><legend>${loc("audit.sheetSection")}</legend>
    <div class="acks-formation-flag-row">
      <label>${loc("audit.usedFor")}</label>
      <select data-field="checkKey" ${dis}>${checkOpts}</select>
      <label>${loc("audit.progression")}</label>
      <select data-field="thiefSkill" ${dis}>${progOpts}</select>
      <label>${loc("audit.factor")}</label>
      <input type="number" step="0.25" min="0.25" max="2" value="${levelFactor}" data-field="levelFactor" ${dis}/>
    </div>
    ${checkKey ? "" : `<p class="hint">${loc("audit.tabNotSkill")}</p>`}
  </fieldset>`;

  // Progression by level with the owner's current row highlighted.
  const progression = thiefSkill ? THIEF_PROGRESSION[thiefSkill] : null;
  html += `<fieldset class="acks-formation-flags"><legend>${loc("audit.progressionRow")}</legend>`;
  if (progression) {
    const factor = Number(levelFactor) || 1;
    const level = owner?.system?.details?.level ?? null;
    const row = level !== null ? Math.min(Math.max(Math.ceil(level * factor), 1), progression.length) : null;
    html += `<div class="acks-formation-progression">`;
    progression.forEach((value, i) => {
      html += `<span class="cell${row === i + 1 ? " current" : ""}"><label>L${i + 1}</label>${value}+</span>`;
    });
    html += `</div>`;
    if (row !== null) {
      html += `<p class="hint">${loc("audit.effectiveRow", { name: esc(owner.name), level, factor, row })}</p>`;
    }
  } else {
    html += `<p class="hint">${loc("audit.sheetTarget")}: ${Number(item.system?.rollTarget) || 0}+</p>`;
  }
  html += `</fieldset>`;

  // Live resolution for the owner: what the party roll actually uses,
  // including the full stacked-bonus breakdown.
  if (owner && checkKey) {
    html += `<fieldset class="acks-formation-flags"><legend>${loc("audit.resolution")}</legend><ul class="acks-formation-resolution">`;
    for (const cfg of Object.values(PARTY_CHECKS)) {
      if (cfg.flagKey !== checkKey) continue;
      const label = game.i18n.localize(cfg.label);
      const check = resolveCheck(owner, cfg);
      if (!check) {
        html += `<li><strong>${label}</strong>: —</li>`;
        continue;
      }
      const breakdown = (check.parts ?? []).map((p) => `+${p.value} ${p.label}`).join(", ");
      html += `<li><strong>${label}</strong>: ${check.target}+ <em>(${esc(check.source)}${breakdown ? `; ${breakdown}` : ""})</em></li>`;
    }
    html += `</ul></fieldset>`;
  }
  html += `</div>`;
  return html;
}
