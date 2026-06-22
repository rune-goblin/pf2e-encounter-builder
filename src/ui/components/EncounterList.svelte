<script lang="ts">
  import type { EncounterEntry, EnrichedEntry, Variant } from '@/encounter/math';

  interface Props {
    encounter: EncounterEntry[];
    enriched: EnrichedEntry[];
    xpCost: number;
    partySize: number;
    stageColor: string;
    totalsTextColor: string;
    saving: boolean;
    loading: boolean;
    dropActive: boolean;
    onSave: () => void;
    onLoad: () => void;
  }

  let {
    encounter = $bindable(),
    enriched,
    xpCost,
    partySize,
    stageColor,
    totalsTextColor,
    saving,
    loading,
    dropActive,
    onSave,
    onLoad,
  }: Props = $props();

  const L = (k: string): string => game.i18n.localize(`pf2e-encounter-builder-rg.${k}`);

  // Display order Weak/Base/Elite, mapped to the variant codes 1/0/2 used by the math.
  const SEGMENTS: { variant: Variant; key: string }[] = [
    { variant: 1, key: 'weak' },
    { variant: 0, key: 'base' },
    { variant: 2, key: 'elite' },
  ];

  function increment(idx: number) {
    encounter[idx].count += 1;
  }

  function decrement(idx: number) {
    if (encounter[idx].count <= 1) {
      encounter = encounter.filter((_, i) => i !== idx);
      return;
    }
    encounter[idx].count -= 1;
  }

  function setVariant(idx: number, v: Variant) {
    encounter[idx].variant = v;
  }
</script>

