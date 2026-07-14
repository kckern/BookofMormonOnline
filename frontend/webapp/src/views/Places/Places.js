/** @format */

import React, { useState, useEffect } from "react"
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI"
import Loader, { Spinner } from "../_Common/Loader"
import Masonry from "react-masonry-css"
import { isMobile, label, processName, replaceNumbers } from "src/models/Utils"
import { Link, useRouteMatch } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Input,
} from "reactstrap"
import BootstrapSwitchButton from 'bootstrap-switch-button-react'
import "./Places.css"
import "../People/People.css"



import brown from "../People/svg/brown.svg";
import green from "../People/svg/green.svg";
import blue from "../People/svg/blue.svg";
import yellow from "../People/svg/yellow.svg";
import black from "../People/svg/black.svg";
import grey from "../People/svg/grey.svg";
import orange from "../People/svg/orange.svg";
import red from "../People/svg/red.svg";


import nation from "../People/svg/nation.svg";
import land from "../People/svg/land.svg";
import city from "../People/svg/city.svg";
import town from "../People/svg/town.svg";
import geographic_feature from "../People/svg/geographic_feature.svg";
import geo_other from "../People/svg/other.svg";
import { SearchPopUp } from "../_Common/SearchPopUp"
import { useAppController } from "src/contexts/AppControllerContext";

function PlacesComponent() {
  const appController = useAppController();
  useEffect(() => document.title = label("menu_places") + " | " + label("home_title"), [])
  const [PlaceList, setPlaceList] = useState(null)

  const [placeFilters, setFilter] = useState({
    location: null,
    type: null,
    occupants: null,
    search: null,
  })

  const match = useRouteMatch()
  useEffect(() => {
    if (match?.params?.placeName) {
      appController.functions.setPopUp({
        type: "places",
        ids: [match.params.placeName],
        underSlug: "places",
      })
    }
  }, [match?.params?.placeName])
  if (!PlaceList)
    BoMOnlineAPI({ placeList: true }).then((result) => {
      setPlaceList(result.placeList)
    })

  const breakpointColumnsObj = {
    default: 8,
    1600: 7,
    1400: 6,
    1200: 5,
    1000: 4,
    800: 3,
    600: 2,
    400: 2
  }


  const occupantBadges = (string) => {
    var reps = {
      N: label("nephites"),
      J: label("jaredites"),
      L: label("lamanites"),
      I: label("israelites"),
      G: label("gadiantons"),
      M: label("mulekites"),
    }
    return string
      .split("")
      .map((l, index) =>
        reps[l] ? <span key={index} className={"IdBadge " + l}>{reps[l]}</span> : null
      )
  }
  const geoBadges = (string) => {
    var reps = {
      Z: label("land_of_zarahemla"),
      D: label("land_of_desolation"),
      N: label("land_of_nephi"),
      W: label("old_world"),
      B: label("land_bountiful"),
      O: null,
    }
    return string
      .split("")
      .map((l, index) => <span key={index} className={"location " + l}>{reps[l]}</span>)
  }
  const typeIcon = (string) => {
    var reps = {
      C: (key) => <img key={key} src={city} alt={label("city")} />,
      G: (key) => <img key={key} src={geographic_feature} alt={label("geographic_feature")} />,
      L: (key) => <img key={key} src={land} alt={label("land")} />,
      T: (key) => <img key={key} src={town} alt={label("town")} />,
      N: (key) => <img key={key} src={nation} alt={label("nation")} />,
      O: (key) => <img key={key} src={geo_other} alt={label("geo_other")} />,
    }
    return string?.split("")?.map((l, index) => reps[l]?.(index) || l)
  }

  const handleClick = (id, e) => {
    e.preventDefault()
    appController.functions.setPopUp({ type: "places", ids: [id],
    underSlug: "places", })
  }

  const filters = (item) => {
    let search = placeFilters.search
      ? new RegExp(placeFilters.search, "gi").test(item.name)
      : true
    let location = placeFilters.location
      ? testFilter(placeFilters, item, "location")
      : true
    let occupants = placeFilters.occupants
      ? testFilter(placeFilters, item, "occupants")
      : true
    let type = placeFilters.type ? testFilter(placeFilters, item, "type") : true
    return search && location && occupants && type
  }

  const testFilter = (filter, item, type) => {
    let filterString = filter[type]
    let itemString = item[type]
    let letters = itemString.split("")
    let matches = letters
      .map((l) => filterString.match(new RegExp(l, "gi")))
      .filter((m) => m)
    return filterString.split("").length === matches.length ? true : false
  }



  return (
    <div className='container noselect' style={{ display: "block" }}>
      <div id='page'>
        <h3 className='title lg-4 text-center'>{label("title_places")}</h3>
        <PlaceFilters  setFilter={setFilter} placeFilters={placeFilters} />
        <div className='PlaceList'>
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className='my-masonry-grid'
            columnClassName='my-masonry-grid_column'
          >
            {PlaceList ? (
              PlaceList.filter(filters).filter(p=>p.slug).map((place, i) => (

                <Link
                  key={i}
                  to={"/places/" + place.slug}
                  onClick={(e) => handleClick(place.slug, e)}
                >
                  <Card key={i}>
                    <CardHeader className='text-center'>
                      <h5> {processName(place.name)} </h5>
                    </CardHeader>
                    <CardBody
                      className='placeInfo'
                      style={{
                        backgroundImage:
                          `url(${assetUrl}/places/` +
                          place.slug +
                          ")",
                      }}
                    >
                        {!geoBadges(place.location) ? null : (
                          <div className='location'>
                            {geoBadges(place.location)}
                          </div>
                        )}
                        <div className='info'> {replaceNumbers(place.info)} </div>
                    </CardBody>
                    <CardFooter className='text-center'>
                      <div className="labels">{occupantBadges(place.occupants)}</div>
                      <div className="icons">{typeIcon(place.type)}</div>
                    </CardFooter>
                  </Card>
                </Link>
              ))
            ) : (
              <Spinner top={(isMobile())? "50vh" : "60vh"} />
            )}
          </Masonry>
        </div>
      </div>
    </div>
  )
}


