export type DrawRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function containedRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): DrawRect {
  const scale = Math.min(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

export function coveredSourceRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): DrawRect {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return {
      x: (sourceWidth - width) / 2,
      y: 0,
      width,
      height: sourceHeight,
    };
  }
  const height = sourceWidth / targetRatio;
  return {
    x: 0,
    y: (sourceHeight - height) / 2,
    width: sourceWidth,
    height,
  };
}

export function faceBubbleRect(
  canvasWidth: number,
  canvasHeight: number,
): DrawRect {
  const size = Math.round(Math.min(canvasWidth * 0.19, canvasHeight * 0.34));
  const margin = Math.round(Math.max(18, canvasWidth * 0.025));
  return {
    x: canvasWidth - size - margin,
    y: canvasHeight - size - margin,
    width: size,
    height: size,
  };
}
