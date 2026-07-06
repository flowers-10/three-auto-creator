<template>
  <ThreeEditor />
</template>

<script setup lang="ts">
import ThreeEditor from "./components/layout/ThreeEditor.vue";
</script>

<style>
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  user-select: none; /* 防止文字被选中 */
}

input, textarea {
  user-select: text; /* 允许输入框内的文字被选中 */
}

/* Custom Scrollbar */
.custom-scrollbar {
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

/* Hide scrollbar by default */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}

/* Show scrollbar on hover */
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
</style>