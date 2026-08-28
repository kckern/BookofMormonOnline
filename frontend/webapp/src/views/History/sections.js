/** @format */
// Single source of truth for the /history sections. Order = display order in the
// hub (JS → Witnesses → Translation → Reception → Lost Pages → JS in New York).
// Reorder here.
import { assetUrl } from "src/models/BoMOnlineAPI";
import receptionIcon from "src/views/_Common/svg/history.svg";
import witnessIcon from "src/views/People/svg/group.svg";
import translationIcon from "src/views/_Common/svg/book.svg";
import josephIcon from "src/views/People/svg/prophet.svg";
import newYorkIcon from "src/views/_Common/svg/map-pin.svg";

const person = (slug) => `${assetUrl}/history/witnesses/people/${slug}.jpg`;

export const HISTORY_SECTIONS = [
  {
    key: "josephSmith",
    title: "Joseph Smith",
    path: "/history/joseph-smith",
    icon: josephIcon,
    blurb: "Statements by Joseph Smith about the Book of Mormon.",
    unit: "statements",
    status: "live",
    hero: { type: "image", src: person("joseph-smith") },
  },
  {
    key: "witnesses",
    title: "The Witnesses",
    path: "/history/witnesses",
    icon: witnessIcon,
    blurb: "Those who testified they saw and handled the plates.",
    unit: "witnesses",
    status: "live",
    // top third: the Three (triptych); bottom two-thirds: the Eight (4×2 grid)
    hero: {
      type: "witnesses",
      three: [person("oliver-cowdery"), person("david-whitmer"), person("martin-harris")],
      eight: [
        person("john-whitmer"), person("jacob-whitmer"), person("christian-whitmer"), person("peter-whitmer-jr"),
        person("hiram-page"), person("joseph-smith-sr"), person("samuel-smith"), person("hyrum-smith"),
      ],
    },
    // static signal — no archive fetch
    signal: "22 WITNESSES · THREE, EIGHT & OTHERS",
  },
  {
    key: "translation",
    title: "Translation Process",
    path: "/history/translation",
    icon: translationIcon,
    blurb: "How the Book of Mormon was brought forth and rendered into English.",
    unit: "documents",
    status: "live",
    // Translation docs have no thumbnails — icon placeholder on the paper field
    hero: { type: "placeholder", icon: translationIcon },
    archive: "translation",
  },
  {
    key: "reception",
    title: "Reception History",
    path: "/history/reception",
    icon: receptionIcon,
    blurb: "How the book was reviewed, attacked, and defended in its own day.",
    unit: "documents",
    status: "live",
    hero: { type: "randomThumb", archive: "reception" },
    archive: "reception",
  },
  {
    key: "lostPages",
    title: "The Lost 116 Pages",
    path: "/history/lost-116-pages",
    icon: translationIcon,
    blurb: "Primary sources on what the lost manuscript contained.",
    unit: "sources",
    status: "live",
    // No facsimiles on this archive (spec: 2026-08-18-lost-116-pages-archive) —
    // placeholder hero, same as translation.
    hero: { type: "placeholder", icon: translationIcon },
    archive: "lost-116-pages",
  },
  {
    key: "nyPa1820s",
    title: "New York & Pennsylvania, 1820s",
    path: "/history/1820s-ny-pa",
    icon: josephIcon,
    blurb: "Primary sources on Joseph Smith in New York and Pennsylvania, to April 1830.",
    unit: "sources",
    status: "live",
    hero: { type: "placeholder", icon: josephIcon },
    archive: "1820s-ny-pa",
  },
  {
    key: "josephNewYork",
    title: "Joseph Smith in New York",
    path: "/history/joseph-smith-new-york",
    icon: newYorkIcon,
    blurb: "The prophet's early years and the coming forth of the record in New York.",
    unit: "documents",
    status: "placeholder",
    hero: { type: "placeholder", icon: newYorkIcon },
  },
];

export const getSection = (key) =>
  HISTORY_SECTIONS.find((s) => s.key === key) || null;

export const pickRandom = (arr) =>
  Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
