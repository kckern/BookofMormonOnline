import React, { Suspense } from "react";
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory, Link } from "react-router-dom";
import validWelcomes from "./_list.js";
import "./Welcome.css";

export default function  Welcome({appController})
{
    const history = useHistory();
    const match = useRouteMatch();
    const {welcomeId} = match?.params;
    const isValid = validWelcomes.includes(welcomeId);
    if(!isValid) { history.push("/home"); return null; }

    const Item = React.lazy(() => import(`./pages/${welcomeId}.js`));
    return <div className="container" style={{ display: 'block' }}>

    <Suspense fallback={<Loader />}>
        <Item appController={appController} />
    </Suspense>

</div>
}