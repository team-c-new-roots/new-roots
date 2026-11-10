<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Clock, Info, Phone } from '@lucide/vue'
import type { SupportService } from '@/data/support-services'
import ExternalLink from '@/components/ui/ExternalLink.vue'

/* the call button is the main action, full width on a phone, because for most
   of these the phone is how you get help. the number shows on the button so
   it can be read out or dialled from another phone */

defineProps<{ service: SupportService }>()
const { t } = useI18n()
</script>

<template>
  <article class="service" :aria-labelledby="`service-${service.id}`">
    <div class="service__body">
      <h3 :id="`service-${service.id}`" class="service__name">{{ service.name }}</h3>
      <p class="service__detail">{{ t(`support.services.${service.id}`) }}</p>
      <p v-if="service.hours" class="service__meta">
        <Clock :size="16" aria-hidden="true" />
        {{ t(`support.hours.${service.hours}`) }}
      </p>
      <p v-if="service.visaNote" class="service__meta service__meta--visa">
        <Info :size="16" aria-hidden="true" />
        {{ t(`support.visa.${service.visaNote}`) }}
      </p>
    </div>
    <div class="service__actions">
      <a v-if="service.phone" :href="`tel:${service.tel}`" class="btn btn--primary service__call">
        <Phone :size="18" aria-hidden="true" />
        {{ t('support.call', { phone: service.phone }) }}
      </a>
      <ExternalLink v-if="service.url" :href="service.url" class="service__website">
        {{ t('support.website') }}
        <span class="visually-hidden">{{
          t('support.websiteFor', { service: service.name })
        }}</span>
      </ExternalLink>
    </div>
  </article>
</template>

<style scoped>
.service {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.1rem 1.25rem;
  border-radius: var(--nr-radius);
  background: var(--nr-panel);
}

.service__name {
  margin-bottom: 0.25rem;
}

.service__detail {
  margin-bottom: 0.5rem;
}

.service__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.25rem;
  color: var(--nr-ink-muted);
  font-size: 0.9375rem;
  font-weight: 600;
}

.service__meta--visa {
  color: var(--nr-rust);
}

.service__actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
}

.service__call {
  white-space: nowrap;
}

.service__website {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--nr-target);
}

/* side by side once there's room, the actions in a fixed column so the call
   buttons line up down the page instead of landing wherever the text ends */
@media (min-width: 40rem) {
  .service {
    flex-direction: row;
    align-items: center;
  }

  .service__body {
    flex: 1;
    min-width: 0;
  }

  .service__actions {
    flex: 0 0 13rem;
  }
}
</style>
