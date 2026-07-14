import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./ActionBubble.css";
import { useAppController } from "src/contexts/AppControllerContext";
export function ActionBubble({ userData, action, link }) {
  const appController = useAppController();
  let message = action;
  const [showElement, setShowElement] = useState(true);
  useEffect(() => {
    setShowElement(true);
    let userId = userData.userId;
    if(!window.timeouts) { window.timeouts={}; window.timeouts[userId] = null}
    clearTimeout(window.timeouts[userId]);
    window.timeouts[userId] = setTimeout(() => {
      setShowElement(false);
    }, 10000);
  }, [action]);

  if(appController.states.studyGroup.isDrawerOpen) return false;
  if(!action) return false;
  if(action.location) return false;
  if (!showElement) return null;
  

  if(["updatePagePosition"].includes(message.key)) return null;
  let body = (message.messageId) ? <Message message={message}/> :  <Movement message={message}/> ;


  return (
    <Link to={link}>
      <div className={"actionBubble"}>
      {userData.nickname}:
        {body}
      </div>
    </Link>
  );
}




function Message({message})
{


  return <div className="messageBody">
    <div className={"messageIcon"}>📖</div>
    <div className="messageText">{message.message}</div>
  </div>
}



function Movement()
{
  // Movement bubbles render nothing (the body is shown only for message actions
  // via <Message/>). Previously had unreachable debug JSON output below a
  // `return null;` — removed.
  return null;
}


