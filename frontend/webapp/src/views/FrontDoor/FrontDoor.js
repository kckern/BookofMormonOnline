import React, { lazy, useState } from "react";
import features from "../../config/features.generated.json";
import { useAppController } from "src/contexts/AppControllerContext";
import { frontDoorView, readChapterRef } from "./frontDoorView";

const Home = lazy(() => import("../Home/Home.js"));
const ReadScripture = lazy(() => import("../Read/Read.js"));

// The view is decided once per mount, from storage, before first paint: no
// redirect hop, the URL stays "/", and Back leaves the site as usual.
export default function FrontDoor() {
  const appController = useAppController();
  const [view] = useState(() =>
    frontDoorView({
      enabled: !!features.frontDoor?.firstVisitDiscover,
      signedIn: !!appController.states?.user?.user,
      chapterRef: readChapterRef(window.localStorage),
    })
  );
  return view === "discover" ? <Home /> : <ReadScripture />;
}