<div class="encounter-section">
  <div class="encounter-header">
    <h2 class="section-title">{L('encounter.title')}</h2>
    <button
      type="button"
      class="load-btn"
      disabled={loading}
      title={L('encounter.loadHint')}
      onclick={onLoad}
    >
      {#if loading}<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>{:else}<i class="fa-solid fa-download" aria-hidden="true"></i>{/if}
      {L('encounter.load')}
    </button>
  </div>
  <div class="encounter-panel" class:drop-active={dropActive} style:--panel-border={stageColor}>
    <div class="totals" style:background={stageColor} style:color={totalsTextColor}>
      <strong>{game.i18n.format('pf2e-encounter-builder-rg.encounter.totalCost', { xp: xpCost })}</strong>
      {#if partySize > 0 && partySize !== 4}
        <small>
          {game.i18n.format('pf2e-encounter-builder-rg.encounter.xpAward', {
            xp: Math.floor((xpCost * 4) / partySize),
          })}
        </small>
      {/if}
    </div>

    <ul class="encounter-list">
      {#each enriched as item, i (i + '-' + item.uuid)}
        {@const activeIdx = SEGMENTS.findIndex((s) => s.variant === item.variant)}
        <li class="encounter-item">
          <button type="button" class="count-btn plus" onclick={() => increment(i)} aria-label="+">+</button>
          <button type="button" class="count-btn minus" onclick={() => decrement(i)} aria-label="−">−</button>

          <div class="name">{item.count} × {item.name}</div>
          <div class="xp">{game.i18n.format('pf2e-encounter-builder-rg.encounter.xpTotal', { xp: item.cost })}</div>

          <div class="variant-block">
            <div class="segmented" role="group">
              {#each SEGMENTS as seg (seg.key)}
                <button
                  type="button"
                  class="segment"
                  class:active={item.variant === seg.variant}
                  onclick={() => setVariant(i, seg.variant)}
                >{L(`encounter.${seg.key}`)}</button>
              {/each}
            </div>
            <div class="efflevel" style:grid-column={activeIdx + 1}>{game.i18n.format('pf2e-encounter-builder-rg.encounter.levelShort', { level: item.effLevel })}</div>
          </div>

          {#if item.band === 'below'}
            <div class="alert below">
              <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              {L('encounter.belowMin')}
            </div>
          {:else if item.band === 'above'}
            <div class="alert above">
              <i class="fa-solid fa-skull-crossbones" aria-hidden="true"></i>
              {L('encounter.aboveMax')}
            </div>
          {/if}
        </li>
      {/each}
      {#if encounter.length === 0}
        <li class="empty">{L('encounter.empty')}</li>
      {/if}
    </ul>

    <div class="actions">
      <button
        type="button"
        class="btn primary"
        disabled={encounter.length === 0 || saving}
        onclick={onSave}
      >
        {#if saving}<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>{/if}
        {L('encounter.save')}
      </button>
      {#if encounter.length > 0}
        <button type="button" class="btn" onclick={() => (encounter = [])}>{L('encounter.clear')}</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .encounter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-height: var(--peb-header-h);
    margin: 0 0 0.5rem;
  }
  .section-title {
    font-size: var(--peb-text-lg);
    font-weight: 700;
    margin: 0;
    border: none;
  }
  .load-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    width: auto;
    box-sizing: border-box;
    /* Cap the height so this button doesn't make the header taller than --peb-header-h
       (Foundry's button rule sets height/min-height: var(--button-size)). */
    height: var(--peb-header-h);
    min-height: var(--peb-header-h);
    padding: 3px 9px;
    border: 1px solid rgba(128, 128, 128, 0.5);
    border-radius: 4px;
    background: rgba(128, 128, 128, 0.15);
    color: inherit;
    font-weight: 600;
    font-size: var(--peb-text-sm);
    white-space: nowrap;
    cursor: pointer;
  }
  .load-btn:hover:not(:disabled) {
    background: rgba(128, 128, 128, 0.3);
  }
  .load-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .encounter-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.18);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 0.75rem;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  /* Drop affordance: a valid creature drag anywhere on the page thickens + brightens this
     border so the panel reads as the drop target. border-box keeps the panel from shifting. */
  .encounter-panel.drop-active {
    border-width: 3px;
    border-color: var(--peb-brand-text);
    box-shadow: inset 0 0 12px rgba(131, 255, 215, 0.35);
  }
  .totals {
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
    transition: background 0.3s ease, color 0.3s ease;
  }
  .totals strong,
  .totals small {
    color: inherit;
  }
  .totals small {
    opacity: 0.85;
    font-size: var(--peb-text-sm);
  }
  .encounter-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 46vh;
    overflow-y: auto;
  }
  .empty {
    opacity: 0.6;
    text-align: center;
    padding: 1rem;
    font-size: var(--peb-text);
  }
  .encounter-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      'plus  name variant'
      'minus xp   variant';
    column-gap: 0.5rem;
    row-gap: 3px;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  }
  /* A band warning drops to its own full-width row beneath the two-row entry. */
  .encounter-item:has(.alert) {
    grid-template-areas:
      'plus  name  variant'
      'minus xp    variant'
      'alert alert alert';
  }
  .count-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(128, 128, 128, 0.2);
    border: 1px solid rgba(128, 128, 128, 0.4);
    border-radius: 3px;
    cursor: pointer;
    line-height: 1;
    color: inherit;
    padding: 0;
    font-size: var(--peb-text-lg);
  }
  .count-btn.plus {
    grid-area: plus;
  }
  .count-btn.minus {
    grid-area: minus;
  }
  .count-btn:hover {
    background: rgba(128, 128, 128, 0.35);
  }
  .name {
    grid-area: name;
    font-size: var(--peb-text);
    font-weight: 700;
    line-height: 1.2;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .xp {
    grid-area: xp;
    font-size: var(--peb-text-sm);
    opacity: 0.7;
  }
  /* Segmented control + level share one grid so the level can sit under the active segment.
     subgrid hands the three button columns down to the level row. */
  .variant-block {
    grid-area: variant;
    justify-self: end;
    align-self: center;
    display: grid;
    grid-template-columns: repeat(3, auto);
    row-gap: 3px;
  }
  .efflevel {
    grid-row: 2;
    text-align: center;
    font-size: var(--peb-text-sm);
    font-weight: 700;
    color: var(--peb-brand-text);
  }
  .alert {
    grid-area: alert;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
    font-size: var(--peb-text-sm);
    font-weight: 600;
  }
  .alert.below {
    color: #e0a106;
  }
  .alert.above {
    color: #ff5a5a;
  }
  .segmented {
    grid-row: 1;
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    border: 1px solid var(--peb-brand-border);
    border-radius: 4px;
    overflow: hidden;
  }
  .segment {
    background: transparent;
    border: 0;
    padding: 4px 9px;
    font-size: var(--peb-text-sm);
    cursor: pointer;
    color: var(--peb-brand-text);
    line-height: 1.3;
    width: auto;
  }
  .segment:not(:last-child) {
    border-right: 1px solid var(--peb-brand-border);
  }
  .segment.active {
    background: var(--peb-brand-surface);
    color: var(--peb-on-brand);
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
  .btn {
    flex: 1;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid rgba(128, 128, 128, 0.5);
    background: rgba(128, 128, 128, 0.15);
    cursor: pointer;
    font-weight: 600;
    color: inherit;
  }
  .btn:hover:not(:disabled) {
    background: rgba(128, 128, 128, 0.3);
  }
  .btn.primary {
    background: var(--peb-brand-surface);
    border-color: var(--peb-brand-border);
    color: var(--peb-on-brand);
  }
  .btn.primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
