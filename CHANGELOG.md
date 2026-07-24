# Changelog

Releases before 0.21.1 predate this file; see the git history and GitHub
releases for earlier changes.

## 0.23.0

**PartyData consumes acks-lib's shared compat stub.** The party actor's schema
was a hand-rolled copy of the system-compatibility fields every non-character
sub-type needs (isNew / thac0 / initiative / movement / the saves the system
touches). That set now has one home — `acksCompatStubs()` in acks-lib — so
`PartyData` spreads it instead. `acks-lib` moves from `recommends` to `requires`
(the party schema now imports it). Behaviour-neutral:

- The party's own `saves` block (paralysis/death/breath/spell + a duplicate
  wand) was **dead** — a party never rolls its own saves; `rollPartySave`
  reads each MEMBER's saves. Verified live: nothing reads the party actor's own
  saves. Dropped to the stub's implements/wand.
- `movement` is re-declared for the two party-specific facts the shared stub
  can't carry: `base` defaults to 120 (a party's speed, synced from members),
  and `value` holds the "N'/turn" label formation writes. `movement.mod` is
  **not** carried — the system's only reader (`_calculateMovement`) runs off
  `computeEncumbrance`, which bails on non-characters, so it is dead on a party.
- `SAVE_KEYS` documented: `breath` is CORRECT for the released system (acks
  14.0.1 stores `saves.breath`, shown as "Blast"); an earlier change to `blast`
  was reverted after live-testing showed it would break party saves against the
  running system. Flip when the system releases the rename.

- Declare the actual acks system floor in the manifest (minimum 14, was a
  stale 13; the family is developed and verified against system 14).
