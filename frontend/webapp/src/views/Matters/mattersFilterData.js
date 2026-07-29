/** @format */
// Matters filter vocabulary — GENERATED from content/matters/items via
// content/matters/build_sql.py's mappings. Regenerate rather than hand-edit:
// the previous hand-maintained list drifted 184 records out of date.
//
// Axis 1 (form) is two-level: five groups over seventeen chips, plus a
// contextual secondary row of sub-chips shown only when a form chip is active.
// Axis 2 (era_culture) merges the old era + provenance, which were 58% redundant.
// Axis 3 (nrefs) buckets reference counts.
//
// Counts in comments are record counts at generation time, for sanity only.

export const formGroups = [
  {
    key: "matter_grp_natural_world",
    label: "Natural World",
    tag: "Natural World",   // 128
    chips: [
      { key: "matter_form_living_world", label: "Living World", tag: "Living World" },   // 64
      { key: "matter_form_land_substance", label: "Land & Substance", tag: "Land & Substance" },   // 36
      { key: "matter_form_food_farming", label: "Food & Farming", tag: "Food & Farming" },   // 28
    ],
  },
  {
    key: "matter_grp_made_things",
    label: "Made Things",
    tag: "Made Things",   // 126
    chips: [
      { key: "matter_form_arms_armor", label: "Arms & Armor", tag: "Arms & Armor" },   // 31
      { key: "matter_form_dress_adornment", label: "Dress & Adornment", tag: "Dress & Adornment" },   // 22
      { key: "matter_form_works_vehicles", label: "Works & Vehicles", tag: "Works & Vehicles" },   // 21
      { key: "matter_form_tools_household", label: "Tools & Household", tag: "Tools & Household" },   // 20
      { key: "matter_form_records_writing", label: "Records & Writing", tag: "Records & Writing" },   // 18
      { key: "matter_form_sacred_objects", label: "Sacred Objects", tag: "Sacred Objects" },   // 14
    ],
  },
  {
    key: "matter_grp_society",
    label: "Society",
    tag: "Society",   // 110
    chips: [
      { key: "matter_form_law_government", label: "Law & Government", tag: "Law & Government" },   // 39
      { key: "matter_form_society_custom", label: "Society & Custom", tag: "Society & Custom" },   // 35
      { key: "matter_form_wealth_trade", label: "Wealth & Trade", tag: "Wealth & Trade" },   // 25
      { key: "matter_form_war_conflict", label: "War & Conflict", tag: "War & Conflict" },   // 11
    ],
  },
  {
    key: "matter_grp_places",
    label: "Places",
    tag: "Places",   // 77
    chips: [
      { key: "matter_form_dwellings_settlements", label: "Dwellings & Settlements", tag: "Dwellings & Settlements" },   // 63
      { key: "matter_form_sacred_places", label: "Sacred Places", tag: "Sacred Places" },   // 14
    ],
  },
  {
    key: "matter_grp_belief_mind",
    label: "Belief & Mind",
    tag: "Belief & Mind",   // 46
    chips: [
      { key: "matter_form_belief_worship", label: "Belief & Worship", tag: "Belief & Worship" },   // 27
      { key: "matter_form_nature_thought", label: "Nature & Thought", tag: "Nature & Thought" },   // 19
    ],
  },
];

