import PeopleTile from "./PeopleTile";
import TextTile from "./TextTile";
import PlacesTile from "./PlacesTile";
import FaxTile from "./FaxTile";
import HistoryTile from "./HistoryTile";
import CommentaryTile from "./CommentaryTile";
import ContentsTile from "./ContentsTile";
import NarrationTile from "./NarrationTile";
import ReadingPlanTile from "./ReadingPlanTile";
import CommunityTile from "./CommunityTile";
import BiblePhrasesTile from "./BiblePhrasesTile";
import ChiasmusTile from "./ChiasmusTile";
import ImageArtTile from "./ImageArtTile";
import NotesTile from "./NotesTile";
import FaxVerseTile from "./FaxVerseTile";
import MapStoryTile from "./MapStoryTile";
import PersonProfileTile from "./PersonProfileTile";
import PlaceProfileTile from "./PlaceProfileTile";
import WitnessTile from "./WitnessTile";
import MapTile from "./MapTile";

/**
 * Sampler tile registry. Adding a tile type:
 *   1. backend: field on HomeSampler + sampler fn (homesampler.ts)
 *   2. add the field to the homesampler query in GraphQLQueries.js
 *   3. write a tile component in this directory
 *   4. append an entry here — key must match the payload field
 * span is a CSS class in Sampler.css controlling the grid footprint (col- and
 * row-spans). ORDER IS LAYOUT: the left rail (Sampler.js LEFT_KEYS) holds
 * narration, contents, community + activity; people spans the grid top, the
 * rest pairs beneath (text-with-text, visual-with-visual for balanced rows).
 *
 * This module is the SINGLE registry. Besides `tileRegistry` (the default grid)
 * it also exports `reservePool` (balancer fill tiles) and `batchTiles`
 * (infinite-scroll tiles) — see their definitions below. `personProfile`,
 * `placeProfile`, `witness`, and `map` live ONLY in those pools, not in the
 * default rotation, so add such tiles to the matching pool here.
 */
export const tileRegistry = [
  { key: "readingplan", component: ReadingPlanTile, span: "tile-readingplan", isReady: () => true },
  { key: "section",     component: NarrationTile,   span: "tile-narration",   isReady: (p) => p?.section?.rows?.some?.((r) => r?.narration) },
  { key: "contents",    component: ContentsTile,    span: "tile-contents",    isReady: (p) => !!p?.contents },
  { key: "community",   component: CommunityTile,   span: "tile-community",   isReady: (p) => !!p?.community },
  { key: "people",      component: PeopleTile,      span: "tile-people",      isReady: (p) => p?.people?.length > 0 },
  { key: "text",        component: TextTile,        span: "tile-text",        isReady: (p) => !!p?.text },
  { key: "commentary",  component: CommentaryTile,  span: "tile-commentary",  isReady: (p) => !!p?.commentary },
  { key: "commentary2", component: CommentaryTile,  span: "tile-commentary",  isReady: (p) => !!p?.commentary2 },
  { key: "commentary3", component: CommentaryTile,  span: "tile-commentary",  isReady: (p) => !!p?.commentary3 },
  { key: "history",     component: HistoryTile,     span: "tile-history",     isReady: (p) => !!p?.history },
  { key: "fax",         component: FaxTile,         span: "tile-fax",         isReady: (p) => !!p?.fax },
  { key: "places",      component: PlacesTile,      span: "tile-places",      isReady: (p) => p?.places?.length > 0 },
  // biblephrases + chiasmus fetch their own data client-side (seeded off
  // payload.seed) — no homesampler field, so they're always "ready".
  { key: "biblephrases", component: BiblePhrasesTile, span: "tile-biblephrases", isReady: () => true },
  { key: "chiasmus",    component: ChiasmusTile,    span: "tile-chiasmus",    isReady: () => true },
  // one standalone artwork in the default rotation; more are held in reserve
  { key: "art",         component: ImageArtTile,    span: "tile-art",         isReady: (p) => (p?.art?.length || 0) > 0 },
  { key: "notes",       component: NotesTile,       span: "tile-notes",       isReady: (p) => (p?.notes?.length || 0) > 0 },
  { key: "faxVerse",   component: FaxVerseTile,    span: "tile-faxVerse",    isReady: (p) => !!p?.faxVerse?.page },
  { key: "mapstory",    component: MapStoryTile,    span: "tile-mapstory",    isReady: (p) => (p?.mapstory?.moves?.length || 0) >= 2 },
];

/**
 * Reserve tiles: NOT part of the default rotation. Sampler's balancer measures
 * the left rail against the masonry and inserts these onto the shorter side
 * until the columns bottom out together. Cheap/relevant first; the map (heavy,
 * lazy) last and always into the masonry (below the fold). `mainOnly` forces a
 * tile into the masonry; `props` are passed through; `dataKey`/`seedOffset` are
 * read by Sampler's renderReserve.
 */
export const reservePool = [
  { key: "personProfile", component: PersonProfileTile, isReady: (p) => (p?.people?.length || 0) > 14 },
  { key: "witness",       component: WitnessTile,       dataKey: "witnesses", isReady: (p) => (p?.witnesses?.length || 0) > 0 },
  { key: "placeProfile",  component: PlaceProfileTile,  isReady: (p) => (p?.places?.length || 0) > 11 },
  { key: "artFill1",      component: ImageArtTile,      props: { artIndex: 1 }, isReady: (p) => (p?.art?.length || 0) > 1 },
  { key: "chiasmus2",     component: ChiasmusTile,      props: { seed: 0 }, seedOffset: 97, isReady: () => true },
  { key: "artFill2",      component: ImageArtTile,      props: { artIndex: 2 }, isReady: (p) => (p?.art?.length || 0) > 2 },
  { key: "map",           component: MapTile,           isReady: () => true, mainOnly: true },
];

// Infinite-scroll batch tiles: the repeatable content types re-sampled under a
// fresh seed as the reader nears the bottom. Fixed/live tiles (reading plan,
// narration, contents, community) are excluded — they render once.
const INFINITE_REGISTRY_KEYS = ["art", "commentary", "commentary2", "commentary3", "history", "fax", "faxVerse", "places", "biblephrases", "chiasmus", "text", "notes"];
export const batchTiles = [
  ...tileRegistry
    .filter((t) => INFINITE_REGISTRY_KEYS.includes(t.key))
    .map((t) => ({ key: t.key, component: t.component, isReady: t.isReady, span: t.span })),
  { key: "personProfile", component: PersonProfileTile, isReady: (p) => (p?.people?.length || 0) > 0, span: "tile-personProfile" },
  { key: "placeProfile",  component: PlaceProfileTile,  isReady: (p) => (p?.places?.length || 0) > 0, span: "tile-placeProfile" },
  { key: "witness",       component: WitnessTile, dataKey: "witnesses", isReady: (p) => (p?.witnesses?.length || 0) > 0, span: "tile-witness" },
  { key: "artB",          component: ImageArtTile, props: { artIndex: 1 }, isReady: (p) => (p?.art?.length || 0) > 1, span: "tile-art" },
];
