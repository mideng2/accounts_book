<template>
  <section class="section-card">
    <div v-if="title || caption" class="section-card__header">
      <div>
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="caption">{{ caption }}</p>
      </div>
      <slot name="action" />
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  caption?: string;
}>();
</script>

