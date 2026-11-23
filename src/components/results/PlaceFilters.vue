<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown, X } from '@lucide/vue'
import { PLACE_GROUPS, PLACE_MARGIN_KM, type PlaceGroup, type PlaceType } from '@/data/places'
import { useFormat } from '@/composables/useFormat'
import type { Place } from '@/services/places'

/* the panel the Places button opens over the map. one row per group with a
   tick for the whole group, and a chevron that opens its types. every box
   starts empty. native checkboxes, so space ticks and the state is read out,
   and a part-chosen group reads as mixed */

const chosen = defineModel<PlaceType[]>({ required: true })

const props = defineProps<{
  suburb: string
  // null while loading, and when the load failed
  places: Place[] | null
  failed: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { km } = useFormat()
const heading = ref<HTMLHeadingElement | null>(null)
const open = ref<Set<string>>(new Set())

const counts = computed(() => {
  const totals = new Map<PlaceType, number>()
  for (const place of props.places ?? []) totals.set(place.type, (totals.get(place.type) ?? 0) + 1)
  return totals
})
const countFor = (type: PlaceType) => counts.value.get(type) ?? 0
const groupCount = (group: PlaceGroup) => group.types.reduce((sum, type) => sum + countFor(type), 0)
const shownCount = computed(() => chosen.value.reduce((sum, type) => sum + countFor(type), 0))

const picked = (group: PlaceGroup) => group.types.filter((type) => chosen.value.includes(type))
const allPicked = (group: PlaceGroup) => picked(group).length === group.types.length
const somePicked = (group: PlaceGroup) => picked(group).length > 0 && !allPicked(group)

function toggleGroup(group: PlaceGroup) {
  const others = chosen.value.filter((type) => !(group.types as readonly string[]).includes(type))
  chosen.value = allPicked(group) ? others : [...others, ...group.types]
}

function toggleOpen(id: string) {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}

onMounted(async () => {
  await nextTick()
  heading.value?.focus()
})
</script>

<template>
  <section
    id="place-filters"
    class="place-filters"
    aria-labelledby="place-filters-title"
    @keydown.esc.stop="emit('close')"
  >
    <header class="place-filters__head">
      <h2 id="place-filters-title" ref="heading" class="place-filters__title" tabindex="-1">
        {{ t('places.title', { suburb }) }}
      </h2>
      <button
        type="button"
        class="place-filters__close"
        :aria-label="t('places.close')"
        @click="emit('close')"
      >
        <X :size="22" aria-hidden="true" />
      </button>
      <p class="place-filters__hint">
        {{ t('places.hint', { suburb, km: km(PLACE_MARGIN_KM) }) }}
      </p>
    </header>

    <div class="place-filters__body">
      <p v-if="failed" class="place-filters__status" role="alert">{{ t('places.error') }}</p>
      <p v-else-if="!places" class="place-filters__status">{{ t('places.loading') }}</p>

      <ul v-else class="place-filters__groups">
        <li v-for="group in PLACE_GROUPS" :key="group.id" class="place-group">
          <!-- the box ticks the whole group, the rest of the row opens its
               types, so the easy target is the one used most -->
          <div class="place-group__row">
            <label class="place-check place-check--group">
              <input
                type="checkbox"
                class="place-check__input"
                :checked="allPicked(group)"
                :indeterminate="somePicked(group)"
                :aria-label="t('places.allOf', { group: t(`places.groups.${group.id}`) })"
                :aria-describedby="group.id === 'worship' ? 'place-worship-note' : undefined"
                @change="toggleGroup(group)"
              />
              <span class="place-check__box" aria-hidden="true">
                <Check v-if="allPicked(group)" :size="18" :stroke-width="3" />
                <span v-else-if="somePicked(group)" class="place-check__dash"></span>
              </span>
            </label>
            <button
              type="button"
              class="place-group__toggle"
              :aria-expanded="open.has(group.id) ? 'true' : 'false'"
              :aria-controls="`place-types-${group.id}`"
              @click="toggleOpen(group.id)"
            >
              <span class="place-pin" :class="`place-pin--${group.id}`" aria-hidden="true">
                <component :is="group.icon" :size="16" />
              </span>
              <span class="place-group__name">
                {{ t(`places.groups.${group.id}`) }}
                <span class="place-check__count">({{ groupCount(group) }})</span>
              </span>
              <ChevronDown class="place-group__chevron" :size="22" aria-hidden="true" />
            </button>
          </div>
          <p v-if="group.id === 'worship'" id="place-worship-note" class="place-group__note">
            {{ t('places.worshipNote') }}
          </p>
          <fieldset
            v-show="open.has(group.id)"
            :id="`place-types-${group.id}`"
            class="place-group__types"
          >
            <legend class="visually-hidden">{{ t(`places.groups.${group.id}`) }}</legend>
            <label v-for="type in group.types" :key="type" class="place-check">
              <input v-model="chosen" type="checkbox" class="place-check__input" :value="type" />
              <span class="place-check__box" aria-hidden="true">
                <Check v-if="chosen.includes(type)" :size="18" :stroke-width="3" />
              </span>
              <span class="place-check__text">
                {{ t(`places.types.${type}`) }}
                <span class="place-check__count">({{ countFor(type) }})</span>
              </span>
            </label>
          </fieldset>
        </li>
      </ul>
    </div>

    <footer class="place-filters__foot">
      <button type="button" class="btn btn--primary place-filters__show" @click="emit('close')">
        {{ t('places.show', shownCount) }}
      </button>
      <button
        type="button"
        class="place-filters__clear"
        :disabled="!chosen.length"
        @click="chosen = []"
      >
        {{ t('places.clear') }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
/* over most of the map, the way a map app's filter sheet sits. its own
   scroll, with the title and buttons fixed top and bottom */
.place-filters {
  position: absolute;
  inset: 0.5rem;
  z-index: 3;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--nr-wine-line);
  border-radius: var(--nr-radius);
  background: var(--nr-surface-raised);
  /* the map keeps its daylight colours in dark mode (main.css), text too */
  color: var(--nr-ink);
  box-shadow: 0 6px 24px rgb(48 38 34 / 0.28);
  overflow: hidden;
}

.place-filters__head {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 0.25rem 0.75rem;
  padding: 0.9rem 1rem 0.75rem;
  border-bottom: 1px solid var(--nr-line);
}

.place-filters__title {
  margin: 0;
  font-size: 1.25rem;
}

.place-filters__title:focus {
  outline: none;
}

.place-filters__hint {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--nr-ink-muted);
  font-size: 0.9375rem;
}

