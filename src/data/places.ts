import type { Component } from 'vue'
import { GraduationCap, HeartPulse, Landmark, Library, Trees } from '@lucide/vue'

/* the map's place filters. every group starts off, and nothing chosen is
   saved, so it's all gone when the page closes (US 3.2, US 3.4).

   places of worship are one colour and one icon whatever the faith, and
   never count towards a score, so nothing on the map is coloured or ranked
   by religion. the faiths only choose which pins show.

   types are the names scripts/export_places.py writes, keep the two in step */

// a 20 minute walk past the suburb's border, the same as export_places.py
export const PLACE_MARGIN_KM = 1.5

export const PLACE_GROUPS = [
  {
    id: 'worship',
    icon: Landmark,
    types: ['church', 'mosque', 'synagogue', 'gurdwara', 'mandir', 'vihara', 'monastery'],
  },
  {
    id: 'community',
    icon: Library,
    types: ['library', 'communityCentre', 'hall'],
  },
  {
    id: 'health',
    icon: HeartPulse,
    types: ['hospital', 'communityHealth', 'gp', 'pharmacy'],
  },
  {
    id: 'education',
    icon: GraduationCap,
    types: ['englishClass', 'primary', 'secondary', 'primarySecondary', 'tertiary', 'university'],
  },
  {
    id: 'recreation',
    icon: Trees,
    types: ['playground', 'picnic'],
  },
] as const satisfies readonly { id: string; icon: Component; types: readonly string[] }[]

export type PlaceGroup = (typeof PLACE_GROUPS)[number]
export type PlaceGroupId = PlaceGroup['id']
export type PlaceType = PlaceGroup['types'][number]

export const GROUP_OF = Object.fromEntries(
  PLACE_GROUPS.flatMap((group) => group.types.map((type) => [type, group])),
) as Record<PlaceType, PlaceGroup>

export function isPlaceType(value: string): value is PlaceType {
  return value in GROUP_OF
}
