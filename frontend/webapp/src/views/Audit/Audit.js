import React, { Suspense, useCallback, useEffect, useState, useRef } from "react";
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory, Link } from "react-router-dom";
import "./Audit.css";
import axios from "axios";

import en from "../_Common/svg/flags/en.svg"
import vn from "../_Common/svg/flags/vn.svg"
import ko from "../_Common/svg/flags/kr.svg"
import swe from "../_Common/svg/flags/swe.svg"
import fr from "../_Common/svg/flags/fr.svg"
import de from "../_Common/svg/flags/de.svg"
import ru from "../_Common/svg/flags/ru.svg"
import es from "../_Common/svg/flags/es.svg"
import tgl from "../_Common/svg/flags/tgl.svg"



import { Button, Card, CardBody, CardHeader, Nav, NavItem } from "reactstrap";
import { determineLanguage } from "../../models/Utils";
import { ApiBaseUrl } from "../../models/BoMOnlineAPI";
import SignIn from "../User/SignIn";

//"bom_map name gpt-4" "bom_map desc gpt-4" "bom_division description gpt-4" "bom_page title gpt-4" "bom_section title  gpt-4" "bom_connection text  gpt-4" "bom_capsulation description  gpt-4" "bom_label label_text" "bom_people title" "bom_places info" "bom_text heading" "bom_markdown markdown gpt-4"
const bom_types = [
    {
        label: "UI Labels",
        slug: "labels",
        table: "bom_label",
        refkey: "label_text",
    },
    {
        label: "Page titles",
        slug: "page-titles",
        table: "bom_page",
        refkey: "title",
    },
    {
        label: "Section titles",
        slug: "section-titles",
        table: "bom_section",
        refkey: "title",
    },
    {
        label: "Synopses",
        slug: "synopses",
        table: "bom_narration",
        refkey: "description",
    },
    {
        label: "Subheadings",
        slug: "subheadings",
        table: "bom_text",
        refkey: "heading",
    },
    {
        label: "Connections",
        slug: "connections",
        table: "bom_connection",
        refkey: "text",
    },
    {
        label: "Capsulations",
        slug: "capsulations",
        table: "bom_capsulation",
        refkey: "description",
    },
    {
        label: "Divisions",
        slug: "divisions",
        table: "bom_division",
        refkey: "description",
    },
    {
        label: "People Names",
        slug: "people-names",
        table: "bom_people",
        refkey: "name",
    },
    {
        label: "People Titles",
        slug: "people-titles",
        table: "bom_people",
        refkey: "title",
    },
    {
        label: "Place Names",
        slug: "place-names",
        table: "bom_places",
        refkey: "name",
    },
    {
        label: "Place Descriptions",
        slug: "place-descriptions",
        table: "bom_places",
        refkey: "info",
    },
    {
        label: "Markdown",
        slug: "markdown",
        table: "bom_markdown",
        refkey: "markdown",
    },
    {
        label: "Map Titles",
        slug: "map-titles",
        table: "bom_map",
        refkey: "name",
    },
    {
        label: "Map Descriptions",
        slug: "map-descriptions",
        table: "bom_map",
        refkey: "desc",
    }

]



async function loadItems(table,refkey,user) {
    const isLocalhost = window.location.hostname === "localhost";
    const lang = determineLanguage();
   
    const list = await axios.post(`${ApiBaseUrl}/translate`, {
        action: "list",
        table,
        refkey,
        lang,
        user
    });
    return list.data.sort(() => Math.random() - 0.5);
}


