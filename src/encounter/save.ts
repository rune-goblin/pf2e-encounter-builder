import { MODULE_ID } from '@/constants';
import {
  adjustmentForVariant,
  dedupeKey,
  variantForAdjustment,
  type EncounterEntry,
  type Variant,
} from '@/encounter/math';
import { creatureFromUuid, entryToCreature, type RawIndexEntry } from '@/data/creatures';
import type { ActorPF2e, CombatantPF2e, EncounterPF2e, ScenePF2e, TokenDocumentPF2e } from 'foundry-pf2e';

const FOLDER_NAME = 'PF2e Encounter Builder';
const TOKENS_PER_ROW = 10;

export interface SaveContext {
  partySize: number;
  partyLevel: number;
}

export interface SaveResult {
  combatantCount: number;
}

export interface AddToSceneResult {
  placed: number;
  alreadyPresent: number;
}

interface Placeable {
  width: number;
  height: number;
  x: number;
  y: number;
}

// Pack token sources into rows (wrapping near TOKENS_PER_ROW grid cells) and center the whole
// block on the scene, mutating x/y in place. Advancing by each token's own footprint keeps
// larger creatures from overlapping; centering on the scene (rather than the top-left corner)
// drops the encounter in view and clear of party tokens parked at the edges.
function centerTokens(scene: ScenePF2e, tokens: Placeable[]): void {
  const { size, sceneX, sceneY, sceneWidth, sceneHeight } = scene.dimensions;

  type Row = { items: Placeable[]; cells: number; height: number };
  const rows: Row[] = [];
  let row: Row = { items: [], cells: 0, height: 1 };
  for (const tk of tokens) {
    const w = tk.width || 1;
    if (row.items.length && row.cells + w > TOKENS_PER_ROW) {
      rows.push(row);
      row = { items: [], cells: 0, height: 1 };
    }
    row.items.push(tk);
    row.cells += w;
    row.height = Math.max(row.height, tk.height || 1);
  }
  if (row.items.length) rows.push(row);

  const blockCells = rows.reduce((sum, r) => sum + r.height, 0);
  let y = sceneY + Math.round((sceneHeight / size - blockCells) / 2) * size;
  for (const r of rows) {
    let x = sceneX + Math.round((sceneWidth / size - r.cells) / 2) * size;
    for (const tk of r.items) {
      tk.x = x;
      tk.y = y;
      x += (tk.width || 1) * size;
    }
    y += r.height * size;
  }
}

interface Group {
  uuid: string;
  variant: Variant;
  name: string;
  count: number;
  actor?: ActorPF2e;
}

function t(key: string, data?: Record<string, string | number>): string {
  return data
    ? game.i18n.format(`${MODULE_ID}.${key}`, data)
    : game.i18n.localize(`${MODULE_ID}.${key}`);
}

// Collapse identical rows (same creature + adjustment) into one group with a summed count,
// so the same actor is imported once and the deploy loop knows the total token count.
function groupEntries(entries: EncounterEntry[]): Group[] {
  const map = new Map<string, Group>();
  for (const e of entries) {
    if (e.count <= 0) continue;
    const key = dedupeKey(e.uuid, e.variant);
    const g = map.get(key);
    if (g) g.count += e.count;
    else map.set(key, { uuid: e.uuid, variant: e.variant, name: e.name, count: e.count });
  }
  return [...map.values()];
}

async function ensureFolder(): Promise<foundry.documents.Folder> {
  const existing = game.folders.find((f) => f.type === 'Actor' && f.name === FOLDER_NAME);
  if (existing) return existing;
  const created = await getDocumentClass('Folder').create({ name: FOLDER_NAME, type: 'Actor' });
  if (!created) throw new Error(`${MODULE_ID} | could not create folder`);
  return created;
}

// Import each group's creature into the folder once, applying the Elite/Weak adjustment.
// Reuses an already-imported actor with the same compendium source + adjustment so repeated
// saves don't pile up duplicates. fromCompendium stamps `_stats.compendiumSource`, which
// PF2e surfaces as `actor.sourceId`.
async function ensureActors(groups: Group[], folder: foundry.documents.Folder): Promise<void> {
  const ActorClass = getDocumentClass('Actor');

  const byKey = new Map<string, ActorPF2e>();
  for (const actor of game.actors.filter((a) => a.folder?.id === folder.id)) {
    const sourceId = actor.sourceId;
    if (!sourceId) continue;
    const adjustment = actor.isOfType('npc') ? actor.system.attributes.adjustment : null;
    byKey.set(`${sourceId}|${adjustment ?? 'base'}`, actor);
  }

  for (const g of groups) {
    const key = dedupeKey(g.uuid, g.variant);
    const reuse = byKey.get(key);
    if (reuse) {
      g.actor = reuse;
      continue;
    }

    const src = await fromUuid(g.uuid);
    if (!src) {
      ui.notifications.warn(t('notifications.missingActor', { name: g.name }));
      continue;
    }
    const data = game.actors.fromCompendium(src as ActorPF2e<null>);
    data.folder = folder.id;
    const actor = await ActorClass.create(data);
    if (!actor) continue;

    const adjustment = adjustmentForVariant(g.variant);
    if (actor.isOfType('npc') && adjustment) await actor.applyAdjustment(adjustment);
    g.actor = actor;
    byKey.set(key, actor);
  }
}

