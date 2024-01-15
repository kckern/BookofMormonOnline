import React, { useState, useEffect } from "react";

import { HomeFeed } from "../../Home/Feed"; 
import { Button, Card, CardBody, CardFooter, CardHeader } from "reactstrap";
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';


export default function WelcomeUnShaken({appController})
{

    
    const groupId = "163262f02963f4437e3085c12996090e";
    return   <div id="page" className="welcome">
        <HeroBanner />
        <div  className="welcome-content" >
            <ShowCasePanels />
            <CommunityFeed groupId={groupId} appController={appController} />
        </div>
    </div>
            
}

function HeroBanner()
{
    return <div className="hero-banner">
        <Card className="hero-banner-content">
            <CardBody className="hero-banner-body">
                <img src={`${assetUrl}/welcome/unshaken/face` } className="face" />
                <div className="text">
                    <h5>Dive deep into the Book of Mormon with Jared Halverson</h5>
                    <p>Join Jared Halverson as he explores the Book of Mormon in depth. Using the resources of <i>Book of Mormon Online</i>, Jared will help you discover the richness of the Book of Mormon and how it can bless your life today. Sign up and join the study group today!</p>
                </div>
                <img src={`${assetUrl}/welcome/unshaken/logo`} className="logo" />
            </CardBody>
        </Card>
    </div>
}

function CommunityFeed({groupId, appController})
{
    return <div className="community-feed" >
        <Card>
            <CardHeader style={{height:"3rem"}}>
                <h6>Community Feed

                <Button color="primary" size="sm"  style={{float:"right", position:"relative",bottom:"1rem"}}>Join Group</Button>
                </h6>
            </CardHeader>
            <CardBody style={{textAlign: 'center'}}>
                Here are the latest insights from Jared’s study group. Join the group to add your own comments and insights.
           
            </CardBody>
        </Card>
        <HomeFeed appController={appController} activeGroup={groupId} />
    </div>
}


function ShowCasePanels() //3x3 grid of panels
{

const panels = [
    {title: <span>Scan the Table of <strong>Contents</strong></span>, video: "toc"},
    {title: <span> <strong>Art</strong> and Illustrations</span>, video: "keyfeatures"},
    {title: <span><strong>Skim</strong> the Stories</span>, video: "skim"},
    {title: <span>Consult <strong>Commentaries</strong></span>, video: "study"},
    {title: <span><strong>Share</strong> with Others</span>, video: "share"},
    {title: <span><strong>Browse</strong> Historic Editions</span>, video: "fax"},
    {title: <span>Meet the <strong>People</strong></span>, video: "people"},
    {title: <span>Leave <strong>Comments</strong></span>, video: "comments"},
    {title: <span>Lookup <strong>Facsimiles</strong></span>, video: "faxlookup"},
    {title: <span>Explore <strong>Maps</strong></span>, video: "map"},
    {title: <span>Join the <strong>Community</strong></span>, video: "community"},
    {title: <span>Read <strong>Commentary</strong></span>, video: "commentary"},
    {title: <span>Learn <strong>History</strong></span>, video: "history"},
    {title: <span>Follow the <strong>Timeline</strong></span>, video: "timeline"},
    {title: <span>Visit <strong>Places</strong></span>, video: "places"},
    {title: <span>Track Your <strong>Progress</strong></span>, video: "progress"},
    {title: <span>Enjoy <strong>Art</strong></span>, video: "art"},
]

const [showcasePanels] = useState(panels.sort(() => Math.random() - 0.5).slice(0,6));

const [acitveIndex, setActiveIndex] = useState(0);

//cycle through active every 5 seconds
useEffect(() => {
    const interval = setInterval(() => {
        setActiveIndex((acitveIndex + 1) % showcasePanels.length);
    }, 5000);
    return () => clearInterval(interval);
}
, [acitveIndex, showcasePanels.length]);




    return <div className="showcase-panels" >
        {showcasePanels.map((panel, i) => <ShowCasePanel key={i} {...panel} isActive={acitveIndex === i} />)}
    </div>
}

function ShowCasePanel({title, video,isActive})
{

    const [isPlaying, setIsPlaying] = useState(false);
    useEffect(() => {
        if(isActive) setIsPlaying(true);
        else setTimeout(() => setIsPlaying(false), 1000);
    }, [isActive]);

    //play the video onchange isPlaying and isPLaying is true
    useEffect(() => {
        try{
        if(isPlaying) document.querySelector(`video[src="${assetUrl}/video/welcome/${video || "skim"}"]`).play();
        else document.querySelector(`video[src="${assetUrl}/video/welcome/${video || "skim"}"]`).pause();
        }catch(e){}
    }, [isPlaying]);

    
    return <Card className={`showcase-panel ${isActive ? "active" : ""}`}>
        <CardHeader className="showcase-panel-header" display="flex" justifyContent="space-between">
            <h6>{title} </h6>
        </CardHeader>
        <CardBody className="showcase-panel-body">
        <video 
            style={{  
                 objectFit: 'cover',
                 objectPosition: 'top center',

                }} 
            loop 
            muted   
            src={`${assetUrl}/video/welcome/${video || "skim"}`}
        />
        </CardBody>
    </Card>
}