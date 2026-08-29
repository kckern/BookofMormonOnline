import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PictureWithOverlay from "../PictureWithOverlay";
import {
  ImageEditorError,
  blobToDataUrl,
  canvasToBlob,
  prepareWorkingImage,
} from "../imageEditorUtils";

const mockCropper = {
  getImageData: jest.fn(() => ({ ratio: 0.5 })),
  zoomTo: jest.fn(),
  rotate: jest.fn(),
  reset: jest.fn(),
  getCroppedCanvas: jest.fn(() => ({ canvas: true })),
};

jest.mock("react-cropper", () => function MockCropper(props) {
  const MockReact = require("react");
  MockReact.useEffect(() => props.onInitialized(mockCropper), [props]);
  return <div data-testid="cropper" data-aspect={props.aspectRatio} />;
});

jest.mock("../imageEditorUtils", () => {
  const actual = jest.requireActual("../imageEditorUtils");
  return {
    ...actual,
    prepareWorkingImage: jest.fn(),
    canvasToBlob: jest.fn(),
    blobToDataUrl: jest.fn(),
  };
});

const strings = {
  cancel: "Cancel",
  change_profile_photo: "Change profile photo",
  choose_group_image: "Choose group image",
  crop_image: "Crop image",
  crop_image_help: "Crop help",
  zoom: "Zoom",
  rotate_left: "Rotate left",
  rotate_right: "Rotate right",
  reset: "Reset",
  choose_another_image: "Choose another image",
  save_profile_photo: "Save profile photo",
  use_group_image: "Use group image",
  close_image_editor: "Close image editor",
  select_paste_drop_image: "Choose, drop, or paste an image",
  img_limits: "JPG or PNG, up to 25 MB.",
  processing_image: "Processing image…",
  saving_image: "Saving image…",
  image_type_unsupported: "Choose a JPG or PNG image.",
  image_upload_failed: "The image could not be saved.",
};

beforeEach(() => {
  global.dictionary = strings;
  mockCropper.getImageData.mockReturnValue({ ratio: 0.5 });
  mockCropper.zoomTo.mockClear();
  mockCropper.rotate.mockClear();
  mockCropper.reset.mockClear();
  mockCropper.getCroppedCanvas.mockReturnValue({ canvas: true });
  prepareWorkingImage.mockResolvedValue({ src: "blob:working", revoke: jest.fn() });
  canvasToBlob.mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
  blobToDataUrl.mockResolvedValue("data:image/jpeg;base64,dGVzdA==");
});

afterEach(() => {
  delete global.dictionary;
});

async function chooseImage() {
  fireEvent.change(document.querySelector(".imageEditor-fileInput"), {
    target: { files: [new File(["image"], "photo.jpg", { type: "image/jpeg" })] },
  });
  await screen.findByTestId("cropper");
}

test("opens an accessible dialog and restores focus after Escape", async () => {
  render(<PictureWithOverlay kind="profile" fallbackUserId="alice" onCommit={jest.fn()} />);
  const trigger = screen.getByRole("button", { name: "Change profile photo" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "Change profile photo" }).getAttribute("aria-modal")).toBe("true");

  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement === trigger).toBe(true);
});

test("uses a fixed-square crop and returns a bounded JPEG result", async () => {
  const onCommit = jest.fn().mockResolvedValue(undefined);
  render(<PictureWithOverlay kind="profile" fallbackUserId="alice" onCommit={onCommit} />);
  fireEvent.click(screen.getByRole("button", { name: "Change profile photo" }));
  await chooseImage();

  expect(screen.getByTestId("cropper").getAttribute("data-aspect")).toBe("1");
  fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), { target: { value: "1.5" } });
  expect(mockCropper.zoomTo).toHaveBeenCalledWith(0.75);
  fireEvent.click(screen.getByRole("button", { name: "Rotate left" }));
  expect(mockCropper.rotate).toHaveBeenCalledWith(-90);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save profile photo" })));
  await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
  expect(onCommit.mock.calls[0][0].dataUrl).toBe("data:image/jpeg;base64,dGVzdA==");
  expect(onCommit.mock.calls[0][0].file).toEqual(expect.objectContaining({ type: "image/jpeg" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("keeps the dialog open and shows an actionable validation error", async () => {
  prepareWorkingImage.mockRejectedValueOnce(new ImageEditorError("image_type_unsupported"));
  render(<PictureWithOverlay kind="profile" fallbackUserId="alice" onCommit={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Change profile photo" }));
  fireEvent.change(document.querySelector(".imageEditor-fileInput"), {
    target: { files: [new File(["gif"], "photo.gif", { type: "image/gif" })] },
  });
  expect((await screen.findByRole("alert")).textContent).toBe("Choose a JPG or PNG image.");
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("group images use the group fallback and stage a File without a personal user id", async () => {
  const onCommit = jest.fn().mockResolvedValue(undefined);
  render(<PictureWithOverlay kind="group" fallbackUserId="alice" onCommit={onCommit} />);
  const avatar = document.querySelector(".editableImage-avatar");
  expect(avatar.getAttribute("src")).not.toContain("6384e2b2184bcbf58eccf10ca7a6563c");

  fireEvent.click(screen.getByRole("button", { name: "Choose group image" }));
  await chooseImage();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Use group image" })));
  await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
  expect(onCommit.mock.calls[0][0].file.name).toBe("group-image.jpg");
});
