export const IMAGE_EDITOR_MAX_BYTES = 25 * 1024 * 1024;
export const IMAGE_EDITOR_OUTPUT_SIZE = 512;
export const IMAGE_EDITOR_MAX_WORKING_EDGE = 4096;
export const IMAGE_EDITOR_TYPES = new Set(["image/jpeg", "image/png"]);

export class ImageEditorError extends Error {
  constructor(labelKey, cause) {
    super(labelKey);
    this.name = "ImageEditorError";
    this.labelKey = labelKey;
    this.cause = cause;
  }
}

export function validateImageFile(file) {
  if (!file || !IMAGE_EDITOR_TYPES.has(String(file.type || "").toLowerCase())) {
    throw new ImageEditorError("image_type_unsupported");
  }
  if (file.size > IMAGE_EDITOR_MAX_BYTES) {
    throw new ImageEditorError("image_too_large");
  }
}

export function editorErrorKey(error, fallback = "image_process_failed") {
  return error?.labelKey || error?.editorErrorKey || fallback;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (!canvas || typeof canvas.toBlob !== "function") {
      reject(new ImageEditorError("image_process_failed"));
      return;
    }
    canvas.toBlob(
      (blob) => blob
        ? resolve(blob)
        : reject(new ImageEditorError("image_process_failed")),
      "image/jpeg",
      0.9
    );
  });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new ImageEditorError("image_process_failed", reader.error));
    reader.readAsDataURL(blob);
  });
}

const canvasBlob = (canvas, quality = 0.92) => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new ImageEditorError("image_read_failed")),
    "image/jpeg",
    quality
  );
});

function drawDownsampled(source, width, height) {
  const scale = Math.min(1, IMAGE_EDITOR_MAX_WORKING_EDGE / Math.max(width, height));
  if (scale === 1) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new ImageEditorError("image_read_failed");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvasBlob(canvas);
}

async function prepareWithImageBitmap(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const downsampled = await drawDownsampled(bitmap, bitmap.width, bitmap.height);
    return downsampled || file;
  } finally {
    if (typeof bitmap.close === "function") bitmap.close();
  }
}

async function prepareWithImageElement(file) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new ImageEditorError("image_read_failed"));
      element.src = sourceUrl;
    });
    const downsampled = await drawDownsampled(image, image.naturalWidth, image.naturalHeight);
    return downsampled || file;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function prepareWorkingImage(file) {
  validateImageFile(file);
  try {
    const workingFile = typeof createImageBitmap === "function"
      ? await prepareWithImageBitmap(file)
      : await prepareWithImageElement(file);
    const src = URL.createObjectURL(workingFile);
    return { src, revoke: () => URL.revokeObjectURL(src) };
  } catch (error) {
    if (error instanceof ImageEditorError) throw error;
    throw new ImageEditorError("image_read_failed", error);
  }
}

export function profileUploadErrorKey(resultOrError) {
  const errors = resultOrError?.error?.errors
    || resultOrError?.response?.data?.errors
    || resultOrError?.errors
    || [];
  const code = errors[0]?.extensions?.code;
  if (code === "UNAUTHORIZED") return "profile_image_session_expired";
  if (code === "PAYLOAD_TOO_LARGE") return "image_too_large";
  return "image_upload_failed";
}
