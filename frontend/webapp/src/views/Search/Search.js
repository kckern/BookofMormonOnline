import React, { useState, useEffect } from "react";
import Parser from "html-react-parser";
// COMPONENTS
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory, useLocation, Link } from "react-router-dom";
import { parseMode, buildSearchPath, shouldOfferRich, isRichDegraded, VERSE_CAP } from "./searchMode";
import { label } from "src/models/Utils";
import { getSearchSlug, getSearchValue } from "src/models/searchSlug";
import BoMOnlineAPI, {assetUrl} from "src/models/BoMOnlineAPI";
import { toast } from "react-toastify";
import ResultGroup from "./ResultGroup";
import VerseResult from "./VerseResult";
import { renderHighlighted } from "./highlight";
import "./Search.css";


function SearchComponent() {

  const history = useHistory();
  const match = useRouteMatch();
  const location = useLocation();
  const mode = parseMode(location.search);
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
    history.push(buildSearchPath(getSearchSlug(keyword), mode));
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

  const toggle = (
    <div className="search-mode-toggle">
      <button
        className={mode === "keyword" ? "active" : ""}
        onClick={() => history.push(buildSearchPath(getSearchSlug(keyword), "keyword"))}
      >{(label("search_verses_only", [-1]) || "").trim() || "Verses"}</button>
      <button
        className={mode === "rich" ? "active" : ""}
        onClick={() => history.push(buildSearchPath(getSearchSlug(keyword), "rich"))}
      >{(label("search_everything", [-1]) || "").trim() || "Everything"}</button>
    </div>
  );

  useEffect(() => {
    const apiInput = (keyword.match(/\d/))
      ? { lookup: keyword }
      : (mode === "rich" ? { searchAllRich: keyword } : { searchAll: keyword });
    BoMOnlineAPI(apiInput, { useCache: false }).then(r => {

      if (r?.lookup) {
        let goTo = r?.lookup?.[0]?.slug || null;
        document.querySelector(".searchbox input").value = "";
        if (goTo) push("/" + goTo); else toast.warning(label("no_results_for_x", [<span>{keyword}</span>]), { position: 'top-center' })
      } else {
        if(!keyword || keyword.length===1) return setContent(<div>
          <h3 className="title lg-4 text-center">{label("search")}</h3>{toggle}{searchBox}</div>);
        if (!r?.searchAll) return setContent(<div><h3 className="title lg-4 text-center">{label("no_results_for_x", [<span>{keyword}</span>])}</h3>{searchBox}</div>);

        const sa = r.searchAll;
        const semantic = !!sa.semantic;
        const verses = sa.verses || [];
        const verseTotal = sa.verseTotal ?? verses.length;
        if (isRichDegraded(mode, semantic))
          toast.warning(label("search_topical_unavailable", [-1]) || "Topical search is unavailable — showing keyword matches", { position: "top-center" });
        const groupCount = [sa.people, sa.places, sa.matters, sa.commentary, sa.narration, sa.pages, sa.events]
          .reduce((acc, g) => acc + (g?.length || 0), 0);
        const count = verseTotal + groupCount;

        if (count === 0) return setContent(<div><h3 className="title lg-4 text-center">{label("no_results_for_x", [<span>{keyword}</span>])}</h3>{searchBox}</div>);

        setContent(<div><h3 className="title lg-4 text-center">{label("x_search_results_for_y", [count,<span>{keyword}</span>])}</h3>
          {toggle}
          {shouldOfferRich(mode, semantic, verseTotal) && (
            <div className="search-rich-banner">
              {/* i18n TODO: seed `search_many_results` with a $1 placeholder, then route through label() */}
              {`${verseTotal} matches — showing the first ${VERSE_CAP}.`}{" "}
              <button onClick={() => history.push(buildSearchPath(getSearchSlug(keyword), "rich"))}>
                {label("search_try_topical", [-1]) || "Try topical search"}
              </button>
            </div>
          )}
          {groupCount > 0 && (
            <div className="search-rich-groups">
              <ResultGroup label={label("menu_people") || "People"} cards={sa.people} kind="person" query={keyword} semantic={semantic} />
              <ResultGroup label={label("menu_places") || "Places"} cards={sa.places} kind="place" query={keyword} semantic={semantic} />
              <ResultGroup label={label("menu_matters", [-1]) || "Matters"} cards={sa.matters} kind="matter" query={keyword} semantic={semantic} />
              <ResultGroup label="Commentary" cards={sa.commentary} kind="commentary" query={keyword} semantic={semantic} />
              <ResultGroup label="Narration" cards={sa.narration} kind="narration" query={keyword} semantic={semantic} />
              <ResultGroup label="Pages" cards={sa.pages} kind="page" query={keyword} semantic={semantic} />
              <ResultGroup label="Events" cards={sa.events} kind="event" query={keyword} semantic={semantic} />
            </div>
          )}
          {verses.length > 0 && (
            <section className="result-group verses">
              <h4 className="result-group-header">Verses <span className="count">({verseTotal})</span></h4>
              <div className="verse-list">
                {verses.map((item, i) => (
                  <VerseResult key={item.slug || i} item={item} keyword={keyword} semantic={semantic}
                    keywordRender={(t) => highlight(keyword, t)} />
                ))}
              </div>
            </section>
          )}
        </div>);
      }
    })
  },[keyword, mode])


  return (<div className="container" style={{ display: 'block' }}>
    <div id="page" className="search">
      {content}
    </div></div>
  )

}

export default SearchComponent;
