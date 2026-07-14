import { loadMenu, MenuItem } from "./Sidebar"
import "./MobileMenu.css"
import { label } from "src/models/Utils"
import { Link } from "react-router-dom";
import search from "./svg/search.svg";

export default  function MobileMenu() {
    const menu = [{ slug: "search", jsx:<MenuItem icon={search} labelKey="menu_search" /> },...loadMenu()]
    return <div className="content ">
        <h3>{label("title_more")}</h3>
        <div className="mobilemenu">
            {menu.filter(i=>!["home","study"].includes(i.slug)).map((item, index)=>(
                <Link key={index} to={item.slug}><div>{item.jsx}</div></Link>
            ))}
        </div>
    </div>
}