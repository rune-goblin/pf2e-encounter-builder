import { CREATURE_TYPES, RARITIES, SIZES, type Creature, type FilterOptions } from '@/encounter/math';

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
  };
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
  return doc ? entryToCreature(doc as unknown as RawIndexEntry) : null;
}

export type CreatureIndex = { creatures: Creature[]; options: FilterOptions };

// Built once per session, lazily on first app open. The full PF2e bestiary is ~4–5k
// entries; pulling every Actor pack's index is the same work PF2e's compendium browser
// does, so we cache the result rather than repeat it.
let cache: CreatureIndex | null = null;

export async function loadCreatures(force = false): Promise<CreatureIndex> {
  if (cache && !force) return cache;

  const packs = game.packs.filter(
    (p) => p.documentName === 'Actor' && p.testUserPermission(game.user, 'LIMITED'),
  );

  const creatures: Creature[] = [];
  for (const pack of packs) {
    const index = await pack.getIndex({ fields: INDEX_FIELDS });
    for (const entry of index) {
      const creature = entryToCreature(entry as RawIndexEntry);
      if (creature) creatures.push(creature);
    }
  }
  creatures.sort((a, b) => a.name.localeCompare(b.name));

  cache = { creatures, options: deriveOptions(creatures) };
  return cache;
}
