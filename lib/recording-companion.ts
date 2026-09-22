import { recordingCue } from './recording-guidance';

type DocumentPictureInPictureController = {
  requestWindow(options: {
    width: number;
    height: number;
    disallowReturnToOpener?: boolean;
    preferInitialWindowPlacement?: boolean;
  }): Promise<Window>;
};

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureController;
  }
}

export type RecordingCompanion = {
  close: () => void;
  update: (elapsedSeconds: number) => void;
};

function twoDigits(value: number) {
  return String(value).padStart(2, '0');
}

export async function openRecordingCompanion({
  durationSeconds,
  onClosed,
  onStop,
}: {
  durationSeconds: number;
  onClosed: () => void;
  onStop: () => void;
}): Promise<RecordingCompanion | null> {
  const controller = window.documentPictureInPicture;
  if (!controller) return null;

  try {
    const companionWindow = await controller.requestWindow({
      width: 360,
      height: 248,
      disallowReturnToOpener: true,
      preferInitialWindowPlacement: true,
    });
    const companionDocument = companionWindow.document;
    companionDocument.title = 'BOUGHT recording timer';

    const style = companionDocument.createElement('style');
    style.textContent = `
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body { width: 100%; min-height: 100%; margin: 0; }
      body {
        display: grid;
        background: #050706;
        color: #f7f7f4;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .companion {
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 12px;
        min-height: 100vh;
        padding: 16px;
        border: 1px solid #ef2b32;
        background:
          radial-gradient(circle at 84% 12%, rgba(239, 43, 50, .13), transparent 36%),
          #050706;
      }
      .topline { display: flex; align-items: center; justify-content: space-between; }
      .rec, .brand, .label, .cue-title {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .rec { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; }
      .rec::before {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #ef2b32;
        content: "";
        animation: pulse 1s infinite;
      }
      .brand { color: #929a94; font-size: 10px; }
      .main { display: grid; align-content: center; justify-items: center; gap: 4px; }
      .label { color: #ff9195; font-size: 10px; }
      .time {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: clamp(42px, 17vw, 64px);
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        letter-spacing: -.06em;
        line-height: 1;
      }
      .companion.urgent .time, .companion.urgent .cue-title { color: #ff696e; }
      .cue {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 12px;
        padding-top: 12px;
        border-top: 1px solid #28302a;
      }
      .cue-copy { min-width: 0; }
      .cue-title { color: #ff9195; font-size: 11px; font-weight: 700; }
      .cue-message { margin-top: 4px; color: #c5cbc6; font-size: 12px; line-height: 1.35; }
      button {
        min-height: 38px;
        padding: 0 14px;
        border: 1px solid #ef2b32;
        background: #17100f;
        color: #fff;
        cursor: pointer;
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: .08em;
      }
      button:hover { background: #ef2b32; }
      @keyframes pulse { 50% { opacity: .32; } }
      @media (max-width: 300px) {
        .companion { padding: 12px; }
        .cue { grid-template-columns: 1fr; }
        button { width: 100%; }
      }
    `;

    const shell = companionDocument.createElement('main');
    shell.className = 'companion';
    shell.setAttribute('aria-label', 'Recording timer');

    const topLine = companionDocument.createElement('div');
    topLine.className = 'topline';
    const recording = companionDocument.createElement('span');
    recording.className = 'rec';
    recording.textContent = 'Recording';
    const brand = companionDocument.createElement('span');
    brand.className = 'brand';
    brand.textContent = 'BOUGHT';
    topLine.append(recording, brand);

    const main = companionDocument.createElement('div');
    main.className = 'main';
    const label = companionDocument.createElement('span');
    label.className = 'label';
    label.textContent = 'Time left';
    const time = companionDocument.createElement('strong');
    time.className = 'time';
    time.setAttribute('aria-live', 'polite');
    main.append(label, time);

    const cue = companionDocument.createElement('div');
    cue.className = 'cue';
    const cueCopy = companionDocument.createElement('div');
    cueCopy.className = 'cue-copy';
    const cueTitle = companionDocument.createElement('div');
    cueTitle.className = 'cue-title';
    const cueMessage = companionDocument.createElement('div');
    cueMessage.className = 'cue-message';
    cueCopy.append(cueTitle, cueMessage);
    const stop = companionDocument.createElement('button');
    stop.type = 'button';
    stop.textContent = 'STOP';
    stop.addEventListener('click', onStop);
    cue.append(cueCopy, stop);

    shell.append(topLine, main, cue);
    companionDocument.head.append(style);
    companionDocument.body.replaceChildren(shell);

    let closing = false;
    companionWindow.addEventListener(
      'pagehide',
      () => {
        if (!closing) onClosed();
      },
      { once: true },
    );

    const update = (elapsedSeconds: number) => {
      if (companionWindow.closed) return;
      const elapsed = Math.max(
        0,
        Math.min(durationSeconds, Math.floor(elapsedSeconds)),
      );
      const remaining = Math.max(0, durationSeconds - elapsed);
      const currentCue = recordingCue(elapsed);
      time.textContent = `${twoDigits(Math.floor(remaining / 60))}:${twoDigits(remaining % 60)}`;
      time.setAttribute(
        'aria-label',
        `${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`,
      );
      cueTitle.textContent = currentCue.title;
      cueMessage.textContent = currentCue.message;
      shell.classList.toggle('urgent', remaining <= 10);
    };

    update(0);
    return {
      close: () => {
        closing = true;
        if (!companionWindow.closed) companionWindow.close();
      },
      update,
    };
  } catch {
    return null;
  }
}
