<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ThemePicker from '@/components/ui/ThemePicker.vue'

/* the accessibility statement the panel asked for. it says which standard we
   build to, how we check it, and where we fall short, the same way a
   government site would. the theme picker lives here too, so anyone
   reading about it can change it straight away. it's also in the menu */

const { t } = useI18n()
</script>

<template>
  <div class="page page--narrow a11y">
    <h1>{{ t('accessibility.title') }}</h1>
    <p class="lead">{{ t('accessibility.lead') }}</p>

    <section aria-labelledby="a11y-contrast">
      <h2 id="a11y-contrast">{{ t('accessibility.contrastHeading') }}</h2>
      <p>{{ t('accessibility.contrast') }}</p>
      <ThemePicker id="page-theme" :columns="3" />
      <p>{{ t('accessibility.mapContrast') }}</p>
    </section>

    <section aria-labelledby="a11y-done">
      <h2 id="a11y-done">{{ t('accessibility.doneHeading') }}</h2>
      <ul class="a11y__list">
        <li v-for="key in ['done1', 'done2', 'done3', 'done4', 'done5', 'done6']" :key="key">
          {{ t(`accessibility.${key}`) }}
        </li>
      </ul>
    </section>

    <section aria-labelledby="a11y-tested">
      <h2 id="a11y-tested">{{ t('accessibility.testedHeading') }}</h2>
      <p>{{ t('accessibility.tested') }}</p>
    </section>

    <section aria-labelledby="a11y-limits">
      <h2 id="a11y-limits">{{ t('accessibility.limitsHeading') }}</h2>
      <ul class="a11y__list">
        <li v-for="key in ['limit1', 'limit2', 'limit3']" :key="key">
          {{ t(`accessibility.${key}`) }}
        </li>
      </ul>
    </section>

    <section aria-labelledby="a11y-help">
      <h2 id="a11y-help">{{ t('accessibility.helpHeading') }}</h2>
      <p>{{ t('accessibility.help') }}</p>
      <RouterLink :to="{ name: 'support' }">{{ t('accessibility.helpLink') }}</RouterLink>
    </section>
  </div>
</template>

<style scoped>
.a11y section {
  margin-top: 2rem;
}

.a11y__list {
  padding-inline-start: 1.25rem;
}

.a11y__list li {
  margin-bottom: 0.5rem;
}
</style>
