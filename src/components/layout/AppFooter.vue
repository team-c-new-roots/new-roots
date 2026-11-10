<script setup lang="ts">
import { I18nT, useI18n } from 'vue-i18n'
import aboriginal1x from '@/assets/brand/flag-aboriginal.webp'
import aboriginal2x from '@/assets/brand/flag-aboriginal@2x.webp'
import aboriginal3x from '@/assets/brand/flag-aboriginal@3x.webp'
import torresStrait1x from '@/assets/brand/flag-torres-strait.webp'
import torresStrait2x from '@/assets/brand/flag-torres-strait@2x.webp'
import torresStrait3x from '@/assets/brand/flag-torres-strait@3x.webp'
import banner640 from '@/assets/brand/footer-banner-640.webp'
import banner960 from '@/assets/brand/footer-banner-960.webp'
import banner1280 from '@/assets/brand/footer-banner-1280.webp'
import banner1600 from '@/assets/brand/footer-banner-1600.webp'
import banner640Avif from '@/assets/brand/footer-banner-640.avif'
import banner960Avif from '@/assets/brand/footer-banner-960.avif'
import banner1280Avif from '@/assets/brand/footer-banner-1280.avif'
import banner1600Avif from '@/assets/brand/footer-banner-1600.avif'

/* same shape as the iris footer: what we're for, the acknowledgements, where
   to get help, the fine print, then the welcome banner along the bottom.

   no email, phone or street address. New Roots doesn't run a service, and a
   made-up number on a page people open when they need help could send
   someone to a dead end. the support page is the way to reach real people.

   the banner is flattened onto the footer apricot, so it needs no alpha
   channel and comes out about half the size. lazy, so on long pages it waits
   until someone scrolls near it. if the footer colour ever changes, re-export
   the banner on the new colour */

const { t } = useI18n()
const year = new Date().getFullYear()

const aboriginalSrcset = `${aboriginal1x} 1x, ${aboriginal2x} 2x, ${aboriginal3x} 3x`
const torresStraitSrcset = `${torresStrait1x} 1x, ${torresStrait2x} 2x, ${torresStrait3x} 3x`
const bannerWebp = `${banner640} 640w, ${banner960} 960w, ${banner1280} 1280w, ${banner1600} 1600w`
const bannerAvif = `${banner640Avif} 640w, ${banner960Avif} 960w, ${banner1280Avif} 1280w, ${banner1600Avif} 1600w`
// the banner never grows past the page width
const bannerSizes = '(min-width: 72rem) 72rem, 100vw'
</script>

<template>
  <footer class="app-footer">
    <div class="page app-footer__inner">
      <p class="app-footer__mission">{{ t('footer.mission') }}</p>

      <section class="app-footer__section" aria-labelledby="footer-country">
        <div class="app-footer__section-head">
          <h2 id="footer-country" class="app-footer__heading">
            {{ t('footer.countryHeading') }}
          </h2>
          <div class="app-footer__flags">
            <img
              :src="aboriginal1x"
              :srcset="aboriginalSrcset"
              :alt="t('footer.aboriginalFlag')"
              width="48"
              height="32"
            />
            <img
              :src="torresStrait1x"
              :srcset="torresStraitSrcset"
              :alt="t('footer.torresStraitFlag')"
              width="48"
              height="32"
            />
          </div>
        </div>
        <p>{{ t('footer.country1') }}</p>
        <p>{{ t('footer.country2') }}</p>
      </section>

      <section class="app-footer__section" aria-labelledby="footer-experience">
        <h2 id="footer-experience" class="app-footer__heading">
          {{ t('footer.experienceHeading') }}
        </h2>
        <p>{{ t('footer.experience') }}</p>
      </section>

      <div class="app-footer__links">
        <section aria-labelledby="footer-help">
          <h2 id="footer-help" class="app-footer__heading">{{ t('footer.helpHeading') }}</h2>
          <RouterLink :to="{ name: 'support' }" class="app-footer__link">
            {{ t('footer.help') }}
          </RouterLink>
          <I18nT keypath="footer.emergency" tag="p" scope="global" class="app-footer__emergency">
            <template #number>
              <a href="tel:000">000</a>
            </template>
          </I18nT>
        </section>

        <nav :aria-label="t('footer.label')" class="app-footer__about">
          <h2 class="app-footer__heading">{{ t('footer.aboutHeading') }}</h2>
          <ul>
            <li>
              <RouterLink :to="{ name: 'how-it-works' }" class="app-footer__link">
                {{ t('nav.howItWorks') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink :to="{ name: 'privacy' }" class="app-footer__link">
                {{ t('nav.privacy') }}
              </RouterLink>
            </li>
          </ul>
        </nav>
      </div>

      <p class="app-footer__legal">{{ t('footer.legal', { year }) }}</p>
    </div>

    <picture>
      <source type="image/avif" :srcset="bannerAvif" :sizes="bannerSizes" />
      <img
        class="app-footer__banner"
        :src="banner960"
        :srcset="bannerWebp"
        :sizes="bannerSizes"
        alt=""
        width="1600"
        height="452"
        loading="lazy"
        decoding="async"
      />
    </picture>
  </footer>
</template>

<style scoped>
.app-footer {
  background: var(--nr-apricot);
  color: var(--nr-ink);
}

.app-footer__inner {
  padding-block: 2.5rem 1rem;
}

.app-footer__mission {
  max-width: 48rem;
  margin-bottom: 2rem;
  color: var(--nr-wine);
  font-size: clamp(1.125rem, 1rem + 0.6vw, 1.375rem);
  font-weight: 700;
  line-height: 1.35;
}

.app-footer__section {
  margin-bottom: 1.75rem;
}

.app-footer__section p {
  max-width: 60rem;
  margin-bottom: 0.5rem;
}

.app-footer__section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: 0.75rem;
}

.app-footer__heading {
  margin: 0;
  color: var(--nr-wine);
  font-size: 1rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.app-footer__section > .app-footer__heading {
  margin-bottom: 0.75rem;
}

.app-footer__flags {
  display: flex;
  gap: 0.5rem;
}

.app-footer__flags img {
  display: block;
}

.app-footer__links {
  display: grid;
  gap: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid var(--nr-line);
}

.app-footer__links .app-footer__heading {
  margin-bottom: 0.25rem;
}

.app-footer__links ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.app-footer__link {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
  color: var(--nr-wine);
  font-weight: 700;
}

.app-footer__link:hover,
.app-footer__emergency a:hover {
  color: var(--nr-rust);
}

/* a 48px row like the links in the other column, so "call 000" lines up
   with Privacy. padding rather than flex, flex would eat the space before 000 */
.app-footer__emergency {
  margin: 0;
  padding-block: 0.75rem;
}

.app-footer__emergency a {
  color: var(--nr-wine);
  font-weight: 700;
}

/* 48px rows are sized for fingers. with a mouse as the main pointer they
   drop to 32px, still well over the 24px WCAG 2.2 asks for, so the footer
   doesn't look so spread out on a desktop */
@media (pointer: fine) {
  .app-footer__link {
    min-height: 2rem;
  }

  .app-footer__emergency {
    padding-block: 0.25rem;
  }
}

.app-footer__legal {
  margin: 1.5rem 0 0;
  color: var(--nr-ink-muted);
  font-size: 0.875rem;
}

.app-footer__banner {
  display: block;
  width: 100%;
  max-width: 72rem;
  height: auto;
  margin: 1.5rem auto 0;
}

@media (min-width: 40rem) {
  .app-footer__links {
    grid-template-columns: 1fr auto;
  }

  .app-footer__about {
    text-align: end;
  }
}
</style>
