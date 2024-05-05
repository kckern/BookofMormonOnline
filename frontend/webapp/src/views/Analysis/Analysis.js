
import React, { useEffect, useState } from 'react';
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import "./Analysis.css"
import Loader from '../_Common/Loader';
import { Card, CardHeader, CardBody, CardFooter, Button, Input } from "reactstrap";
import Masonry from 'react-masonry-css'
import Caractors from "./Caractors/Caractors.js"
import Bible from "./Bible/Bible.js"
import Chiasmus from "./Chiasmus/Chiasmus.js"
import { Link, useRouteMatch } from 'react-router-dom';
import { label } from 'src/models/Utils';

function Analysis() {


    const match = useRouteMatch();

    if(match.params.value==="caractors") return <Caractors/>;
    if(match.params.value==="bible") return <Bible/>;
    if(match.params.value==="chiasmus") return <Chiasmus/>;

    const breakpointColumnsObj = {
        default: 4,
        1400: 3,
        1100: 2,
        800: 1
      };

    const sections = [
        {heading:"“Caractors” Document",text:"A glyph-level comparative and sequential analysis of the “Caractors” document recovered from the Whitmer estate in 1884.",slug:"caractors", ready:true},
        {heading:"Bible Quotations",text:"ok",slug:"bible", ready:true},
        {heading:"Chiastic Features",text:"An inventory of all identified chiasms in the Book of Mormon.",
        slug:"chiasmus", ready:true},
        {heading:"Discursive Analysis",text:"ok",slug:"discourse"},
        {heading:"Narrative Analysis",text:"ok",slug:"narrative"},
        {heading:"Intertextuality",text:"ok",slug:"intertext"},
        {heading:"Structural Analysis",text:"ok",slug:"structure"},
        {heading:"Internal Quotations",text:"ok",slug:"internalquotes"},
        {heading:"Names",text:"ok",slug:"names"},
        {heading:"N-gram Analysis",text:"ok",slug:"ngram"},
        {heading:"Word Search",text:"ok",slug:"search"},
        {heading:"Critical Text",text:"ok",slug:"criticaltext"},
    ]
    
    return <div className="container">

        <div id="page" >
            <h3 className="title lg-4 text-center">{label("title_analysis")}</h3>

            <div className="analysis">
                <Masonry
                    breakpointCols={breakpointColumnsObj}
                    className="my-masonry-grid"
                    columnClassName="my-masonry-grid_column">
                    {sections.map((section, i) => (
                        <Card key={i} className={(!section.ready ? "notready" : "")}>
                            <CardHeader className="text-center"><h5>{section.heading}</h5></CardHeader>
                            <Link onClick={(e)=>{if(!section.ready) e.preventDefault()}} to={"/analysis/"+section.slug}>
                             <CardBody  style={{ backgroundImage: `url(${assetUrl}/analysis/covers/` + section.slug + ")" }}>
                                <div className={"infoText "} >{(section.ready ? section.text : <div>⌛ {label("coming_soon")}</div>) } </div>
                            </CardBody>
                            </Link>
                        </Card>
                    ))}
                </Masonry>
            </div>
        </div>
    </div>



}

export default Analysis;