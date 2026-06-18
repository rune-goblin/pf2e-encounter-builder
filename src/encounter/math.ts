// Pure encounter math — no Foundry deps, so it unit-tests headlessly. Ported from the
// standalone pf2e-encounters app; the Creature shape is re-sourced from the PF2e
// compendium (Foundry UUIDs instead of AoN ids).

export type Variant = 0 | 1 | 2;
export type Adjustment = 'elite' | 'weak' | null;

export type Creature = {
  uuid: string;
  name: string;
  level: number;
  size: string;
  rarity: string;
  traits: string[];
  source: string;
  img: string;
  remaster: boolean;
};

export type EncounterEntry = Creature & {
  variant: Variant;
  count: number;
  cost: number;
};

export type FilterOptions = {
  minLevel: number;
  maxLevel: number;
  sizes: string[];
  traits: string[];
  creatureTypes: string[];
  rarities: string[];
};

export type ColumnKey = 'name' | 'level' | 'size' | 'traits' | 'rarity' | 'source';

export type BarStage = {
  at: number;
  color: string;
  label?: string;
  tickline?: boolean;
};

// PF2e size codes (system.traits.size.value), in natural order.
export const SIZES = ['tiny', 'sm', 'med', 'lg', 'huge', 'grg'] as const;

const SIZE_ABBR: Record<string, string> = {
  tiny: 'Tiny',
  sm: 'Sm',
  med: 'Med',
  lg: 'Lg',
  huge: 'Huge',
  grg: 'Gtn',
};

export function sizeLabel(s: string): string {
  return SIZE_ABBR[s] ?? s;
}

// PF2e creature-type traits (CONFIG.PF2E.creatureTypes). A creature carries its type as a
// trait, so these are split out of the trait list into their own filter.
export const CREATURE_TYPES = [
  'aberration', 'animal', 'astral', 'beast', 'celestial', 'construct', 'dragon', 'dream',
  'elemental', 'ethereal', 'fey', 'fiend', 'fungus', 'giant', 'humanoid', 'monitor', 'ooze',
  'petitioner', 'plant', 'shadow', 'spirit', 'time', 'undead', 'vitality', 'void',
] as const;

// PF2e rarity order, common → unique.
export const RARITIES = ['common', 'uncommon', 'rare', 'unique'] as const;

export function rarityRank(r: string): number {
  const i = (RARITIES as readonly string[]).indexOf(r);
  return i === -1 ? RARITIES.length : i;
}

export function adjustmentForVariant(variant: Variant): Adjustment {
  if (variant === 1) return 'weak';
  if (variant === 2) return 'elite';
  return null;
}

export function variantForAdjustment(adjustment: Adjustment): Variant {
  if (adjustment === 'weak') return 1;
  if (adjustment === 'elite') return 2;
  return 0;
}

// Stable key for "same creature, same adjustment" — used to dedupe imported actors
// and to aggregate identical encounter rows. base/weak/elite never collide.
export function dedupeKey(uuid: string, variant: Variant): string {
  return `${uuid}|${adjustmentForVariant(variant) ?? 'base'}`;
}

// The GMG creature-XP table (Table 10-2) only spans party level −4 … +4. Outside it the budget
// math doesn't apply: see threatBand. https://2e.aonprd.com/Rules.aspx?ID=2716
export const MIN_XP_DELTA = -4;
export const MAX_XP_DELTA = 4;

export type ThreatBand = 'below' | 'normal' | 'above';

export function computeDelta(delta: number): number {
  switch (delta) {
    case -4: return 10;
    case -3: return 15;
    case -2: return 20;
    case -1: return 30;
    case 0: return 40;
    case 1: return 60;
    case 2: return 80;
    case 3: return 120;
    case 4: return 160;
  }
  // A creature 5+ levels below the party is no real threat and earns no XP; one 5+ above is off
  // the table, so cap it at the +4 value rather than extrapolate.
  if (delta < MIN_XP_DELTA) return 0;
  return 160;
}

// Weak/elite shift the creature's effective level by one (two near the bottom of the range),
// which is what every budget/threat calculation actually compares against the party level.
export function effectiveLevel(entry: Pick<EncounterEntry, 'level' | 'variant'>): number {
  if (entry.variant === 1) return entry.level - (entry.level === 1 ? 2 : 1);
  if (entry.variant === 2) return entry.level + (entry.level === -1 || entry.level === 0 ? 2 : 1);
  return entry.level;
}

export function computeCost(entry: EncounterEntry, partyLevel: number): number {
  return computeDelta(effectiveLevel(entry) - partyLevel);
}

// Where the creature sits relative to the XP table. 'below' earns no XP and is flagged as
// inconsequential; 'above' is off-the-charts dangerous and flagged as a hazard.
export function threatBand(delta: number): ThreatBand {
  if (delta < MIN_XP_DELTA) return 'below';
  if (delta > MAX_XP_DELTA) return 'above';
  return 'normal';
}

// An encounter row with its per-creature cost recomputed for the current party, its weak/elite
// effective level, and its threat band resolved — what the list renders.
export type EnrichedEntry = EncounterEntry & { effLevel: number; band: ThreatBand };

export function filterOptions(all: string[], selected: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  const sel = new Set(selected);
  if (!q) return [...selected, ...all.filter((v) => !sel.has(v))];
  return [
    ...selected.filter((v) => v.toLowerCase().includes(q)),
    ...all.filter((v) => !sel.has(v) && v.toLowerCase().includes(q)),
  ];
}

export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function makeXpBudget(partySize: number): number[] {
  const extra = partySize - 4;
  return [40 + 10 * extra, 60 + 15 * extra, 80 + 20 * extra, 120 + 30 * extra, 160 + 40 * extra];
}

export function makeBarStages(xpBudget: number[]): BarStage[] {
  return [
    { at: 0,    color: '#81d4fa' },
    { at: 25,   color: '#66bb6a', label: `Trivial ${xpBudget[0]}` },
    { at: 37.5, color: '#2e7d32', label: `Low ${xpBudget[1]}` },
    { at: 50,   color: '#b05600', label: `Moderate ${xpBudget[2]}` },
    { at: 75,   color: '#e53935', label: `Severe ${xpBudget[3]}` },
    { at: 100,  color: '#8b0000', label: `Extreme ${xpBudget[4]}` },
  ];
}

export function activeStageIndex(stages: BarStage[], value: number): number {
  let idx = 0;
  for (let i = 0; i < stages.length; i++) if (stages[i].at <= value) idx = i;
  return idx;
}

// WCAG luminance + black-text contrast. Picks text color by *stage index* — find the
// first stage where black drops below AA (4.5:1) and use white from that index onward.
// Per-color picking flips back and forth when a light orange follows dark green;
// index-based picking guarantees monotonic switching.
export function blackTextSwitchIndex(stages: BarStage[]): number {
  for (let i = 0; i < stages.length; i++) {
    const contrast = (relativeLuminance(stages[i].color) + 0.05) / 0.05;
    if (contrast < 4.5) return i;
  }
  return stages.length;
}
