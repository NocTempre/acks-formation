/* global game, foundry */
import { MODULE_ID } from "./constants.mjs";
import { SHARED_ACTIONS, bindMemberDrop, onChangeForm } from "./formation-actions.mjs";
import { getFormations } from "./formation-model.mjs";
import { buildFormationView, buildGMExtras, buildPlayerPanel } from "./formation-view.mjs";

/**
 * The dedicated "party" actor sub-type backing party tokens, and its sheet.
 * The sheet renders the SAME shared formation body as the formation manager
 * window — one UI, with GM-only controls hidden from players and a
 * declaration panel for member-owning players.
 */

export const PARTY_TYPE = `${MODULE_ID}.party`;

/**
 * Minimal system data. Besides our own needs, this mirrors every field the
 * acks system touches unguarded on non-character actors:
 * computeAdditionnalData (initiative, movement, thac0), Actor.create (isNew),
 * and the setup-time updateWeightsLanguages sweep, whose updateImplements()
 * reads `system.saves.implements` on EVERY actor in the world.
 */
export class PartyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const save = (initial) =>
      new fields.SchemaField({ value: new fields.NumberField({ required: true, initial }) });
    return {
      isNew: new fields.BooleanField({ initial: false }),
      initiative: new fields.SchemaField({
        mod: new fields.NumberField({ required: true, initial: 0 }),
        value: new fields.NumberField({ required: true, initial: 0 }),
      }),
      movement: new fields.SchemaField({
        base: new fields.NumberField({ required: true, initial: 120 }),
        mod: new fields.NumberField({ required: true, initial: 0 }),
        value: new fields.StringField({ required: true, blank: true, initial: "" }),
        encounter: new fields.NumberField({ required: true, initial: 0 }),
      }),
      thac0: new fields.SchemaField({
        throw: new fields.NumberField({ required: true, initial: 10 }),
        bba: new fields.NumberField({ required: true, initial: 0 }),
      }),
      saves: new fields.SchemaField({
        paralysis: save(13),
        death: save(14),
        breath: save(15),
        implements: save(16),
        spell: save(17),
        wand: save(16),
      }),
    };
  }
}

/** The formation record backed by a given party actor. */
export function formationForActor(actor) {
  if (!actor) return null;
  return Object.values(getFormations()).find((f) => f.actorId === actor.id) ?? null;
}

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class PartySheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["acks-formation", "party-sheet"],
    position: { width: 540, height: 700 },
    window: { resizable: true },
    // Replace the document sheet's submit pipeline: form inputs configure the
    // FORMATION record (rename, table), never the actor document itself.
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
      handler: onChangeForm,
    },
    actions: { ...SHARED_ACTIONS },
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/formation-body.hbs`, scrollable: [""] },
  };

  /** Re-render all open party sheets (called on any formation change). */
  static refreshAll() {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof PartySheet && app.rendered) app.render();
    }
  }

  get formation() {
    return formationForActor(this.actor);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const formation = this.formation;
    context.isGM = game.user.isGM;
    context.formation = formation;
    if (!formation) return context;
    Object.assign(context, buildFormationView(formation));
    if (context.isGM) Object.assign(context, buildGMExtras(formation));
    else Object.assign(context, buildPlayerPanel(formation));
    return context;
  }

  /** Preserve the window-content scroll position across live re-renders. */
  #scrollTop = 0;

  /** @override */
  async _preRender(context, options) {
    await super._preRender(context, options);
    this.#scrollTop = this.element?.querySelector(".window-content")?.scrollTop ?? this.#scrollTop;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    bindMemberDrop(this);
    const content = this.element?.querySelector(".window-content");
    if (content && this.#scrollTop) content.scrollTop = this.#scrollTop;
  }
}
