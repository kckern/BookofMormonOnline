import React, { Suspense, useMemo } from "react";
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory } from "react-router-dom";
import validWelcomes from "./_list.js";
import "./Welcome.css";

export default function  Welcome({appController})
{
    const history = useHistory();
    const match = useRouteMatch();
    let {welcomeId} = match?.params;
    const isValid = validWelcomes.includes(welcomeId);
    if(!welcomeId) welcomeId = "showcase";
    const Item = useMemo(()=>React.lazy(() => import(`./pages/${welcomeId}.js`)),[welcomeId]);
 
    return <div className="container" style={{ display: 'block' }}>

    <Suspense fallback={<Loader />}>
        <Item appController={appController} />
    </Suspense>

</div>
}