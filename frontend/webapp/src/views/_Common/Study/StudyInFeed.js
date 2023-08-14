import React, { useState, useEffect } from "react";
import { flattenDescription, label, renderHTMLContentInFeed } from "src/models/Utils";
import { Link } from "react-router-dom";
import "./StudyInFeed.css";
import { BlankParagraph } from "src/models/Utils";
import { assetUrl } from "src/models/BoMOnlineAPI";

function ImageBox({ imageIds }) {
  const [currentIndex, setIndex] = useState(0);

  useEffect(() => {
    if (imageIds === null) return null;
    const timer = setTimeout(() => {
      let next = currentIndex + 1;
      if (next >= imageIds?.length) next = 0;
      setIndex(next);
    }, 3000 + Math.random() * 10000);
    return () => {
      clearTimeout(timer);
    };
  });

  if (imageIds === null) return null;
  if (imageIds === undefined) return null;
  if (imageIds[currentIndex] === undefined) return null;
  let style = {
    backgroundImage: `url(${assetUrl}/art/${imageIds[currentIndex]})`,
  };

  return <div className="imgBox" style={style}></div>;
}

export function TextInFeed({ appController, textData, highlights }) {
  if (!textData) return <Placeholder classname="text" />;

  //if(!textData.narration) debugger;
  return (
    <Link
      to={"/" + textData.slug}
      onClick={() => appController.functions.openDrawer(false)}
    >
      <div className="itemInFeedContainer noselect">
        <span className={"notch"}>▲</span>
        <div className="itemInFeed textInFeed ">
          <h5>{textData.heading}</h5>
          <div className="scripture">
            {" "}
            {renderHTMLContentInFeed(textData.content, highlights)}{" "}
          </div>
          <div className="caption">
            <ImageBox imageIds={textData.imgIds} />
            <div className="pageSection">
              {textData.parent_page?.title} ▸ {textData.parent_section?.title}:{" "}
            </div>
            <div className="narration">
              {flattenDescription(textData.narration?.description)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function SectionInFeed({ appController, sectionData, highlights }) {
  if (!sectionData) return <Placeholder classname="sectionholder" />;
  return (
    <Link
      to={"/" + sectionData.slug}
      onClick={() => appController.functions.openDrawer(false)}
    >
      <div className="itemInFeedContainer">
        <span className={"notch"}>▲</span>
        <div className="itemInFeed sectionInFeed ">
          <h5>{sectionData.title}</h5>
          <div className="sectionItems">
            <ul>
              {sectionData?.rows?.map((r, i) => {
                if (r.narration) {
                  return (
                    <li key={sectionData.slug + i}>
                      {flattenDescription(r.narration.description, highlights)}
                    </li>
                  );
                } else if (r.capsulation) {
                  return (
                    <li key={sectionData.slug + i}>
                      {flattenDescription(
                        r.capsulation.description,
                        highlights
                      )}
                    </li>
                  );
                } else return null;
              })}
            </ul>
          </div>
          <div className="caption">
            <div className="pageSection">{sectionData.page?.title}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
export function CommentaryInFeed({ appController, comData, highlights }) {

  if (!comData) return <Placeholder classname="com" />;
  if(!comData.location?.narration?.description) {} // Nested location have no narration
  let description = flattenDescription(comData.location?.narration?.description || "");

 // return <pre>{JSON.stringify({comData,highlights},0,2)}</pre>
 // if(!comData.location) return null;
  return (
    <div className="itemInFeedContainer">
      <span className={"notch"}>▲</span>
      <div className="itemInFeed commentaryInFeed ">
        <Link
          to={"/commentary/" + comData.id}
          onClick={() => appController.functions.openDrawer(false)}
        >
          <h5>{label("commentary_on",[comData.location?.heading])}</h5>
        </Link>
        <div className={"commentaryContent "}>
          <Link
            to={"/commentary/" + comData.id}
            onClick={() => appController.functions.openDrawer(false)}
          >
            <img
              src={
                `${assetUrl}/source/cover/` +
                comData.publication?.source_id.padStart(3,0)
              }
              alt={comData.publication?.source_id.padStart(3,0 )}
            />
            <h3>{comData.title}</h3>
          </Link>
          <div className="commentaryContentText">
            {renderHTMLContentInFeed(comData.text || "", highlights)}
          </div>
        </div>
        <Link
          to={"/commentary/" + comData.id}
          onClick={() => appController.functions.openDrawer(false)}
        >
          <div className="caption">
            <ImageBox imageIds={comData.location?.imgIds} />
            <div className="pageSection">
              {comData.location?.parent_page.title} ▸ {comData.location?.parent_section.title}:{" "}
            </div>
            <div className="narration">{description}</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function FaxInFeed({ appController, textData, version, hasStar }) {
  const [imgHW, setHW] = useState({ h: 0, w: 0 });
  const [position, setPosition] = useState("center center");

  if (!textData) return <Placeholder classname="fax" />;
  const magnify = ({ nativeEvent: e, target: div }) => {
    if (imgHW.h === 0) return false;
    let margin = 0;
    let mousePos = { x: e.offsetX - margin, y: e.offsetY - margin };
    let boxSize = { w: div.offsetWidth + margin, h: div.offsetHeight + margin };

    let x = -(mousePos.x / boxSize.w) * (imgHW.w - boxSize.w);
    let y = -(mousePos.y / boxSize.h) * (imgHW.h - boxSize.h);
    setPosition(x + "px " + y + "px");
  };

  const resetMag = () => {
    setPosition("center center");
  };

  const onImgLoad = ({ target: img }) => {
    setHW({ h: img.naturalHeight, w: img.naturalWidth });
  };
  let m =textData.slug && textData.slug.match(/([a-z-]+)\/(\d+)$/) || [null,null];
  let imgUrl = `${assetUrl}/fax/text/${version}/${m[1]}-${m[2]}`;
  let magStyle = {
    backgroundPosition: position,
    backgroundImage: `url(${imgUrl})`,
  };
  let images = (
    <>
      <div
        className="coverImage"
        style={{ backgroundImage: `url(${imgUrl})` }}
      ></div>
      <div
        className="containImage"
        onMouseEnter={magnify}
        onMouseMove={magnify}
        onMouseLeave={resetMag}
        style={magStyle}
      ></div>
    </>
  );
    if(!textData.narration) return null;
  return (
    <Link
      to={`/${textData.slug}/fax/${version}` }
      onClick={() => appController.functions.openDrawer(false)}
    >
      <div className="itemInFeedContainer">
        <span className={"notch"}>▲</span>
        <div className="faxInFeed itemInFeed">
          <h5>
            {textData.heading} ({version})
          </h5>
          <img
            src={imgUrl}
            alt={imgUrl}
            className="imgRef"
            onLoad={onImgLoad}
          />
          <div className="imageContainer">
            {images}
            {hasStar ? <div className="imageStar">⭐</div> : null}
          </div>
          <div className="caption">
            <ImageBox imageIds={textData.imgIds} />
            <div className="pageSection">
              {textData.parent_page.title} ▸ {textData.parent_section.title}:{" "}
            </div>
            <div className="narration">
              {flattenDescription(textData.narration.description)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ImageInFeed({ appController, imageData, hasStar }) {
  useEffect(() => {
    if (!imageData || imageData.width) return false;
    let viewerRatio =
      document.getElementsByClassName("coverImage")[0].offsetHeight /
      document.getElementsByClassName("coverImage")[0].offsetWidth;
    let imageRatio = imageData.height / imageData.width;
    let diff = Math.abs(100 * (viewerRatio - imageRatio));
    if (diff > 15) setLetterBox(true);
  }, [imageData]);
  const [letterBox, setLetterBox] = useState(false);

  if (!imageData) return <Placeholder classname="img" />;

  if (imageData.location === null) return false;
  let description = flattenDescription(
    imageData.location?.narration?.description
  );

  let images = (
    <div
      className="coverImage full"
      style={{
        backgroundImage: `url(${assetUrl}/art/${imageData.id})`,
      }}
    ></div>
  );

  if (letterBox) {
    images = (
      <>
        <div
          className="coverImage"
          style={{
            backgroundImage: `url(${assetUrl}//art/${imageData.id})`,
          }}
        ></div>
        <div
          className="containImage"
          style={{
            backgroundImage: `url(${assetUrl}//art/${imageData.id})`,
          }}
        ></div>
      </>
    );
  }

  return (
    <Link
      to={"/" + imageData.location?.slug}
      onClick={() => appController.functions.openDrawer(false)}
    >
      <div className="itemInFeedContainer">
        <span className={"notch"}>▲</span>
        <div className="imageInFeed itemInFeed">
          <h5>{imageData.title}</h5>

          <div className="imageContainer">
            {images}
            <div className="imageSource">© {imageData.artist}</div>
            {hasStar ? <div className="imageStar">⭐</div> : null}
          </div>
          <div className="caption">
            <div className="pageSection">
              {imageData.location?.parent_page.title} ▸{" "}
              {imageData.location?.parent_section.title}:{" "}
            </div>
            <div className="narration">{description}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Placeholder({ classname }) {
  const [gaveUp, giveUp] = useState(false);
  useEffect(
    () =>
      setTimeout(() => {
        giveUp(true);
      }, 5000),
    []
  );

  return (
    <div className={"itemInFeedContainer noselect " + (gaveUp ? "hidden" : "")}>
      <span className={"notch"}>▲</span>
      <div className={"itemInFeed itemPlaceholder " + classname}>
        <h5>
          <BlankParagraph min={2} max={4} />
        </h5>
        <div className="contentPaceholder"></div>
        <div className="caption">
          <div className="pageSection">
            <BlankParagraph min={1} max={3} /> ▸{" "}
            <BlankParagraph min={2} max={4} /> :{" "}
          </div>
          <div className="narration">
            <BlankParagraph min={6} max={12} />
          </div>
        </div>
      </div>
    </div>
  );
}
