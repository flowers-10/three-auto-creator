<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @mousedown.self="emit('cancel')">
      <section class="input-dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" @keydown.esc.stop.prevent="emit('cancel')">
        <div class="dialog-heading">
          <h2 :id="titleId">{{ title }}</h2>
          <button type="button" class="close-button" aria-label="关闭" @click="emit('cancel')">×</button>
        </div>
        <form @submit.prevent="submit">
          <label :for="inputId">{{ label }}</label>
          <input :id="inputId" ref="inputRef" v-model="value" type="text" autocomplete="off" :placeholder="placeholder" @keydown.esc.stop.prevent="emit('cancel')" />
          <div class="dialog-actions">
            <button type="button" class="cancel-button" @click="emit('cancel')">取消</button>
            <button type="submit" class="confirm-button" :disabled="!value.trim()">确定</button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = withDefaults(defineProps<{ open: boolean; title: string; label: string; initialValue?: string; placeholder?: string }>(), {
  initialValue: '',
  placeholder: '',
});
const emit = defineEmits<{ (e: 'confirm', value: string): void; (e: 'cancel'): void }>();
const value = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const titleId = 'input-dialog-title';
const inputId = 'input-dialog-field';

watch(() => props.open, async (open) => {
  if (!open) return;
  value.value = props.initialValue;
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select();
});

const submit = () => {
  const trimmed = value.value.trim();
  if (trimmed) emit('confirm', trimmed);
};
</script>

<style scoped>
.dialog-backdrop { position: fixed; inset: 0; z-index: 5000; display: grid; place-items: center; padding: 20px; background: rgba(22, 24, 30, .34); backdrop-filter: blur(3px); }
.input-dialog { width: min(100%, 380px); padding: 24px; box-sizing: border-box; border: 1px solid #ececec; border-radius: 18px; background: #fff; box-shadow: 0 20px 60px #0003; color: #222; text-align: left; }
.dialog-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.dialog-heading h2 { margin: 0; font-size: 18px; font-weight: 650; }
.close-button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: #888; font-size: 23px; line-height: 1; }
.close-button:hover { background: #f3f3f3; color: #333; }
label { display: block; margin-bottom: 8px; color: #555; font-size: 13px; font-weight: 600; }
input { width: 100%; height: 42px; box-sizing: border-box; padding: 0 12px; border: 1px solid #dedede; border-radius: 9px; outline: 0; background: #fafafa; color: #222; font: inherit; font-size: 14px; }
input:focus { border-color: #666; background: #fff; box-shadow: 0 0 0 3px #0000000d; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.dialog-actions button { min-width: 72px; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; }
.cancel-button { border: 1px solid #e6e6e6; background: #fff; color: #444; }
.confirm-button { border: 1px solid #171717; background: #171717; color: #fff; }
.confirm-button:disabled { opacity: .4; cursor: not-allowed; }
</style>
