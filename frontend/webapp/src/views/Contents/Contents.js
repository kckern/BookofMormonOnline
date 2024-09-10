import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
// COMPONENTS
import Loader from "../_Common/Loader";
// API ACTIONS
// REDUX ACTIONS
// ACTIONS TYPE
import { Card, CardHeader, CardBody } from "reactstrap";
import Masonry from "react-masonry-css";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import "./Contents.css";
import { label } from 'src/models/Utils';

function Contents() {
  const [contents, setContents] = useState([]);
  useEffect(()=>document.title = label("table_of_contents") + " | " + label("home_title"),[])

  const contentsUI = () => {
    const breakpointColumnsObj = {
      default: 3,
      1100: 2,
      766: 1,
    };


    return (
      <>
        <div id="page" className="table-of-content">
          <h3 className="title lg-4 text-center">{label("table_of_contents")}</h3>
          <div className="toc">
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {contents.map((chapter, i) => (
                <Card key={i}>
                  <CardHeader className="text-center">
                    <Link to={`/${chapter.slug}`}>
                      <h5>{chapter.title} </h5>
                      <div
                        className="divImg"
                        style={{
                          backgroundImage: `url("${assetUrl}/home/${chapter.slug}-1")`,
                        }}
                      >
                        <div>{chapter.description} </div>
                      </div>
                    </Link>
                  </CardHeader>
                  <CardBody>
                    {chapter.pages.map((page, i) => (
                      <ul key={i}>
                        <Link to={`/${page.slug}`}>{page.title}</Link>
                        <ul>
                          {page.sections.map((section, i) =>
                            section.slug ? (
                              <li key={i}>
                                <Link to={`/${section.slug}`}>
                                  {section.title}
                                </Link>
                              </li>
                            ) : (
                              ""
                            )
                          )}
                        </ul>
                      </ul>
                    ))}
                  </CardBody>
                </Card>
              ))}
            </Masonry>
          </div>
        </div>
      </>
    );
  };
  if (!contents.length)
    BoMOnlineAPI({ contents: null }).then((r) => setContents(r.contents));
  return contents?.length ? (
    <div className="container" style={{ display: "block" }}>
      {contentsUI()}
    </div>
  ) : (
    <Loader />
  );
}

export default Contents;
