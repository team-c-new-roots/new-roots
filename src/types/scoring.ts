import type { TopicName } from './index'

/* the scoring contract: what a household's answers turn into, and the rows
   that come back. it mirrors calculate_scores in the data team's
   new_roots_scoring.py, which stays the reference version. the browser's
   copy in services/scoring.ts is tested against its output */

export type ImportanceLevel = 'not important' | 'important' | 'very important'

export interface ScoreRequest {
  // census language name, like "Dari" or "Persian (excluding Dari)"
  selected_language: string | null
  // 1 to 4, the rental report stops at 4
  bedrooms: number
  dwelling_type: 'house' | 'flat' | 'both'
  // weekly, rent assistance and the energy supplement included
  income: number
  topic_importance: Record<TopicName, ImportanceLevel>
}

export interface ResultRow {
  suburb_id: string
  suburb_name: string
  affordability_score: number | null
  selected_weekly_rent: number | null
  rent_to_income_pct: number | null
  affordability_cap: number | null
  education_score: number | null
  healthcare_score: number | null
  safety_score: number | null
  transport_score: number | null
  language_score: number | null
  community_score: number | null
  overall_score: number | null
  overall_rank: number | null
  fill_color?: string
}

// one row of the one big table. every metric comes as _value, _ranking and _score
export interface ObtRow {
  suburb_id: string
  suburb_name: string
  suburb_area_km2: number | null
  [metric: string]: string | number | null
}

export interface LookupRow {
  table: string
  topic: TopicName
  metric: string
  weighting_pct: number
  to_display: string
}

export interface LanguageRow {
  suburb_id: string
  language: string
  percent_spoken: number | null
  language_score: number | null
  language_ranking: number | null
}

export interface InfrastructureRow {
  suburb_id: string
  infra_type: string
  proximity: number | null
  infra_score: number | null
  infra_ranking: number | null
}

export interface MapData {
  results: ResultRow[]
  obt: ObtRow[]
  lookup: LookupRow[]
  languages: LanguageRow[]
  infrastructure: InfrastructureRow[]
  selectedLanguage: string | null
}

// what scripts/export_app_data.py writes to public/data/app-data.json
export interface AppDataWeight {
  topic: TopicName
  table: 'obt' | 'languages' | 'infrastructure'
  metric: string
  weight: number
}

export interface AppData {
  exported: string
  weights: AppDataWeight[]
  suburbs: ObtRow[]
  // census language name, then suburb id, then [percent spoken, language score]
  languages: Record<string, Record<string, [number | null, number | null]>>
  // each suburb's four most spoken languages, [name, percent]
  topLanguages: Record<string, [string, number][]>
  // each suburb's average community places score
  community: Record<string, number | null>
}
