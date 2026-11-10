<script setup lang="ts">
import { ref, useId } from 'vue'

/* a native <dialog> opened with showModal(), so the page behind goes inert,
   focus is trapped and Escape closes it, all without extra script. focus starts
   on the safe choice and goes back to whatever opened it */

defineProps<{
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
}>()

const emit = defineEmits<{ confirm: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
const bodyId = useId()
let returnTo: HTMLElement | null = null

function open() {
  returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}

function confirm() {
  // whatever confirm does next (usually a route change) decides where focus goes
  returnTo = null
  emit('confirm')
  close()
}

function onClose() {
  returnTo?.focus()
  returnTo = null
}

defineExpose({ open, close })
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog"
    role="alertdialog"
    :aria-labelledby="titleId"
    :aria-describedby="bodyId"
    @close="onClose"
  >
    <h2 :id="titleId">{{ title }}</h2>
    <p :id="bodyId">{{ body }}</p>
    <div class="dialog__actions">
      <button type="button" class="btn btn--primary" @click="confirm">{{ confirmLabel }}</button>
      <button type="button" class="btn btn--outline" autofocus @click="close">
        {{ cancelLabel }}
      </button>
    </div>
  </dialog>
</template>
