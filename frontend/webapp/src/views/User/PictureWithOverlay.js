import React, { useState } from "react";
import uploadIcon from "./svg/uploadImage.svg";
import ImageChanger from "./ImageChanger";
import "./PictureWithOverlay.css";
import { label } from "src/models/Utils";
function PictureWithOverlay({
  imgUrl,
  setOpenModal,
  openModal,
  appController,
  isGroup,
  setProfileImage,
}) {
  const [showOverlay, setShowOverlay] = useState(false);
  return (
    <div
      className={isGroup ? "groupImgWrapper" : "imgWrapper"}
      onMouseEnter={() => setShowOverlay(true)}
      onMouseLeave={() => setShowOverlay(false)}
    >
      <img
        className={isGroup ? "groupImage" : "profileImage"}
        src={imgUrl}
        alt=""
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
