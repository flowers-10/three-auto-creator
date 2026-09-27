<template>
  <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="(path, index) in paths[name] ?? paths.square" :key="index" :d="path" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>();

const paths: Record<string, string[]> = {
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['m4 12 5 5L20 6'],
  square: ['M5 5h14v14H5z'],
  cube: ['m12 2 9 5v10l-9 5-9-5V7z', 'm3 7 9 5 9-5', 'M12 12v10'],
  text: ['M4 6V4h16v2', 'M12 4v16', 'M8 20h8'],
  path: ['M4 18c4-10 7-13 10-11 3 2 1 8 6 9', 'M4 18h.01', 'M20 16h.01'],
  input: ['M3 5h18v14H3z', 'M7 9h10', 'M7 13h6'],
  select: ['M5 3v17l4.5-5 3.5 6 2-1-3.5-6H18z'],
  preview: ['M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  template: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  circle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'],
  triangle: ['m12 4 9 16H3z'],
  pentagon: ['m12 2 9 7-3.5 11h-11L3 9z'],
  star: ['m12 2 2.8 6.7 7.2.6-5.5 4.7 1.7 7-6.2-3.7-6.2 3.7 1.7-7L2 9.3l7.2-.6z'],
  blend: ['M9 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M15 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12z'],
  image: ['M3 4h18v16H3z', 'M7.5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'm4 17 5-5 4 4 3-3 4 4'],
  particles: ['M12 3v2', 'M12 19v2', 'M3 12h2', 'M19 12h2', 'm5.6 5.6 1.5 1.5', 'm11.3 11.3 1.5 1.5', 'm0-11.3-1.5 1.5', 'm-11.3 11.3-1.5 1.5', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  plane: ['m3 8 9-5 9 5-9 5z', 'M12 13v7'],
  sphere: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c-5 5-5 13 0 18', 'M12 3c5 5 5 13 0 18'],
  cylinder: ['M4 6c0-4 16-4 16 0s-16 4-16 0z', 'M4 6v12c0 4 16 4 16 0V6'],
  torus: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  cone: ['M12 3 4 18', 'M12 3 20 18', 'M4 18c0 4 16 4 16 0'],
  group: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  camera: ['M3 5h18v14H3z', 'm8 9 6 3-6 3z'],
  light: ['M9 18h6', 'M10 21h4', 'M8 15a6 6 0 1 1 8 0l-1 2H9z'],
};
</script>

<style scoped>
.ui-icon { display: block; width: 22px; height: 22px; flex: none; }
</style>
