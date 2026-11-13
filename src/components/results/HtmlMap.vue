<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// always use src, html (srcdoc) gets blocked by our CSP
const props = defineProps<{
  //map page url
  src?: string
  //raw html, fallback only
  html?: string
}>()

const { t } = useI18n()
const state = ref<'loading' | 'ready' | 'error'>('loading')

// reset to loading when we get a new map
watch(
  () => [props.src, props.html],
  ([src, html]) => {
    state.value = src || html ? 'loading' : 'error'
  },
  { immediate: true },
)
</script>

<template>
  <div class="html-map">
    <div class="html-map__frame">
      <iframe
        v-if="src || html"
        :key="src ?? html"
        class="html-map__canvas"
        :src="src"
        :srcdoc="src ? undefined : html"
        :title="t('map.label')"
        sandbox="allow-scripts allow-popups"
        referrerpolicy="no-referrer"
        loading="lazy"
        @load="state = 'ready'"
        @error="state = 'error'"
      ></iframe>
      <p v-if="state === 'loading'" class="html-map__status">{{ t('map.loading') }}</p>
      <p v-if="state === 'error'" class="html-map__status" role="alert">{{ t('map.error') }}</p>
    </div>
  </div>
</template>

<style scoped>
.html-map__frame {
  position: relative;
  margin-bottom: 1rem;
}

/*same size as the old leaflet map */
.html-map__canvas {
  display: block;
  width: 100%;
  height: clamp(20rem, 60vh, 34rem);
  border: 2px solid var(--nr-line);
  border-radius: var(--nr-radius);
  background: var(--nr-map-bg);
}

.html-map__status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 1rem;
  background: var(--nr-map-bg);
  border-radius: var(--nr-radius);
  text-align: center;
  font-weight: 700;
}
</style>
