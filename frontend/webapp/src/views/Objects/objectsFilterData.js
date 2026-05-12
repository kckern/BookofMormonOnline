// Five filter axes for the Objects index. Each axis exports a list of chips
// with { key, label, tag } where `key` is the i18n label key, `label` is the
// English fallback, and `tag` is the canonical value stored in bom_objects.

export const categoryChips = [
  { key: "object_cat_animal",       label: "Animal",        tag: "animal" },
  { key: "object_cat_building",     label: "Building",      tag: "building" },
  { key: "object_cat_weapon",       label: "Weapon",        tag: "weapon" },
  { key: "object_cat_food",         label: "Food",          tag: "food" },
  { key: "object_cat_sacred_object",label: "Sacred Object", tag: "sacred-object" },
  { key: "object_cat_money",        label: "Money",         tag: "money" },
  { key: "object_cat_plant",        label: "Plant",         tag: "plant" },
  { key: "object_cat_record",       label: "Record",        tag: "record" },
  { key: "object_cat_metal",        label: "Metal",         tag: "metal" },
  { key: "object_cat_tool",         label: "Tool",          tag: "tool" },
  { key: "object_cat_apparel",      label: "Apparel",       tag: "apparel" },
  { key: "object_cat_structure",    label: "Structure",     tag: "structure" },
  { key: "object_cat_vehicle",      label: "Vehicle",       tag: "vehicle" },
  { key: "object_cat_landscape",    label: "Landscape",     tag: "landscape" },
  { key: "object_cat_armor",        label: "Armor",         tag: "armor" },
  { key: "object_cat_treasure",     label: "Treasure",      tag: "treasure" },
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

export const specificityChips = [
  { key: "spec_specific", label: "Named",   tag: "specific" },
  { key: "spec_general",  label: "Generic", tag: "general"  },
];

export const usageChips = [
  { key: "usage_literal",       label: "Literal",     tag: "literal" },
  { key: "usage_mixed",         label: "Mixed",       tag: "mixed" },
  { key: "usage_metaphorical",  label: "Symbolic",    tag: "metaphorical" },
];

export const filterAxes = [
  { name: "category",    title: "object_axis_category",    chips: categoryChips,    titleEn: "Category" },
  { name: "era",         title: "object_axis_era",         chips: eraChips,         titleEn: "Era" },
  { name: "provenance",  title: "object_axis_provenance",  chips: provenanceChips,  titleEn: "Provenance" },
  { name: "specificity", title: "object_axis_specificity", chips: specificityChips, titleEn: "Specificity" },
  { name: "usage",       title: "object_axis_usage",       chips: usageChips,       titleEn: "Usage" },
];