export async function saveEncounter(entries: EncounterEntry[], _ctx: SaveContext): Promise<SaveResult> {
  if (!game.user.isGM) throw new Error(`${MODULE_ID} | only a GM can save an encounter`);

  const groups = groupEntries(entries);
  if (groups.length === 0) throw new Error(`${MODULE_ID} | nothing to save`);

  const folder = await ensureFolder();
  await ensureActors(groups, folder);
  const deployable = groups.filter((g): g is Required<Group> => !!g.actor);
  if (deployable.length === 0) throw new Error(`${MODULE_ID} | no actors could be imported`);

  // Always a scene-less combat of token-less combatants. Placing tokens is the deliberate
  // "Add to Scene" step, so the encounter isn't dropped onto whatever map happens to be open
  // at save time; the GM positions it when ready.
  const combat = await getDocumentClass('Combat').create({ scene: null });
  if (!combat) throw new Error(`${MODULE_ID} | could not create combat`);

  const combatants = deployable.flatMap((g) =>
    Array.from({ length: g.count }, () => ({ actorId: g.actor.id })),
  );
  await combat.createEmbeddedDocuments('Combatant', combatants);
  await combat.activate();
  return { combatantCount: combatants.length };
}

// Prefer the compendium source so we recover the creature's *base* stats (level/img/source
// unmutated by an applied Elite/Weak adjustment); fall back to the live actor for homebrew
// world actors that never came from a pack. Either way entryToCreature drops non-NPCs, so
// party PCs and hazards in the combat are skipped.
async function creatureForCombatant(actor: ActorPF2e) {
  const source = actor.sourceId;
  if (source) {
    const fromSource = await creatureFromUuid(source);
    if (fromSource) return fromSource;
  }
  return entryToCreature(actor as unknown as RawIndexEntry);
}

// Reverse of saveEncounter: rebuild the builder's entry list from a combat's combatants,
// reading each actor's adjustment as the Weak/Base/Elite variant and collapsing identical
// (source + adjustment) combatants into one counted row.
export async function encounterFromCombat(combat: EncounterPF2e): Promise<EncounterEntry[]> {
  const groups = new Map<string, EncounterEntry>();
  for (const c of combat.combatants) {
    const actor = c.actor;
    if (!actor) continue;
    const creature = await creatureForCombatant(actor);
    if (!creature) continue;
    const adjustment = actor.isOfType('npc') ? actor.system.attributes.adjustment : null;
    const variant = variantForAdjustment(adjustment);
    const key = dedupeKey(creature.uuid, variant);
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { ...creature, variant, count: 1, cost: 0 });
  }
  return [...groups.values()];
}

// Combatants with an actor but no token on this scene — i.e. exactly what "Add to Scene"
// would place. Drives both the placement loop and the launch button's enabled state.
export function missingFromScene(combat: EncounterPF2e, scene: ScenePF2e): CombatantPF2e[] {
  return combat.combatants.filter((c) => !!c.actor && !(c.token && c.sceneId === scene.id));
}

// Drop tokens for a combat's actors onto a scene and link each combatant to its token, so a
// token-less encounter can be placed once a map is open. Combatants already represented by a
// token on this scene are left untouched.
export async function addEncounterToScene(combat: EncounterPF2e, scene: ScenePF2e): Promise<AddToSceneResult> {
  if (!game.user.isGM) throw new Error(`${MODULE_ID} | only a GM can place an encounter`);

  const pending = missingFromScene(combat, scene);
  const alreadyPresent = combat.combatants.size - pending.length;
  if (pending.length === 0) return { placed: 0, alreadyPresent };

  // A scene-less combat binds to this scene now that one is in play.
  if (!combat.scene) await combat.update({ scene: scene.id });

  const tokenDocs: TokenDocumentPF2e[] = [];
  for (const c of pending) {
    tokenDocs.push(await c.actor!.getTokenDocument());
  }
  const tokenSources = tokenDocs.map((td) => td.toObject());
  centerTokens(scene, tokenSources);
  const tokens = await scene.createEmbeddedDocuments('Token', tokenSources);

  await combat.updateEmbeddedDocuments(
    'Combatant',
    tokens.map((tk, i) => ({ _id: pending[i].id, tokenId: tk.id, sceneId: scene.id, actorId: tk.actor?.id })),
  );

  return { placed: tokens.length, alreadyPresent };
}
