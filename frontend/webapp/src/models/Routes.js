import { lazy } from "react";
import { isMessengerEnabled } from './featureFlags';
import { determineLanguage } from "./Utils.js";
import { Redirect, useParams } from "react-router-dom";

// Feature flag - messaging disabled until Phase 5 data migration
const USE_MESSENGER = isMessengerEnabled();

// Redirect component for disabled routes
const DisabledRedirect = () => <Redirect to="/" />;

// Legacy /community/* and /user/* now live under the unified Home.
export const CommunityRedirect = () => {
  const { channelId, messageId } = useParams();
  const tail = channelId ? `/${channelId}${messageId ? `/${messageId}` : ""}` : "";
  return <Redirect to={`/home/community${tail}`} />;
};
export const UserRedirect = () => {
  const { value } = useParams();
  return <Redirect to={`/home/user${value ? `/${value}` : ""}`} />;
};

// COMPONENTS
const About = lazy(() => import("../views/About/About.js"));
const KRSEB = lazy(() => import("../views/About/KRSEB.js"));
const Facsimiles = lazy(() => import("../views/Facsimiles/Facsimiles.js"));
const Contact = lazy(() => import("../views/Contact/Contact.js"));
const Home = lazy(() => import("../views/Home/Home.js"));
const People = lazy(() => import("../views/People/People.js"));
const Places = lazy(() => import("../views/Places/Places.js"));
const Matters = lazy(() => import("../views/Matters/Matters.js"));
const Map = lazy(() => import("../views/Map/Map.js"));
const PeopleNetWork = lazy(() => import("../views/People/PeopleNetwork.js"));
const TimeLine = lazy(() => import("../views/Timeline/Timeline.js"));
const Contents = lazy(() => import("../views/Contents/Contents.js"));
const SearchComponent = lazy(() => import("../views/Search/Search.js"));
const Page = lazy(() => import("../views/Page/Page.js"));
const Analysis = lazy(() => import("../views/Analysis/Analysis.js"));
const Theology = lazy(() => import("../views/Theology/Theology.js"));
const History = lazy(() => import("../views/History/History.js"));
const Invitation = lazy(() => import("../views/User/Invitation.js"));
const MobileGroups = lazy(() => import("../views/_Common/Study/Mobile/MobileStudy.js"));
const MobileMenu = lazy(() => import("../views/_Common/MobileMenu.js"));
const Group = lazy(() => import("../views/_Common/Group.js"));
const Theater = lazy(() => import("../views/Theater/Theater.js"));
const Welcome = lazy(() => import("../views/Welcome/Welcome.js"));
const Audit = lazy(() => import("../views/Audit/Audit.js"));
const Witnesses = lazy(() => import("../views/History/Witnesses.js"));
const JosephSmith = lazy(() => import("../views/History/JosephSmith.js"));
const HistoryHub = lazy(() => import("../views/History/HistoryHub.jsx"));
const TranslationSources = lazy(() => import("../views/History/TranslationSources.jsx"));
const LostPages = lazy(() => import("../views/History/LostPages.js"));
const RedirectReceptionSlug = lazy(() => import("../views/History/RedirectReceptionSlug.jsx"));
const ReadScripture = lazy(() => import("../views/Read/Read.js"));
const lang = determineLanguage();


