import { CREATURE_TYPES, RARITIES, SIZES, type Creature, type FilterOptions } from '@/encounter/math';
import { ENCOUNTER_FOLDER_NAME } from '@/constants';

// Index fields mirror PF2e's own bestiary tab (compendium-browser/tabs/bestiary.ts) plus
// publication.remaster for the Remaster-only filter.
const INDEX_FIELDS = [
  'img',
  'system.details.level.value',
  'system.details.publication.title',
  'system.details.publication.remaster',
  'system.details.source.value',
  'system.traits',
];

// The slice of a compendium index entry we read. Everything optional: PF2e itself warns
// and skips actors missing index fields, so we map defensively rather than trust the shape.
export interface RawIndexEntry {
  type?: string;
  name?: string;
  img?: string;
  uuid?: string;
  system?: {
    details?: {
      level?: { value?: number };
      publication?: { title?: string; remaster?: boolean };
      source?: { value?: string };
    };
    traits?: {
      value?: string[];
      rarity?: string;
      size?: { value?: string };
    };
  };
}

export function entryToCreature(entry: RawIndexEntry): Creature | null {
  if (entry.type !== 'npc') return null;
  const details = entry.system?.details;
  const traits = entry.system?.traits;
  const uuid = entry.uuid;
  const level = details?.level?.value;
  const size = traits?.size?.value;
  if (!uuid || typeof level !== 'number' || !size) return null;

  const source = (details?.publication?.title || details?.source?.value || '').trim() || 'Unknown';
  return {
    uuid,
    name: entry.name ?? '(unnamed)',
    level,
    size,
    rarity: traits?.rarity ?? 'common',
    traits: traits?.value ?? [],
    source,
    img: entry.img ?? '',
    remaster: details?.publication?.remaster === true,
    hasArt: false,
  };
}

// A pack's index `img` is the stock system portrait; module-provided art lives in core Foundry's
// resolved `game.compendiumArt` map (the same source PF2e's own compendium browser overrides with,
// in compendium-browser/loader.ts#setModuleArt). Layer it on here so the thumbnail matches the
// browser and `hasArt` marks creatures whose portrait isn't the shared default.
function applyArt(creature: Creature): Creature {
  const art = game.compendiumArt?.get(creature.uuid)?.actor;
  if (art) {
    creature.img = art;
    creature.hasArt = true;
  }
  return creature;
}

export function deriveOptions(creatures: Creature[]): FilterOptions {
  const typeSet = new Set<string>(CREATURE_TYPES);
  const sizes = new Set<string>();
  const traits = new Set<string>();
  const creatureTypes = new Set<string>();
  const rarities = new Set<string>();
  let minLevel = Infinity;
  let maxLevel = -Infinity;

  for (const c of creatures) {
    sizes.add(c.size);
    for (const t of c.traits) (typeSet.has(t) ? creatureTypes : traits).add(t);
    rarities.add(c.rarity);
    if (c.level < minLevel) minLevel = c.level;
    if (c.level > maxLevel) maxLevel = c.level;
  }

  return {
    minLevel: Number.isFinite(minLevel) ? minLevel : -1,
    maxLevel: Number.isFinite(maxLevel) ? maxLevel : 25,
    sizes: SIZES.filter((s) => sizes.has(s)),
    rarities: RARITIES.filter((r) => rarities.has(r)),
    traits: [...traits].sort((a, b) => a.localeCompare(b)),
    creatureTypes: [...creatureTypes].sort((a, b) => a.localeCompare(b)),
  };
}

// Drag-drop entry point: resolve a dropped Actor UUID (world actor from the sidebar, or a
// compendium entry from the browser) to a Creature. A live actor document exposes the same
// system fields a compendium index entry does, so entryToCreature handles both — and applies
// the same npc-only/level+size validation, returning null for PCs, hazards, etc.
export async function creatureFromUuid(uuid: string): Promise<Creature | null> {
  const doc = await fromUuid(uuid);
  if (!doc) return null;
  const creature = entryToCreature(doc as unknown as RawIndexEntry);
  return creature ? applyArt(creature) : null;
}

