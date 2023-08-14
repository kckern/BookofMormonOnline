

import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import React, { useState } from 'react';
import Loader from 'src/views/_Common/Loader';
import "./StudyGroupNotebook.css"
import { normalizeUnits } from 'moment';
export default function StudyGroupNotebook({ appController }) {


    const [contents, setContents] = useState([]);
    const [activeDivision, setActiveDivision] = useState("lehites");
    const [activePages, setActivePages] = useState(null);
    const [activeNotes, setActiveNotes] = useState(null);
    if (!contents.length) {
        BoMOnlineAPI({ contents: null }).then((r) => setContents(r.contents));
        return (
            <Loader />
        )
    }


    if(!activePages && activeDivision)
    {
        //get page slugs
        for(let i in contents)
        {
            let item = contents[i];
            if(item.slug===activeDivision)
            {
                setActivePages(item.pages.map(page=>page.slug.split("/").reverse().shift()));
            }
        }
    }


    if(activePages && !activeNotes)
    {

        let group = appController.states.studyGroup.activeGroup;

        var listQuery = group.createPreviousMessageListQuery();
        listQuery.limit = 100;
        listQuery.reverse = false;
        listQuery.includeThreadInfo = true; // Retrieve a list of messages along with their metaarrays.
        listQuery.includeReaction = true; // Retrieve a list of messages along with their reactions.
        listQuery.customTypesFilter = activePages;
        listQuery.load(function (notes, error) {
          if (error) {
              console.log(error)
          }
          setActiveNotes(notes);
        });
    
    }



    return <div className={"StudyGroupChatPanel Notebook"} >
        <div>
            <div className="topTabs">{contents.map(item =>  <div className={activeDivision===item.slug ? "active" : ""}>{item.title} <span className={"badge"}>{5}</span></div> )}</div>
            <div className="noteList">
                {activeNotes?.length}
                {activeNotes?.map(note=>{
                    let dateObj = (new Date(note.createdAt));
                    return (<div className="note">
                        <h4>1 Nephi 4:3</h4>
                        <b>{note?._sender?.nickname}</b>
                        <i>{dateObj.toLocaleDateString("en-US")}</i>
                        <blockquote>{note.message}<span className={"badge"}>{note.threadInfo.replyCount}</span></blockquote>
                        <pre>{note.data}</pre>
                        
                        </div>)
                })}
            </div>
            <div>Contents</div>

        </div>
    </div>
}