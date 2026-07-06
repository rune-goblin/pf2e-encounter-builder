import { describe, it, expect } from 'vitest';
import {
  activeStageIndex,
  adjustmentForVariant,
  computeCost,
  computeDelta,
  dedupeKey,
  effectiveLevel,
  isTroop,
  makeBarStages,
  makeXpBudget,
  reinforcedBudget,
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

describe('reinforcedBudget', () => {
  it('raises every tier by the allied XP (Rules 3439)', () => {
    expect(reinforcedBudget([40, 60, 80, 120, 160], 100)).toEqual([140, 160, 180, 220, 260]);
  });

  it('is the identity with no allies', () => {
    expect(reinforcedBudget([40, 60, 80, 120, 160], 0)).toEqual([40, 60, 80, 120, 160]);
  });
});

describe('makeBarStages', () => {
  it('places chips at the base budget ratios — 25/37.5/50/75/100 — with a pinned pre-Trivial stage', () => {
    const stages = makeBarStages([40, 60, 80, 120, 160]);
    expect(stages.map((s) => s.at)).toEqual([0, 25, 37.5, 50, 75, 100]);
    expect(stages[1].label).toBe('Trivial 40');
    expect(stages[5].label).toBe('Extreme 160');
  });

  it('re-derives chip positions when a flat ally offset shifts the budget', () => {
    const ats = makeBarStages([140, 160, 180, 220, 260]).map((s) => s.at);
    expect(ats[0]).toBe(0); // pre-Trivial stage stays pinned
    expect(ats[1]).toBeCloseTo((140 / 260) * 100);
    expect(ats[3]).toBeCloseTo((180 / 260) * 100);
    expect(ats[5]).toBe(100);
    // no longer the fixed 25 — the whole scale is pushed right by the reinforcement
    expect(ats[1]).toBeGreaterThan(50);
  });
});

describe('activeStageIndex', () => {
  const stages = [{ at: 0 }, { at: 25 }, { at: 50 }, { at: 75 }, { at: 100 }] as Parameters<
    typeof activeStageIndex
  >[0];

  it('picks the last stage the value has reached', () => {
    expect(activeStageIndex(stages, 0)).toBe(0);
    expect(activeStageIndex(stages, 24.9)).toBe(0);
    expect(activeStageIndex(stages, 25)).toBe(1); // inclusive at the threshold
    expect(activeStageIndex(stages, 60)).toBe(2);
    expect(activeStageIndex(stages, 100)).toBe(4);
    expect(activeStageIndex(stages, 130)).toBe(4); // past the top clamps to the last stage
  });
});

describe('skirmish threat band', () => {
  // The payoff of skirmish mode: enemy XP is rated against the *reinforced* thresholds. This pins
  // the whole reinforcedBudget → makeBarStages → activeStageIndex chain the bar renders through —
  // the bar value and the chip positions must share budget[4] as their denominator, or the band drifts.
  const bandFor = (budget: number[], enemyXp: number) =>
    activeStageIndex(makeBarStages(budget), Math.min(100, (enemyXp / budget[4]) * 100));

  const reinforced = reinforcedBudget(makeXpBudget(4), 100); // [140,160,180,220,260], one strong ally troop
  const band = (enemyXp: number) => bandFor(reinforced, enemyXp);

  it('measures enemy XP against the reinforced tiers, not the base ones', () => {
    expect(band(0)).toBe(0); // pre-Trivial
    expect(band(140)).toBe(1); // exactly the reinforced Trivial threshold
    expect(band(200)).toBe(3); // between reinforced Moderate (180) and Severe (220) → Moderate
    expect(band(260)).toBe(5); // reinforced Extreme
    expect(band(400)).toBe(5); // overkill still clamps to Extreme
    // 200 enemy XP is off-the-charts Extreme against the base [40,60,80,120,160]; the allies pull it down.
    expect(bandFor(makeXpBudget(4), 200)).toBe(5);
    expect(band(200)).toBeLessThan(bandFor(makeXpBudget(4), 200));
  });
});

describe('isTroop', () => {
  it('detects the PF2e troop trait', () => {
    expect(isTroop({ traits: ['undead', 'troop', 'zombie'] })).toBe(true);
    expect(isTroop({ traits: ['giant'] })).toBe(false);
    expect(isTroop({ traits: [] })).toBe(false);
  });
});

describe('side-aware budgeting', () => {
  // The Svelte layer sums each side; this pins the arithmetic the skirmish budget rests on:
  // four 7th-level PCs, one 7th-level ally troop → +40 to the budget the enemies are rated against.
  it('sums enemy and ally XP independently via computeCost', () => {
    const partyLevel = 7;
    const entries = [
      { level: 8, variant: 0, side: 'enemy' },
      { level: 6, variant: 0, side: 'enemy' },
      { level: 7, variant: 0, side: 'ally' },
    ] as EncounterEntry[];
    const sideXp = (side: string) =>
      entries.filter((e) => e.side === side).reduce((s, e) => s + computeCost(e, partyLevel), 0);
    expect(sideXp('enemy')).toBe(60 + 30); // lvl8 +1 → 60, lvl6 −1 → 30
    expect(sideXp('ally')).toBe(40); // party-level troop
  });
});
