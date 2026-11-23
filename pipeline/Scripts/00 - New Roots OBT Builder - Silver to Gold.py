# New Roots - suburb and helper table builder
#
# REQUIRED FILES (keep these in the same folder as this script):
#   suburbs.csv
#   census_people.csv
#   rental_clean.csv
#   crime_clean.csv
#   transport_stops.csv
#   health_services.csv
#   vicmap_facilities.csv
#   amep_victoria_facilities.csv
#   language_counts.csv
#   new_roots_language_display_map.csv
#   rental_availability.csv
#
# OUTPUT FILES:
#   new_roots_obt.csv
#   new_roots_languages.csv
#   new_roots_infrastructure.csv
#
# All inputs are assumed to be clean. Spatial WKT inputs use EPSG:4326.

from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

folder = Path(__file__).parent

# Read Census language names and their display labels
language_display_names = pd.read_csv(
    folder / 'new_roots_language_display_map.csv'
).set_index('language')['display_name']


def score(values, lower=False):
    valid = values.dropna()
    if valid.empty:
        return pd.Series(np.nan, index=values.index)
    if (valid == 0).all():
        return pd.Series(0.0, index=values.index).where(values.notna())
    low, high = valid.quantile([0.1, 0.9])
    if high == low:
        return pd.Series(100.0, index=values.index).where(values.notna())
    result = (values.clip(low, high) - low) / (high - low) * 100
    return (100 - result if lower else result).round()


def add_metric(name, values, lower=False):
    values = pd.Series(values, index=suburbs.index, dtype=float)
    suburbs[f'{name}_value'] = values
    suburbs[f'{name}_ranking'] = values.rank(ascending=lower, method='min').astype('Int64')
    suburbs[f'{name}_score'] = score(values, lower).astype('Int64')


def proximity(points):
    if points.empty:
        return np.full(len(suburbs), np.nan)
    point_xy = np.array([(p.x, p.y) for p in points.geometry])
    suburb_xy = np.array([(p.x, p.y) for p in suburbs.geometry.centroid])
    return cKDTree(point_xy).query(suburb_xy)[0] / 1000


def stop_density(points):
    joined = gpd.sjoin(points[['geometry']], suburbs[['suburb_id', 'geometry']], predicate='within')
    counts = joined.groupby('suburb_id').size()
    return suburbs.suburb_id.map(counts).fillna(0) / suburbs.suburb_area_km2


def read_points(filename):
    data = pd.read_csv(folder / filename, dtype={'suburb_id': str})
    return gpd.GeoDataFrame(data, geometry=gpd.GeoSeries.from_wkt(data.geometry), crs=4326).to_crs(7855)


# Suburbs and census population (population needed for crime and language calculations)
suburbs = read_points('suburbs.csv').reset_index(drop=True)
people = pd.read_csv(folder / 'census_people.csv', dtype={'suburb_id': str})
suburbs = suburbs.merge(people[['suburb_id', 'population']], on='suburb_id', how='left', validate='one_to_one')
suburbs['suburb_area_km2'] = suburbs.geometry.area / 1_000_000

# Rent metrics: each dwelling type is separate
rent = pd.read_csv(folder / 'rental_clean.csv')
dwellings = {
    'rent_1br_flat': '1 bedroom flat',
    'rent_2br_flat': '2 bedroom flat',
    'rent_3br_flat': '3 bedroom flat',
    'rent_2br_house': '2 bedroom house',
    'rent_3br_house': '3 bedroom house',
    'rent_4br_house': '4 bedroom house',
}
for name, dwelling in dwellings.items():
    dwelling_rent = rent.loc[
        rent.dwelling_type.eq(dwelling) & rent.median_weekly_rent.notna()
    ]
    rates = dwelling_rent.groupby('suburb_join').median_weekly_rent.mean()
    add_metric(name, suburbs.suburb_name_join.map(rates), lower=True)

    # Carry through the origin of the rent for this dwelling type.
    # If multiple source rows contribute to an averaged rent, show all methods.
    methods = dwelling_rent.groupby('suburb_join').infilling_method.agg(
        lambda values: ', '.join(sorted(values.dropna().astype(str).unique()))
    )
    suburbs[f'{name}_infilling_method'] = suburbs.suburb_name_join.map(methods)



# Rental availability: average annual new lettings over the past five years
availability = pd.read_csv(folder / 'rental_availability.csv', dtype={'suburb_id': str})
assert not availability.duplicated(['suburb_id', 'dwelling_type']).any(), 'Duplicate rental availability records'

for name, dwelling in dwellings.items():
    dwelling_availability = availability.loc[
        availability.dwelling_type.eq(dwelling)
    ].set_index('suburb_id')

    metric_name = name.replace('rent_', 'rental_availability_')

    add_metric(metric_name,
               suburbs.suburb_id.map(dwelling_availability['5yr_avg_new_rentals']))

    suburbs[f'{metric_name}_infilling_method'] = (
        suburbs.suburb_id.map(dwelling_availability['infilling_method'])
    )


