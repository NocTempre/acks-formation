/* global globalThis */

/**
 * Capability-aware ability matching — the bridge to the abilities program
 * (acks-lib vocabulary, acks-abilities effect model, acks-content import).
 *
 * The books print one capability several ways: *Searching* is a thief skill, a
 * proficiency, and what several class powers hand out. Matching on item NAME
 * catches whichever spelling the sheet happens to use; matching on a `kw:`
 * capability token catches every route to the mechanic. This module prefers
 * the capability and keeps the name match alongside it.
 *
 * **Union, not fallback.** Capability matching is precise but only as complete
 * as the register: Eavesdropping is a real listening proficiency that does not
 * yet declare `kw:listening`, and a strict capability check would silently drop
 * it. So candidates are the UNION of capability matches and the existing name
 * matches — never fewer members than before, plus the ones a rename would have
 * hidden.
 *
 * Degrades cleanly: with acks-lib absent there are no capability tokens to fold
 * and every caller falls back to the name patterns, which is exactly the
 * pre-integration behaviour. Nothing here is required for the module to run.
 */

const CONTENT_ID = "acks-content";
const ABILITIES_ID = "acks-abilities";

/** acks-lib's vocabulary, or null when it is not installed. */
function lib() {
  return globalThis.acksLib ?? null;
}

/**
 * One ability item as the `{id, provides}` shape acks-lib reasons over.
 *
 * `id` is the register's definition id, written by acks-content on import
 * (`flags["acks-content"].cookbook.id`). `provides` comes from the
 * acks-abilities effect model. An item with neither is a hand-made ability and
 * simply has no capability — the name path still covers it.
 */
function abilityRef(item) {
  const id = item?.getFlag?.(CONTENT_ID, "cookbook")?.id ?? null;
  const provides = item?.getFlag?.(ABILITIES_ID, "extras")?.provides ?? [];
  if (!id && !provides.length) return null;
  return { id, provides };
}

/** Every capability-bearing ability item on this actor. */
export function abilityRefs(actor) {
  const out = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "ability") continue;
    const ref = abilityRef(item);
    if (ref) out.push(ref);
  }
  return out;
}

/**
 * Does this actor hold an ability satisfying `token` (e.g. "kw:alertness")?
 *
 * Returns false — never throws — when acks-lib is absent, so callers combine it
 * with their name pattern via `||` and lose nothing.
 */
export function hasCapability(actor, token) {
  const l = lib();
  if (!l?.satisfies || !token) return false;
  return l.satisfies(abilityRefs(actor), token);
}

/** Does this specific item satisfy `token`? Used to pick roll candidates. */
export function itemHasCapability(item, token) {
  const l = lib();
  if (!l?.satisfies || !token) return false;
  const ref = abilityRef(item);
  return ref ? l.satisfies([ref], token) : false;
}

/*
 * Deliberately NOT wrapped here yet: acks-lib's `scopeApplies` (the 0.6.0
 * scoping primitive) and `nonStackingGroups`.
 *
 * `scopeApplies` answers WHEN a modifier applies — `vsKinds`, `vsAlignment`,
 * `tones`, `optionalRule`, `kickerAt`. This module cannot use it until it
 * consumes cookbook `effects` instead of its own hardcoded bonuses (retirement
 * Phase 4), because today there is no scoped effect in the pipeline for it to
 * gate. Wrapping it now would be an untested indirection with no caller.
 * When Phase 4 lands, the rule to honour is that **`undetermined` is not
 * `false`**: an unsettled scope must surface as a manual toggle, not silently
 * drop the bonus.
 *
 * `nonStackingGroups` is likewise unnecessary so far: every capability this
 * module reads is consumed as a boolean (`hasCapability`), so holding the same
 * capability twice already cannot double-apply.
 */
