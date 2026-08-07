

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams, useRouteMatch } from "react-router-dom";
import {
  Button,
  ButtonGroup,
  Pagination,
  PaginationItem,
  PaginationLink,
  Row,
  Col,
  UncontrolledTooltip,
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
import { useAppController } from "src/contexts/AppControllerContext";
import HistoryBreadcrumb from "./HistoryBreadcrumb";
import HistorySourceCard from "./HistorySourceCard";


function History() {
  const appController = useAppController();


  useEffect(()=>document.title = label("menu_history") + " | " + label("home_title"),[])


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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const yearTip = useMemo(() => {
    const map = {};
    for (const r of range) {
      const isBucket = typeof r === "string";
      const min = isBucket ? parseInt(r, 10) : r;
      const cands = (docList || []).filter((d) => {
        if (!d.mini_quote) return false;
        return isBucket ? Number(d.year) >= min : Number(d.year) === r;
      });
      if (!cands.length) continue;
      const d = cands[Math.floor(Math.random() * cands.length)];
      const q = String(d.mini_quote).trim();
      map[r] = d.source ? `“${q}” — ${d.source}` : `“${q}”`;
    }
    return map;
  }, [docList]); // eslint-disable-line react-hooks/exhaustive-deps

  const breakpointColumnsObj = {
    default: 4,
    1400: 3,
    1100: 2,
    800: 1
  };

  useEffect(() => {
    BoMOnlineAPI({ history: { archive: "reception" }, markdown: "history" }).then(r => {
      setDocList(r.history); 
      setIntro(r.markdown.history.markdown);
    
      if(match.params.slug){
        if(/^[0-9+]+$/.test(match.params.slug))
        {
          setDate(parseInt(match.params.slug));
        }
        else{
          let item = r.history.filter(i=>i.slug===match.params.slug).shift();
          const yearPrefix = match.params.slug.substr(0,4);
          if (/^\d{4}$/.test(yearPrefix)) setDate(parseInt(yearPrefix));
          appController.functions.setPopUp({
            type: "history",
            ids: [match.params.slug],
            popUpData: item || { slug: match.params.slug },
            underSlug: `history/${yearPrefix}`,
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
      {range.map(r => {
        const btnId = `yrbtn-${String(r).replace(/\W+/g, "")}`;
        return (
          <React.Fragment key={r}>
            <Button
              id={btnId}
              onClick={() => setDate(()=>{
                history.push("/history/reception/"+r);
                return r})}
              className={"btn-round " + ((r === dateFilter) ? "active" : "")}
              color="info"
              outline
              type="button"
            >{label("year_format",[r])}</Button>
            {yearTip[r] ? (
              <UncontrolledTooltip target={btnId} placement="top" delay={{ show: 150, hide: 0 }}>
                {yearTip[r]}
              </UncontrolledTooltip>
            ) : null}
          </React.Fragment>
        );
      })}
    </ButtonGroup>

    <div className="historicaldocs">
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column">
        {docList.filter(i => i.year === dateFilter).map((doc, i) => (
          <HistorySourceCard
            key={i}
            doc={doc}
            variant="reception"
            displayDate={displayDate}
            onOpen={(d) => appController.functions.setPopUp({
              type: "history",
              ids: [d.slug],
              popUpData: d,
              vhtop: 10,
              underSlug: `history/${match.params.slug?.substr(0, 4) || dateFilter}`,
            })}
          />
        ))}
      </Masonry>
    </div>
  </div>

  return (
    <div className="container " style={{ display: 'block' }}>
      <div id="page" >
        <HistoryBreadcrumb sectionKey="reception" />
        <h3 className="title lg-4 text-center">{label("title_history")}</h3>
        <div className='archive_intro'><ReactMarkdown linkTarget={'_blank'}>{introText}</ReactMarkdown></div>
        {contents}
      </div>
    </div>);

}

export default History;