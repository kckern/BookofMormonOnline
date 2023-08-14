import React, { useState, useEffect, useCallback, useRef } from "react";
import SweetAlert from "react-bootstrap-sweetalert";
import { label } from "src/models/Utils";
import { generateGroupHash } from "../../Study/StudyGroupSelect";
import QRCode from "react-qr-code";
// CSS
import "../Style.scss";

// :- TODOS
// * call/dispatch "showInviteLink" is listener to show/hide model

export default function InviteLinkModal({  }) {

    const [hash, setHash] = useState(null),
        [visible, setVisible] = useState(false),
        [studyGroup, setStudyGroup] = useState(null),
        copyTxt = useRef(),
        inviteLink = window.location.origin + "/invite/" + hash;

    const toggleInviteLink = (e) => {
        setStudyGroup(e.studyGroup);
        setVisible(true);
    };

    useEffect(() => {
        window.addEventListener("showInviteLink", toggleInviteLink, false);
        return () => {
            window.removeEventListener("showInviteLink", toggleInviteLink, false);
        };
    }, []);

    useEffect(() => {
        studyGroup?.getMetaData(["hash"], function (response, error) {
            if (error) { }
            if (response)
                if (response.hash === undefined) generateGroupHash(studyGroup, (response) => setHash(response.hash));
                else setHash(response.hash);
        });
    }, [studyGroup])

    const handleCopyTxt = useCallback(() => {

        var textarea = document.createElement("textarea"),
            timeoutId = null;

        textarea.textContent = inviteLink;
        textarea.style.position = "fixed";
        document.body.appendChild(textarea);
        textarea.select();

        try {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            copyTxt.current.className = "text-highlight";
            return document.execCommand("copy");
        } catch (ex) {
            console.warn("Copy to clipboard failed.", ex);
            return false;
        } finally {
            timeoutId = setTimeout(() => {
                if (copyTxt?.current)
                    copyTxt.current.className = "";
            }, 5000);
            document.body.removeChild(textarea);
        }
    }, [inviteLink]);

    return (
        <SweetAlert
            customClass={"sweet-alert-modal"}
            show={visible}
            title={label("invite_link")}
            onConfirm={() => setVisible(false)}
            //  onCancel={onCancel}
            showConfirm={true}
            showCancel={false}
            btnSize=""
            cancelBtnBsStyle="danger"
            confirmBtnText="Close"
            cancelBtnText="Cancel"
            confirmBtnCssClass="model-confirm-btn-css-class"
            cancelBtnCssClass="model-cancel-btn-css-class"
        >
            {() => (
                <div className="" ref={copyTxt} onMouseDown={handleCopyTxt}>
                    <div className="linkContainer">
                        <div className="copy-modal">📋 {label("copied_to_clipboard")}</div>
                        <code onTouchEnd={()=>navigator.share(inviteLink)}>{inviteLink}</code>
                        <QRCode value={inviteLink} size={150} />
                    </div>

                    <div>
                        {label("share_group_link_to_x", [studyGroup?.name])}.
                    </div>
                    <div className="coverUrl">
                        <img src={studyGroup?.coverUrl} alt={studyGroup?.coverUrl} />
                    </div>
                </div>
            )}
        </SweetAlert>
    )
}