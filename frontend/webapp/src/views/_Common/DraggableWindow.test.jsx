import React from "react";
import { render, fireEvent } from "@testing-library/react";
import DraggableWindow from "./DraggableWindow";

// React 19 removed ReactDOM.findDOMNode; react-draggable throws on drag
// start unless it is handed a nodeRef. This is the popup drag-handle bug.
test("dragging by the header moves the window", () => {
  const errors = [];
  const onError = (e) => { errors.push(e.error || e); e.preventDefault(); };
  window.addEventListener("error", onError);
  const { container } = render(
    <DraggableWindow handle=".card-header">
      <div id="popUp">
        <div className="card-header">Title</div>
      </div>
    </DraggableWindow>
  );
  const handle = container.querySelector(".card-header");
  fireEvent.mouseDown(handle, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.mouseMove(document, { clientX: 40, clientY: 30 });
  fireEvent.mouseUp(document, { clientX: 40, clientY: 30 });
  window.removeEventListener("error", onError);
  expect(errors.map(String)).toEqual([]);
  expect(container.querySelector("#popUp").style.transform).toBe("translate(40px,30px)");
});
