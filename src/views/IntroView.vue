<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Lock, X } from '@lucide/vue'
import { useFlash } from '@/composables/useFlash'

/* sets expectations before any questions (US 6.1): what New Roots does, what
   it doesn't, and that nothing is saved (US 6.2). it's one short screen with
   Start already in view, so there's no skip link. the support link is for
   someone who needs help today rather than a suburb list */

const { t } = useI18n()
const { take } = useFlash()
const cleared = ref(false)

onMounted(() => {
  cleared.value = take() === 'cleared'
})
</script>

<template>
  <div class="page page--narrow intro">
    <p v-if="cleared" class="panel intro__cleared" role="status">
      <Check :size="20" :stroke-width="3" aria-hidden="true" />
      {{ t('app.cleared') }}
    </p>

    <div class="intro__art" aria-hidden="true">
      <span class="intro__dot intro__dot--a"></span>
      <span class="intro__dot intro__dot--b"></span>
      <span class="intro__dot intro__dot--c"></span>
      <span class="intro__dot intro__dot--d"></span>
      <span class="intro__house">
        <span class="intro__leaf intro__leaf--left"></span>
        <span class="intro__leaf intro__leaf--right"></span>
        <span class="intro__roof"></span>
        <span class="intro__walls"></span>
      </span>
    </div>

    <h1>{{ t('intro.heading') }}</h1>
    <p class="lead">{{ t('intro.lead') }}</p>

    <h2 class="intro__subhead">{{ t('intro.doesHeading') }}</h2>
    <ul class="icon-list">
      <li v-for="key in ['does1', 'does2', 'does3']" :key="key">
        <Check :size="22" aria-hidden="true" />
        {{ t(`intro.${key}`) }}
      </li>
    </ul>

    <div class="panel intro__doesnt">
      <h2 class="intro__subhead">{{ t('intro.doesntHeading') }}</h2>
      <ul class="icon-list">
        <li v-for="key in ['doesnt1', 'doesnt2', 'doesnt3']" :key="key">
          <X :size="22" aria-hidden="true" />
          {{ t(`intro.${key}`) }}
        </li>
      </ul>
    </div>

    <div class="intro__privacy">
      <Lock :size="22" aria-hidden="true" />
      <p>
        {{ t('intro.privacy') }}
        <RouterLink :to="{ name: 'privacy' }">{{ t('intro.privacyLink') }}</RouterLink>
      </p>
    </div>

    <RouterLink :to="{ name: 'household' }" class="btn btn--primary btn--block">
      {{ t('intro.start') }}
    </RouterLink>
    <p class="intro__secondary">
      <RouterLink :to="{ name: 'support' }" class="link-action">{{
        t('intro.helpNow')
      }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.intro__cleared {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  font-weight: 700;
}

/* a drawn house rather than an image file: no download, and it's decoration only */
.intro__art {
  position: relative;
  height: 9.5rem;
  margin-bottom: 1.5rem;
  border-radius: var(--nr-radius-lg);
  background: var(--nr-apricot);
  overflow: hidden;
}

.intro__dot {
  position: absolute;
  border-radius: 50%;
  background: var(--nr-orange);
}

.intro__dot--a {
  width: 1.4rem;
  height: 1.4rem;
  inset-inline-start: 12%;
  top: 22%;
}

.intro__dot--b {
  width: 0.9rem;
  height: 0.9rem;
  inset-inline-start: 22%;
  bottom: 18%;
}

.intro__dot--c {
  width: 0.9rem;
  height: 0.9rem;
  inset-inline-end: 20%;
  top: 18%;
}

.intro__dot--d {
  width: 1.8rem;
  height: 1.8rem;
  inset-inline-end: 12%;
  bottom: 22%;
}

.intro__house {
  position: absolute;
  left: 50%;
  bottom: 1rem;
  width: 8rem;
  height: 7.5rem;
  transform: translateX(-50%);
}

.intro__roof {
  position: absolute;
  left: 0;
  right: 0;
  top: 1.25rem;
  height: 2.6rem;
  background: var(--nr-rust);
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}

.intro__walls {
  position: absolute;
  left: 1rem;
  right: 1rem;
  top: 3.85rem;
  bottom: 0;
  background: var(--nr-orange);
}

.intro__leaf {
  position: absolute;
  top: 0.4rem;
  width: 1.9rem;
  height: 1.1rem;
  border-radius: 50%;
  background: var(--nr-orange);
}

.intro__leaf--left {
  left: calc(50% - 1.9rem);
}

.intro__leaf--right {
  left: 50%;
}

.intro__subhead {
  margin-top: 1.25rem;
  font-size: 1.1875rem;
}

.intro__doesnt {
  margin-block: 1rem 1.5rem;
}

.intro__doesnt .intro__subhead {
  margin-top: 0;
}

.intro__doesnt svg {
  color: var(--nr-wine);
}

.intro__privacy {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.intro__privacy svg {
  flex: 0 0 auto;
  color: var(--nr-rust);
}

.intro__privacy p {
  margin: 0;
}

.intro__privacy a {
  display: inline-block;
  margin-top: 0.35rem;
}

.intro__secondary {
  margin-top: 0.75rem;
  text-align: center;
}
</style>
