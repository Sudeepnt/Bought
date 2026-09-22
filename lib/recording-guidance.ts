export type RecordingCue = {
  title: string;
  message: string;
};

export function recordingCue(seconds: number): RecordingCue {
  if (seconds < 10)
    return {
      title: 'TAKE THE STAGE',
      message: 'Start with your point. Speak clearly and make it yours.',
    };
  if (seconds < 90)
    return {
      title: 'KEEP GOING',
      message: 'Talk naturally. Give the room the story and the reason.',
    };
  if (seconds < 110)
    return {
      title: 'LAND THE POINT',
      message: 'Bring your strongest evidence forward now.',
    };
  return {
    title: 'FINAL 10 SECONDS',
    message: 'Wrap up your thought. The recording ends automatically at 02:00.',
  };
}
