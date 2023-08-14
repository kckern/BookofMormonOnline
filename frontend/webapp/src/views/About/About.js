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
        setAboutPageData(result.markdown);

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
          <img src={what} />
          <ReactMarkdown>{aboutPageData.what.markdown}</ReactMarkdown>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <img src={why} />
          <ReactMarkdown>{aboutPageData.why.markdown}</ReactMarkdown>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <img src={disclaimer} />
          <ReactMarkdown>{aboutPageData.disclaimer.markdown}</ReactMarkdown>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <img src={who} />
          <ReactMarkdown linkTarget={'_blank'}>{aboutPageData.who.markdown}</ReactMarkdown>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <img src={official} />
          <ReactMarkdown>{aboutPageData.official.markdown}</ReactMarkdown>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <img src={bom} />
          <ReactMarkdown>{aboutPageData.bom.markdown}</ReactMarkdown>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <img src={contribute} />
          <ReactMarkdown>{aboutPageData.contribute.markdown}</ReactMarkdown>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <img src={contact} />
          <ReactMarkdown linkTarget={'_blank'}>{aboutPageData.contact.markdown}</ReactMarkdown>
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

export default About;
