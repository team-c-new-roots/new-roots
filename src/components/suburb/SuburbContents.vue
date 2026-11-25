<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/* quick links to each section of the suburb page, it's a long page now.
   each moves focus to the section's heading as well as scrolling, so a
   keyboard or screen reader user lands in the same place as everyone else.
   the address bar isn't changed, so Back still goes to the results */

const props = defineProps<{ sections: { id: string; label: string }[] }>()
const { t } = useI18n()

function jump(id: string) {
  const heading = document.getElementById(id)
  if (!heading) return
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  heading.setAttribute('tabindex', '-1')
  heading.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
  heading.focus({ preventScroll: true })
}
</script>

<template>
  <nav class="contents no-print" :aria-label="t('suburb.contents')">
    <p class="contents__title" aria-hidden="true">{{ t('suburb.contents') }}</p>
    <ul>
      <li v-for="section in props.sections" :key="section.id">
        <a :href="`#${section.id}`" @click.prevent="jump(section.id)">{{ section.label }}</a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.contents {
  margin: 1rem 0 0.5rem;
}

.contents__title {
  margin: 0 0 0.35rem;
  color: var(--nr-ink-muted);
  font-weight: 700;
}

.contents ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* plain links, not pills, so they don't look like the on/off choices
   elsewhere. rust is themed so it's #ffb678 in dark and blue in contrast */
.contents li + li {
  margin-top: 0.15rem;
}

.contents a {
  display: inline-block;
  padding: 0.2rem 0;
  color: var(--nr-rust);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.contents a:hover {
  text-decoration-thickness: 2px;
}
</style>
