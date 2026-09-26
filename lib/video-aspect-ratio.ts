export function portraitVideoAspectRatio(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= width
  )
    return null;

  return width / height;
}
