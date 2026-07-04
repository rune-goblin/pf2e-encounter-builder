<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import type { BarStage } from '@/encounter/math';

  interface Props {
    value: number;
    stages: BarStage[];
    allyXp?: number;
  }

  let { value, stages, allyXp = 0 }: Props = $props();
</script>

<section class="budget">
  <div class="budget-header">
    <h2 class="section-title">{game.i18n.localize('pf2e-encounter-builder-rg.budget.title')}</h2>
    {#if allyXp > 0}
      <span class="reinforced">{game.i18n.format('pf2e-encounter-builder-rg.budget.reinforced', { xp: allyXp })}</span>
    {/if}
  </div>
  <ProgressBar {value} {stages} />
</section>

<style>
  .budget {
    margin: 0 0 1rem;
  }
  .budget-header {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin: 0 0 0.25rem;
  }
  .section-title {
    font-size: var(--peb-text-lg);
    font-weight: 700;
    margin: 0;
    border: none;
  }
  .reinforced {
    font-size: var(--peb-text-sm);
    font-weight: 600;
    color: var(--peb-brand-text);
  }
</style>
