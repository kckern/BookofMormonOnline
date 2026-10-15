import React, { useRef } from "react";
import Draggable from "react-draggable";

// react-draggable finds its DOM node via ReactDOM.findDOMNode unless given a
// nodeRef. React 19 removed findDOMNode, so a bare <Draggable> throws on drag
// start and the popup can't be moved. Always drag through this wrapper.
export default function DraggableWindow({ children, ...props }) {
  const nodeRef = useRef(null);
  return (
    <Draggable nodeRef={nodeRef} {...props}>
      {React.cloneElement(children, { ref: nodeRef })}
    </Draggable>
  );
}
