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

function PlacesComponent({ appController }) {
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
      .map((l) =>
        reps[l] ? <span className={"IdBadge " + l}>{reps[l]}</span> : null
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
      .map((l) => <span className={"location " + l}>{reps[l]}</span>)
  }
  const typeIcon = (string) => {
    var reps = {
      C: <img src={city} />,
      G: <img src={geographic_feature} />,
      L: <img src={land} />,
      T: <img src={town} />,
      N: <img src={nation} />,
      O: <img src={geo_other} />,
    }
    return string.split("").map((l) => reps[l] || l)
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
        <PlaceFilters  setFilter={setFilter} placeFilters={placeFilters} appController={appController}/>
        <div className='PlaceList'>
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className='my-masonry-grid'
            columnClassName='my-masonry-grid_column'
          >
            {PlaceList ? (
              PlaceList.filter(filters).filter(p=>p.slug).map((place, i) => (

                <Link
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

export function PlaceFilters({ appController, setFilter, placeFilters })
{



  const filterSections = {
    occupants: {
      title: label("occupants"),
      key: "occupants",
      filters: [
        { label: <span><img className="dot" src={grey} /> {label("biblical_israelite")}</span>, tag: "I" },
        { label: <span><img className="dot" src={yellow} /> {label("jaredite")}</span>, tag: "J" },
        { label: <span><img className="dot" src={green} /> {label("nephite")}</span>, tag: "N" },
        { label: <span><img className="dot" src={blue} /> {label("lamanite")}</span>, tag: "L" },
        { label: <span><img className="dot" src={orange} /> {label("mulekite")}</span>, tag: "M" },
        { label: <span><img className="dot" src={red} /> {label("gadianton")}</span>, tag: "G" },
        { label: <span><img className="dot" src={black} /> {label("other")}</span>, tag: "O" }
      ]
    },
    location: {
      title: label("greater_locale"),
      key: "location",
      filters: [
        { label: <span><img className="dot" src={brown} /> {label("land_of_first_Inheritance")}</span>, tag: "F" },
        { label: <span><img className="dot" src={red} /> {label("land_of_nephi")}</span>, tag: "N" },
        { label: <span><img className="dot" src={blue} /> {label("land_of_zarahemla")}</span>, tag: "Z" },
        { label: <span><img className="dot" src={green} /> {label("land_bountiful")}</span>, tag: "B" },
        { label: <span><img className="dot" src={yellow} /> {label("land_of_desolation")}</span>, tag: "D" },
        { label: <span><img className="dot" src={grey} /> {label("old_world")}</span>, tag: "W" },
        { label: <span><img className="dot" src={black} /> {label("geo_other")}</span>, tag: "O" }
      ]
    },
    type: {
      title: label("geo_type"),
      key: "type",
      filters: [

        { label: <span><img src={nation} />{label("nation")}</span>, tag: "N" },
        { label: <span><img src={land} />{label("land")}</span>, tag: "L" },
        { label: <span><img src={city} />{label("city")}</span>, tag: "C" },
        { label: <span><img src={town} />{label("town")}</span>, tag: "T" },
        { label: <span><img src={geographic_feature} />{label("geographic_feature")}</span>, tag: "G" },
        { label: <span><img src={geo_other} />{label("geo_other")}</span>, tag: "O" },
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
        {data.filters.map((f) => (
          <li className='item' onClick={(e) => toggleFilter(data.key, f.tag)}>
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
  

  const filterBox = <><h5 className='ppFiltersHeading'>{label("selectors")}</h5>
  <div className='ppFilters'>
    <Input
      className='ppSearch'
      placeholder={"🔍" + label("search")}
      onFocus={(e) => (e.target.placeholder = "")}
      onChange={(e) => {
        let tmp = { ...placeFilters }
        tmp.search = e.target.value
        setFilter(tmp)
      }}
    />
    <div className='ppColumns'>
      {filterUI(filterSections.occupants)}
      {filterUI(filterSections.location)}
      {filterUI(filterSections.type)}
    </div>
  </div></>

    const handleClick = ()=>{

      appController.functions.setPopUp({
        type: "pFilter",
        ids: [appController.states.user.social.user_id],
        underSlug: "places",
        popUpData: { filterBox,setFilter, placeFilters
        },
      });

    }

  if(isMobile()) return <div className="filterDrawerButton">
    <Button onClick={handleClick}>{label("selectors")}</Button>
    </div>;

  return filterBox;


}