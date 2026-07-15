import { lazy } from "react";
import { isMessengerEnabled } from './featureFlags';
import { determineLanguage } from "./Utils.js";
import { Redirect, useParams } from "react-router-dom";

// Feature flag - messaging disabled until Phase 5 data migration
const USE_MESSENGER = isMessengerEnabled();

// Redirect component for disabled routes
const DisabledRedirect = () => <Redirect to="/" />;

// Legacy /home/:channelId(/:messageId) deep links now live under /community.
const HomeChannelRedirect = () => {
  const { channelId, messageId } = useParams();
  return <Redirect to={`/community/${channelId}${messageId ? `/${messageId}` : ""}`} />;
};

// COMPONENTS
const About = lazy(() => import("../views/About/About.js"));
const KRSEB = lazy(() => import("../views/About/KRSEB.js"));
const Facsimiles = lazy(() => import("../views/Facsimiles/Facsimiles.js"));
const Contact = lazy(() => import("../views/Contact/Contact.js"));
const User = lazy(() => import("../views/User/User.js"));
const People = lazy(() => import("../views/People/People.js"));
const Places = lazy(() => import("../views/Places/Places.js"));
const Objects = lazy(() => import("../views/Objects/Objects.js"));
const Map = lazy(() => import("../views/Map/Map.js"));
const PeopleNetWork = lazy(() => import("../views/People/PeopleNetwork.js"));
const TimeLine = lazy(() => import("../views/Timeline/Timeline.js"));
const Contents = lazy(() => import("../views/Contents/Contents.js"));
const SearchComponent = lazy(() => import("../views/Search/Search.js"));
const Sampler = lazy(() => import("../views/Home/Sampler.js"));
const Community = lazy(() => import("../views/Home/Community.js"));
const Page = lazy(() => import("../views/Page/Page.js"));
const Analysis = lazy(() => import("../views/Analysis/Analysis.js"));
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
const ReadScripture = lazy(() => import("../views/Read/Read.js"));
const lang = determineLanguage();


const routes = [
  {
    exact: true,
    path: "/",
    component: (!lang || lang === "en") ? ReadScripture : ReadScripture,
  },
  {
    // /home — the tile "sampler" explore page (design: docs/plans/2026-07-15-home-sampler-redesign-design.md)
    exact: true,
    path: "/home",
    component: Sampler,
  },
  {
    path: "/home/:channelId/:messageId(\\d+)",
    component: HomeChannelRedirect,
  },
  {
    path: "/home/:channelId",
    component: HomeChannelRedirect,
  },
  {
    exact: true,
    path: "/community",
    component: Community,
  },
  {
    path: "/community/:channelId/:messageId(\\d+)",
    component: Community,
  },
  {
    path: "/community/:channelId",
    component: Community,
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
    path: "/analysis",
    component: Analysis,
  },
  {
    path: "/contact",
    component: Contact,
  },
  {
  path: "/user/signup",
    component: User,
  },
  {
    path: "/user/:value",
    component: User,
  },
  {
    path: "/user",
    component: User,
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
    path: "/history/:slug",
    component: History,
  },
  {
    path: "/history",
    component: History,
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
    path: "/objects/:objectSlug",
    component: Objects,
  },
  {
    path: "/objects",
    component: Objects,
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
