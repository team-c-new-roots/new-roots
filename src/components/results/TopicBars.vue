<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TopicName } from '@/types'
import type { SuburbResult } from '@/services/results'
import { TOPICS } from '@/data/topics'
import ScoreBar from '@/components/ui/ScoreBar.vue'

/* a score out of 100 for each of the seven topics, with icons, like the
   data team's map panel. topics that don't count for this household say why
   instead of showing a bar, so a low number never looks like it mattered */

const props = defineProps<{
  suburb: SuburbResult
  counted: Set<TopicName>
  hasLanguage: boolean
  compact?: boolean
}>()

const { t } = useI18n()

const rows = computed(() =>
  TOPICS.map((topic) => {
    const raw = props.suburb.row[topic.score]
    let note: string | undefined
    if (topic.id === 'Affordability' && props.suburb.status === 'noData') {
      note = t('suburb.noRentScore')
    } else if (topic.id === 'Language' && !props.hasLanguage) {
      note = t('suburb.noLanguage')
    } else if (!props.counted.has(topic.id)) {
      note = t('suburb.notCounted')
    }
    return {
      id: topic.id,
      icon: topic.icon,
      label: t(`topics.${topic.key}`),
      score: typeof raw === 'number' ? Math.round(raw) : null,
      note,
    }
  }),
)
</script>

<template>
  <dl class="topic-bars">
    <ScoreBar
      v-for="row in rows"
      :key="row.id"
      :label="row.label"
      :icon="row.icon"
      :score="row.score"
      :note="row.note"
      :compact="compact"
    />
  </dl>
</template>

<style scoped>
.topic-bars {
  margin: 0;
}
</style>