.place-filters__close {
  display: inline-grid;
  place-items: center;
  width: var(--nr-target);
  height: var(--nr-target);
  margin-block-start: -0.4rem;
  margin-inline-end: -0.4rem;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--nr-wine-text);
  cursor: pointer;
}

.place-filters__close:hover {
  background: var(--nr-apricot);
}

.place-filters__body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.25rem 1rem;
}

.place-filters__status {
  margin: 1rem 0;
  font-weight: 700;
}

.place-filters__groups {
  margin: 0;
  padding: 0;
  list-style: none;
}

.place-group {
  padding-block: 0.35rem;
  border-bottom: 1px solid var(--nr-line);
}

.place-group:last-child {
  border-bottom: 0;
}

.place-group__row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.place-group__toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  min-height: var(--nr-target);
  padding: 0.25rem 0.5rem;
  border: 0;
  border-radius: var(--nr-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.place-group__toggle:hover {
  background: var(--nr-apricot);
}

.place-group__name {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.place-group__chevron {
  flex: none;
  color: var(--nr-wine-text);
  transition: transform 0.15s ease;
}

.place-group__toggle[aria-expanded='true'] .place-group__chevron {
  transform: rotate(180deg);
}

.place-group__note {
  margin: 0 0 0.35rem;
  padding-inline-start: 3.25rem;
  color: var(--nr-ink-muted);
  font-size: 0.875rem;
}

.place-group__types {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  margin: 0 0 0.35rem;
  padding: 0;
  padding-inline-start: 3.25rem;
  border: 0;
}

/* a native checkbox under our own box, so it keeps its keyboard and screen
   reader behaviour */
.place-check {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  min-height: var(--nr-target);
  cursor: pointer;
}

.place-check__input {
  position: absolute;
  inset-inline-start: 0;
  width: 1.5rem;
  height: 1.5rem;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.place-check__box {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--nr-border-strong);
  border-radius: 0.35rem;
  background: var(--nr-surface-raised);
  color: var(--nr-cream);
}

.place-check__input:checked + .place-check__box,
.place-check__input:indeterminate + .place-check__box {
  border-color: var(--nr-wine);
  background: var(--nr-wine);
}

.place-check__input:focus-visible + .place-check__box {
  outline: 3px solid var(--nr-focus);
  outline-offset: 2px;
}

.place-check__dash {
  width: 0.75rem;
  height: 3px;
  border-radius: 2px;
  background: currentColor;
}

.place-check__text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.place-check--group {
  flex: none;
  justify-content: center;
  width: var(--nr-target);
}

.place-check--group .place-check__input {
  inset: 0;
  width: 100%;
  height: 100%;
}

.place-check__count {
  color: var(--nr-ink-muted);
  font-weight: 400;
}

.place-filters__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--nr-line);
  background: var(--nr-surface-raised);
}

.place-filters__show {
  flex: 1 1 12rem;
}

.place-filters__clear {
  min-height: var(--nr-target);
  padding: 0 0.5rem;
  border: 0;
  background: transparent;
  color: var(--nr-wine-text);
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.place-filters__clear:disabled {
  color: var(--nr-ink-muted);
  text-decoration: none;
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  .place-group__chevron {
    transition: none;
  }
}
</style>
