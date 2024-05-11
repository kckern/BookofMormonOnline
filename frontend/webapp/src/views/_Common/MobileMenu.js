import { loadMenu } from "./Sidebar"
import "./MobileMenu.css"
import { label } from "src/models/Utils"
import { Link } from "react-router-dom";
import search from "./svg/search.svg";

export default  function MobileMenu({appController}) {
    const menu = [{ slug: "search", title: <span><img src={search} /> {label("menu_search")}</span> },...loadMenu()]
    return <div className="content ">
        <h3>{label("title_more")}</h3>
        <div className="mobilemenu">
            {menu.filter(i=>!["home","study"].includes(i.slug)).map((item, index)=>(
                <Link key={index} to={item.slug}><div>{item.title}</div></Link>
            ))}
        </div>
    </div>
}