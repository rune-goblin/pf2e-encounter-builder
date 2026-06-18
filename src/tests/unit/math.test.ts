import { describe, it, expect } from 'vitest';
import {
  adjustmentForVariant,
  computeCost,
  computeDelta,
  dedupeKey,
  effectiveLevel,
  makeXpBudget,
  threatBand,
  variantForAdjustment,
  type EncounterEntry,
  type Variant,
} from '@/encounter/math';

// computeCost only reads level + variant; the rest of Creature is irrelevant here.
function entry(level: number, variant: Variant): EncounterEntry {
  return { level, variant } as EncounterEntry;
}

describe('makeXpBudget', () => {
  it('is the GMG table for a 4-player party', () => {
    expect(makeXpBudget(4)).toEqual([40, 60, 80, 120, 160]);
  });

  it('scales by character-adjustment per extra/missing member', () => {
    expect(makeXpBudget(5)).toEqual([50, 75, 100, 150, 200]);
    expect(makeXpBudget(3)).toEqual([30, 45, 60, 90, 120]);
  });
});

describe('computeDelta', () => {
  it('maps the standard creature-XP deltas', () => {
    expect(computeDelta(-3)).toBe(15);
    expect(computeDelta(0)).toBe(40);
    expect(computeDelta(3)).toBe(120);
  });

  it('keeps the table edges', () => {
    expect(computeDelta(-4)).toBe(10);
    expect(computeDelta(4)).toBe(160);
  });

  it('earns no XP more than 4 levels below the party', () => {
    expect(computeDelta(-5)).toBe(0);
    expect(computeDelta(-8)).toBe(0);
  });

  it('caps at the +4 value more than 4 levels above the party', () => {
    expect(computeDelta(5)).toBe(160);
    expect(computeDelta(9)).toBe(160);
  });
});

describe('threatBand', () => {
  it('flags creatures outside the party level −4 … +4 table', () => {
    expect(threatBand(-5)).toBe('below');
    expect(threatBand(-4)).toBe('normal');
    expect(threatBand(0)).toBe('normal');
    expect(threatBand(4)).toBe('normal');
    expect(threatBand(5)).toBe('above');
  });
});

describe('effectiveLevel', () => {
  it('shifts by the weak/elite adjustment', () => {
    expect(effectiveLevel(entry(5, 0))).toBe(5);
    expect(effectiveLevel(entry(5, 1))).toBe(4); // weak −1
    expect(effectiveLevel(entry(5, 2))).toBe(6); // elite +1
    expect(effectiveLevel(entry(1, 1))).toBe(-1); // weak −2 at level 1
    expect(effectiveLevel(entry(0, 2))).toBe(2); // elite +2 at level 0
  });
});

describe('computeCost', () => {
  it('base cost tracks level − partyLevel', () => {
    expect(computeCost(entry(5, 0), 5)).toBe(40);
    expect(computeCost(entry(6, 0), 5)).toBe(60);
  });

  it('elite raises effective level by one (two at level ≤ 0)', () => {
    expect(computeCost(entry(3, 2), 3)).toBe(60); // 3 + 1 vs party 3 → delta +1
    expect(computeCost(entry(0, 2), 1)).toBe(60); // 0 + 2 vs party 1 → delta +1
  });

  it('weak lowers effective level by one (two at level 1)', () => {
    expect(computeCost(entry(5, 1), 5)).toBe(30); // 5 − 1 vs party 5 → delta −1
    expect(computeCost(entry(1, 1), 1)).toBe(20); // 1 − 2 vs party 1 → delta −2
  });

  it('costs nothing when 5+ levels below the party', () => {
    expect(computeCost(entry(0, 0), 5)).toBe(0); // delta −5
    expect(computeCost(entry(6, 1), 10)).toBe(0); // weak → eff 5 vs party 10 → delta −5
  });
});

describe('variant helpers', () => {
  it('maps variants to PF2e adjustments', () => {
    expect(adjustmentForVariant(0)).toBeNull();
    expect(adjustmentForVariant(1)).toBe('weak');
    expect(adjustmentForVariant(2)).toBe('elite');
  });

  it('maps PF2e adjustments back to variants, round-tripping', () => {
    expect(variantForAdjustment(null)).toBe(0);
    expect(variantForAdjustment('weak')).toBe(1);
    expect(variantForAdjustment('elite')).toBe(2);
    for (const v of [0, 1, 2] as Variant[]) {
      expect(variantForAdjustment(adjustmentForVariant(v))).toBe(v);
    }
  });

  it('builds a distinct dedupe key per adjustment', () => {
    const uuid = 'Compendium.pf2e.pathfinder-bestiary.Actor.abc';
    expect(dedupeKey(uuid, 0)).toBe(`${uuid}|base`);
    expect(dedupeKey(uuid, 1)).toBe(`${uuid}|weak`);
    expect(dedupeKey(uuid, 2)).toBe(`${uuid}|elite`);
    expect(new Set([dedupeKey(uuid, 0), dedupeKey(uuid, 1), dedupeKey(uuid, 2)]).size).toBe(3);
  });
});
