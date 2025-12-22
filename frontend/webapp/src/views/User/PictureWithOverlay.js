import React, { useState } from "react";
import uploadIcon from "./svg/uploadImage.svg";
import ImageChanger from "./ImageChanger";
import "./PictureWithOverlay.css";
import { label } from "src/models/Utils";
import UserAvatar from "src/components/UserAvatar";

function PictureWithOverlay({
  imgUrl,
  setOpenModal,
  openModal,
  appController,
  isGroup,
  setProfileImage,
}) {
  const [showOverlay, setShowOverlay] = useState(false);
  const userId = appController.states?.user?.user;
  
  return (
    <div
      className={isGroup ? "groupImgWrapper" : "imgWrapper"}
      onMouseEnter={() => setShowOverlay(true)}
      onMouseLeave={() => setShowOverlay(false)}
    >
      <UserAvatar
        userId={userId}
        profileUrl={imgUrl}
        size={isGroup ? 80 : 100}
        className={isGroup ? "groupImage" : "profileImage"}
        style={{ borderRadius: '50%' }}
      />
      <div
        className={`overlay ${showOverlay && "show"}`}
        onClick={() => setOpenModal(true)}
      >
        <img className="overlayImage" src={uploadIcon} alt="" /><br/>
        <strong style={{ fontSize: "10px" }}>{label("upload_photo")}</strong>
      </div>
      {openModal && (
        <ImageChanger
          appController={appController}
          setOpenModal={setOpenModal}
          setShowOverlay={setShowOverlay}
          isGroup={isGroup}
          setProfileImage={setProfileImage}
        />
      )}
    </div>
  );
}

export default PictureWithOverlay;
