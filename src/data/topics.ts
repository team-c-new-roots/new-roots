import type { Component } from 'vue'
import {
  Wallet,
  BookOpen,
  HeartPulse,
  Store,
  Bus,
  Languages,
  Library,
  TramFront,
  ShieldCheck,
} from '@lucide/vue'
import type { Importance, RatedTopic, TopicName } from '@/types'
import type { ResultRow } from '@/types/scoring'

export interface TopicInfo {
  id: TopicName
  // key under topics. in the i18n file
  key: string
  icon: Component
  score: keyof ResultRow
}

// the order topics are shown in, on bars and in the tooltip. affordability
// first because it always counts most, safety last because it starts off
export const TOPICS: TopicInfo[] = [
  { id: 'Affordability', key: 'affordability', icon: Wallet, score: 'affordability_score' },
  { id: 'Education', key: 'education', icon: BookOpen, score: 'education_score' },
  { id: 'Healthcare', key: 'healthcare', icon: HeartPulse, score: 'healthcare_score' },
  // US 4.3, a pharmacy, GP and Services Australia centre within walking distance
  { id: 'Essentials', key: 'essentials', icon: Store, score: 'essentials_score' },
  { id: 'Transport', key: 'transport', icon: Bus, score: 'transport_score' },
  // US 4.2, only shown once the household picks a place to get to
  { id: 'Commute', key: 'commute', icon: TramFront, score: 'commute_score' },
  { id: 'Language', key: 'language', icon: Languages, score: 'language_score' },
  { id: 'Community', key: 'community', icon: Library, score: 'community_score' },
  { id: 'Safety', key: 'safety', icon: ShieldCheck, score: 'safety_score' },
]

// the six rated on the priorities step. language has its own step
export const PRIORITY_TOPICS: RatedTopic[] = [
  'Education',
  'Healthcare',
  'Essentials',
  'Transport',
  'Community',
  'Safety',
]

// reported crime starts at Not important, from the ethics canvas. the rest
// start at Important so a quick tap through still gives a sensible ranking
export const DEFAULT_IMPORTANCE: Record<RatedTopic, Importance> = {
  Education: 'important',
  Healthcare: 'important',
  Essentials: 'important',
  Transport: 'important',
  Language: 'important',
  Community: 'important',
  Commute: 'important',
  Safety: 'not',
}

export function topicInfo(id: TopicName): TopicInfo {
  return TOPICS.find((topic) => topic.id === id)!
}
