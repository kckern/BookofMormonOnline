// Five filter axes for the Matters index. Each axis exports a list of chips
// with { key, label, tag } where `key` is the i18n label key, `label` is the
// English fallback, and `tag` is the canonical value stored in bom_matters.

export const categoryChips = [
  { key: "matter_cat_animal",                  label: "Animal",           tag: "animal" },
  { key: "matter_cat_building",                label: "Building",         tag: "building" },
  { key: "matter_cat_weapon",                  label: "Weapon",           tag: "weapon" },
  { key: "matter_cat_food",                    label: "Food",             tag: "food" },
  { key: "matter_cat_sacred_object",           label: "Sacred Object",    tag: "sacred-object" },
  { key: "matter_cat_money",                   label: "Money",            tag: "money" },
  { key: "matter_cat_plant",                   label: "Plant",            tag: "plant" },
  { key: "matter_cat_record",                  label: "Record",           tag: "record" },
  { key: "matter_cat_metal",                   label: "Metal",            tag: "metal" },
  { key: "matter_cat_tool",                    label: "Tool",             tag: "tool" },
  { key: "matter_cat_apparel",                 label: "Apparel",          tag: "apparel" },
  { key: "matter_cat_structure",               label: "Structure",        tag: "structure" },
  { key: "matter_cat_vehicle",                 label: "Vehicle",          tag: "vehicle" },
  { key: "matter_cat_landscape",               label: "Landscape",        tag: "landscape" },
  { key: "matter_cat_armor",                   label: "Armor",            tag: "armor" },
  { key: "matter_cat_treasure",                label: "Treasure",         tag: "treasure" },
  { key: "matter_cat_society_custom",          label: "Society & Custom", tag: "society-custom" },
  { key: "matter_cat_governance_politics",     label: "Governance",       tag: "governance-politics" },
  { key: "matter_cat_law_justice",             label: "Law & Justice",    tag: "law-justice" },
  { key: "matter_cat_natural_world",           label: "Natural World",    tag: "natural-world" },
  { key: "matter_cat_warfare_military",        label: "Warfare",          tag: "warfare-military" },
  { key: "matter_cat_agriculture_subsistence", label: "Agriculture",      tag: "agriculture-subsistence" },
  { key: "matter_cat_economy",                 label: "Economy",          tag: "economy" },
  { key: "matter_cat_material_culture_tech",   label: "Material Culture", tag: "material-culture-tech" },
];

export const eraChips = [
  { key: "era_timeless",         label: "Timeless",         tag: "timeless" },
  { key: "era_nephite",          label: "Nephite",          tag: "nephite" },
  { key: "era_old_world",        label: "Old World",        tag: "old-world" },
  { key: "era_lehite_departure", label: "Lehite Departure", tag: "lehite-departure" },
  { key: "era_jaredite",         label: "Jaredite",         tag: "jaredite" },
  { key: "era_christ_era",       label: "Christ Era",       tag: "christ-era" },
  { key: "era_post_christ",      label: "Post-Christ",      tag: "post-christ" },
];

export const provenanceChips = [
  { key: "prov_generic",   label: "Generic",   tag: "generic" },
  { key: "prov_nephite",   label: "Nephite",   tag: "nephite" },
  { key: "prov_israelite", label: "Israelite", tag: "israelite" },
  { key: "prov_divine",    label: "Divine",    tag: "divine" },
  { key: "prov_lehite",    label: "Lehite",    tag: "lehite" },
  { key: "prov_jaredite",  label: "Jaredite",  tag: "jaredite" },
  { key: "prov_lamanite",  label: "Lamanite",  tag: "lamanite" },
  { key: "prov_mulekite",  label: "Mulekite",  tag: "mulekite" },
];

// Replaced the old specific/general pair when bom_objects became bom_matters:
// an entry now names either a single thing in the text (instance), a whole
// category of thing (class), or a recurring motif (theme).
export const specificityChips = [
  { key: "spec_instance", label: "Named", tag: "instance" },
  { key: "spec_class",    label: "Class", tag: "class" },
  { key: "spec_theme",    label: "Theme", tag: "theme" },
];

export const usageChips = [
  { key: "usage_literal",       label: "Literal",     tag: "literal" },
  { key: "usage_mixed",         label: "Mixed",       tag: "mixed" },
  { key: "usage_metaphorical",  label: "Symbolic",    tag: "metaphorical" },
];

export const filterAxes = [
  { name: "category",    title: "matter_axis_category",    chips: categoryChips,    titleEn: "Category" },
  { name: "era",         title: "matter_axis_era",         chips: eraChips,         titleEn: "Era" },
  { name: "provenance",  title: "matter_axis_provenance",  chips: provenanceChips,  titleEn: "Provenance" },
  { name: "specificity", title: "matter_axis_specificity", chips: specificityChips, titleEn: "Specificity" },
  { name: "usage",       title: "matter_axis_usage",       chips: usageChips,       titleEn: "Usage" },
];