// A world Creature paired with the compendium UUID it was imported from (null for homebrew),
// so the merge can let a world copy replace its compendium origin.
export type WorldCreature = { creature: Creature; source: string | null };

// World creatures win over compendium entries: a world creature whose source UUID matches a
// compendium creature's UUID replaces it (prefer the world copy), and duplicate world copies of
// the same source collapse to the first. Homebrew (no source) keys on its own UUID, so it never
// collides with a compendium entry.
export function mergeCreatures(world: WorldCreature[], compendium: Creature[]): Creature[] {
  const seen = new Set<string>();
  const covered = new Set<string>();
  const out: Creature[] = [];
  for (const { creature, source } of world) {
    const identity = source ?? creature.uuid;
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (source) covered.add(source);
    out.push(creature);
  }
  for (const creature of compendium) {
    if (!covered.has(creature.uuid)) out.push(creature);
  }
  return out;
}

// The compendium UUID a world actor was imported from. Foundry stamps it on `_stats`
// (older worlds carry it under `flags.core.sourceId`); null means homebrew.
function worldSourceId(actor: Actor): string | null {
  const stats = actor._stats as { compendiumSource?: string | null } | undefined;
  const core = actor.flags?.core as { sourceId?: string } | undefined;
  return stats?.compendiumSource ?? core?.sourceId ?? null;
}

// Stock placeholders (core mystery-man under icons/svg, PF2e's default-icons) aren't real art.
function isStockIcon(img: string): boolean {
  return !img || img.startsWith('icons/svg/') || img.includes('/default-icons/');
}

// World NPC actors the user can browse alongside the compendia. Prefer the actor's own portrait;
// fall back to the source's module art only when the world copy is still on a stock placeholder.
function collectWorldCreatures(): WorldCreature[] {
  const out: WorldCreature[] = [];
  for (const actor of game.actors) {
    // Our own saved-encounter imports are derived copies (deduped, Elite/Weak-adjusted) — listing
    // them would shadow the pristine compendium entries with adjusted stats.
    if (actor.folder?.name === ENCOUNTER_FOLDER_NAME) continue;
    if (!actor.testUserPermission(game.user, 'LIMITED')) continue;
    const creature = entryToCreature(actor as unknown as RawIndexEntry);
    if (!creature) continue;
    const source = worldSourceId(actor);
    const moduleArt = source ? game.compendiumArt?.get(source)?.actor : undefined;
    if (isStockIcon(creature.img) && moduleArt) {
      creature.img = moduleArt;
      creature.hasArt = true;
    } else if (!isStockIcon(creature.img)) {
      creature.hasArt = true;
    }
    out.push({ creature, source });
  }
  return out;
}

export type CreatureIndex = { creatures: Creature[]; options: FilterOptions };

// Built once per session, lazily on first app open. The full PF2e bestiary is ~4–5k
// entries; pulling every Actor pack's index is the same work PF2e's compendium browser
// does, so we cache the result rather than repeat it.
let cache: CreatureIndex | null = null;

export async function loadCreatures(force = false): Promise<CreatureIndex> {
  if (cache && !force) return cache;

  const world = collectWorldCreatures();

  const packs = game.packs.filter(
    (p) => p.documentName === 'Actor' && p.testUserPermission(game.user, 'LIMITED'),
  );
  const compendium: Creature[] = [];
  for (const pack of packs) {
    const index = await pack.getIndex({ fields: INDEX_FIELDS });
    for (const entry of index) {
      const creature = entryToCreature(entry as RawIndexEntry);
      if (creature) compendium.push(applyArt(creature));
    }
  }

  const creatures = mergeCreatures(world, compendium).sort((a, b) => a.name.localeCompare(b.name));

  cache = { creatures, options: deriveOptions(creatures) };
  return cache;
}
