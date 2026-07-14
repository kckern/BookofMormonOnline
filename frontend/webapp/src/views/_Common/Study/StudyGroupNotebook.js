

import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import React, { useState, useEffect } from 'react';
import Loader from 'src/views/_Common/Loader';
import "./StudyGroupNotebook.css"
import { normalizeUnits } from 'moment';
import { useAppController } from "src/contexts/AppControllerContext";
export default function StudyGroupNotebook() {
    const appController = useAppController();


    const [contents, setContents] = useState([]);
    const [activeDivision, setActiveDivision] = useState("lehites");
    const [activeLeafCursors, setActiveLeafCursors] = useState(null);
    const [activeNotes, setActiveNotes] = useState(null);

    // Load the table of contents once (was a setState-during-render).
    useEffect(() => {
        let cancelled = false;
        BoMOnlineAPI({ contents: null }).then((r) => {
            if (!cancelled) setContents(r.contents);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Derive the page-slug cursors for the active division (was a
    // setState-during-render: a for-loop calling setActiveLeafCursors in the
    // render body).
    useEffect(() => {
        if (!contents.length || !activeDivision) return;
        const item = contents.find((c) => c.slug === activeDivision);
        if (!item) return;
        setActiveLeafCursors(
            item.pages.map((page) => page.slug.split("/").reverse().shift())
        );
    }, [contents, activeDivision]);

    // Load notes for the active cursors (was a setState-during-render: a
    // listQuery.load(...) called directly in the render body).
    useEffect(() => {
        if (!activeLeafCursors || activeNotes) return;
        let cancelled = false;

        let group = appController.states.studyGroup.activeGroup;

        var listQuery = group.createPreviousMessageListQuery();
        listQuery.limit = 100;
        listQuery.reverse = false;
        listQuery.includeThreadInfo = true; // Retrieve a list of messages along with their metaarrays.
        listQuery.includeReaction = true; // Retrieve a list of messages along with their reactions.
        listQuery.customTypesFilter = activeLeafCursors;
        listQuery.load(function (notes, error) {
          if (error) {
              console.log(error)
          }
          if (!cancelled) setActiveNotes(notes);
        });

        return () => {
            cancelled = true;
        };
    }, [activeLeafCursors, activeNotes]);

    if (!contents.length) {
        return (
            <Loader />
        )
    }


    return <div className={"StudyGroupChatPanel Notebook"} >
        <div>
            <div className="topTabs">{contents.map(item =>  <div key={item.slug} className={activeDivision===item.slug ? "active" : ""} onClick={() => { if (activeDivision !== item.slug) { setActiveDivision(item.slug); setActiveLeafCursors(null); setActiveNotes(null); } }}>{item.title} <span className={"badge"}>{5}</span></div> )}</div>
            <div className="noteList">
                {activeNotes?.map(note=>{
                    let dateObj = (new Date(note.createdAt));
                    return (<div className="note" key={note.messageId}>
                        <h4>1 Nephi 4:3</h4>
                        <b>{note?._sender?.nickname}</b>
                        <i>{dateObj.toLocaleDateString("en-US")}</i>
                        <blockquote>{note.message}<span className={"badge"}>{note.threadInfo?.replyCount ?? 0}</span></blockquote>
                        <pre>{note.data}</pre>
                        
                        </div>)
                })}
            </div>
            <div>Contents</div>

        </div>
    </div>
}