export default PlacesComponent

export function PlaceFilters({ setFilter, placeFilters })
{
  const appController = useAppController();

  const [isOpen,setIsOpen] = useState(false);
  const [initSearchString,setInitSearchString] = useState('')

  const filterSections = {
    occupants: {
      title: label("occupants"),
      key: "occupants",
      filters: [
        { label: <span><img className="dot" src={grey} alt="" /> {label("biblical_israelite")}</span>, tag: "I" },
        { label: <span><img className="dot" src={yellow} alt="" /> {label("jaredite")}</span>, tag: "J" },
        { label: <span><img className="dot" src={green} alt="" /> {label("nephite")}</span>, tag: "N" },
        { label: <span><img className="dot" src={blue} alt="" /> {label("lamanite")}</span>, tag: "L" },
        { label: <span><img className="dot" src={orange} alt="" /> {label("mulekite")}</span>, tag: "M" },
        { label: <span><img className="dot" src={red} alt="" /> {label("gadianton")}</span>, tag: "G" },
        { label: <span><img className="dot" src={black} alt="" /> {label("other")}</span>, tag: "O" }
      ]
    },
    location: {
      title: label("greater_locale"),
      key: "location",
      filters: [
        { label: <span><img className="dot" src={brown} alt="" /> {label("land_of_first_Inheritance")}</span>, tag: "F" },
        { label: <span><img className="dot" src={red} alt="" /> {label("land_of_nephi")}</span>, tag: "N" },
        { label: <span><img className="dot" src={blue} alt="" /> {label("land_of_zarahemla")}</span>, tag: "Z" },
        { label: <span><img className="dot" src={green} alt="" /> {label("land_bountiful")}</span>, tag: "B" },
        { label: <span><img className="dot" src={yellow} alt="" /> {label("land_of_desolation")}</span>, tag: "D" },
        { label: <span><img className="dot" src={grey} alt="" /> {label("old_world")}</span>, tag: "W" },
        { label: <span><img className="dot" src={black} alt="" /> {label("geo_other")}</span>, tag: "O" }
      ]
    },
    type: {
      title: label("geo_type"),
      key: "type",
      filters: [

        { label: <span><img src={nation} alt="" />{label("nation")}</span>, tag: "N" },
        { label: <span><img src={land} alt="" />{label("land")}</span>, tag: "L" },
        { label: <span><img src={city} alt="" />{label("city")}</span>, tag: "C" },
        { label: <span><img src={town} alt="" />{label("town")}</span>, tag: "T" },
        { label: <span><img src={geographic_feature} alt="" />{label("geographic_feature")}</span>, tag: "G" },
        { label: <span><img src={geo_other} alt="" />{label("geo_other")}</span>, tag: "O" },
      ],
    },
  };

  const filterUI = (data) => {
    return (
      <ul>
        <li className='lihead'>{data.title}</li>
        <li className='lifoot'>
          <Button onClick={() => toggleFilterCategory(data.key, true)}>
            {label("select_all")}
          </Button>
          <Button onClick={() => toggleFilterCategory(data.key, false)}>
            {label("clear")}
          </Button>
        </li>
        {data.filters.map((f, index) => (
          <li key={index} className='item' onClick={(e) => toggleFilter(data.key, f.tag)}>
            <BootstrapSwitchButton
              checked={new RegExp(f.tag).test(placeFilters[data.key])}
              onstyle='success'
              offlabel={label("off")}
              onstyle='success'
              onlabel={label("on")}
              size={"xs"}
            />
            {f.label}
          </li>
        ))}
      </ul>
    )
  }

  const toggleFilter = (key, val) => {
    let tmp = { ...placeFilters }
    if (new RegExp(val).test(placeFilters[key])) {
      tmp[key] = tmp[key].replace(new RegExp(val), "")
      if (tmp[key] === "") tmp[key] = null
    } else tmp[key] = tmp[key] !== null ? tmp[key] + val : val
    setFilter(tmp)
  }

  const toggleFilterCategory = (key, all) => {
    let tmp = { ...placeFilters }
    if (!all) tmp[key] = null
    else tmp[key] = filterSections[key].filters.map((f) => f.tag).join("")
    setFilter(tmp)
  }

  const {placeList} = appController.preLoad;

  const selectItemHandler = (slug)=>{
    appController.functions.setPopUp({ type: "places", ids: [slug],underSlug: "places",});
    setIsOpen(false);
}


  const filterBox = <><h5 className='ppFiltersHeading'>{label("selectors")}</h5>
  <div className='ppFilters'>
  {!isMobile() && <button className="ppFiltersSearchButton" onClick={()=>setIsOpen(true)}>
    🔍
    </button>}
    <div className='ppColumns'>
      {filterUI(filterSections.occupants)}
      {filterUI(filterSections.location)}
      {filterUI(filterSections.type)}
    </div>
    {!isMobile() && <SearchPopUp
      placeholder="search_for_a_place"
      preLoadData={placeList}
      selectItemHandler={selectItemHandler}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      testFieldNames={{primary:'name',secondary:'info'}}
      assetName="places"
      initSearchString={initSearchString}
      />}
  </div></>

    const handleClick = ()=>{

      appController.functions.setPopUp({
        type: "pFilter",
        ids: [appController.states.user.social?.user_id],
        underSlug: "places",
        popUpData: { filterBox,setFilter, placeFilters
        },
      });

    }

    const handleKeyDown = (event) => {
      const ignoreKeys = ['-', '_', '=', '+', '[', ']', 'Tab',"\\","/","|"];
        if (document.activeElement.tagName !== "INPUT" && ignoreKeys.includes(event.key)) {
          return false;
        }
        if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
        if (event.key === 'Escape') {
          setIsOpen(false);
        }

        //input is focused
        if (document.activeElement.tagName === "INPUT") {
          event.stopPropagation();
          return false;
        }

        // todo: handle arrows and +/-
        else {
          if(event.key.length > 1) return false;
          setIsOpen(true);
          setInitSearchString(event.key);
        }
      };

      useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return ()=>{
          window.removeEventListener('keydown', handleKeyDown);
        }
      }, [])

  if(isMobile()) return <div className="filterDrawerButton">
    <Button onClick={handleClick}>{label("selectors")}</Button>
    <button className="ppFiltersSearchButtonMobile" onClick={()=>setIsOpen(true)}>🔍</button>
    <SearchPopUp
      placeholder="search_for_a_place"
      preLoadData={placeList}
      selectItemHandler={selectItemHandler}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      testFieldNames={{primary:'name',secondary:'info'}}
      assetName="places"
      initSearchString={initSearchString}
      />
    </div>;

  return filterBox;


}
