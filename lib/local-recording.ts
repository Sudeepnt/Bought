// A device-local recovery copy, never the source of truth for payment or publication.
type LocalTake = {
  id: string;
  video: Blob;
  thumbnail?: Blob;
  uploadId?: string;
  uploaded?: boolean;
  savedAt: number;
};

export function recordingUploadRequired({
  replace,
  mediaState,
  localUploadId,
  serverUploadId,
  localUploadCompleted,
}: {
  replace: boolean;
  mediaState: string;
  localUploadId?: string;
  serverUploadId?: string | null;
  localUploadCompleted: boolean;
}) {
  const completedUploadMatches =
    localUploadCompleted && !!localUploadId && localUploadId === serverUploadId;
  return (
    !completedUploadMatches &&
    (replace || !['ready', 'processing'].includes(mediaState))
  );
}

async function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('bought-recorder', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('takes', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('takes', mode);
      const request = action(tx.objectStore('takes'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function saveTake(
  id: string,
  video: Blob,
  thumbnail?: Blob,
  uploadId?: string,
  uploaded = false,
) {
  return transaction('readwrite', (store) =>
    store.put({
      id,
      video,
      thumbnail,
      uploadId,
      uploaded,
      savedAt: Date.now(),
    } satisfies LocalTake),
  );
}

export async function markTakeUploaded(id: string, uploadId: string) {
  const saved = await loadTake(id);
  if (!saved || saved.uploadId !== uploadId) return false;
  await saveTake(saved.id, saved.video, saved.thumbnail, saved.uploadId, true);
  return true;
}
export function loadTake(id: string) {
  return transaction('readonly', (store) => store.get(id)) as Promise<
    LocalTake | undefined
  >;
}
export function deleteTake(id: string) {
  return transaction('readwrite', (store) => store.delete(id));
}

export async function videoFrame(video: HTMLVideoElement): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight)
    throw new Error('Wait for the broadcast to load before capturing a frame.');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1280 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Frame capture is unavailable in this browser.');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Could not capture this frame.')),
      'image/jpeg',
      0.88,
    ),
  );
}

export async function normalizeThumbnail(file: File): Promise<Blob> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error('Choose a JPEG, PNG, or WebP image under 5 MB.');
  const image = await createImageBitmap(file);
  try {
    if (
      image.width < 240 ||
      image.height < 240 ||
      image.width * image.height > 40000000
    )
      throw new Error(
        'Use an image at least 240 × 240 pixels and under 40 megapixels.',
      );
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('Could not read this image.')),
        'image/jpeg',
        0.9,
      ),
    );
  } finally {
    image.close();
  }
}
