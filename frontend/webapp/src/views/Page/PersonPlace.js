
import React from 'react';
import parse from 'html-react-parser';
import ReactTooltip from 'react-tooltip';
import crypto from "crypto-browserify";
import { Link } from 'react-router-dom';
import { assetUrl } from "src/models/BoMOnlineAPI";

export const renderPersonPlaceHTML = (html, pageController) => {

  html = html.replace(/{(.*?)\|(.*?)}/g, "<a class='person' slug='$2' label='$1'></a>");
  html = html.replace(/\[(.*?)\|(.*?)\]/g, "<a class='place'  slug='$2' label='$1'></a>");
  const options = {
    replace: domNode => {
      if (domNode.attribs && domNode.attribs.class === 'person') {
        return <PersonLink pageController={pageController} label={domNode.attribs.label} id={domNode.attribs.slug} />
      }
      if (domNode.attribs && domNode.attribs.class === 'place') {
        return <PlaceLink pageController={pageController} label={domNode.attribs.label} id={domNode.attribs.slug} />
      }
    }
  };
  return parse(html, options);
}

function PersonLink({ label, id, pageController }) {

  const handleClick = (e) => {
    e.preventDefault();
    const appController = pageController?.appController || pageController
    appController.functions.setPopUp({ type: "people", ids: [id], popUpData: pageController.preLoad?.peoplePlaces?.person });
  }
  let tooltip_id = crypto.randomBytes(20).toString('hex');


  return (
    <>
      <Link
        to={"/people/" + id}
        data-tip
        data-for={tooltip_id}
        onClick={handleClick}
        className={"person"}
      >
        {label}
      </Link>
      <ReactTooltip
        wrapper={"span"}
        id={tooltip_id}
        effect="solid"
        backgroundColor={"#666"}
        arrowColor={"#666"}
      >
        <NarrationToolTip
          id={id}
          type={"personList"}
          appController={pageController?.appController || pageController}
        />
      </ReactTooltip>
    </>
  );
}
function PlaceLink({ label, id, pageController }) {

  const handleClick = (e) => {

    e.preventDefault();
    const appController = pageController?.appController || pageController
    appController.functions.setPopUp({ type: "places", ids: [id], popUpData: pageController.preLoad?.peoplePlaces?.place });
  }
  let tooltip_id = crypto.randomBytes(20).toString('hex');


  return (
    <>
      <Link
        to={"/place/" + id}
        data-tip
        data-for={tooltip_id}
        onClick={handleClick}
        className={"place"}
      >
        {label}
      </Link>
      <ReactTooltip
        wrapper={"span"}
        id={tooltip_id}
        effect="solid"
        backgroundColor={"#666"}
        arrowColor={"#666"}
      >
        <NarrationToolTip
          id={id}
          type={"placeList"}
          appController={pageController.appController || pageController}
        />
      </ReactTooltip>
    </>
  );
}

function NarrationToolTip({ type, id, appController }) {
  if (appController === undefined) return null;
  if (!appController.preLoad) return null;
  if (appController.preLoad[type] === undefined) return null;

  let list = appController.preLoad[type];
  let ttData = false;
  for (let x in list) {
    if (list[x].slug === id) {
      ttData = list[x];
      break;
    }
  }
  if (!ttData) return null;

  let info = (type === "personList") ? ttData.title : ttData.info;
  let name = ttData.name.replace(/(.*?), (.*)/, "$2 $1")
  let linkType = (type === "personList") ? "people" : "places";
  return (
    <div className="ppToolTip">
      <img src={`${assetUrl}/${linkType}/${id}`} alt={linkType} />
      <div>
        <div className="ppToolTipName">{numberFormat(name)}</div>
        <div className="ppToolTipInfo">{numberFormat(info)}</div>
      </div>
    </div>
  )
}

function numberFormat(string) {
  string = string.replace("1", "₁");
  string = string.replace("2", "₂");
  string = string.replace("3", "₃");
  string = string.replace("4", "₄");
  return string;
}