const routes = [
  {
    exact: true,
    path: "/",
    component: (!lang || lang === "en") ? ReadScripture : ReadScripture,
  },
  {
    // Unified tabbed Home: /home (Explore), /home/community, /home/user.
    // Non-exact so the Home shell handles all sub-paths. (spec:
    // docs/specs/2026-07-17-unified-tabbed-home.md)
    path: "/home",
    component: Home,
  },
  // Legacy redirects into the unified Home (most specific first).
  {
    path: "/community/:channelId/:messageId(\\d+)",
    component: CommunityRedirect,
  },
  {
    path: "/community/:channelId",
    component: CommunityRedirect,
  },
  {
    exact: true,
    path: "/community",
    component: CommunityRedirect,
  },
  {
    path: "/groups",
    component: USE_MESSENGER ? Group : DisabledRedirect,
  },
  {
    path: "/group/:channelId/:messageId(\\d+)",
    component: USE_MESSENGER ? Group : DisabledRedirect,
  },
  {
    path: "/group/:channelId/:leaderboard",
    component: USE_MESSENGER ? Group : DisabledRedirect,
  },
  {
    path: "/group/:channelId",
    component: USE_MESSENGER ? Group : DisabledRedirect,
  },
  {
    path: "/mobilemenu",
    component: MobileMenu,
  },
  {
    path: "/contents",
    component: Contents,
  },
  {
    path: "/welcome",
    component: Welcome,
  },
  {
    path: "/welcome/:welcomeId+",
    component: Welcome,
  },
  {
    path: "/fax/:faxVersion/:pageNumber",
    component: Facsimiles,
  },
  {
    path: "/fax/:faxVersion+",
    component: Facsimiles,
  },
  {
    path: "/fax",
    component: Facsimiles,
  },
  {
    path: "/about/:value",
    component: About,
  },
  {
    path: "/about",
    component: About,
  },
  {
    path: "/read/:bookCh?/:verseNum?",
    component: ReadScripture,
  },
  {
    path: "/theater/:slug*",
    component: Theater,
  },
  {
    path: "/audit/:key*",
    component: Audit,
  },
  {
    path: "/studyedition",
    component: KRSEB,
  },
  {
    path: "/특별반",
    component: KRSEB,
  },
  {
    path: "/analysis/:value*",
    component: Analysis,
  },
  {
    path: "/theology",
    component: Theology,
  },
  {
    path: "/analysis",
    component: Analysis,
  },
  {
    path: "/contact",
    component: Contact,
  },
  {
    path: "/user/:value",
    component: UserRedirect,
  },
  {
    exact: true,
    path: "/user",
    component: UserRedirect,
  },
  {
    path: "/study/:value",
    component: SearchComponent,
  },
  {
    path: "/search/:value",
    component: SearchComponent,
  },
  {
    path: "/search",
    component: SearchComponent,
  },
  {
      path: "/history/witnesses/:witness?/:source?",
      component: Witnesses,
  },
  {
      path: "/history/joseph-smith",
      component: JosephSmith,
  },
  {
      path: "/history/translation",
      component: TranslationSources,
  },
  {
      path: "/history/reception/:slug?",
      component: History,
  },
  {
      path: "/history/lost-116-pages",
      component: LostPages,
  },
  {
      path: "/history/:slug",
      component: RedirectReceptionSlug,
  },
  {
      path: "/history",
      component: HistoryHub,
  },
  {
    path: "/invite/:hash",
    component: USE_MESSENGER ? Invitation : DisabledRedirect,
  },
  {
    path: "/relationships",
    component: PeopleNetWork,
  },
  {
    path: "/people/:personName",
    component: People,
  },
  {
    path: "/people",
    component: People,
  },
  {
    path: "/place/:placeName",
    component: Places,
  },
  {
    path: "/places/:placeName",
    component: Places,
  },
  {
    path: "/places",
    component: Places,
  },
  {
    path: "/matters/:matterSlug",
    component: Matters,
  },
  {
    path: "/matters",
    component: Matters,
  },
  {
    // Single Route (path array, specific first) so <Switch> never unmounts
    // TimeLine when opening/closing the info-box (/timeline ↔ /timeline/:slug).
    // Otherwise the whole grid remounts on every modal toggle, discarding the
    // memoized fill layer and scroll position.
    path: ["/timeline/:markerSlug", "/timeline"],
    component: TimeLine,
  },
  {
    // Single Route for all map URLs so <Switch> never unmounts Map when
    // navigating between place/story/event/move variants. Order matters:
    // path-to-regexp tries each in turn, so more specific patterns come first.
    path: [
      "/map/:mapType/story/:storySlug/move/:moveSeq(\\d+)",
      "/map/:mapType/story/:storySlug",
      "/map/:mapType/event/:storySlug/move/:moveSeq(\\d+)",
      "/map/:mapType/event/:storySlug",
      "/map/:mapType/place/:placeName",
      "/map/:mapType",
      "/maps",
      "/map",
    ],
    component: Map,
  },
  {
    path: "/commentary/:commentaryId(\\d+)",
    component: Page,
  },
  {
    path: "/image/:imageId(\\d+)",
    component: Page,
    exact: true,
  },
  {
    path: "/art/:imageId(\\d+)",
    component: Page,
    exact: true,
  },
  {
    path: "/:pageSlug+/:textId(\\d+)/fax/:faxVersion+",
    component: Page,
  },
  {
    path: "/:pageSlug+/:textId(\\d+)",
    component: Page,
  },
  {
    path: "/:pageSlug+",
    component: Page,
    exact: true,
  },


  // {
  //      component: TextPageComponent
  // },
  // {
  //      component: TextPageComponent
  // },
  // {
  //      component: TextPageComponent
  // },
  // {
  //      component: TextPageComponent
  // },
];

export default routes;
