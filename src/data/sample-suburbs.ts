import type { CommunityLanguage, RentKey, Suburb } from '@/types'

/* sample figures only. shaped like the real datasets (rental report medians,
   census language shares, school and AMEP distances, crime rates) so the
   screens can be built and tested, but every number here is made up. the UI
   shows a Sample data badge wherever these appear.

   three clusters so each persona has a story to demo: south east for Mariam,
   west for Majok, north for Reza. Dandenong South and Lynbrook have gaps on
   purpose so the not enough data states get exercised */

type Rents = Partial<Record<RentKey, number>>
type Languages = Partial<Record<CommunityLanguage, number>>

// rents in order: 1-3 bed flats, then 2-4 bed houses. null where the report has no figure
function rents(
  flat1: number | null,
  flat2: number | null,
  flat3: number | null,
  house2: number | null,
  house3: number | null,
  house4: number | null,
): Rents {
  const all: Record<RentKey, number | null> = { flat1, flat2, flat3, house2, house3, house4 }
  const out: Rents = {}
  for (const [key, value] of Object.entries(all) as [RentKey, number | null][]) {
    if (value !== null) out[key] = value
  }
  return out
}

function langs(
  dari: number,
  hazaraghi: number,
  persian: number,
  arabic: number,
  pashto: number,
  dinka: number,
): Languages {
  return { dari, hazaraghi, persian, arabic, pashto, dinka }
}

function suburb(
  name: string,
  lga: string,
  rentFigures: Rents | null,
  languages: Languages | null,
  km: [number | null, number | null, number | null],
  essentialsScore: number | null,
  crime: [number, number] | null,
): Suburb {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    lga,
    rents: rentFigures,
    languages,
    schoolPrimaryKm: km[0],
    schoolSecondaryKm: km[1],
    englishClassKm: km[2],
    essentialsScore,
    crimeRate: crime ? crime[0] : null,
    crimeScore: crime ? crime[1] : null,
  }
}

const DANDENONG = 'City of Greater Dandenong'
const CASEY = 'City of Casey'
const HUME = 'Hume City Council'
const MERRI_BEK = 'Merri-bek City Council'
const BRIMBANK = 'Brimbank City Council'
const MARIBYRNONG = 'City of Maribyrnong'

