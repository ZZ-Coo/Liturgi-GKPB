<script setup lang="ts">
// The GKPB emblem on a round white badge. The badge is always white (not a
// theme token): the emblem is drawn with black outlines on white, so it stays
// legible in dark mode too instead of vanishing into a dark card.
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })

const SIZES = { sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-16 w-16' } as const
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-white shadow-soft"
    :class="SIZES[size]"
  >
    <img src="/logo.png" alt="Lambang GKPB" class="h-[78%] w-[78%] select-none object-contain" draggable="false" />
  </span>
</template>
