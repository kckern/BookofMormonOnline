import React, { useEffect, useState, useCallback, useRef } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import "./Contact.css";
import Loader from "../_Common/Loader";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Input,
  CardDeck,
} from "reactstrap";
import Masonry from "react-masonry-css";
import facebook from "./img/facebook.png";
import twitter from "./img/twitter.png";
import instagram from "./img/instagram.png";
import patreon from "./img/patreon.png";
import { label } from "src/models/Utils";

function Contact({ appController }) {
  const breakpointColumnsObj = {
    default: 2,
    1200: 1,
  };
  return (
    <div className="container">
      <div id="page">
        <h3 className="title lg-4 text-center">{label("contact")}</h3>
        <div className="contact">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            <Card>
              <CardHeader className="text-center">
                <h5>{label("contact_form")}</h5>
              </CardHeader>
              <CardBody></CardBody>
            </Card>
            <Card>
              <CardHeader className="text-center">
                <h5>{label("social_media")}</h5>
              </CardHeader>
              <CardBody>
                <a
                  target={"_blank"}
                  href="https://www.facebook.com/BookofMormonOnline"
                  rel="noreferrer"
                >
                  <Button>
                    {" "}
                    <img src={facebook} /> {label("facebook")}
                  </Button>
                </a>
                <a
                  target={"_blank"}
                  href="https://www.twitter.com/BkMormonOnline"
                  rel="noreferrer"
                >
                  <Button>
                    {" "}
                    <img src={twitter} /> {label("twitter")}
                  </Button>
                </a>
                <a
                  target={"_blank"}
                  href="https://www.instagram.com/BookofMormonOnline"
                  rel="noreferrer"
                >
                  <Button>
                    {" "}
                    <img src={instagram} /> {label("instagram")}
                  </Button>
                </a>
                <a
                  target={"_blank"}
                  href="https://www.patreon.com/bookofmormononline"
                  rel="noreferrer"
                >
                  <Button>
                    {" "}
                    <img src={patreon} /> {label("patreon")}
                  </Button>
                </a>
              </CardBody>
            </Card>
          </Masonry>
        </div>
      </div>
    </div>
  );
}

export default Contact;