export default function  Audit({appController})
{

    const {user} = appController.states.user;
    const history = useHistory();
    const match = useRouteMatch();
    const {key} = match?.params;
    let slugIndex = bom_types.findIndex(i=>i.slug === key);
    if(slugIndex === -1) slugIndex = 0;
    const [index, setIndex] = useState(slugIndex);
    const [items, setItems] = useState([]);
    const [table, setTable] = useState(bom_types[index].table);
    const [refkey, setRefkey] = useState(bom_types[index].refkey);
    const [editMode, setEditMode] = useState(false);

    const BomType = ({ type }) => {
        const isActive = type.table === table && type.refkey === refkey;
        const handleClick = () => {
            setTable(type.table);
            setRefkey(type.refkey);
            loadItems(type.table, type.refkey, user).then(setItems);
            //set history to slug
            history.push(`/audit/${type.slug}`);
        };
    
        return (
            <NavItem key={type.slug} className={isActive ? "active" : ""} onClick={handleClick}>
                {type.label}
            </NavItem>
        );
    };


    useEffect(() => {
        if(!user) return;
        //console.log("loading items", table, refkey);
        loadItems(
            table,
            refkey,
            user
        ).then((items) => {
            //console.log("loaded items", table, refkey,items);
            setItems(items);
        })
    }, [table+refkey, user]);



    if(!user) return <div className="container">
            
      <Card className="card-login">
        <CardBody>
            <SignIn appController={appController} />
        </CardBody>
        </Card>
        </div>
    
    
    return <div className="container" style={{ display: 'block', textAlign: 'center' }}>
        <h2>Translation Review</h2>
        <p>Review the item below and mark it as "Good" or "Needs Revision". If unsure, you can skip it for now.</p>
        <Nav pills className="bomtypes">{bom_types.map(i=>{
            return <BomType type={i} />
        })}</Nav>
        {items.length === 0 ? <Loader /> :
         <AuditItem  setItems={setItems} items={items}  setRefkey={setRefkey} setTable={setTable} typeIndex={index} setTypeIndex={setIndex} user={user}
            setEditMode={setEditMode} editMode={editMode}

         />}
    </div>
}
async function saveItemAudit({id, score, user}) {
    await new Promise(resolve => setTimeout(resolve, 500));

    if(score === null) return;
    const postRequest = axios.post(`${ApiBaseUrl}/translate`, {
        action: "audit",
        id,
        score,
        user
    });

    return await postRequest;
}

async function saveItemEdit({id, dst, user}) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const postRequest = axios.post(`${ApiBaseUrl}/translate`, {
        action: "update",
        id,
        value: dst,
        user
    });
    return await postRequest;
}


