import {
  IMAGE_EDITOR_MAX_BYTES,
  ImageEditorError,
  editorErrorKey,
  profileUploadErrorKey,
  validateImageFile,
} from "../imageEditorUtils";

describe("imageEditorUtils", () => {
  test("accepts JPEG and PNG files within 25 MB", () => {
    expect(() => validateImageFile(new File(["ok"], "photo.jpg", { type: "image/jpeg" }))).not.toThrow();
    expect(() => validateImageFile(new File(["ok"], "photo.png", { type: "image/png" }))).not.toThrow();
  });

  test("rejects unsupported types with a label key", () => {
    expect(() => validateImageFile(new File(["no"], "photo.gif", { type: "image/gif" })))
      .toThrow(expect.objectContaining({ labelKey: "image_type_unsupported" }));
  });

  test("rejects files over the advertised limit", () => {
    const file = { type: "image/jpeg", size: IMAGE_EDITOR_MAX_BYTES + 1 };
    expect(() => validateImageFile(file))
      .toThrow(expect.objectContaining({ labelKey: "image_too_large" }));
  });

  test("normalizes editor and GraphQL failures", () => {
    expect(editorErrorKey(new ImageEditorError("image_read_failed"))).toBe("image_read_failed");
    expect(profileUploadErrorKey({ error: { errors: [{ extensions: { code: "UNAUTHORIZED" } }] } }))
      .toBe("profile_image_session_expired");
    expect(profileUploadErrorKey({ error: { errors: [{ extensions: { code: "PAYLOAD_TOO_LARGE" } }] } }))
      .toBe("image_too_large");
    expect(profileUploadErrorKey(new Error("offline"))).toBe("image_upload_failed");
  });
});
