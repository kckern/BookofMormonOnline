import PeopleTile from "./PeopleTile";
import PlacesTile from "./PlacesTile";
import FaxTile from "./FaxTile";
import CommentaryTile from "./CommentaryTile";
import ContentsTile from "./ContentsTile";
import NarrationTile from "./NarrationTile";
import ReadingPlanTile from "./ReadingPlanTile";
import SpotlightTile from "./SpotlightTile";
import ActivityTile from "./ActivityTile";

/**
 * Sampler tile registry. Adding a tile type:
 *   1. backend: field on HomeSampler + sampler fn (homesampler.ts)
 *   2. add the field to the homesampler query in GraphQLQueries.js
 *   3. write a tile component in this directory
 *   4. append an entry here — key must match the payload field
 * span is a CSS class in Sampler.css controlling the grid footprint (col- and
 * row-spans). Render ORDER is shuffled per load (Sampler.js) and packed by
 * grid-auto-flow: dense, so entries here carry no layout order.
 */
export const tileRegistry = [
  { key: "people",      component: PeopleTile,      span: "tile-people",      isReady: (p) => p?.people?.length > 0 },
  { key: "places",      component: PlacesTile,      span: "tile-places",      isReady: (p) => p?.places?.length > 0 },
  { key: "readingplan", component: ReadingPlanTile, span: "tile-readingplan", isReady: () => true },
  { key: "fax",         component: FaxTile,         span: "tile-fax",         isReady: (p) => !!p?.fax },
  { key: "commentary",  component: CommentaryTile,  span: "tile-commentary",  isReady: (p) => !!p?.commentary },
  { key: "contents",    component: ContentsTile,    span: "tile-contents",    isReady: (p) => !!p?.contents },
  { key: "section",     component: NarrationTile,   span: "tile-narration",   isReady: (p) => p?.section?.rows?.some?.((r) => r?.narration) },
  { key: "spotlight",   component: SpotlightTile,   span: "tile-spotlight",   isReady: (p) => !!p?.spotlight },
  { key: "activity",    component: ActivityTile,    span: "tile-activity",    isReady: (p) => p?.activity?.length > 0 },
];
