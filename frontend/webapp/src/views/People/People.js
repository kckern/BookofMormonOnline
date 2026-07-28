import React, { useState, useEffect, useCallback } from "react";

import Loader, { Spinner } from "../_Common/Loader";
import { Card, CardHeader, CardBody, CardFooter, Input } from "reactstrap";
import { Link, useRouteMatch } from 'react-router-dom';
import Masonry from 'react-masonry-css'
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { isMobile, label, processName, replaceNumbers } from "src/models/Utils";
import "./People.css"
import { assetUrl } from "src/models/BoMOnlineAPI";

import royalty from "./svg/royalty.svg";
import prophet from "./svg/prophet.svg";
import priest from "./svg/priest.svg";
import record_keeper from "./svg/record_keeper.svg";
import warrior from "./svg/warrior.svg";
import judge from "./svg/judge.svg";
import other from "./svg/other.svg";


import individual from "./svg/individual.svg";
import group from "./svg/group.svg";
import organization from "./svg/organization.svg";
import society from "./svg/society.svg";
import civilization from "./svg/civilization.svg";



import green from "./svg/green.svg";
import blue from "./svg/blue.svg";
import yellow from "./svg/yellow.svg";
import black from "./svg/black.svg";
import grey from "./svg/grey.svg";
import orange from "./svg/orange.svg";
import red from "./svg/red.svg";
import { useAppController } from "src/contexts/AppControllerContext";
import FilterPanel from "src/views/_Common/FilterPanel/FilterPanel";


function PeopleComponent() {
  const appController = useAppController();

  useEffect(() => document.title = label("menu_people") + " | " + label("home_title"), [])
  const [peopleList, setPersonList] = useState(null);


  const [peopleFilters, setFilter] = useState({
    identification: null,
    classification: null,
    unit: null,
    search: null
  });



  const match = useRouteMatch();
  useEffect(() => {
    if (match?.params?.personName) {
      appController.functions.setPopUp({ type: "people", ids: [match.params.personName],
      underSlug: "people", });
    }
  }, [match?.params?.personName])


  if (!peopleList) BoMOnlineAPI({ personList: true }).then(result => {
    setPersonList(result.personList);
  });

  const breakpointColumnsObj = {
    default: 8,
    1600: 7,
    1400: 6,
    1200: 5,
    1000: 4,
    800: 3,
    600: 2,
    400: 2
  };

  const handleClick = (id, e) => {
    e.preventDefault();
    appController.functions.setPopUp({ type: "people", ids: [id],
    underSlug: "people",});
  }

  const personIcons = (string) => {
    var reps = {
      R: (key) => <img key={key} src={royalty} alt={label("royalty")} />, //Royalty
      P: (key) => <img key={key} src={prophet} alt={label("prophet")} />, //Prophet
      I: (key) => <img key={key} src={priest} alt={label("priest")} />, //Prophet
      W: (key) => <img key={key} src={warrior} alt={label("warrior")} />,
      J: (key) => <img key={key} src={judge} alt={label("judge")} />,
      O: (key) => <img key={key} src={other} alt={label("other")} />,
      H: (key) => <img key={key} src={record_keeper} alt={label("record_keeper")} />,
    };
    return string?.split("")?.map((i, index) => reps[i]?.(index));
  };

  const unitIcons = (string) => {
    var reps = {
      I: (key) => <img key={key} src={individual} alt={label("individual")} />, //Royalty
      G: (key) => <img key={key} src={group} alt={label("group")} />, //Prophet
      O: (key) => <img key={key} src={organization} alt={label("organization")} />, //Prophet
      S: (key) => <img key={key} src={society} alt={label("society")} />,
      C: (key) => <img key={key} src={civilization} alt={label("civilization")} />
    };
    return string?.split("")?.map((i, index) => reps[i]?.(index))[0];
  };

  const affiliationBadges = (string) => {
    var reps = {
      N: label("nephite"),
      J: label("jaredite"),
      L: label("lamanite"),
      I: label("israelite"),
      G: label("gadianton"),
      M: label("mulekite"),
      B: label("biblical"),
      H: label("spiritual"),
      O: null
    };
    return string?.split("")?.map(l => (reps[l]) ? <span key={l} className={"IdBadge " + l}>{reps[l]}</span> : null)
  };

  const filters = (item) => {
    let search = (peopleFilters.search) ? (new RegExp(peopleFilters.search, "gi").test(item.name)) : true;
    let identification = (peopleFilters.identification) ? testFilter(peopleFilters, item, "identification") : true;
    let classification = (peopleFilters.classification) ? testFilter(peopleFilters, item, "classification") : true;
    let unit = (peopleFilters.unit) ? testFilter(peopleFilters, item, "unit") : true;
    return search && unit && identification && classification;
  };

  const testFilter = (filter, item, type) => {
    let filterString = filter[type];
    let itemString = item[type];
    let letters = itemString.split("")
    let matches = letters.map(l => filterString.match(new RegExp(l, "gi"))).filter(m => m);
    return (filterString.split("").length === matches.length) ? true : false;
  }

  return (
    <div className="container noselect" style={{ display: 'block' }}>
      <div id="page" >
        <h3 className="title lg-4 text-center">{label("title_people")}</h3>
        <PeopleFilters setFilter={setFilter} peopleFilters={peopleFilters} />
        <div className="peopleList">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column">
            {peopleList ? peopleList.filter(filters).map((person, i) => ( person ?
              <Link key={i} to={"/people/" + person.slug} onClick={(e) => handleClick(person.slug, e)}>
                <Card className="personCard">
                  <CardHeader className="text-center">
                    <h5>{unitIcons(person.unit)} <span>{processName(person.name)}</span></h5>
                  </CardHeader>
                  <CardBody className="personInfo" style={{ backgroundImage: `url(${assetUrl}/people/` + person.slug + ")" }}>
                    {person.date ? <span className="date">{(person.date)}</span> : null}
                    <div>
                      {replaceNumbers(person.title)}
                    </div>
                  </CardBody>
                  <CardFooter className="text-center">
                    <div className="personInfoBadges">{affiliationBadges(person.identification)} </div>
                    <div className="personIcons">{personIcons(person.classification)}</div>
                  </CardFooter>
                </Card>
              </Link>
            : null )) : <Spinner top={(isMobile()) ? "50vh" : "60vh"} />}
          </Masonry>
        </div>
      </div>
    </div>);



}



