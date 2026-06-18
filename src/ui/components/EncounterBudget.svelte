<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import type { BarStage } from '@/encounter/math';

  interface Props {
    value: number;
    stages: BarStage[];
  }

  let { value, stages }: Props = $props();
</script>

<section class="budget">
  <h2 class="section-title">{game.i18n.localize('pf2e-encounter-builder.budget.title')}</h2>
  <ProgressBar {value} {stages} />
</section>

<style>
  .budget {
    margin: 0 0 1rem;
  }
  .section-title {
    font-size: var(--peb-text-lg);
    font-weight: 700;
    margin: 0 0 0.25rem;
    border: none;
  }
</style>
