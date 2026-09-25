import React, { Suspense, useMemo } from "react";
import Loader from "../_Common/Loader";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useLegacyParams } from "src/models/routeParams";
import validWelcomes from "./_list.js";
import "./Welcome.css";

export default function  Welcome()
{
    const navigate = useNavigate();
    const match = { params: useLegacyParams(), url: useLocation().pathname };
    let {welcomeId} = match?.params;
    const isValid = validWelcomes.includes(welcomeId);
    if(!welcomeId) welcomeId = "showcase";
    const Item = useMemo(()=>React.lazy(() => import(`./pages/${welcomeId}.js`)),[welcomeId]);
 
    return <div className="container" style={{ display: 'block' }}>

    <Suspense fallback={<Loader />}>
        <Item />
    </Suspense>

</div>
}