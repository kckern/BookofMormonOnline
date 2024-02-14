import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
// Actions
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import "./About.css";
import Loader from "../_Common/Loader";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Input,
} from "reactstrap";
import Masonry from "react-masonry-css";
import { useLocation, useParams, useRouteMatch } from "react-router-dom";
import axios from "axios";
import { label } from "src/models/Utils";
import ReactMarkdown from "react-markdown";
import bom from "./icons/bom.svg";
import contribute from "./icons/contribute.svg";
import disclaimer from "./icons/disclaimer.svg";
import what from "./icons/what.svg";
import who from "./icons/who.svg";
import why from "./icons/why.svg";
import contact from "./icons/contact.svg";
import official from "./icons/official.svg";
function About() {
  useEffect(()=>document.title = label("menu_about") + " | " + label("home_title"),[])
  const match = useRouteMatch();
  const [aboutPageData, setAboutPageData] = useState(null);

  let breakpointColumnsObj = {
    default: 3,
    1400: 2,
    1000: 1,
  };
  let items = ["bom", "official", "contribute", "disclaimer", "what", "who", "why", "contact"];
  if (match.params.value === "tos") { items = ["tos"]; breakpointColumnsObj = { default: 1 } }
  if (match.params.value === "privacy") { items = ["privacy"]; breakpointColumnsObj = { default: 1 } }

  useEffect(() => {
    BoMOnlineAPI({ markdown: items }, { useCache: false })
      .then((result) => {
        setAboutPageData(result?.markdown);

      })
  }, [])


  if (!aboutPageData) return <Loader />;


  let cards = (match.params.value === "tos") ? <Card>
    <CardBody>
      <img src={official} />
      <ReactMarkdown>{aboutPageData.tos.markdown}</ReactMarkdown>
    </CardBody>
  </Card> : (match.params.value === "privacy") ? <Card>
    <CardBody>
      <img src={official} />
      <ReactMarkdown>{aboutPageData.privacy.markdown}</ReactMarkdown>
    </CardBody>
  </Card> :
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="my-masonry-grid"
      columnClassName="my-masonry-grid_column"
    ><Card>
        <CardBody>
          <CardContent img={<img src={bom} />} markdown={aboutPageData.what.markdown} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardContent img={<img src={why} />} markdown={aboutPageData.why.markdown} />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <CardContent img={<img src={contribute} />} markdown={aboutPageData.contribute.markdown} />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <CardContent img={<img src={contact} />} markdown={aboutPageData.contact.markdown} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardContent img={<img src={who} />} markdown={aboutPageData.who.markdown} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardContent img={<img src={disclaimer} />} markdown={aboutPageData.disclaimer.markdown} />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <CardContent img={<img src={disclaimer} />} markdown={aboutPageData.official.markdown} />
        </CardBody>
      </Card>



      </Masonry>;

  return (
    <div className="container about">
        <h3 className="title lg-4 text-center">{label("about_bookofmormononline")}</h3>
        
          {cards}
    
    </div>
  );
}


function CardContent({img, markdown}){

  const lines = (markdown||"")?.split("\n");
  const firstLine = lines.shift().replace(/#+/g, "").trim();
  const rest = lines.join("\n").trim();

  return <div>
    <h3>{img}
    <span>{firstLine}</span>
    </h3>
    <ReactMarkdown linkTarget={'_blank'}>{rest}</ReactMarkdown>
  </div>
}
export default About;
