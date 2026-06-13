import React, { useState, useEffect, useCallback } from "react";
import SweetAlert from "react-bootstrap-sweetalert";
import { label } from "src/models/Utils";
import useModalA11y from "../useModalA11y";
// :- TODOS
// * call/dispatch "showDeleteAlert" is listener to show/hide model
// * set "deleteMessage" listener from you want to delete message

export default function DeleteConfirmAlert() {
  const [show, setShow] = useState(false);

  const toggleDeleteAlert = useCallback(() => {
    let event = new CustomEvent("deleteMessage");
    event.isDelete = false;
    window.dispatchEvent(event); // event dispatch if need to delete Event
    setShow(!show);
  }, [show]);

  useEffect(() => {
    window.addEventListener("showDeleteAlert", toggleDeleteAlert, false);
    return () => {
      window.removeEventListener("showDeleteAlert", toggleDeleteAlert, false);
    };
  }, [toggleDeleteAlert]);

  useModalA11y(show, { onClose: toggleDeleteAlert, label: label("are_you_sure") });

  const deleteMessage = () => {
    let event = new CustomEvent("deleteMessage");
    event.hideDeleteMessageAlert = toggleDeleteAlert;
    event.isDelete = true;
    window.dispatchEvent(event);
  };

  return (
    <SweetAlert
      title=""
      customClass={"custom-alert"}
      show={show}
      onConfirm={deleteMessage}
      onCancel={toggleDeleteAlert}
      confirmBtnBsStyle="danger"
      cancelBtnBsStyle="default"
      confirmBtnText={label("delete")}
      cancelBtnText={label("cancel")}
      showCancel
      btnSize=""
    >
      {() => (
        <div className="custom-alert-container">
          <div className="">{label("are_you_sure")}</div>
        </div>
      )}
    </SweetAlert>
  );
}
