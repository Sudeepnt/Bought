export const REEL_WHEEL_GESTURE_IDLE_MS = 700;

export function isNewReelWheelGesture(
  now: number,
  previousWheelEventAt: number | null,
): boolean {
  return (
    previousWheelEventAt === null ||
    now - previousWheelEventAt >= REEL_WHEEL_GESTURE_IDLE_MS
  );
}
