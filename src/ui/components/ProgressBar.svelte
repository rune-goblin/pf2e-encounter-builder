<script lang="ts">
  import type { BarStage } from '@/encounter/math';

  interface Props {
    value: number;
    stages: BarStage[];
  }

  let { value, stages }: Props = $props();

  let clamped = $derived(Math.min(100, Math.max(0, value)));
  let activeColor = $derived.by(() => {
    let color = stages[0]?.color ?? '#888';
    for (const s of stages) if (s.at <= clamped) color = s.color;
    return color;
  });
</script>

<div class="bar-wrap">
  <div class="stages-layer">
    {#each stages as s (s.at)}
      {#if s.label}
        <div
          class="stage-tag"
          class:at-end={s.at >= 100}
          class:at-start={s.at <= 0}
          style:left="{s.at}%"
        >{s.label}</div>
      {/if}
    {/each}
  </div>
  <div class="track">
    <div class="fill" style:width="{clamped}%" style:background={activeColor}></div>
    <div class="tickline-layer">
      {#each stages as s (s.at)}
        {#if s.label && s.tickline !== false}
          <span class="tick" style:left={s.at >= 100 ? 'calc(100% - 1px)' : `${s.at}%`}></span>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  .bar-wrap {
    position: relative;
    min-width: 0;
    padding-top: 2rem;
  }
  .stages-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2rem;
    pointer-events: none;
  }
  .stage-tag {
    position: absolute;
    bottom: 6px;
    transform: translateX(-50%);
    background: #1b1b1f;
    color: #fff;
    padding: 2px 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    font-size: var(--peb-text-sm);
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
  .stage-tag::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    width: 8px;
    height: 8px;
    transform: translateX(-50%) rotate(45deg);
    background: #1b1b1f;
    border-right: 1px solid rgba(255, 255, 255, 0.15);
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  }
  .stage-tag.at-end {
    transform: translateX(-100%);
  }
  .stage-tag.at-end::after {
    left: auto;
    right: 8px;
    transform: translateX(50%) rotate(45deg);
  }
  .stage-tag.at-start {
    transform: none;
  }
  .stage-tag.at-start::after {
    left: 8px;
  }
  .track {
    position: relative;
    height: 20px;
    border-radius: 6px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .fill {
    height: 100%;
    transition: width 0.3s ease, background 0.3s ease;
  }
  .tickline-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #fff;
    opacity: 0.5;
    transform: translateX(-50%);
  }
</style>
