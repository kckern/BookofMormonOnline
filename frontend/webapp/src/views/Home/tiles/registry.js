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
];
