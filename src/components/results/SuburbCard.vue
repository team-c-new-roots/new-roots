<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from '@lucide/vue'
import { useFormat } from '@/composables/useFormat'
import type { CommunityLanguage, RankedSuburb } from '@/types'
import BudgetBadge from '@/components/ui/BudgetBadge.vue'

/* one suburb in the results list. shows the data behind its rank right on
   the card (US-3, US-13): rent for the home size, how many neighbours speak
   the family's language, and how far school and English class are */

const props = defineProps<{
  item: RankedSuburb
  language: CommunityLanguage | null
  inSummary: boolean
}>()

const { t } = useI18n()
const { money, km, percent, home } = useFormat()

const share = computed(() =>
  props.language ? (props.item.suburb.languages?.[props.language] ?? null) : null,
)
const headingId = computed(() => `suburb-${props.item.suburb.id}`)
</script>

<template>
  <article class="suburb-card" :aria-labelledby="headingId">
    <div class="suburb-card__top">
      <span class="suburb-card__rank" aria-hidden="true">{{ item.rank }}</span>
      <h2 :id="headingId" class="suburb-card__name">{{ item.suburb.name }}</h2>
      <BudgetBadge :status="item.status" class="suburb-card__badge" />
    </div>

    <ul class="suburb-card__facts">
      <li v-if="item.home && item.median !== null">
        {{ t('results.median', { home: home(item.home), amount: money(item.median) }) }}
      </li>
      <li v-if="language && share !== null">
        {{
          t('results.speakers', { language: t(`languages.${language}`), percent: percent(share) })
        }}
      </li>
      <li v-if="item.suburb.schoolPrimaryKm !== null || item.suburb.englishClassKm !== null">
        <span v-if="item.suburb.schoolPrimaryKm !== null">
          {{ t('results.school', { distance: km(item.suburb.schoolPrimaryKm) }) }}
        </span>
        <span
          v-if="item.suburb.schoolPrimaryKm !== null && item.suburb.englishClassKm !== null"
          class="suburb-card__dot"
          aria-hidden="true"
          >·</span
        >
        <span v-if="item.suburb.englishClassKm !== null">
          {{ t('results.englishClass', { distance: km(item.suburb.englishClassKm) }) }}
        </span>
      </li>
    </ul>

    <div class="suburb-card__bottom">
      <RouterLink :to="{ name: 'suburb', params: { id: item.suburb.id } }">
        {{ t('results.details') }}
        <span class="visually-hidden">{{
          t('results.detailsFor', { suburb: item.suburb.name })
        }}</span>
      </RouterLink>
      <span v-if="inSummary" class="suburb-card__saved">
        <Check :size="16" :stroke-width="3" aria-hidden="true" />
        {{ t('results.inSummary') }}
      </span>
    </div>
  </article>
</template>

<style scoped>
.suburb-card {
  padding: 1.1rem 1.25rem;
  border-radius: var(--nr-radius);
  background: var(--nr-panel);
}

.suburb-card__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}

.suburb-card__rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--nr-wine);
  color: var(--nr-cream);
  font-weight: 700;
}

.suburb-card__name {
  flex: 1;
  margin: 0;
  font-size: 1.375rem;
}

.suburb-card__facts {
  margin: 0 0 0.5rem;
  padding: 0;
  list-style: none;
}

.suburb-card__facts li {
  padding-block: 0.1rem;
}

.suburb-card__dot {
  margin-inline: 0.4rem;
}

.suburb-card__bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.suburb-card__bottom a {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
}

.suburb-card__saved {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--nr-wine);
  font-weight: 700;
}
</style>
