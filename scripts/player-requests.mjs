/* global game, foundry, ChatMessage, ui */
import { getFormation } from "./formation-model.mjs";
import { getSocket, registerHandler } from "./socket.mjs";
import { rollPartyCheck } from "./party-rolls.mjs";
import { addLight, addSpell, advanceTurns } from "./turn-engine.mjs";

/**
 * Player-declared party actions. All formation state lives in a world setting
 * only GMs can write, so member-owning players declare actions from the party
 * sheet and the primary GM's client validates and executes them:
 *
 * - light a torch/lantern/candle borne by a member they own;
 * - track a spell they cast (from an owned member's spellbook);
 * - declare a rest turn, or a listen/search/bash/track check.
 *
 * Every executed request is announced publicly so the table sees who declared
 * what; check results still go to the GM per the usual secrecy rules.
 */

const REQUEST_HANDLER = "partyRequest";

function loc(key, data = {}) {
  return game.i18n.format(`ACKS-FORMATION.${key}`, data);
}

function userOwnsMember(formation, user, actorId = null) {
  const members = actorId ? formation.members.filter((m) => m.actorId === actorId) : formation.members;
  return members.some((m) => {
    const actor = game.actors.get(m.actorId);
    return actor?.testUserPermission(user, "OWNER") ?? false;
  });
}

async function announceDeclaration(formation, user, text) {
  await ChatMessage.create({
    content: `<div class="acks-formation-card"><em>${loc("request.declared", {
      user: foundry.utils.escapeHTML(user.name),
      action: text,
    })}</em></div>`,
    speaker: { alias: formation.name },
  });
}

/** Execute a validated request on the GM client. */
async function executeRequest(formation, user, type, payload) {
  switch (type) {
    case "light": {
      if (!userOwnsMember(formation, user, payload.bearerId)) return;
      await announceDeclaration(formation, user, loc("request.light", {
        light: game.i18n.localize(`ACKS-FORMATION.light.${payload.lightType}`),
        bearer: game.actors.get(payload.bearerId)?.name ?? "?",
      }));
      await addLight(formation, payload.lightType, payload.bearerId);
      break;
    }
    case "spell": {
      if (!userOwnsMember(formation, user, payload.casterId)) return;
      if (!payload.name || !(payload.turns > 0)) return;
      await announceDeclaration(formation, user, loc("request.spell", {
        spell: foundry.utils.escapeHTML(payload.name),
        caster: game.actors.get(payload.casterId)?.name ?? "?",
        turns: payload.turns,
      }));
      await addSpell(formation, { name: payload.name, casterId: payload.casterId, turns: payload.turns });
      break;
    }
    case "rest": {
      if (!userOwnsMember(formation, user)) return;
      await announceDeclaration(formation, user, loc("request.rest"));
      await advanceTurns(formation, 1, { resting: true });
      break;
    }
    case "check": {
      if (!userOwnsMember(formation, user)) return;
      const label = game.i18n.localize(`ACKS-FORMATION.rolls.${payload.key}`);
      await announceDeclaration(formation, user, loc("request.check", { check: label }));
      await rollPartyCheck(formation, payload.key);
      break;
    }
  }
}

/** socketlib handler: runs on the active GM with the declaring user's id. */
async function handlePartyRequest(formationId, type, payload, userId) {
  const formation = getFormation(formationId);
  const user = game.users.get(userId);
  if (!formation || !user) return;
  await executeRequest(formation, user, type, payload ?? {});
}

/**
 * Declare a party action. GMs execute directly; players relay to the active
 * GM via socketlib (executeAsGM routes to exactly one GM client).
 */
export async function requestPartyAction(formationId, type, payload = {}) {
  const formation = getFormation(formationId);
  if (!formation) return;
  if (game.user.isGM) {
    await executeRequest(formation, game.user, type, payload);
    return;
  }
  const socket = getSocket();
  if (!socket || !game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize("ACKS-FORMATION.request.noGM"));
    return;
  }
  await socket.executeAsGM(REQUEST_HANDLER, formationId, type, payload, game.user.id);
  ui.notifications.info(game.i18n.localize("ACKS-FORMATION.request.sent"));
}

/** Register the GM-side request handler with socketlib. */
export function registerRequestSocket() {
  registerHandler(REQUEST_HANDLER, handlePartyRequest);
}
