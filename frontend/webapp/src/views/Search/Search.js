import React, { useState, useEffect } from "react";
import Parser from "html-react-parser";
// COMPONENTS
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory, Link } from "react-router-dom";
import { label } from "src/models/Utils";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { toast } from "react-toastify";
import "./Search.css";

const getSearchValue = (value) => {
  value =value?.replace(/[.]/ig, " ");
  return value || "";
}


function SearchComponent({ appController }) {

  const match = useRouteMatch();
  useEffect(() => document.title = label("menu_search") + " | " + label("home_title"), [])
  const { push } = useHistory(),
    [keyword, setKeyWord] = useState(getSearchValue(match.params?.value)),
    [content, setContent] = useState(<Loader />);

  const highlight = (needle, haystack) => {
    const full_pattern =  new RegExp(needle.replace(/(ing|s|es|ed)$/,'') + ".*?(\\b| )", 'gi');
    console.log(full_pattern);
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

  useEffect(() => {
    const apiInput = (keyword.match(/\d/)) ? { lookup: keyword } : { search: keyword };
    BoMOnlineAPI(apiInput, { useCache: false }).then(r => {

      if (r?.lookup) {
        let goTo = r?.lookup?.[0]?.slug || null;
        document.querySelector(".searchbox input").value = "";
        if (goTo) push("/" + goTo); else toast.warning(label("no_results_for_x", [<code>{keyword}</code>]), { position: 'top-center' })
      } else {
        if (!r?.search?.map) return setContent(<div><h3 className="title lg-4 text-center">{label("no_results_for_x", [<code>{keyword}</code>])}</h3></div>);

        let count = r?.search?.length;
        setContent(<div><h3 className="title lg-4 text-center">{label("x_search_results_for_y", [count,<code>{keyword}</code>])}</h3>
          {r?.search?.map(item => {
            const { reference, text, slug, page, section, narration } = item;
            return <Link to={"/" + slug}>
              <div className="resultItem">
                <div className="reference">{reference}</div>
                <div className="text">
                  <h5>{section} <span>{page}</span></h5>
                  <p>{highlight(keyword, text)}</p>
                </div>
              </div></Link>
          })}
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
