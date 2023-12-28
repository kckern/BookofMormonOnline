

import React, { useState, useEffect } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import "./ReadingPlan.css";

import { Card, CardHeader, CardBody, CardFooter, Button, Badge } from "reactstrap";
import moment from "moment";
import { Link } from "react-router-dom/cjs/react-router-dom.min";
import green from "../User/svg/green.svg";
import blank from "../User/svg/blank.svg";
export function ReadingPlan({appController,slug}){

    const token = appController.states.user.token;

    const [planData, setPlanData] = useState(null);
    const [activeSegment, setActiveSegment] = useState(null);

    useEffect(() => {
        if(planData) return;
        BoMOnlineAPI(
            { readingplan: { token, slug } },
            { useCache: false })
            .then((data) => {
                setPlanData(data.readingplan[0]);
                const today = moment();
                const activeSegmentIndex = data.readingplan[0].segments.findIndex((segment) => {
                    return moment(segment.duedate).isAfter(today);
                });
                setActiveSegment(activeSegmentIndex);
            });
    }, []);

    const today = moment("2024-06-25");

   if(planData) planData.progress = 60;

    if(!planData) return <ReadingPlanLoading />;
    return (
        <Card>
            <CardHeader>
                <h3>Reading Plan: <span className="planName">{planData.title}</span></h3>
            <div className="readingplan progressContainer">
            <div><Badge color="success">On Track</Badge></div>
            <div className="readingplan progress">
              <div className="progressbar" style={{ width: `${planData.progress}%` }}>
                {" "}
              </div>
              <span>{planData.progress}%</span>
            </div>
            </div>
            </CardHeader>
            <CardBody>
                <ReadingPlanSegmentList segments={planData.segments} 
                today={today}
                setActiveSegment={setActiveSegment} activeSegment={activeSegment} />
            </CardBody>
            <CardFooter>
                <ReadingPlanSegment segment={planData.segments[activeSegment]} token={token} />
            </CardFooter>
        </Card>
    )
}

function ReadingPlanSegmentList({segments, setActiveSegment, activeSegment, today}){

    const currentSegment = segments?.find((segment) => {
        return moment(segment.duedate).isAfter(today);
    }); currentSegment.className = "current";
    const currentIndex = segments.findIndex((segment) => {
        return moment(segment.duedate).isAfter(today);
    });
    const futureSegments = segments?.filter((segment) => {
        return moment(segment.duedate).isAfter(today) && segment !== currentSegment;
    })?.map((segment) => ({...segment, className: "future"}));
    const pastSegments = segments?.filter((segment) => {
        return moment(segment.duedate).isBefore(today);
    })?.map((segment) => ({...segment, className: "past"}));

    useEffect(() => {
        if(activeSegment===null) setActiveSegment(currentIndex);
    }, [activeSegment, currentIndex]);

    if(!segments || !segments.length) return null;


    //useFlexbox, 1 square for each segment, highlight active segment, onClick to set active segment
    return (
        <div className="segmentList">
            {[...pastSegments,currentSegment,...futureSegments].map((segment,i) => <ReadingPlanSegmentListItem segmentListItem={segment} key={i} index={i} setActiveSegment={setActiveSegment} activeSegment={activeSegment} />)}
        </div>
    )
}


function ReadingPlanSegmentListItem({segmentListItem, index, setActiveSegment, activeSegment}){

    const dueDate = moment(segmentListItem.duedate).format("MMM D");
    const {ref, className,progress} = segmentListItem;
    const progressInt = parseInt(progress);
    const statusClass = progressInt === 100 ? "complete" : progressInt > 0 ? "inProgress" : "notStarted";
    return (
        <div className={`segmentListItem ${className} ${statusClass} ${activeSegment === index ? "active" : ""}`} 
         onClick={() => setActiveSegment(index)}>
            {progressInt ? `${progressInt}%` : null}
        </div>
    )

}

function ReadingPlanSegment({segment, token, index}){

    if(!segment) return null;

    const title = segment.title ? `${segment.ref} • ${segment.title}` : segment.ref;
    const period = segment.period ? segment.period : null;
    return <div className="segment">
        <h4>{title} {period ? <span className="period">{period}</span> : null}</h4>
        <p>Guid: {segment.guid}</p>
        <ReadingPlanSegmentSections token={token} guid={segment.guid} />
        </div>
}

function ReadingPlanSegmentSections({guid, token}){

    const [sectionData, setSectionData] = useState(null);
    useEffect(() => {
        if(sectionData?.guid === guid) return;
        setSectionData(null);
        BoMOnlineAPI(
            { readingplansegment: { token, guid } },
            { useCache: false })
            .then((data) => {
                console.log(data.readingplansegment);
                setSectionData(data.readingplansegment[0]);
            });
    }, [guid]);
    if(!sectionData) return null; 
    return (
        <div className="segmentSections">
            {sectionData.sections.map((section) => <ReadingPlanSection section={section} />)}
        </div>
    )


}

function ReadingPlanSection({section}){
    const {title, slug,sectionText} = section;
    //
    return (
        <div className="segmentSection">
            <h6><Link to={`/${slug}`}>{title}</Link></h6>
            <div className="sectionDots">
            {sectionText.map((item) => <img src={ item.status === "complete" ? green : blank} />)}
        </div>
        </div>
    )
}


function ReadingPlanLoading(){
    return null
}