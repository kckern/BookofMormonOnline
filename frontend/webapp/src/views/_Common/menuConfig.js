// Menu configuration with language restrictions
// 
// Configuration options:
// - slug: The route slug for the menu item
// - labelKey: The translation key for the menu item label (null for custom titles)
// - customTitle: Custom title text (for items like "특별반")
// - lang: Array of language codes where this item should be shown (whitelist)
// - langNot: Array of language codes where this item should NOT be shown (blacklist)
// - dev: Only show in development environment (localhost or dev domains)
// - beta: Show beta badge next to the item
//
export const menuConfig = [
  {
    slug: "home",
    labelKey: "menu_home",
  },
  {
    slug: "contents",
    labelKey: "menu_contents",
  },
  {
    slug: "study",
    labelKey: "menu_study",
  },
  {
    slug: "read",
    labelKey: "menu_read",
    lang: ["en", "fr", "tr", "ko", "covoc", "slv", "es", "ru"],
  },
  {
    slug: "특별반",
    labelKey: null, // Custom title, no label key
    customTitle: "특별반",
    lang: ["ko"],
  },
  {
    slug: "theater",
    labelKey: "menu_theater",
    langNot: ["tr"],
  },
  {
    slug: "timeline",
    labelKey: "menu_timeline",
  },
  {
    slug: "people",
    labelKey: "menu_people",
  },
  // Commented out in original - uncomment by removing the comments below
  // {
  //   slug: "relationships",
  //   labelKey: "menu_network",
  //   dev: true,
  // },
  {
    slug: "places",
    labelKey: "menu_places",
  },
  {
    slug: "map",
    labelKey: "menu_map",
  },
  {
    slug: "fax",
    labelKey: "menu_fax",
    lang: ["en", "ko"],
  },
  {
    slug: "history",
    labelKey: "menu_history",
    lang: ["en"],
  },
  {
    slug: "analysis",
    labelKey: "menu_analysis",
    beta: true,
    lang: ["en"],
  },
  {
    slug: "about",
    labelKey: "menu_about",
  },
  {
    slug: "audit",
    labelKey: "menu_audit",
    langNot: ["en", "covoc"],
  },
];
