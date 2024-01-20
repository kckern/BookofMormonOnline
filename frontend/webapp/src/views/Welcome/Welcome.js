import React, { Suspense, useEffect, useMemo } from "react";
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory } from "react-router-dom";
import validWelcomes from "./_list.js";
import "./Welcome.css";
import Home from "../Home/Home.js";

export default function  Welcome({appController})
{

    //TODO: if logged in and path is root ("/") then redirect to community
    const [ready, setReady] = React.useState(false);
    const isLoggedIn = !! appController.states?.user?.user;
    const shouldShowHome = isLoggedIn && window.location.pathname === "/";

    useEffect(() => {
        const isReady = !!appController.states.user.loaded;
        setReady(isReady);
    },[appController.states.user.loaded] );

    const history = useHistory();
    const match = useRouteMatch();
    const {welcomeId} = match?.params?.welcomeId ? match.params : {welcomeId: "showcase"};
    const Item = useMemo(()=>React.lazy(() => import(`./pages/${welcomeId}.js`)),[welcomeId]);
    const isValid = validWelcomes.includes(welcomeId);

    if(!ready) return <Loader />;
    if(!isValid || shouldShowHome) return <Home appController={appController}/>


    return <div className="container" style={{ display: 'block' }}>

    <Suspense fallback={<Loader />}>
        <Item appController={appController} />
    </Suspense>
    <pre>{JSON.stringify({ready})}</pre>
</div>
}