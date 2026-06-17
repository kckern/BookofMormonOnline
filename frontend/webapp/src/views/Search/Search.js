import React, { useState, useEffect } from "react";
import Parser from "html-react-parser";
// COMPONENTS
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory, Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { getSearchSlug, getSearchValue } from "src/models/searchSlug";
import BoMOnlineAPI, {assetUrl} from "src/models/BoMOnlineAPI";
import { toast } from "react-toastify";
import ResultGroup from "./ResultGroup";
import "./Search.css";


function SearchComponent({ appController }) {

  const history = useHistory();
  const match = useRouteMatch();
  useEffect(() => document.title = label("menu_search") + " | " + label("home_title"), [])
  const { push } = useHistory(),
    [keyword, setKeyWord] = useState(getSearchValue(match.params?.value)),
    [content, setContent] = useState(<Loader />);

  const highlight = (needle, haystack) => {
    const full_pattern =  new RegExp(needle.replace(/(ing|s|es|ed)$/,'') + ".*?(\\b| )", 'gi');
    //console.log(full_pattern);
    if(full_pattern.test(haystack)) return Parser(haystack.replace(full_pattern, (str) => `<em>${str.trim()}</em> `));

    let needles = needle.split(/[ ,.;!?]+/).map(str=>(new RegExp("\\b"+str.replace(/(ing|s|es|ed)$/,'')  + ".*?\\b", 'gi')));
    for(let i in needles)
    {
      haystack = haystack.replace(needles[i], (str) => `<em>${str}</em>`);
    }
    haystack = haystack.replace(/<\/em>\s+<em>/," ");
    return Parser(haystack);

  }

  useEffect(()=>{

    setContent(<Loader/>);
    setKeyWord(getSearchValue(match.params?.value));
    
  }, [match?.params?.value])

  const searchFor = (keyword) => {
    if (keyword.trim() === "") return;
    history.push("/search/" + getSearchSlug(keyword));
    document.querySelector(".nav .searchbox input").value = keyword;

  }

  const searchBox = <div className="searchboxWrapper">
    <input type="text"
    autoFocus
    aria-label={label("search") || "Search"}
    placeholder={label("search") || "Search"}
    onKeyUp={(e) => {
      if (e.key === "Enter" && e.target.value.trim() !== "") searchFor(e.target.value)
    }}
    className="onpage searchbox" />
    <button onClick={(e) => {
      const searchValue = document.querySelector(".search .searchbox").value
      searchFor(searchValue)
    }}>{label("search")}</button>
  </div>

  useEffect(() => {
    const apiInput = (keyword.match(/\d/)) ? { lookup: keyword } : { searchAll: keyword };
    BoMOnlineAPI(apiInput, { useCache: false }).then(r => {

      if (r?.lookup) {
        let goTo = r?.lookup?.[0]?.slug || null;
        document.querySelector(".searchbox input").value = "";
        if (goTo) push("/" + goTo); else toast.warning(label("no_results_for_x", [<span>{keyword}</span>]), { position: 'top-center' })
      } else {
        if(!keyword || keyword.length===1) return setContent(<div>
          <h3 className="title lg-4 text-center">{label("search")}</h3>{searchBox}</div>);
        if (!r?.searchAll) return setContent(<div><h3 className="title lg-4 text-center">{label("no_results_for_x", [<span>{keyword}</span>])}</h3>{searchBox}</div>);

        const verses = r.searchAll.verses || [];
        let count = verses.length;
        setContent(<div><h3 className="title lg-4 text-center">{label("x_search_results_for_y", [count,<span>{keyword}</span>])}</h3>
          {verses.map(item => {
            const { reference, text, slug, page, section, speaker, voice } = item;

            const handleReadClick = (e,ref) => {
              e.preventDefault();
              e.stopPropagation();
              const chapterSlug = ref.split(":")[0];
              const verse = ref.split(":")[1];
              history.push("/read/" + chapterSlug + "/" + verse);
            }

            const handleImgClick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              appController.functions.setPopUp({ type: "people", ids: [speaker], underSlug: `search/${keyword}` });
            }


            return <Link to={"/" + slug}>
              <div className="resultItem">
                <div className="reference-speaker noselect">
                <div className="reference noselect">{reference}</div>
                <div className="speaker noselect">
                  <img alt={label(voice)} src={assetUrl + `/people/${speaker}`} onClick={handleImgClick} />
                  <div className="read-voice"
                      onClick={handleImgClick}
                  >{label(voice)}</div>
                </div>
                </div>
                <div className="text">
                  <h5 className="noselect">{section} <span>{page}</span>
                  <button onClick={(e)=>handleReadClick(e,reference)} >{label("menu_read")}</button>
                  <button>{label("menu_study")}</button>
                  </h5>
                  <p className="scripture"
                  >{highlight(keyword, text)}</p>
                </div>
              </div></Link>
          })}
          <ResultGroup label={label("menu_people") || "People"} cards={r.searchAll.people} kind="person" />
          <ResultGroup label={label("menu_places") || "Places"} cards={r.searchAll.places} kind="place" />
          <ResultGroup label="Commentary" cards={r.searchAll.commentary} kind="commentary" />
          <ResultGroup label="Narration" cards={r.searchAll.narration} kind="narration" />
          <ResultGroup label="Pages" cards={r.searchAll.pages} kind="page" />
          <ResultGroup label="Events" cards={r.searchAll.events} kind="event" />
        </div>);
      }
    })
  },[keyword])


  return (<div className="container" style={{ display: 'block' }}>
    <div id="page" className="search">
      {content}
    </div></div>
  )

}

export default SearchComponent;
