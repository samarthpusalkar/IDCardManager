const DEFAULT_EXPORT_TYPE = 'image/jpeg';
const DEFAULT_EXPORT_QUALITY = 0.92;
export const DEFAULT_OUTPUT_WIDTH = 2480;
const MIN_OUTPUT_WIDTH = 800;
const MAX_OUTPUT_WIDTH = 4000;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadImageFromObjectUrl(objectUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load selected image'));
    image.src = objectUrl;
  });
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to process selected image'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

export function getCardAspectRatio() {
  return 85.6 / 53.98;
}

export function getDefaultEditorState() {
  return {
    rotationDeg: 0,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    outputWidth: DEFAULT_OUTPUT_WIDTH,
  };
}

export async function processImageOnClient(file, editorState) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const aspectRatio = getCardAspectRatio();
    const outputWidth = clamp(
      Number(editorState.outputWidth) || DEFAULT_OUTPUT_WIDTH,
      MIN_OUTPUT_WIDTH,
      MAX_OUTPUT_WIDTH
    );
    const outputHeight = Math.round(outputWidth / aspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is not available in this browser');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const baseScale = Math.min(outputWidth / image.width, outputHeight / image.height);
    const zoom = clamp(Number(editorState.zoom) || 1, 1, 4);
    const scale = baseScale * zoom;

    const offsetX = clamp(Number(editorState.offsetX) || 0, -50, 50);
    const offsetY = clamp(Number(editorState.offsetY) || 0, -50, 50);
    const panX = (offsetX / 100) * image.width;
    const panY = (offsetY / 100) * image.height;

    const rotationDeg = Number(editorState.rotationDeg) || 0;
    const rotationRad = (rotationDeg * Math.PI) / 180;

    context.save();
    context.translate(outputWidth / 2, outputHeight / 2);
    context.rotate(rotationRad);
    context.scale(scale, scale);
    context.drawImage(image, -image.width / 2 + panX, -image.height / 2 + panY);
    context.restore();

    const blob = await toBlob(canvas, DEFAULT_EXPORT_TYPE, DEFAULT_EXPORT_QUALITY);
    const processedName = `${file.name.replace(/\.[^.]+$/, '')}-processed.jpg`;
    return new File([blob], processedName, {
      type: DEFAULT_EXPORT_TYPE,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
