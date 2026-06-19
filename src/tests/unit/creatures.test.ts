import { describe, it, expect } from 'vitest';
import {
  entryToCreature,
  deriveOptions,
  mergeCreatures,
  type RawIndexEntry,
  type WorldCreature,
} from '@/data/creatures';
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
      hasArt: false,
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
    { uuid: 'a', name: 'A', level: 2, size: 'lg', rarity: 'rare', traits: ['fire', 'undead'], source: 'Bestiary 2', img: '', remaster: false, hasArt: false },
    { uuid: 'b', name: 'B', level: -1, size: 'sm', rarity: 'common', traits: ['undead'], source: 'Bestiary', img: '', remaster: true, hasArt: false },
    { uuid: 'c', name: 'C', level: 10, size: 'med', rarity: 'common', traits: ['fire'], source: 'Bestiary', img: '', remaster: false, hasArt: false },
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

describe('mergeCreatures', () => {
  function creature(uuid: string, name = uuid): Creature {
    return { uuid, name, level: 1, size: 'med', rarity: 'common', traits: [], source: 'X', img: '', remaster: false, hasArt: false };
  }

  it('lets a world copy replace its compendium source, preferring the world', () => {
    const compendium = [creature('Compendium.pf2e.bestiary.Actor.goblin', 'Goblin')];
    const world: WorldCreature[] = [
      { creature: creature('Actor.world-goblin', 'My Goblin'), source: 'Compendium.pf2e.bestiary.Actor.goblin' },
    ];
    expect(mergeCreatures(world, compendium).map((c) => c.uuid)).toEqual(['Actor.world-goblin']);
  });

  it('collapses duplicate world copies of the same source', () => {
    const world: WorldCreature[] = [
      { creature: creature('Actor.a', 'A'), source: 'Compendium.x.Actor.s' },
      { creature: creature('Actor.b', 'B'), source: 'Compendium.x.Actor.s' },
    ];
    expect(mergeCreatures(world, []).map((c) => c.uuid)).toEqual(['Actor.a']);
  });

  it('keeps homebrew (sourceless) world creatures alongside the compendium', () => {
    const compendium = [creature('Compendium.x.Actor.goblin', 'Goblin')];
    const world: WorldCreature[] = [{ creature: creature('Actor.homebrew', 'Homebrew'), source: null }];
    expect(mergeCreatures(world, compendium).map((c) => c.uuid)).toEqual([
      'Actor.homebrew',
      'Compendium.x.Actor.goblin',
    ]);
  });

  it('keeps compendium entries with no world copy, world first', () => {
    const compendium = [creature('Compendium.x.Actor.a'), creature('Compendium.x.Actor.b')];
    const world: WorldCreature[] = [{ creature: creature('Actor.w'), source: null }];
    expect(mergeCreatures(world, compendium).map((c) => c.uuid)).toEqual([
      'Actor.w',
      'Compendium.x.Actor.a',
      'Compendium.x.Actor.b',
    ]);
  });
});
