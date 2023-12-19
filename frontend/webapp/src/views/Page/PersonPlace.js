import React from "react";
import parse from "html-react-parser";
import ReactTooltip from "react-tooltip";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";

export const renderPersonPlaceHTML = (html, pageController,setPopupRef) => {
  html = html.replace(
    /{(.*?)\|(.*?)}/g,
    "<a class='person' slug='$2' label='$1'></a>",
  );
  html = html.replace(
    /\[(.*?)\|(.*?)\]/g,
    "<a class='place'  slug='$2' label='$1'></a>",
  );

  let className = html.match(/(?<=class=)'(.*?)'/g);

  html = html + "<span class='react-tooltip'></span>";
  let slugs = html.match(/(?<=slug=)'(.*?)'/g);

  const options = {
    replace: (domNode) => {
      const attribs = { ...domNode.attribs };
      if (attribs?.classname === 'scripture_link') {
        const ref = domNode.children[0].data;
        attribs.class = attribs.classname;
        delete attribs.classname;
        return <a {...attribs} onClick={()=>setPopupRef(ref)}>{ref}</a>;
      }

      if (domNode.attribs && domNode.attribs.class === "person") {
        return (
          <PersonLink
            pageController={pageController}
            label={domNode.attribs.label}
            id={domNode.attribs.slug}
          />
        );
      }
      if (domNode.attribs && domNode.attribs.class === "place") {
        return (
          <PlaceLink
            pageController={pageController}
            label={domNode.attribs.label}
            id={domNode.attribs.slug}
          />
        );
      }
      if (domNode.attribs && domNode.attribs.class === "react-tooltip") {
        if (slugs === null) {
          return <></>;
        }
        return (
          <>
            {slugs.map((slug, index) => {
              const id = slug.replaceAll("'", "");
              const typeName = className.shift().replaceAll("'", "") + "List";
              return (
                <ReactTooltip
                  wrapper={"span"}
                  id={id}
                  key={("slug-", id, "-ind", index)}
                  effect="solid"
                  backgroundColor={"#666"}
                  arrowColor={"#666"}
                >
                  <NarrationToolTip
                    id={id}
                    type={typeName}
                    appController={
                      pageController?.appController || pageController
                    }
                  />
                </ReactTooltip>
              );
            })}
          </>
        );
      }
    },
  };
  return parse(html, options);
};

function PersonLink({ label, id, pageController }) {
  const handleClick = (e) => {
    e.preventDefault();
    const appController = pageController?.appController || pageController;
    appController.functions.setPopUp({
      type: "people",
      ids: [id],
      popUpData: pageController.preLoad?.peoplePlaces?.person,
    });
  };

  return (
    <>
      <Link
        to={"/people/" + id}
        data-tip
        data-for={id}
        onClick={handleClick}
        className={"person"}
      >
        {label}
      </Link>
    </>
  );
}
function PlaceLink({ label, id, pageController }) {
  const handleClick = (e) => {
    e.preventDefault();
    const appController = pageController?.appController || pageController;
    appController.functions.setPopUp({
      type: "places",
      ids: [id],
      popUpData: pageController.preLoad?.peoplePlaces?.place,
    });
  };

  return (
    <>
      <Link
        to={"/place/" + id}
        data-tip
        data-for={id}
        onClick={handleClick}
        className={"place"}
      >
        {label}
      </Link>
    </>
  );
}

function NarrationToolTip({ type, id, appController }) {
  if (appController === undefined) return null;
  if (!appController.preLoad) return null;
  if (appController.preLoad[type] === undefined) return null;

  let list = Object.values(appController.preLoad[type]);
  let ttData = list.find((x) => x.slug === id);
  if (!ttData) return null;
  let info = ttData.title || ttData.info;
  let name = ttData.name.replace(/(.*?), (.*)/, "$2 $1");
  let linkType = type === "personList" ? "people" : "places";
  if (!info) return null;
  return (
    <div className="ppToolTip">
      <img src={`${assetUrl}/${linkType}/${id}`} alt={linkType} />
      <div>
        <div className="ppToolTipName">{numberFormat(name)}</div>
        <div className="ppToolTipInfo">{numberFormat(info)}</div>
      </div>
    </div>
  );
}

function numberFormat(string) {
  if (!string) return null;
  string = string.replace("1", "₁");
  string = string.replace("2", "₂");
  string = string.replace("3", "₃");
  string = string.replace("4", "₄");
  return string;
}
