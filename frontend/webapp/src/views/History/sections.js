/** @format */
// Single source of truth for the /history sections. Order = display order in the
// hub = the "priority" call (narrative: coming-forth → aftermath). Reorder here.
import receptionIcon from "src/views/_Common/svg/history.svg";
import witnessIcon from "src/views/People/svg/group.svg";
import translationIcon from "src/views/_Common/svg/book.svg";
import josephIcon from "src/views/People/svg/prophet.svg";

export const HISTORY_SECTIONS = [
  {
    key: "translation",
    title: "Translation Sources",
    path: "/history/translation",
    icon: translationIcon,
    blurb: "How the Book of Mormon was brought forth and rendered into English.",
    status: "live",
  },
  {
    key: "witnesses",
    title: "The Witnesses",
    path: "/history/witnesses",
    icon: witnessIcon,
    blurb: "The three, the eight, and others who testified of the plates.",
    status: "live",
  },
  {
    key: "reception",
    title: "Reception History",
    path: "/history/reception",
    icon: receptionIcon,
    blurb: "How the book was reviewed, attacked, and defended in its own day.",
    status: "live",
  },
  {
    key: "josephSmith",
    title: "Joseph Smith",
    path: "/history/joseph-smith",
    icon: josephIcon,
    blurb: "The life and work of the translator.",
    status: "live",
  },
];

export const getSection = (key) =>
  HISTORY_SECTIONS.find((s) => s.key === key) || null;

export const pickRandom = (arr) =>
  Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
