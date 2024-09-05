import { lazy } from "react";
import { determineLanguage } from "./Utils.js";
// COMPONENTS
const About = lazy(() => import("../views/About/About.js"));
const KRSEB = lazy(() => import("../views/About/KRSEB.js"));
const Facsimiles = lazy(() => import("../views/Facsimiles/Facsimiles.js"));
const Contact = lazy(() => import("../views/Contact/Contact.js"));
const User = lazy(() => import("../views/User/User.js"));
const People = lazy(() => import("../views/People/People.js"));
const Places = lazy(() => import("../views/Places/Places.js"));
const Map = lazy(() => import("../views/Map/Map.js"));
const PeopleNetWork = lazy(() => import("../views/People/PeopleNetwork.js"));
const TimeLine = lazy(() => import("../views/Timeline/Timeline.js"));
const Contents = lazy(() => import("../views/Contents/Contents.js"));
const SearchComponent = lazy(() => import("../views/Search/Search.js"));
const Home = lazy(() => import("../views/Home/Home.js"));
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
    component: (!lang || lang === "en") ? Welcome : Home,
  },
  {
    exact: true,
    path: "/home",
    component: Home,
  },
  {
    path: "/home/:channelId/:messageId(\\d+)",
    component: Home,
  },
  {
    path: "/home/:channelId",
    component: Home,
  },
  {
    path: "/groups",
    component: Group,
  },
  {
    path: "/group/:channelId/:messageId(\\d+)",
    component: Group,
  },
  {
    path: "/group/:channelId/:leaderboard",
    component: Group,
  },
  {
    path: "/group/:channelId",
    component: Group,
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
    component: Invitation,
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
    path: "/places/:placeName",
    component: Places,
  },
  {
    path: "/places",
    component: Places,
  },
  {
    path: "/timeline/:markerSlug",
    component: TimeLine,
  },
  {
    path: "/timeline",
    component: TimeLine,
  },
  {
    path: "/map/:mapType/place/:placeName",
    component: Map,
  },
  // {
  //   path: "/map/place/:mapType",
  //   component: Map,
  // },
  {
    path: "/map/:mapType",
    component: Map,
  },
  {
    path: "/maps",
    component: Map,
  },
  {
    path: "/map",
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
