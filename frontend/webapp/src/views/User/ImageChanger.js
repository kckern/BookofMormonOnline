import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "reactstrap";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import selectImg from "./svg/selectimg.svg";
import { label } from "src/models/Utils";
import useModalA11y from "src/views/_Common/AppModal/useModalA11y";
import {
  IMAGE_EDITOR_OUTPUT_SIZE,
  ImageEditorError,
  blobToDataUrl,
  canvasToBlob,
  editorErrorKey,
  prepareWorkingImage,
} from "./imageEditorUtils";

const makeId = () => `image-editor-${Math.random().toString(36).slice(2)}`;

export default function ImageChanger({ kind = "profile", onClose, onCommit }) {
  const dialogRef = useRef(null);
  const selectButtonRef = useRef(null);
  const fileInputRef = useRef(null);
  const preparedRef = useRef(null);
  const idRef = useRef(makeId());
  const [source, setSource] = useState(null);
  const [cropper, setCropper] = useState(null);
  const [baseRatio, setBaseRatio] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [errorKey, setErrorKey] = useState(null);

  const titleId = `${idRef.current}-title`;
  const descriptionId = `${idRef.current}-description`;
  const previewId = `${idRef.current}-preview`;
  const editing = !!source;
  const dialogTitle = editing
    ? label("crop_image")
    : label(kind === "group" ? "choose_group_image" : "change_profile_photo");

  const releasePrepared = useCallback(() => {
    preparedRef.current?.revoke?.();
    preparedRef.current = null;
  }, []);

  useEffect(() => releasePrepared, [releasePrepared]);

  useModalA11y(true, {
    onClose,
    label: dialogTitle,
    dialogRef,
    initialFocusRef: selectButtonRef,
    lockScroll: true,
    closeDisabled: busy,
  });

  const resetSelection = useCallback(() => {
    releasePrepared();
    setSource(null);
    setCropper(null);
    setBaseRatio(1);
    setZoom(1);
    setErrorKey(null);
    setBusy(false);
  }, [releasePrepared]);

  const acceptFile = useCallback(async (file) => {
    if (busy) return;
    setBusy(true);
    setErrorKey(null);
    try {
      const prepared = await prepareWorkingImage(file);
      releasePrepared();
      preparedRef.current = prepared;
      setSource(prepared.src);
      setCropper(null);
      setZoom(1);
    } catch (error) {
      setErrorKey(editorErrorKey(error, "image_read_failed"));
    } finally {
      setBusy(false);
    }
  }, [busy, releasePrepared]);

  const handleInput = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) acceptFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type?.startsWith("image/"));
    if (file) acceptFile(file);
    else setErrorKey("image_type_unsupported");
  };

  const handlePaste = (event) => {
    if (busy) return;
    const item = Array.from(event.clipboardData?.items || []).find((candidate) => candidate.type?.startsWith("image/"));
    const file = item?.getAsFile?.();
    if (file) {
      event.preventDefault();
      acceptFile(file);
    }
  };

  const initializeCropper = (instance) => {
    setCropper(instance);
    const ratio = instance.getImageData?.().ratio;
    setBaseRatio(Number.isFinite(ratio) && ratio > 0 ? ratio : 1);
    setZoom(1);
  };

  const changeZoom = (event) => {
    const value = Number(event.target.value);
    setZoom(value);
    cropper?.zoomTo?.(baseRatio * value);
  };

  const rotate = (degrees) => cropper?.rotate?.(degrees);

  const resetCrop = () => {
    cropper?.reset?.();
    const ratio = cropper?.getImageData?.().ratio;
    setBaseRatio(Number.isFinite(ratio) && ratio > 0 ? ratio : baseRatio);
    setZoom(1);
  };

  const save = async () => {
    if (!cropper || busy) return;
    setBusy(true);
    setErrorKey(null);
    try {
      const canvas = cropper.getCroppedCanvas({
        width: IMAGE_EDITOR_OUTPUT_SIZE,
        height: IMAGE_EDITOR_OUTPUT_SIZE,
        fillColor: "#fff",
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      });
      const blob = await canvasToBlob(canvas);
      const dataUrl = await blobToDataUrl(blob);
      const fileName = kind === "group" ? "group-image.jpg" : "profile-photo.jpg";
      const file = new File([blob], fileName, { type: "image/jpeg" });
      await onCommit({ file, dataUrl });
      onClose();
    } catch (error) {
      const fallback = error instanceof ImageEditorError ? "image_process_failed" : "image_upload_failed";
      setErrorKey(editorErrorKey(error, fallback));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  const node = (
    <div
      className="imageEditor"
      onPaste={handlePaste}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!editing && !busy) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="imageEditor-backdrop" onClick={close} aria-hidden="true" />
      <section
        ref={dialogRef}
        className="imageEditor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy}
        tabIndex="-1"
      >
        <header className="imageEditor-header">
          <h2 id={titleId}>{dialogTitle}</h2>
          <button
            type="button"
            className="imageEditor-close"
            aria-label={label("close_image_editor")}
            onClick={close}
            disabled={busy}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {!editing ? (
          <div className="imageEditor-select">
            <input
              ref={fileInputRef}
              className="imageEditor-fileInput"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleInput}
              disabled={busy}
            />
            <button
              ref={selectButtonRef}
              type="button"
              className={`imageEditor-dropzone${dragging ? " is-dragging" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <img src={selectImg} alt="" />
              <span>{label("select_paste_drop_image")}</span>
            </button>
            <p id={descriptionId} className="imageEditor-help">{label("img_limits")}</p>
          </div>
        ) : (
          <div className="imageEditor-workspace">
            <div className="imageEditor-cropArea">
              <Cropper
                src={source}
                aspectRatio={1}
                initialAspectRatio={1}
                viewMode={1}
                dragMode="move"
                autoCropArea={1}
                background={false}
                responsive
                guides
                preview={`#${previewId}`}
                onInitialized={initializeCropper}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
            <aside className="imageEditor-tools">
              <div id={previewId} className="imageEditor-preview" aria-hidden="true" />
              <p id={descriptionId} className="imageEditor-help">{label("crop_image_help")}</p>
              <label className="imageEditor-zoom">
                <span>{label("zoom")}</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={changeZoom}
                  disabled={busy || !cropper}
                />
              </label>
              <div className="imageEditor-toolButtons">
                <Button type="button" color="secondary" onClick={() => rotate(-90)} disabled={busy || !cropper} aria-label={label("rotate_left")} title={label("rotate_left")}>
                  <span aria-hidden="true">↶</span>
                </Button>
                <Button type="button" color="secondary" onClick={() => rotate(90)} disabled={busy || !cropper} aria-label={label("rotate_right")} title={label("rotate_right")}>
                  <span aria-hidden="true">↷</span>
                </Button>
                <Button type="button" color="secondary" onClick={resetCrop} disabled={busy || !cropper}>
                  {label("reset")}
                </Button>
              </div>
            </aside>
          </div>
        )}

        {errorKey && <div className="imageEditor-error" role="alert">{label(errorKey)}</div>}
        {busy && <div className="imageEditor-status" role="status">{label(editing ? "saving_image" : "processing_image")}</div>}

        <footer className="imageEditor-footer">
          {editing && (
            <Button type="button" color="secondary" onClick={resetSelection} disabled={busy}>
              {label("choose_another_image")}
            </Button>
          )}
          <Button type="button" color="secondary" onClick={close} disabled={busy}>
            {label("cancel")}
          </Button>
          {editing && (
            <Button type="button" color="primary" onClick={save} disabled={busy || !cropper}>
              {label(kind === "group" ? "use_group_image" : "save_profile_photo")}
            </Button>
          )}
        </footer>
      </section>
    </div>
  );

  return createPortal(node, document.body);
}
