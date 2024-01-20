import React, { Suspense, useMemo } from "react";
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory } from "react-router-dom";
import validWelcomes from "./_list.js";
import "./Welcome.css";

export default function  Welcome({appController})
{
    const history = useHistory();
    const match = useRouteMatch();
    const {welcomeId} = match?.params?.welcomeId ? match.params : {welcomeId: "showcase"};
    const Item = useMemo(()=>React.lazy(() => import(`./pages/${welcomeId}.js`)),[welcomeId]);
    const isValid = validWelcomes.includes(welcomeId);
    if(!isValid) { history.push("/community"); return null; }

    return <div className="container" style={{ display: 'block' }}>

    <Suspense fallback={<Loader />}>
        <Item appController={appController} />
    </Suspense>

</div>
}