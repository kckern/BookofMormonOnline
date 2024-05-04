

import React, { useState, useEffect } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import "./ReadingPlan.css";
import { Link, NavLink, useHistory, useRouteMatch } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import { Card, CardHeader, CardBody, CardFooter, Button, Badge } from "reactstrap";
import moment from "moment";
import green from "../User/svg/green.svg";
import yellow from "../User/svg/yellow.svg";
import blank from "../User/svg/blank.svg";

import theater from "../_Common/svg/theater.svg";
import study from "../_Common/svg/study.svg";
import { Spinner } from "../_Common/Loader";
import loading from  "../_Common/svg/loadbar.svg"
import { label } from "../../models/Utils";
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

    const today = moment();

    let nonFutureSegments = planData?.segments?.filter((segment) => {
        return moment(segment.duedate).isBefore(today);
    }) || [];
    nonFutureSegments = [...nonFutureSegments,planData?.segments?.find((segment) => {
        return moment(segment.duedate).isAfter(today);
    })];
    let averageProgress = (nonFutureSegments?.reduce((acc,segment) => {
        return acc + parseFloat(segment?.progress);
    },0) / (nonFutureSegments?.length || 1)).toFixed(1);

    const pastSegments = planData?.segments?.filter((segment) => {
        return moment(segment.duedate).isBefore(today);
    }
    ) || [];

    const pastSegmentsAreComplete = pastSegments?.every((segment) => {
        return segment.progress === 100;
    });


    averageProgress = isNaN(averageProgress) ? 0 : averageProgress;
    const progressInt = parseInt(averageProgress);

    if(planData) planData.progress = averageProgress || 0;
    function getProgressStatus(progressInt) {
        let status = {};
        
        if (progressInt > 95 || nonFutureSegments?.length === 1 || pastSegmentsAreComplete) {
            status = { label: label("status_ontrack"), labelClass: "green" };
        } else if (progressInt === 0) {
            status = { label: label("status_notstarted"), labelClass: "gray" };
        } else if (progressInt > 50) {
            status = { label: label("status_catchingup"), labelClass: "yellow" };
        } else {
            status = { label: label("status_fallenbehind"), labelClass: "red" };
        }

        return status;
    }

// Usage
const { label:labelText, labelClass } = getProgressStatus(progressInt);

 
    if(!planData) return <ReadingPlanLoading />;
    return (
        <Card className="noselect">
            <CardHeader>
                <h3>{label("reading_plan")}: <span className="planName">{planData.title}</span></h3>
            <div className="readingplan progressContainer">
            <div><Badge className={labelClass}>{labelText}</Badge></div>
            <div className="readingplan progress">
              <div  style={{ width: `${planData.progress || 0}%` }} className={`progress-bar ${labelClass}`}>
                {" "}
              </div>
              <span>{planData.progress || 0}%</span>
            </div>
            </div>
            </CardHeader>
            <CardBody>
                <ReactTooltip place="top" effect="solid" id={`segmentTips`} />
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
        <div
        data-for={`segmentTips`}
        data-tip={`<b>${segmentListItem.period} • ${ref}</b><br/>${segmentListItem.title}`}
        data-html={true}
        className={`segmentListItem ${className} ${statusClass} ${activeSegment === index ? "active" : ""}`}
         onClick={() => setActiveSegment(index)}>
            {progressInt ? `${progressInt}%` : (index + 1)}
        </div>
    )

}

function ReadingPlanSegment({segment, token, index}){

    if(!segment) return null;

    const title = segment.title ? `${segment.ref} • ${segment.title}` : segment.ref;
    const period = segment.period ? segment.period : null;
    return <div className="segment" key={segment.guid}>
        <h4>{period ? <span className="period">{period}</span> : null}{title}</h4>
        <ReadingPlanSegmentSections token={token} guid={segment.guid } />
        </div>
}

function ReadingPlanSegmentSections({guid, token}){

    const history = useHistory();

    const [sectionData, setSectionData] = useState(null);
    useEffect(() => {
        if(sectionData?.guid === guid) return;
        setSectionData(null);
        BoMOnlineAPI(
            { readingplansegment: { token, guid } },
            { useCache: false })
            .then((data) => {
                setSectionData(data.readingplansegment?.[0] || {});
            });
    }, [guid]);
    if(!sectionData) return <div className="spinnerBox" key={guid}>
        <img src={loading} />
    </div>;



    const flatSectionText = sectionData.sections.reduce((acc,section) => {
        return [...acc,...section.sectionText];
    }
    ,[]);
    const studySlug = flatSectionText
    .filter((item) =>  item.status !== "complete")
    .map((item) => item.slug)[0] || flatSectionText[0].slug;

    const random = Math.random();

    return (
        <React.Fragment key={guid}>
        <div className="buttonRow" key={guid}>
            <Link to={`/${studySlug}`}>
            <Button color="primary" size="sm">
                <img src={study} /> {label("menu_study")}</Button></Link>
            <Link to={`/theater/plan/${guid}`}>
            <Button color="secondary" size="sm">
                <img src={theater} /> {label("menu_theater")}</Button></Link>
        </div>
        <div className="segmentSections" key={guid + `${random}`}>
            {sectionData.sections.map((section,i) => <ReadingPlanSection section={section} key={section.guid + `${i}`} />)}
        </div>
        </React.Fragment>
    )


}

function ReadingPlanSection({section}){
    const {title, slug,sectionText} = section;
    const history = useHistory();

    const clickDot = (e,item) => {
        e.preventDefault();
        e.stopPropagation();
        const link = `/${item.slug}`;
        if(link) history.push(link);
    }

    const sectionProgress = sectionText.reduce((acc,item) => {
        return acc + (item.status === "completed" ? 1 : 0);
    }
    ,0);
    section.progress = (sectionProgress / sectionText.length * 100).toFixed(1);
    //
    return (<>
        <ReactTooltip place="bottom" effect="solid" id={`sectionDotTips-${slug}`} />
        <Link to={`/${slug}`}>
        <div className="segmentSection">
            <div className="miniprogress">
                <div style={{width: `${section.progress || 0}%`}} className="progressBar" />
            </div>
            <h6>{title}</h6>
            <div className="sectionDots">
            {sectionText.map((item, index) =>
            <img
            key={index}
            onClick={(e)=>clickDot(e,item)}
            data-for={`sectionDotTips-${slug}`}
            data-tip={item.heading}
            src={ item.status === "completed" ? green : item.status === "started" ? yellow : blank} />
            
            )}
            </div>
        </div>
        </Link></>
    )
}


function ReadingPlanLoading(){
    return <Card >
    <CardHeader>
        <h3>{label("reading_plan")}: <span className="planName">{label("loading")}</span></h3>
    </CardHeader>
    <CardBody className="spinnerBox segment" style={{border: "none"}}>
        <img src={loading} style={{height: "4rem"}}/>        
    </CardBody>
    </Card>
}