// form tag -> secondary chips. Forms with fewer than 3 sub-values are omitted;
// the UI renders no secondary row for them.
export const secondaryChips = {
  "Living World": [
    { key: "matter_sub_animals", label: "Animals", tag: "Animals" },   // 35
    { key: "matter_sub_plants", label: "Plants", tag: "Plants" },   // 17
    { key: "matter_sub_insects", label: "Insects", tag: "Insects" },   // 5
    { key: "matter_sub_cattle", label: "Cattle", tag: "Cattle" },   // 4
    { key: "matter_sub_serpents", label: "Serpents", tag: "Serpents" },   // 3
  ],
  "Dwellings & Settlements": [
    { key: "matter_sub_tents", label: "Tents", tag: "Tents" },   // 14
    { key: "matter_sub_settlements", label: "Settlements", tag: "Settlements" },   // 12
    { key: "matter_sub_prisons", label: "Prisons", tag: "Prisons" },   // 9
    { key: "matter_sub_houses", label: "Houses", tag: "Houses" },   // 8
    { key: "matter_sub_towers", label: "Towers", tag: "Towers" },   // 7
    { key: "matter_sub_beds", label: "Beds", tag: "Beds" },   // 5
    { key: "matter_sub_camps", label: "Camps", tag: "Camps" },   // 3
    { key: "matter_sub_palaces", label: "Palaces", tag: "Palaces" },   // 3
    { key: "matter_sub_gardens", label: "Gardens", tag: "Gardens" },   // 2
  ],
  "Land & Substance": [
    { key: "matter_sub_materials", label: "Materials", tag: "Materials" },   // 16
    { key: "matter_sub_landforms", label: "Landforms", tag: "Landforms" },   // 15
    { key: "matter_sub_caves", label: "Caves", tag: "Caves" },   // 3
    { key: "matter_sub_wood", label: "Wood", tag: "Wood" },   // 2
  ],
  "Society & Custom": [
    { key: "matter_sub_custom", label: "Custom", tag: "Custom" },   // 15
    { key: "matter_sub_gesture_token", label: "Gesture & Token", tag: "Gesture & Token" },   // 11
    { key: "matter_sub_marriage_sexuality", label: "Marriage & Sexuality", tag: "Marriage & Sexuality" },   // 6
    { key: "matter_sub_kinship_naming", label: "Kinship & Naming", tag: "Kinship & Naming" },   // 3
  ],
  "Arms & Armor": [
    { key: "matter_sub_weapons", label: "Weapons", tag: "Weapons" },   // 8
    { key: "matter_sub_swords", label: "Swords", tag: "Swords" },   // 8
    { key: "matter_sub_armor", label: "Armor", tag: "Armor" },   // 7
    { key: "matter_sub_slings", label: "Slings", tag: "Slings" },   // 3
    { key: "matter_sub_bows", label: "Bows", tag: "Bows" },   // 2
    { key: "matter_sub_javelins", label: "Javelins", tag: "Javelins" },   // 2
    { key: "matter_sub_axes", label: "Axes", tag: "Axes" },   // 1
  ],
  "Food & Farming": [
    { key: "matter_sub_food", label: "Food", tag: "Food" },   // 13
    { key: "matter_sub_agriculture", label: "Agriculture", tag: "Agriculture" },   // 5
    { key: "matter_sub_meat", label: "Meat", tag: "Meat" },   // 3
    { key: "matter_sub_wine", label: "Wine", tag: "Wine" },   // 3
    { key: "matter_sub_fruits", label: "Fruits", tag: "Fruits" },   // 3
    { key: "matter_sub_bread", label: "Bread", tag: "Bread" },   // 1
  ],
  "Wealth & Trade": [
    { key: "matter_sub_nephite_coinage", label: "Nephite Coinage", tag: "Nephite Coinage" },   // 13
    { key: "matter_sub_economy", label: "Economy", tag: "Economy" },   // 10
    { key: "matter_sub_treasure", label: "Treasure", tag: "Treasure" },   // 2
  ],
  "Dress & Adornment": [
    { key: "matter_sub_apparel", label: "Apparel", tag: "Apparel" },   // 11
    { key: "matter_sub_ornaments", label: "Ornaments", tag: "Ornaments" },   // 9
    { key: "matter_sub_cloaks", label: "Cloaks", tag: "Cloaks" },   // 2
  ],
  "Works & Vehicles": [
    { key: "matter_sub_fortification", label: "Fortification", tag: "Fortification" },   // 8
    { key: "matter_sub_structures", label: "Structures", tag: "Structures" },   // 4
    { key: "matter_sub_ships", label: "Ships", tag: "Ships" },   // 3
    { key: "matter_sub_barges", label: "Barges", tag: "Barges" },   // 3
    { key: "matter_sub_chariots", label: "Chariots", tag: "Chariots" },   // 3
  ],
  "Tools & Household": [
    { key: "matter_sub_tools", label: "Tools", tag: "Tools" },   // 8
    { key: "matter_sub_thrones", label: "Thrones", tag: "Thrones" },   // 4
    { key: "matter_sub_agriculture", label: "Agriculture", tag: "Agriculture" },   // 3
    { key: "matter_sub_lighting", label: "Lighting", tag: "Lighting" },   // 2
    { key: "matter_sub_containers", label: "Containers", tag: "Containers" },   // 2
    { key: "matter_sub_musical_instruments", label: "Musical Instruments", tag: "Musical Instruments" },   // 1
  ],
  "Records & Writing": [
    { key: "matter_sub_plates", label: "Plates", tag: "Plates" },   // 8
    { key: "matter_sub_records", label: "Records", tag: "Records" },   // 5
    { key: "matter_sub_language", label: "Language", tag: "Language" },   // 5
  ],
  "Sacred Places": [
    { key: "matter_sub_synagogues", label: "Synagogues", tag: "Synagogues" },   // 4
    { key: "matter_sub_temples", label: "Temples", tag: "Temples" },   // 4
    { key: "matter_sub_sepulchres", label: "Sepulchres", tag: "Sepulchres" },   // 2
    { key: "matter_sub_noah_s_temple", label: "Noah''s Temple", tag: "Noah''s Temple" },   // 2
    { key: "matter_sub_sanctuaries", label: "Sanctuaries", tag: "Sanctuaries" },   // 2
  ],
  "Sacred Objects": [
    { key: "matter_sub_idols", label: "Idols", tag: "Idols" },   // 4
    { key: "matter_sub_other_sacred_objects", label: "Other Sacred Objects", tag: "Other Sacred Objects" },   // 3
    { key: "matter_sub_translation_instruments", label: "Translation Instruments", tag: "Translation Instruments" },   // 3
    { key: "matter_sub_altars", label: "Altars", tag: "Altars" },   // 2
    { key: "matter_sub_liahona", label: "Liahona", tag: "Liahona" },   // 2
  ],
};

