import React, { useState, useEffect } from "react";
import { FileUploader } from "react-drag-drop-files";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import ReactLoading from "react-loading";
import Gluejar from "react-gluejar";
import selectImg from "./svg/selectimg.svg";
import { getFwdUrl, label } from "src/models/Utils";
import { toast } from "react-toastify";
function ImageChanger({
  setOpenModal,
  appController,
  setShowOverlay,
  isGroup,
  setProfileImage,
}) {
  const fileTypes = ["JPG", "PNG", "JPEG"];
  const [file, setFile] = useState(null);
  const [cropData, setCropData] = useState(null);
  const [cropper, setCropper] = useState(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    setShowOverlay(false);
    return () => setShowOverlay(false);
  }, []);
  const handleChange = (file) => {
    const objectURL = URL.createObjectURL(file);
    setFile(objectURL);
  };
  const getCropData = () => {
    if (typeof cropper !== "undefined") {
      setCropData(cropper.getCroppedCanvas().toDataURL());
    }
  };
  const uploadImage = () => {
    setUploading(true);
    if (typeof cropper !== "undefined") {
      if (isGroup) {
        const imgUrl = cropper.getCroppedCanvas().toDataURL();
        cropper.getCroppedCanvas().toBlob(function (blob) {
          let file = null;
          if (blob["type"] === "image/jpeg") {
            file = new File([blob], "profile_picture.jpg", {
              type: "image/jpeg",
            });
          } else if (blob["type"] === "image/png") {
            file = new File([blob], "profile_picture.png");
          }
          setProfileImage({ img: imgUrl, file });
        });
        return setOpenModal(false);
      }
      const nickname = appController.states.user.social?.nickname;
      cropper.getCroppedCanvas().toBlob(async function (blob) {
        let file = null;
        if (blob["type"] === "image/jpeg") {
          file = new File([blob], "profile_picture.jpg", {
            type: "image/jpeg",
          });
        } else if (blob["type"] === "image/png") {
          file = new File([blob], "profile_picture.png");
        }
				const params = {
					nickname:nickname,
					profileImage: file
				};
				try {
					const response = await appController.sendbird.sb.updateCurrentUserInfo(params);
					if (response !== null) {
						// console.log("SB",response.plainProfileUrl);
						getFwdUrl(response.plainProfileUrl).then(url=>{
							appController.sendbird.sb.updateCurrentUserInfo(nickname,url,(r,e)=>{
								if(e) return toast.warn(label("error"));
								 //console.log("S3",url,r);
								appController.functions.setUserSocialProfileImage(url);
							})
						})
					}
					appController.functions.setUserSocialProfileImage(response.plainProfileUrl);
					setTimeout(() => setOpenModal(false), 3000);
				} catch (error) {
					if(error) return toast.warn(label("error"));
				}
      });
    }
  };
  return (
    <div
      className="imageUploaderOverlay"
      onClick={(e) =>
        e.target.className === "imageUploaderOverlay" && setOpenModal(false)
      }
    >
      <div className="imageUploaderWrapper">
        <div className="imageWrapperHeader">
          <h5>
            {file && cropData === null
              ? label("edit_image")
              : cropData
              ? label("upload_photo")
              : label("select_image")}
          </h5>
          <hr />
          <button
            className="imageWrapperHeaderButton"
            onClick={() => {
              setOpenModal(false);
            }}
            style={{ cursor: "pointer" }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {file && cropData === null ? (
          <>
            <Cropper
              style={{ height: "calc(100vh - 25em)", width: "100%" }}
              zoomTo={0.5}
              responsive={true}
              dragMode={"move"}
              initialAspectRatio={1}
              src={file}
              viewMode={1}
              autoCropArea={1}
              guides={true}
              onInitialized={(instance) => {
                setCropper(instance);
              }}
            />
            <button
              className="cropButton saveCrop"
              onClick={getCropData}
              style={{ margin: "20px 10px 20px 0", cursor: "pointer" }}
            >
            {label("save")}
            </button>
            <button
              className="cropButton cancelCrop"
              onClick={() => setFile(null)}
              style={{ cursor: "pointer" }}
            >
            {label("cancel")}
            </button>
          </>
        ) : cropData ? (
          <div className="cropDataWrapper">
            <div className="cropDataImageWrapper">
              <img
                src={cropData}
                alt=""
                style={{
                  borderRadius: "50%",
                  marginBottom: "10px",
                  border: "3px solid black",
                  width: "60%",
                  heigth: "60%",
                }}
              />
            </div>
            {uploading ? (
              <ReactLoading
                type={"spin"}
                color={"grey"}
                height={64}
                width={64}
                className="uploadingSpinner"
              />
            ) : (
              <>
                <button
                  className="cropButton saveCrop"
                  onClick={uploadImage}
                  style={{ margin: "20px 10px 20px 0", cursor: "pointer" }}
                >
                  Upload
                </button>
                <button
                  className="cropButton cancelCrop"
                  onClick={() => setCropData(null)}
                  style={{ cursor: "pointer" }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <FileUploader
              handleChange={handleChange}
              name="file"
              types={fileTypes}
            >
              <div
                className="dragField"
                style={{ width: "240px", height: "auto" }}
              >
                <img
                  src={selectImg}
                  alt=""
                />
                <h5>{label("select_paste_drop_image")}</h5>
              </div>
              <span>{label("img_limits")}</span>
            </FileUploader>
            <Gluejar
              acceptedFiles="['image/jpg', 'image/png', 'image/jpeg']"
              errorHandler={(err) => console.error(err)}
            >
              {(images) =>
                images.length > 0 && images.map((image) => setFile(image))
              }
            </Gluejar>
          </>
        )}
      </div>
    </div>
  );
}

export default ImageChanger;
