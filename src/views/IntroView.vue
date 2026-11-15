<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Lock, X } from '@lucide/vue'
import { useFlash } from '@/composables/useFlash'
import photo640 from '@/assets/brand/intro-640.webp'
import photo960 from '@/assets/brand/intro-960.webp'
import photo1200 from '@/assets/brand/intro-1200.webp'
import photo640Avif from '@/assets/brand/intro-640.avif'
import photo960Avif from '@/assets/brand/intro-960.avif'
import photo1200Avif from '@/assets/brand/intro-1200.avif'

/* sets expectations before any questions (US 6.1): what New Roots does, what
   it doesn't, and that nothing is saved (US 6.2). it's one short screen with
   Start already in view, so there's no skip link. the support link is for
   someone who needs help today rather than a suburb list */

const { t } = useI18n()
const { take } = useFlash()
const cleared = ref(false)

// decoration, so alt is empty. the column is never wider than 36rem
const photoWebp = `${photo640} 640w, ${photo960} 960w, ${photo1200} 1200w`
const photoAvif = `${photo640Avif} 640w, ${photo960Avif} 960w, ${photo1200Avif} 1200w`
const photoSizes = '(min-width: 40rem) 36rem, calc(100vw - 2rem)'

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

    <picture>
      <source type="image/avif" :srcset="photoAvif" :sizes="photoSizes" />
      <img
        class="intro__photo"
        :src="photo960"
        :srcset="photoWebp"
        :sizes="photoSizes"
        alt=""
        width="1200"
        height="600"
        fetchpriority="high"
        decoding="async"
      />
    </picture>

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

/* rounded here rather than in the file, so the corners match the panels */
.intro__photo {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 1;
  object-fit: cover;
  margin-bottom: 1.5rem;
  border-radius: var(--nr-radius-lg);
  background: var(--nr-apricot);
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
