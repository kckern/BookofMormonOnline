import React, { useState, useEffect } from "react";

import { HomeFeed } from "../../Home/Feed"; 
import { Button, Card, CardBody, CardFooter, CardHeader } from "reactstrap";
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import { Link ,useHistory} from "react-router-dom/cjs/react-router-dom.min";


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
    {title: <span>Track your study <strong>Progress</strong></span>, video: "progress", link: "user"},
    {title: <span>Meet the <strong>People</strong></span>, video: "people", link: "people"},
    {title: <span>Map out the <strong>Places</strong></span>, video: "places", link: "places"},
    {title: <span>Chat with the <strong>AI</strong> Study Buddy</span>, video: "bot", link: "study"},
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
        <CardHeader className="showcase-panel-header" display="flex" justifycontent="space-between">
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