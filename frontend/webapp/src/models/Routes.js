import { lazy } from "react";
import { isMessengerNavigationEnabled } from './featureFlags';
import { determineLanguage } from "./Utils.js";
import { Navigate, useParams } from "react-router-dom";

// Feature flag - messaging disabled until Phase 5 data migration
const USE_MESSENGER = isMessengerNavigationEnabled();

// Navigate component for disabled routes
const DisabledRedirect = () => <Navigate to="/" />;

// Legacy /community/* and /user/* now live under the unified Home.
export const CommunityRedirect = () => {
  const { channelId, messageId } = useParams();
  const tail = channelId ? `/${channelId}${messageId ? `/${messageId}` : ""}` : "";
  return <Navigate to={`/home/community${tail}`} />;
};
export const UserRedirect = () => {
  const { value } = useParams();
  return <Navigate to={`/home/user${value ? `/${value}` : ""}`} />;
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
const ResetPassword = lazy(() => import("../views/User/ResetPassword.js"));
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
const NyPa1820s = lazy(() => import("../views/History/NyPa1820s.js"));
const ReadScripture = lazy(() => import("../views/Read/Read.js"));
const EntityPage = lazy(() => import("../views/Entity/EntityPage"));
const ArtPage = lazy(() => import("../views/Entity/ArtPage"));
const lang = determineLanguage();


const routes = [
  {
    exact: true,
    path: "/",
    component: (!lang || lang === "en") ? ReadScripture : ReadScripture,
  },
  {
    // Unified tabbed Home: /home (Explore), /home/community, /home/user.
    // Splat so the Home shell handles all sub-paths. v5 achieved this by being
    // non-exact; v7 matches "/home" exactly, which left /home/user and friends
    // falling through to the page catch-all. (spec:
    // docs/specs/2026-07-17-unified-tabbed-home.md)
    path: "/home/*",
    component: Home,
  },
  // Legacy redirects into the unified Home (most specific first).
  {
    path: "/community/:channelId/:messageId",
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
    path: "/reset-password",
    component: ResetPassword,
  },
  {
    path: "/groups",
    component: USE_MESSENGER ? Group : DisabledRedirect,
  },
  {
    path: "/group/:channelId/:messageId",
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
    path: "/welcome/*",
    component: Welcome,
  },
  {
    path: "/fax/:faxVersion/:pageNumber",
    component: Facsimiles,
  },
  {
    path: "/fax/*",
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
    path: "/theater/*",
    component: Theater,
  },
  {
    path: "/audit/*",
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
    path: "/analysis/*",
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
      path: "/history/1820s-ny-pa",
      component: NyPa1820s,
  },
  {
      // The document itself, matching what SSR has always meant by this URL
      // (frontend/next/app/history/[slug]/page.tsx). Archive doc slugs are
      // shared across all four archives, but setSlug always pushes
      // /history/<slug>, so the old redirect landed a witnesses or
      // translation doc under the RECEPTION hub.
      path: "/history/:slug",
      component: () => <EntityPage type="history" />,
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
    component: () => <EntityPage type="people" />,
  },
  {
    path: "/people",
    component: People,
  },
  {
    path: "/place/:placeName",
    component: () => <EntityPage type="places" />,
  },
  {
    path: "/places/:placeName",
    component: () => <EntityPage type="places" />,
  },
  {
    path: "/places",
    component: Places,
  },
  {
    path: "/matters/:matterSlug",
    component: () => <EntityPage type="matters" />,
  },
  {
    path: "/matters",
    component: Matters,
  },
  {
    // Single Route (path array, specific first) so <Routes> never unmounts
    // TimeLine when opening/closing the info-box (/timeline ↔ /timeline/:slug).
    // Otherwise the whole grid remounts on every modal toggle, discarding the
    // memoized fill layer and scroll position.
    path: "/timeline/*",
    component: TimeLine,
  },
  {
    // Was one element of the v5 path array; "/map/*" does not match "/maps",
    // so it needs its own entry or it falls through to the page catch-all.
    path: "/maps",
    component: Map,
  },
  {
    // Single Route for all map URLs so <Routes> never unmounts Map when
    // navigating between place/story/event/move variants. Order matters:
    // path-to-regexp tries each in turn, so more specific patterns come first.
    path: "/map/*",
    component: Map,
  },
  {
    path: "/commentary/:commentaryId",
    component: Page,
  },
  {
    path: "/image/:imageId",
    component: ArtPage,
    exact: true,
  },
  {
    path: "/art/:imageId",
    component: ArtPage,
    exact: true,
  },
  {
    // Catch-all for scripture pages, text blocks and facsimile views:
    //   /<slug...>              -> page
    //   /<slug...>/<n>          -> text block
    //   /<slug...>/<n>/fax/<v>  -> facsimile
    // v7 cannot express v5's ":pageSlug+/:textId(\\d+)" — it has no
    // multi-segment params and no regex — and the slug genuinely can be several
    // segments (the Next SSR classifier calls it "leading segments" and reads a
    // numeric tail as a text block). So one splat replaces all three entries and
    // Page derives pageSlug/textId/faxVersion with parsePagePath(). v7 ranks a
    // splat LAST and picks the best match rather than the first, so this cannot
    // shadow the explicit routes above.
    path: "*",
    component: Page,
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