function AuditItem({items,setItems, setTable, setRefkey, typeIndex, setTypeIndex, user, setEditMode, editMode})
{
    const [highlight, setHighlight] = useState(false);
    const [saving, setSaving] = useState(false);
    const index = items.findIndex(item => !item.done);
    const item = items[index];
    const auditItem = useCallback(async (status) => {
        const {id} = item;
        let score = status === "pass" ? 1 : 0;
        if(status === "skip") score = null;
        setSaving(true);
        setHighlight(status);
        await saveItemAudit({id, score, user}); //This takes no time, why no delay?
        items[index].done = true;
        setItems([...items]);
        setSaving(false);
        setHighlight(false);
    }, [item, index, items, setItems]); // add other dependencies if needed
    
    const updateTableAndRefKey = (num) => {
        num = num > 0 ? 1 : -1; 
        const maxIndex = bom_types.length;
        const newIndex = (typeIndex + num + maxIndex) % maxIndex;
        const newItem = bom_types[newIndex];
        const newTable = newItem.table;
        const newRefkey = newItem.refkey;
        setTable(newTable);
        setRefkey(newRefkey);
        setTypeIndex(newIndex);
        loadItems(newTable, newRefkey, user).then(setItems);
    }

    useEffect(() => {
        const handleKeyDown = (event) => {
            switch(event.key) {
                case ' ':
                    if(editMode) return;
                    auditItem("fail");
                    break;
                case 'Enter':
                    if(editMode){
                        const isShift = event.shiftKey;
                        if(isShift) return;
                        event.preventDefault(); // Prevent the default action
                        document.querySelector("#savebutton").click();
                        return;
                    }
                    auditItem("pass");
                    break;
                case 'Escape':
                    if(editMode) return setEditMode(false);
                    auditItem("skip");
                    break;
                case 'ArrowRight':
                    if(editMode) return;
                    event.preventDefault(); // Prevent the default action
                    updateTableAndRefKey(1); // Call the function that updates the table and refkey
                    break;
                case 'ArrowLeft':
                    if(editMode) return;
                    event.preventDefault(); // Prevent the default action
                    updateTableAndRefKey(-1); // Call the function that updates the table and refkey
                    break;
                case 'Tab':
                    if(editMode) return;
                    event.preventDefault(); // Prevent the default action
                    setEditMode(true);
                    // EDIT
                    break;
                default:
                    break;
            }
        };
    
        window.addEventListener('keydown', handleKeyDown);
    
        // Cleanup function to remove the event listener
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [auditItem]);

    useEffect(() => {
        if(!editMode) return;
        //focus on the textarea
        const textarea = document.querySelector("textarea#editor");
        if(textarea) textarea.focus();
    }, [editMode]);

const pickFlag = () => {
    const lang = determineLanguage();
    switch(lang) {
        case "en": return en;
        case "vn": return vn;
        case "ko": return ko;
        case "swe": return swe;
        case "fr": return fr;
        case "de": return de;
        case "ru": return ru;
        case "es": return es;
        case "tgl": return tgl;
        default: return en;
    }}

    const {src, dst} = itemRules(item);
    return <Card className={`audit-item ${saving ? "saving" : ""} ${editMode ? "editMode" : ""}`}>
    <CardHeader className="audit-controls">

    <Button color="info"  onClick={() => auditItem("skip")} className={highlight === "skip" ? "highlight" : ""}>
    ⎋ Skip For Now
            <span className="keyboardLabel">⎋ Esc</span>
        </Button>

<Button color="danger"  onClick={() => auditItem("fail")} className={highlight === "fail" ? "highlight" : ""}>
    ❌ • Needs Revision
    <span className="keyboardLabel">⌴ Space</span> 
</Button>

    <Button color="warning"  onClick={() => setEditMode(true)} className={highlight === "edit" ? "highlight" : ""}>
    ✏️ •  Edit 
        <span className="keyboardLabel">↦ Tab</span> 
    </Button>

        <Button color="success" onClick={() => auditItem("pass")} className={highlight === "pass" ? "highlight" : ""}>
            ✅ • GOOD
            <span className="keyboardLabel">↩ Return</span>
        </Button>
    </CardHeader>
    <CardBody>
        <div className="audit-dst">
            <div><img src={pickFlag()} alt="Language" /></div>
            <div className="dst-content">
                {editMode ? <>
                    <Textarea
                        value={dst}
                        onChange={(e) => {items[index].dst = e.target.value; setItems([...items])}}
                    />
                <Button id="savebutton" color="info" onClick={async () => {
                    setEditMode(false);
                    setSaving(true);
                    const value = document.querySelector("textarea#editor").value;
                    await saveItemEdit({id: item.id, dst: value, user});
                    items[index].dst = value;
                    items[index].done = true;
                    setItems([...items]);
                    setSaving(false);
                }}>Save</Button>
                </> : dst}
            </div>
        </div>
        <div className="audit-src">
            <div><img src={en} alt="English" /></div>
            <div>{src}</div>
        </div>
    </CardBody>
</Card>
}

const Textarea = ({ value, onChange }) => {
    const textareaRef = useRef(null);
    
    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [value]);
  
    return (
      <textarea
        id="editor"
        ref={textareaRef}
        value={value}
        onChange={onChange}
      />
    );
  };

function itemRules (item)
{
    [
        [/\$[0-9]+/ig,"…"],
        [/\{([^\|]+)\|([^\}]+)\}/ig, "$1"],
        [/\[([^\|]+)\|([^\]]+)\]/ig, "$1"],
        
    ].forEach(([from, to]) => {
        item.dst = item.dst.replace(from, to);
        item.src = item.src.replace(from, to);
    });

    return item;
}