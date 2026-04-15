<template>
  <span v-if="isBuiltin" class="app-icon" aria-hidden="true" v-html="builtinSvg"></span>
  <svg v-else-if="isCategoryIcon" class="app-icon svgfont" aria-hidden="true" viewBox="0 0 1024 1024">
    <use :href="symbolId"></use>
  </svg>
  <span v-else class="app-icon" aria-hidden="true" v-html="icons.dot"></span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { categoryIconNameSet, iconfontPrefix } from "@/utils/categoryIcons";

const props = withDefaults(
  defineProps<{
    name: string;
  }>(),
  {
    name: "dot",
  },
);

const icons: Record<string, string> = {
  ledger:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>',
  chart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19V5"/><path d="M5 19h14"/><path d="m8 14 3-3 3 2 4-5"/></svg>',
  add:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  assets:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 12 4l8 5"/><path d="M6 10v8h12v-8"/><path d="M10 18v-5h4v5"/></svg>',
  profile:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M6 19c1.8-3 4-4.5 6-4.5s4.2 1.5 6 4.5"/></svg>',
  cash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="10" rx="2"/><circle cx="12" cy="12" r="2.2"/></svg>',
  alipay:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9h8"/><path d="M6 13c2.2 1.8 4 2.7 5.8 2.7 2.1 0 3.9-1 6.2-3.7"/><path d="M8 6h8"/><path d="M9 17h6"/></svg>',
  cmb:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 5 8v8l7 4 7-4V8l-7-4Z"/><path d="M9 10h6"/><path d="M9 14h6"/></svg>',
  credit_card:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 10h16"/><path d="M8 15h3"/></svg>',
  manual:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19h12"/><path d="M8 19V8l4-3 4 3v11"/></svg>',
  dot:
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2.5"/></svg>',
};

const isBuiltin = computed(() => Boolean(icons[props.name]));
const isCategoryIcon = computed(() => categoryIconNameSet.has(props.name));
const builtinSvg = computed(() => icons[props.name] ?? icons.dot);
const symbolId = computed(() => `#${iconfontPrefix}${props.name}`);
</script>