// prettier-ignore
export const SAMPLE_SUBURBS: Suburb[] = [
  // south east
  suburb('Springvale', DANDENONG, rents(390, 450, 520, 480, 540, 620), langs(1, 0.5, 0.6, 0.8, 0.4, 0.3), [0.6, 1.2, 0.9], 84, [92, 38]),
  suburb('Noble Park', DANDENONG, rents(375, 430, 500, 470, 520, 560), langs(3, 2, 0.8, 1, 0.9, 1.5), [0.5, 1.6, 1.2], 80, [88, 41]),
  suburb('Dandenong North', DANDENONG, rents(390, 440, 510, 470, 520, 560), langs(5, 2, 0.7, 0.9, 1.2, 0.6), [0.8, 1.5, 2.0], 72, [60, 58]),
  suburb('Dandenong', DANDENONG, rents(380, 430, 490, 450, 480, 500), langs(7, 5, 1, 1.5, 2, 1.2), [0.7, 1.1, 0.4], 88, [140, 22]),
  suburb('Doveton', CASEY, rents(370, 420, 470, 440, 460, 480), langs(9, 4, 0.8, 1, 1.5, 0.3), [0.5, 1.4, 1.8], 74, [95, 40]),
  suburb('Endeavour Hills', CASEY, rents(null, 450, null, null, 530, 600), langs(5, 2.5, 0.6, 0.7, 1, 0.2), [0.7, 1.3, 3.1], 63, [45, 70]),
  suburb('Keysborough', DANDENONG, rents(null, 470, 540, null, 560, 650), langs(1, 1, 0.4, 0.5, 0.3, 0.2), [0.9, 1.8, 2.4], 60, [40, 74]),
  suburb('Dandenong South', DANDENONG, null, null, [null, null, null], null, null),
  suburb('Hallam', CASEY, rents(385, 430, null, 450, 500, 540), langs(6, 3, 0.5, 0.6, 1.4, 0.4), [0.9, 1.9, 2.6], 66, [70, 52]),
  suburb('Hampton Park', CASEY, rents(null, 440, null, 460, 500, 550), langs(5, 3, 0.4, 0.5, 1.3, 0.3), [0.8, 2.1, 3.4], 61, [62, 57]),
  suburb('Lynbrook', CASEY, null, langs(4, 2.5, 0.3, 0.4, 0.9, 0.2), [1.2, 2.5, 4.0], 52, [35, 78]),
  suburb('Lyndhurst', CASEY, rents(null, null, null, null, 560, 620), langs(2, 1.5, 0.3, 0.4, 0.6, 0.2), [1.4, 3.0, 4.2], 48, [30, 80]),
  suburb('Narre Warren', CASEY, rents(390, 450, null, 470, 520, 590), langs(4, 3, 0.5, 0.5, 1, 0.3), [0.7, 1.6, 2.9], 64, [72, 50]),
  suburb('Cranbourne North', CASEY, rents(null, 450, null, null, 510, 570), langs(3, 4, 0.4, 0.4, 0.8, 0.3), [1.0, 2.2, 5.1], 50, [50, 65]),

  // north
  suburb('Broadmeadows', HUME, rents(340, 400, 450, 430, 470, 540), langs(1, 0.3, 1.2, 10, 0.5, 0.2), [0.6, 1.2, 0.8], 82, [120, 28]),
  suburb('Dallas', HUME, rents(350, 410, null, 440, 470, 530), langs(0.8, 0.2, 0.8, 12, 0.4, 0.1), [0.5, 1.5, 1.4], 76, [110, 32]),
  suburb('Meadow Heights', HUME, rents(360, 420, null, 450, 480, 540), langs(0.7, 0.2, 0.9, 9, 0.3, 0.1), [0.6, 1.0, 2.2], 70, [70, 52]),
  suburb('Coolaroo', HUME, rents(365, null, null, 440, 470, 530), langs(0.5, 0.1, 0.6, 8, 0.2, 0.1), [0.8, 1.7, 2.0], 64, [80, 46]),
  suburb('Campbellfield', HUME, rents(370, 420, null, 450, 480, 550), langs(0.4, 0.1, 0.5, 6, 0.2, 0.1), [1.1, 2.0, 2.4], 55, [150, 20]),
  suburb('Glenroy', MERRI_BEK, rents(380, 450, 520, 480, 540, 640), langs(0.6, 0.2, 1, 6, 0.3, 0.2), [0.5, 0.9, 1.1], 86, [55, 62]),
  suburb('Roxburgh Park', HUME, rents(null, null, null, null, 520, 600), langs(0.5, 0.1, 0.6, 7, 0.3, 0.1), [0.9, 1.6, 3.5], 58, [40, 72]),

  // west
  suburb('Sunshine', BRIMBANK, rents(395, 450, 520, 470, 540, 620), langs(0.3, 0.1, 0.4, 0.8, 0.2, 1.2), [0.4, 1.0, 0.6], 90, [105, 34]),
  suburb('Sunshine North', BRIMBANK, rents(375, 430, null, 450, 500, 580), langs(0.2, 0.1, 0.3, 0.6, 0.1, 1), [0.6, 1.5, 1.6], 74, [70, 52]),
  suburb('Sunshine West', BRIMBANK, rents(385, 440, null, 460, 510, 590), langs(0.2, 0.1, 0.3, 0.7, 0.1, 1.1), [0.7, 1.4, 1.9], 70, [65, 55]),
  suburb('St Albans', BRIMBANK, rents(365, 420, 480, 440, 480, 560), langs(0.3, 0.1, 0.4, 0.9, 0.2, 1.8), [0.5, 1.1, 0.9], 84, [95, 40]),
  suburb('Deer Park', BRIMBANK, rents(380, 430, null, 460, 500, 570), langs(0.2, 0.1, 0.3, 0.6, 0.1, 1.5), [0.8, 1.8, 2.6], 62, [60, 58]),
  suburb('Ardeer', BRIMBANK, rents(370, 430, null, 450, 490, 560), langs(0.2, 0.1, 0.2, 0.5, 0.1, 1.3), [0.7, 1.6, 2.1], 66, [58, 59]),
  suburb('Braybrook', MARIBYRNONG, rents(400, 450, 520, 480, 540, 620), langs(0.3, 0.1, 0.4, 0.9, 0.2, 0.8), [0.6, 1.3, 1.5], 78, [90, 42]),
]

export function findSampleSuburb(id: string): Suburb | undefined {
  return SAMPLE_SUBURBS.find((item) => item.id === id)
}
