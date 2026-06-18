import { describe, it, expect } from 'vitest';
import { entryToCreature, deriveOptions, type RawIndexEntry } from '@/data/creatures';
import type { Creature } from '@/encounter/math';

function npc(overrides: Partial<RawIndexEntry> = {}): RawIndexEntry {
  return {
    type: 'npc',
    name: 'Goblin Warrior',
    img: 'icons/goblin.webp',
    uuid: 'Compendium.pf2e.pathfinder-bestiary.Actor.goblin',
    system: {
      details: {
        level: { value: -1 },
        publication: { title: 'Pathfinder Bestiary', remaster: false },
        source: { value: 'Bestiary' },
      },
      traits: { value: ['goblin', 'humanoid'], rarity: 'common', size: { value: 'sm' } },
    },
    ...overrides,
  };
}

describe('entryToCreature', () => {
  it('maps a well-formed npc index entry', () => {
    expect(entryToCreature(npc())).toEqual<Creature>({
      uuid: 'Compendium.pf2e.pathfinder-bestiary.Actor.goblin',
      name: 'Goblin Warrior',
      level: -1,
      size: 'sm',
      rarity: 'common',
      traits: ['goblin', 'humanoid'],
      source: 'Pathfinder Bestiary',
      img: 'icons/goblin.webp',
      remaster: false,
    });
  });

  it('skips non-npc entries', () => {
    expect(entryToCreature(npc({ type: 'character' }))).toBeNull();
    expect(entryToCreature(npc({ type: 'hazard' }))).toBeNull();
  });

  it('skips entries missing required index fields', () => {
    expect(entryToCreature(npc({ uuid: undefined }))).toBeNull();
    expect(entryToCreature({ ...npc(), system: { details: {}, traits: {} } })).toBeNull();
  });

  it('falls back source title → source.value → Unknown', () => {
    const noTitle = npc();
    noTitle.system!.details!.publication = undefined;
    expect(entryToCreature(noTitle)?.source).toBe('Bestiary');

    const none = npc();
    none.system!.details!.publication = undefined;
    none.system!.details!.source = undefined;
    expect(entryToCreature(none)?.source).toBe('Unknown');
  });

  it('reads the remaster flag', () => {
    const remastered = npc();
    remastered.system!.details!.publication = { title: 'Monster Core', remaster: true };
    expect(entryToCreature(remastered)?.remaster).toBe(true);
  });
});

describe('deriveOptions', () => {
  const creatures: Creature[] = [
    { uuid: 'a', name: 'A', level: 2, size: 'lg', rarity: 'rare', traits: ['fire', 'undead'], source: 'Bestiary 2', img: '', remaster: false },
    { uuid: 'b', name: 'B', level: -1, size: 'sm', rarity: 'common', traits: ['undead'], source: 'Bestiary', img: '', remaster: true },
    { uuid: 'c', name: 'C', level: 10, size: 'med', rarity: 'common', traits: ['fire'], source: 'Bestiary', img: '', remaster: false },
  ];

  it('reports the level range', () => {
    const o = deriveOptions(creatures);
    expect(o.minLevel).toBe(-1);
    expect(o.maxLevel).toBe(10);
  });

  it('orders sizes and rarities by PF2e rank, splits creature types out of traits', () => {
    const o = deriveOptions(creatures);
    expect(o.sizes).toEqual(['sm', 'med', 'lg']);
    expect(o.rarities).toEqual(['common', 'rare']);
    expect(o.traits).toEqual(['fire']);
    expect(o.creatureTypes).toEqual(['undead']);
  });

  it('defaults the level range when empty', () => {
    const o = deriveOptions([]);
    expect(o.minLevel).toBe(-1);
    expect(o.maxLevel).toBe(25);
  });
});
