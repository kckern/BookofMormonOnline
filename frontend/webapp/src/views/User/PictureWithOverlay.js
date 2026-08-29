import React, { useState } from "react";
import uploadIcon from "./svg/uploadImage.svg";
import ImageChanger from "./ImageChanger";
import "./PictureWithOverlay.css";
import { label } from "src/models/Utils";
import UserAvatar from "src/components/UserAvatar";

export default function PictureWithOverlay({
  kind = "profile",
  src,
  fallbackUserId,
  onCommit,
  size,
}) {
  const [open, setOpen] = useState(false);
  const group = kind === "group";
  const triggerLabel = label(group ? "choose_group_image" : "change_profile_photo");

  return (
    <div className={`editableImage ${group ? "editableImage-group" : "editableImage-profile"}`}>
      <UserAvatar
        userId={group ? "group" : fallbackUserId}
        profileUrl={src}
        size={size || (group ? 80 : 100)}
        className="editableImage-avatar"
      />
      <button
        type="button"
        className="editableImage-trigger"
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen(true)}
      >
        <img src={uploadIcon} alt="" />
        <span>{triggerLabel}</span>
      </button>
      {open && (
        <ImageChanger
          kind={kind}
          onClose={() => setOpen(false)}
          onCommit={onCommit}
        />
      )}
    </div>
  );
}
