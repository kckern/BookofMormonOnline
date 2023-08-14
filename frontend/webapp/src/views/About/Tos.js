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
import official from "./icons/official.svg";

function About() {
  const match = useRouteMatch();
  const [aboutPageData, setAboutPageData] = useState(null);

  useEffect(() => {
    BoMOnlineAPI({ markdown: ["tos"] }, { useCache: false })
      .then((result) => {
        setAboutPageData(result.markdown);

      })
  }, [])


  if (!aboutPageData) return <Loader />;


  const breakpointColumnsObj = {
    default: 1,
  };



  return (
    <div className="container">
      <div id="page">
        <h3 className="title lg-4 text-center">{label("about_bookofmormononline")}</h3>
        <div className="about">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >

            <Card>
              <CardBody>
                <img src={official} />
                <ReactMarkdown>{aboutPageData.tos.markdown}</ReactMarkdown>
              </CardBody>
            </Card>


          </Masonry>
        </div>
      </div>
    </div>
  );
}

export default About;
