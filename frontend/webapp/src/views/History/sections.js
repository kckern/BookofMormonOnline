/** @format */
// Single source of truth for the /history sections. Order = display order in the
// hub (JS → Witnesses → Translation → Reception). Reorder here.
import { assetUrl } from "src/models/BoMOnlineAPI";
import receptionIcon from "src/views/_Common/svg/history.svg";
import witnessIcon from "src/views/People/svg/group.svg";
import translationIcon from "src/views/_Common/svg/book.svg";
import josephIcon from "src/views/People/svg/prophet.svg";

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
    // radial 3-wedge pie, vertex @ 50%/38% (see HistoryHub.css .pie)
    hero: {
      type: "pie",
      srcs: [person("oliver-cowdery"), person("david-whitmer"), person("martin-harris")],
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
];

export const getSection = (key) =>
  HISTORY_SECTIONS.find((s) => s.key === key) || null;

export const pickRandom = (arr) =>
  Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
