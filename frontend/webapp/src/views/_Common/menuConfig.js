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
// - requiresMessenger: Only show when REACT_APP_USE_MESSENGER is true
//

// Note: menu items carry `requiresMessenger`; the actual gate is applied by the
// consumer (Sidebar) via isMessengerEnabled() — no flag needed in this config file.

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
    langNot: ["tr", "slv"]
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
    slug: "theology",
    labelKey: "menu_theology",
    lang: ["en"],
    dev: true, // placeholder — hidden on public URLs, visible on localhost/dev while it's built out
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
