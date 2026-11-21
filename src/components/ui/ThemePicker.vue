<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Contrast, Moon, Sun } from '@lucide/vue'
import { THEMES, useDisplayStore, type Theme } from '@/stores/display'
import type { ChoiceOption } from '@/types'
import RadioGroup from './RadioGroup.vue'

/* the site theme, in the menu on every screen size and on the Accessibility
   page. native radios, so it's one stop for a keyboard and reads as
   "1 of 3" to a screen reader. changes apply straight away */

// three across on the Accessibility page as tiles, icon above the words, so
// High contrast wraps between its words on a phone instead of mid-word.
// stacked chips in the narrow menu
withDefaults(defineProps<{ id?: string; columns?: 3 }>(), { id: 'theme', columns: undefined })

const { t } = useI18n()
const display = useDisplayStore()

const icons = { default: Sun, dark: Moon, contrast: Contrast }
const options = computed<ChoiceOption<Theme>[]>(() =>
  THEMES.map((value) => ({ value, label: t(`theme.${value}`), icon: icons[value] })),
)

const choice = computed<Theme | null>({
  get: () => display.theme,
  set: (value) => {
    if (value) display.setTheme(value)
  },
})
</script>

<template>
  <RadioGroup
    :id="id"
    v-model="choice"
    :options="options"
    :legend="t('theme.legend')"
    :columns="columns"
    :variant="columns ? 'tile' : 'chip'"
  />
</template>
