import React, { useState, useEffect } from "react";

import { HomeFeed } from "../../Home/Feed"; 
import { Button, Card, CardBody, CardFooter, CardHeader } from "reactstrap";
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import { Link ,useHistory} from "react-router-dom/cjs/react-router-dom.min";
import { ReadingPlan } from "../../Home/ReadingPlan";
import logo from "src/views/_Common/svg/logo.svg";


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

                 <img src={`${logo}`} className="face" />
                <div className="text">
                    <h5>Book of Mormon Online: <em>A Book of Mormon Study Resource</em></h5>
                    <p>Experience the Book of Mormon in a whole new way with <i>Book of Mormon Online</i>. This free resource will guide you through the Book of Mormon in a way that will help you understand the narrative, the people, the places, and the teachings of the Book of Mormon. Track your progress, start a study group, start exploring everything the Book of Mormon has to offer.</p>
                </div>
            </CardBody>
        </Card>
    </div>
}

function CommunityFeed({groupId, appController})
{
    return <div className="community-feed" >
        <ReadingPlan appController={appController} slug={"cfm2024"} />
    </div>
}


function ShowCasePanels() //3x3 grid of panels
{


   const panels = [
    {title: <span>Track your study <strong>Progress</strong></span>, video: "progress", link: "user"},
    {title: <span>Meet the <strong>People</strong></span>, video: "people", link: "people"},
    {title: <span>Map out the <strong>Places</strong></span>, video: "places", link: "places"},
    {title: <span>Chat with the <strong>AI</strong> Study Buddy</span>, video: "bot", link: "community"},
    {title: <span>Experience the <strong>Theater</strong></span>, video: "theater", link: "theater"},
    {title: <span>Explore the <strong>Commentary</strong></span>, video: "commentary", link: "study"},
   ];


const [showcasePanels] = useState(panels.slice(0,6));

const [activeIndex, setActiveIndex] = useState(null);

//cycle through active every 5 seconds
useEffect(() => {
		let interval = null;

		const timeout = setTimeout(()=>{

			setActiveIndex(0);

			interval = setInterval(() => {
        setActiveIndex(prev=>prev === 5?0:prev+1);
    }, 2000);

		},1000)

    return () => {
			clearInterval(interval);
			clearTimeout(timeout);
		};
}
, []);




    return <div className="showcase-panels" >
        {showcasePanels.map((panel, i) => <ShowCasePanel key={i} {...panel} isActive={activeIndex === i}/>)}
    </div>
}

function ShowCasePanel({title, video, link, isActive})
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

    const onMouseEnter = () => setIsPlaying(true);
    const onMouseLeave = () => setIsPlaying(false);

    const onClick = () => {
        history.push(`/${link}`);
    }

    const history = useHistory();

    return <Card className={`showcase-panel ${isActive ? "active" : ""}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
        <CardHeader className="showcase-panel-header" display="flex" justifyContent="space-between">
            <h6>{title} </h6>
        </CardHeader>
        <CardBody className="showcase-panel-body">
        <video 
						id={`video-${video}`}
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