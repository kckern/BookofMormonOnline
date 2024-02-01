import React, { useState, useEffect, useCallback } from "react";

import Loader, { Spinner } from "../_Common/Loader";
import { Card, CardHeader, CardBody, CardFooter, Button, Input } from "reactstrap";
import BootstrapSwitchButton from 'bootstrap-switch-button-react'
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


function PeopleComponent({ appController }) {

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
      R: <img src={royalty} />, //Royalty
      P: <img src={prophet} />, //Prophet
      I: <img src={priest} />, //Prophet
      W: <img src={warrior} />,
      J: <img src={judge} />,
      O: <img src={other} />,
      H: <img src={record_keeper} />,
    };
    return string?.split("")?.map(i => reps[i]);
  };
  const unitIcons = (string) => {
    var reps = {
      I: <img src={individual} />, //Royalty
      G: <img src={group} />, //Prophet
      O: <img src={organization} />, //Prophet
      S: <img src={society} />,
      C: <img src={civilization} />
    };
    return string?.split("")?.map(i => reps[i])[0];
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
        <PeopleFilters setFilter={setFilter} peopleFilters={peopleFilters}  appController={appController}/>
        <div className="peopleList">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column">
            {peopleList ? peopleList.filter(filters).map((person, i) => ( person ?
              <Link to={"/people/" + person.slug} onClick={(e) => handleClick(person.slug, e)}>
                <Card key={i} className="personCard">
                  <CardHeader className="text-center">

                    <h5>{unitIcons(person.unit)} <Link to={"/people/" + person.slug}><span>{processName(person.name)}</span></Link></h5>

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
                </Card>  </Link>
            : null )) : <Spinner top={(isMobile()) ? "50vh" : "60vh"} />}
          </Masonry>
        </div>
      </div>
    </div>);



}



export function PeopleFilters({ appController, setFilter, peopleFilters }) {

  const filterSections = {
    identification: {
      title: label("social_identification"),
      key: "identification",
      filters: [
        { label: <span><img className="dot" src={grey} /> {label("biblical_israelite")}</span>, tag: "B" },
        { label: <span><img className="dot" src={yellow} /> {label("jaredite")}</span>, tag: "J" },
        { label: <span><img className="dot" src={green} /> {label("nephite")}</span>, tag: "N" },
        { label: <span><img className="dot" src={blue} /> {label("lamanite")}</span>, tag: "L" },
        { label: <span><img className="dot" src={orange} /> {label("mulekite")}</span>, tag: "M" },
        { label: <span><img className="dot" src={red} /> {label("gadianton")}</span>, tag: "G" },
        { label: <span><img className="dot" src={black} /> {label("other")}</span>, tag: "O" }
      ]
    },
    classification: {
      title: label("social_classification"),
      key: "classification",
      filters: [
        { label: <span><img src={royalty} />{label("royalty")}</span>, tag: "R" },
        { label: <span><img src={prophet} />{label("prophet")}</span>, tag: "P" },
        { label: <span><img src={priest} />{label("priest")}</span>, tag: "I" },
        { label: <span><img src={record_keeper} />{label("record_keeper")}</span>, tag: "H" },
        { label: <span><img src={warrior} />{label("warrior")}</span>, tag: "W" },
        { label: <span><img src={judge} />{label("judge")}</span>, tag: "J" },
        { label: <span><img src={other} />{label("other")}</span>, tag: "O" },
      ]
    },
    unit: {
      title: label("social_unit"),
      key: "unit",
      filters: [
        { label: <span><img src={individual} />{label("individual")}</span>, tag: "I" },
        { label: <span><img src={group} />{label("group")}</span>, tag: "G" },
        { label: <span><img src={organization} />{label("organization")}</span>, tag: "O" },
        { label: <span><img src={society} />{label("society")}</span>, tag: "S" },
        { label: <span><img src={civilization} />{label("civilization")}</span>, tag: "C" },
        { label: <span><img src={other} />{label("other")}</span>, tag: "X" },
      ]
    }
  };

  const filterUI = (data) => {
    return <ul>
      <li className="lihead">{data.title}</li>
      <li className="lifoot">
        <Button onClick={() => toggleFilterCategory(data.key, true)}>{label("select_all")}</Button>
        <Button onClick={() => toggleFilterCategory(data.key, false)}>{label("clear")}</Button>
      </li>
      {data.filters.map(f =>
        <li className="item" key={f.tag} onClick={(e) => toggleFilter(data.key, f.tag)}>
          <BootstrapSwitchButton
            checked={new RegExp(f.tag).test(peopleFilters[data.key])}
            onstyle='success'
            offlabel={label("off")}
            onlabel={label("on")}
            size={"xs"}
          />
          {f.label}
        </li>)}

    </ul>
  }

  const toggleFilter = (key, val) => {
    let tmp = { ...peopleFilters }
    if ((new RegExp(val)).test(peopleFilters[key])) {
      tmp[key] = tmp[key].replace((new RegExp(val)), '');
      if (tmp[key] === "") tmp[key] = null;
    }
    else tmp[key] = (tmp[key] !== null) ? tmp[key] + val : val;
    setFilter(prev=>{
			return tmp;
		});
  }


  const toggleFilterCategory = (key, all) => {
    let tmp = { ...peopleFilters }
    if (!all) tmp[key] = null
    else tmp[key] = filterSections[key].filters.map(f => f.tag).join("");
    setFilter(tmp);
  }

  const filterBox = <><h5 className="ppFiltersHeading">{label("filters")} </h5>
    <div className="ppFilters">
      <Input className="ppSearch" placeholder={"🔍" + label("search")} onFocus={(e) => e.target.placeholder = ""}
        onChange={(e) => {
          let tmp = { ...peopleFilters }
          tmp.search = e.target.value;
          setFilter(tmp)
        }}
      />
      <div className="ppColumns">
        {filterUI(filterSections.identification)}
        {filterUI(filterSections.classification)}
        {filterUI(filterSections.unit)}
      </div>
    </div>
  </>
    const handleClick = ()=>{
      appController.functions.setPopUp({
        type: "pFilter",
        ids: [appController.states.user.social?.user_id],
        underSlug: "people",
        popUpData: { filterBox,setFilter, peopleFilters
        },
      });
    }
	
	useEffect(()=>{
		if(isMobile() && appController.states.popUp.type === "pFilter"){
			appController.functions.setPopUp({
				...appController.states.popUp,
				popUpData:{
					filterBox,setFilter, peopleFilters
				}
			})
		}
	},[peopleFilters,appController.states.popUp.type])

  if (isMobile()) return <div className="filterDrawerButton"><Button onClick={handleClick}>{label("filters")}</Button></div>;

  return filterBox;
}


export default PeopleComponent;
