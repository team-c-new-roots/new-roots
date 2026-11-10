<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/* shown after a failed Next. a screen reader gets the whole list at once
   instead of hunting field by field, and each item jumps to its field.

   the links focus the field with script rather than following the #hash. a
   hash change in a history-mode SPA can look like a navigation and move focus
   to <main>, which is the opposite of what someone clicking an error wants */

const props = defineProps<{
  // { id of the field to jump to: message }
  errors: Record<string, string>
}>()

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)
const count = computed(() => Object.keys(props.errors).length)

function jump(target: string) {
  const field = document.getElementById(target)
  field?.focus()
  field?.scrollIntoView({ block: 'center' })
}

defineExpose({ focus: () => root.value?.focus() })
</script>

<template>
  <div
    v-if="count"
    ref="root"
    class="error-summary"
    role="alert"
    tabindex="-1"
    aria-labelledby="error-summary-title"
  >
    <h2 id="error-summary-title" class="error-summary__title">
      {{ t('steps.errorTitle', { n: count }, count) }}
    </h2>
    <ul>
      <li v-for="(message, target) in errors" :key="target">
        <a :href="`#${target}`" @click.prevent="jump(String(target))">{{ message }}</a>
      </li>
    </ul>
  </div>
</template>
