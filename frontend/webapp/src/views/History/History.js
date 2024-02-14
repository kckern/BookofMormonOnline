

import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useRouteMatch } from "react-router-dom";
import {
  Button,
  ButtonGroup,
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Pagination,
  PaginationItem,
  PaginationLink,
  Row,
  Col,
  CardFooter,
} from "reactstrap";

import "./History.css"
import { docs } from "./docs.js"
import Masonry from 'react-masonry-css'
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import { isMobile, label } from 'src/models/Utils';
import Loader, { Spinner } from '../_Common/Loader';
import Parser from "html-react-parser";
import moment from 'moment';
import ReactMarkdown from "react-markdown";
import { history } from 'src/models/routeHistory';


function History({ appController }) {


  const match = useRouteMatch();
  const [dateFilter, setDate] = useState(1829);
  const [docList, setDocList] = useState(null);
  const [introText, setIntro] = useState(null);


  var lowEnd = 1829;
  var highEnd = 1844;
  var range = [];
  while (lowEnd <= highEnd) {
    range.push(lowEnd++);
  }
  range.push((lowEnd++)+"+");
  const breakpointColumnsObj = {
    default: 4,
    1400: 3,
    1100: 2,
    800: 1
  };

  useEffect(() => {
    BoMOnlineAPI({ history: true, markdown: "history" }).then(r => {  
      setDocList(r.history); 
      setIntro(r.markdown.history.markdown);
    
      if(match.params.slug){
        if(/^[0-9+]+$/.test(match.params.slug))
        {
          setDate(parseInt(match.params.slug));
        }
        else{
          let item = r.history.filter(i=>i.slug===match.params.slug).shift();
          setDate(parseInt(match.params.slug.substr(0,4)));
          appController.functions.setPopUp({
            type: "history",
            ids: [item.slug],
            popUpData: item,
            underSlug: `history/${match.params.slug.substr(0,4)}`,
            vhtop: 10
          })
        }

      }
    
    })
  }, [])


  const displayDate = (date) => {
    let len = date.length;
    return moment(date, [(len === 4) ? "YYYY" : 'YYYY-MM-DD']).format((len === 4) ?  label("history_date_format_year") : (len === 7) ?  label("history_date_format_month") : label("history_date_format_full"))
  }

  const contents = (!docList) ? <Spinner top={isMobile() ? "60vh" : null} /> : <div className="history">

    <ButtonGroup data-toggle="buttons">
      {range.map(r => <Button
        onClick={() => setDate(()=>{
          history.push("/history/"+r);
          return r})}
        className={"btn-round " + ((r === dateFilter) ? "active" : "")}
        color="info"
        outline
        type="button"
      >{label("year_format",[r])}</Button>)}
    </ButtonGroup>

    <div className="historicaldocs">
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column">
        {docList.filter(i => i.year === dateFilter).map((doc, i) => (
          <Card key={i} onClick={() => appController.functions.setPopUp({
            type: "history",
            ids: [doc.slug],
            popUpData: doc,
            vhtop: 10,
            underSlug: `history/${match.params.slug?.substr(0,4) || dateFilter}`,
          })}
            className='historycard'
          >
            <CardHeader className="text-left">
              <div className='sourcebox'>
                <div className='pub'>{doc.source}</div>
                <div className='date'>{displayDate(doc.date)}</div>
              </div>

            </CardHeader>
            <div className='thumbbox'>
            <img key={doc.id} src={`${assetUrl}/history/thumbs/${doc.id}`} />
            <div className='thumb_teaser'>{Parser(doc.teaser)}</div>
            </div>
            <h5>{doc.document}</h5>
            <div className='citation'>{Parser(doc.citation + "")}</div>
            <CardBody>


            </CardBody>
          </Card>
        ))}
      </Masonry>
    </div>
  </div>

  return (
    <div className="container " style={{ display: 'block' }}>
      <div id="page" >
        <h3 className="title lg-4 text-center">{label("title_history")}</h3>
        <div className='archive_intro'><ReactMarkdown linkTarget={'_blank'}>{introText}</ReactMarkdown></div>
        {contents}
      </div>
    </div>);

}

export default History;