# Crime incidents per 1,000 residents
crime = pd.read_csv(folder / 'crime_clean.csv')
crime = crime.groupby('suburb_join')[['total_incidents', 'person_incidents', 'property_incidents']].sum()
for name, field in {
    'crime_per_1000': 'total_incidents',
    'crime_person_per_1000': 'person_incidents',
    'crime_property_per_1000': 'property_incidents',
}.items():
    rate = suburbs.suburb_name_join.map(crime[field]) / suburbs.population.replace(0, np.nan) * 1000
    add_metric(name, rate.where(suburbs.population >= 500), lower=True)

# Transport
stops = read_points('transport_stops.csv')
bus_tram = stops[stops.transport_mode.isin(['metro bus', 'regional bus', 'metro tram'])]
trains = stops[stops.transport_mode.isin(['metro train', 'regional train'])]
add_metric('bus_tram_stop_density', stop_density(bus_tram))
add_metric('train_station_proximity', proximity(trains), lower=True)

# Healthcare
health = read_points('health_services.csv')
for name, facility in [('gp_proximity', 'gp'), ('hospital_proximity', 'hospital')]:
    add_metric(name, proximity(health[health.facility_type.eq(facility)]), lower=True)

# Schools and English classes
facilities = read_points('vicmap_facilities.csv')
facilities['geometry'] = facilities.geometry.centroid
add_metric('primary_school_proximity', proximity(facilities[facilities.facility_subtype.isin(
    ['primary school', 'primary/secondary school'])]), lower=True)
add_metric('secondary_school_proximity', proximity(facilities[facilities.facility_subtype.isin(
    ['secondary school', 'primary/secondary school'])]), lower=True)

english = pd.read_csv(folder / 'amep_victoria_facilities.csv')
english = gpd.GeoDataFrame(english, geometry=gpd.points_from_xy(english.longitude, english.latitude), crs=4326).to_crs(7855)
add_metric('english_class_proximity', proximity(english), lower=True)

# Export one row per suburb (no population or median age)
columns = ['suburb_id', 'suburb_name', 'suburb_area_km2']
columns += [c for c in suburbs.columns if c.endswith(('_value', '_ranking', '_score', '_infilling_method'))]
result = suburbs[columns].copy()
result['geometry'] = suburbs.to_crs(4326).geometry.to_wkt()
result.to_csv(folder / 'new_roots_obt.csv', index=False)
print(f'Saved {len(result)} suburbs and {len(result.columns)} columns')


# Language helper table: one row per suburb and language
languages = pd.read_csv(folder / 'language_counts.csv', dtype={'suburb_id': str})
languages = languages.merge(suburbs[['suburb_id', 'population']], on='suburb_id', how='left', validate='many_to_one')
languages['display_name'] = languages.language.map(language_display_names).fillna(languages.language)
languages['percent_spoken'] = languages.speaker_count / languages.population.replace(0, np.nan) * 100
languages['language_score_ranking'] = languages.groupby('language').percent_spoken.rank(
    ascending=False, method='min').astype('Int64')
languages['language_score'] = languages.groupby('language').percent_spoken.transform(score).astype('Int64')

# Language community size: total speakers per suburb
languages['speaker_count_ranking'] = languages.groupby('language').speaker_count.rank(
    ascending=False, method='min').astype('Int64')
languages['speaker_count_score'] = languages.groupby('language').speaker_count.transform(score).astype('Int64')

languages = languages[['suburb_id', 'language', 'display_name', 'percent_spoken', 'language_score', 'language_score_ranking',
                       'speaker_count', 'speaker_count_score', 'speaker_count_ranking']]
languages.to_csv(folder / 'new_roots_languages.csv', index=False)
print(f'Saved {len(languages)} suburb-language rows')


# Community infrastructure helper table: nearest facility of each type
community_types = ['community centre', 'hall', 'neighbourhood house', 'senior citizens']
community = facilities[facilities.facility_subtype.isin(community_types)].copy()

infra_rows = []
for infra_type in sorted(community.facility_subtype.dropna().unique()):
    points = community[community.facility_subtype.eq(infra_type)]
    distances = pd.Series(proximity(points))
    infra_rows.append(pd.DataFrame({
        'suburb_id': suburbs.suburb_id,
        'infra_type': infra_type,
        'proximity': distances,
        'infra_score': score(distances, lower=True).astype('Int64'),
        'infra_score_ranking': distances.rank(ascending=True, method='min').astype('Int64')
    }))

infrastructure = pd.concat(infra_rows, ignore_index=True)
infrastructure.to_csv(folder / 'new_roots_infrastructure.csv', index=False)
print(f'Saved {len(infrastructure)} suburb-infrastructure rows')