export function PeopleFilters({ setFilter, peopleFilters }) {
  const appController = useAppController();
  const { personList } = appController.preLoad;

  const filterSections = {
    identification: {
      title: label("social_identification"),
      key: "identification",
      filters: [
        { label: <span><img className="dot" src={grey} alt="" /> {label("biblical_israelite")}</span>, tag: "B" },
        { label: <span><img className="dot" src={yellow} alt="" /> {label("jaredite")}</span>, tag: "J" },
        { label: <span><img className="dot" src={green} alt="" /> {label("nephite")}</span>, tag: "N" },
        { label: <span><img className="dot" src={blue} alt="" /> {label("lamanite")}</span>, tag: "L" },
        { label: <span><img className="dot" src={orange} alt="" /> {label("mulekite")}</span>, tag: "M" },
        { label: <span><img className="dot" src={red} alt="" /> {label("gadianton")}</span>, tag: "G" },
        { label: <span><img className="dot" src={black} alt="" /> {label("other")}</span>, tag: "O" },
      ],
    },
    classification: {
      title: label("social_classification"),
      key: "classification",
      filters: [
        { label: <span><img src={royalty} alt="" />{label("royalty")}</span>, tag: "R" },
        { label: <span><img src={prophet} alt="" />{label("prophet")}</span>, tag: "P" },
        { label: <span><img src={priest} alt="" />{label("priest")}</span>, tag: "I" },
        { label: <span><img src={record_keeper} alt="" />{label("record_keeper")}</span>, tag: "H" },
        { label: <span><img src={warrior} alt="" />{label("warrior")}</span>, tag: "W" },
        { label: <span><img src={judge} alt="" />{label("judge")}</span>, tag: "J" },
        { label: <span><img src={other} alt="" />{label("other")}</span>, tag: "O" },
      ],
    },
    unit: {
      title: label("social_unit"),
      key: "unit",
      filters: [
        { label: <span><img src={individual} alt="" />{label("individual")}</span>, tag: "I" },
        { label: <span><img src={group} alt="" />{label("group")}</span>, tag: "G" },
        { label: <span><img src={organization} alt="" />{label("organization")}</span>, tag: "O" },
        { label: <span><img src={society} alt="" />{label("society")}</span>, tag: "S" },
        { label: <span><img src={civilization} alt="" />{label("civilization")}</span>, tag: "C" },
        { label: <span><img src={other} alt="" />{label("other")}</span>, tag: "X" },
      ],
    },
  };

  const axes = [filterSections.identification, filterSections.classification, filterSections.unit].map((s) => ({
    name: s.key,
    title: s.title,
    options: s.filters.map((f) => ({ tag: f.tag, label: f.label })),
  }));

  const value = {
    identification: (peopleFilters.identification || "").split(""),
    classification: (peopleFilters.classification || "").split(""),
    unit: (peopleFilters.unit || "").split(""),
  };

  const onChange = (next) =>
    setFilter({
      ...peopleFilters,
      identification: next.identification.join("") || null,
      classification: next.classification.join("") || null,
      unit: next.unit.join("") || null,
    });

  const selectItemHandler = (slug) =>
    appController.functions.setPopUp({ type: "people", ids: [slug], underSlug: "people" });

  return (
    <FilterPanel
      heading={label("filters")}
      axes={axes}
      value={value}
      onChange={onChange}
      search={{
        placeholder: "search_for_a_person",
        preLoadData: personList,
        testFieldNames: { primary: "name", secondary: "title" },
        assetName: "people",
        selectItemHandler,
      }}
    />
  );
}


export default PeopleComponent;