export const eraCultureChips = [
  { key: "matter_ec_nephite", label: "Nephite", tag: "Nephite" },
  { key: "matter_ec_generic", label: "Generic", tag: "Generic" },
  { key: "matter_ec_israelite_old_world", label: "Israelite/Old World", tag: "Israelite/Old World" },
  { key: "matter_ec_jaredite", label: "Jaredite", tag: "Jaredite" },
  { key: "matter_ec_lamanite", label: "Lamanite", tag: "Lamanite" },
  { key: "matter_ec_christ_era", label: "Christ era", tag: "Christ era" },
];

// Prominence buckets over bom_matters.nrefs. NOTE: nrefs measures editorial
// coverage — how thoroughly a record was researched — not textual importance.
export const prominenceChips = [
  { key: "matter_prom_9",  label: "9+ refs",  tag: "9+"  },
  { key: "matter_prom_48", label: "4–8 refs", tag: "4-8" },
  { key: "matter_prom_23", label: "2–3 refs", tag: "2-3" },
  { key: "matter_prom_1",  label: "1 ref",    tag: "1"   },
];

export function prominenceBucket(nrefs) {
  const n = Number(nrefs) || 0;
  if (n >= 9) return "9+";
  if (n >= 4) return "4-8";
  if (n >= 2) return "2-3";
  return "1";
}

// The secondary chip row writes into its own axis so a stale sub-selection
// cannot keep filtering after its parent form chip is deselected.
export const SUBFORM_AXIS = "subform_label";

export const filterAxes = [
  { name: "form",        title: "matter_axis_form",     titleEn: "Kind",          groups: formGroups, secondary: secondaryChips, secondaryName: SUBFORM_AXIS },
  { name: "era_culture", title: "matter_axis_culture",  titleEn: "Era & Culture", chips: eraCultureChips },
  { name: "prominence",  title: "matter_axis_prominence", titleEn: "Prominence",  chips: prominenceChips },
];
