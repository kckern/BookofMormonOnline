import { loadMenu } from "./Sidebar"
import "./MobileMenu.css"
import { label } from "src/models/Utils"
import { Link } from "react-router-dom";

export default  function MobileMenu({appController})
{
    const menu = loadMenu();
    return <div className="content ">
        <h3>{label("title_more")}</h3>
        <div className="mobilemenu">
        {menu.filter(i=>!["home","study"].includes(i.slug)).map(item=><Link to={item.slug}><div>{item.title}</div></Link>)}    
        </div>
        
    </div>
}