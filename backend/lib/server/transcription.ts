import { database, dbError } from './security';
import { mux, muxPlaybackToken, muxRobots, type MuxAsset } from './providers';

const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

function clip(value: string, max: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function isEnglishCaptionLanguage(language: string | undefined) {
  const normalized = language?.toLowerCase();
  return normalized === 'en' || normalized?.startsWith('en-') === true;
}

export function muxGeneratedSubtitles(dropId: string) {
  return [
    {
      language_code: 'auto',
      name: 'Original captions',
      passthrough: dropId,
    },
  ];
}

export function selectReadyMuxCaptionTrack(
  tracks: MuxAsset['tracks'] | undefined,
) {
  const captions =
    tracks?.filter(
      (track) => track.type === 'text' && track.status === 'ready' && track.id,
    ) ?? [];
  return (
    captions.find((track) => isEnglishCaptionLanguage(track.language_code)) ??
    captions.find((track) => track.text_source === 'generated_vod') ??
    null
  );
}

async function fetchMuxTextTrack(
  playbackId: string,
  trackId: string,
  extension: 'txt' | 'vtt',
) {
  const token = muxPlaybackToken(playbackId);
  const response = await fetch(
    `https://stream.mux.com/${encodeURIComponent(playbackId)}/text/${encodeURIComponent(trackId)}.${extension}?token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok) throw new Error('Mux captions are unavailable.');
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CAPTION_BYTES)
    throw new Error('Mux captions are too large.');
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_CAPTION_BYTES)
    throw new Error('Mux captions are too large.');
  return text;
}

async function failTranscription(
  dropId: string,
  assetId: string,
  message: string,
) {
  const { error } = await database().rpc('bought_ad_fail_transcription', {
    p_ad_id: dropId,
    p_asset_id: assetId,
    p_error: clip(message, 500),
  });
  dbError(error);
}

async function finishMuxCaptions(args: {
  dropId: string;
  assetId: string;
  playbackId: string;
  trackId: string;
  title: string;
}) {
  try {
    const [transcriptSource, captionsSource] = await Promise.all([
      fetchMuxTextTrack(args.playbackId, args.trackId, 'txt'),
      fetchMuxTextTrack(args.playbackId, args.trackId, 'vtt'),
    ]);
    const transcript = clip(transcriptSource, 100_000);
    const captions = captionsSource.replace(/^\uFEFF/, '');
    if (!transcript || !/^WEBVTT(?:\s|$)/.test(captions))
      throw new Error('Mux did not return a complete English transcript.');
    const { error } = await database().rpc('bought_ad_finish_transcription', {
      p_ad_id: args.dropId,
      p_asset_id: args.assetId,
      p_transcript: transcript,
      p_captions: captions.slice(0, 200_000),
    });
    dbError(error);
    return { state: 'ready' as const };
  } catch (error) {
    await failTranscription(
      args.dropId,
      args.assetId,
      error instanceof Error
        ? error.message
        : 'English captions could not be completed.',
    );
    throw error;
  }
}

export async function processMuxCaptionTrack(args: {
  dropId: string;
  assetId: string;
  playbackId: string;
  trackId: string;
  title: string;
}) {
  const asset = (
    await mux<MuxAsset>(`assets/${encodeURIComponent(args.assetId)}`)
  ).data;
  const track = asset.tracks?.find(
    (candidate) => candidate.id === args.trackId,
  );
  if (!track || track.type !== 'text' || track.status !== 'ready')
    return { state: 'pending' as const };

  if (track.text_source === 'generated_vod') {
    const { data: claimed, error } = await database().rpc(
      'bought_ad_claim_transcription',
      { p_ad_id: args.dropId, p_asset_id: args.assetId },
    );
    dbError(error);
    if (!claimed) return { state: 'unchanged' as const };
    if (isEnglishCaptionLanguage(track.language_code))
      return finishMuxCaptions({ ...args, trackId: args.trackId });
    // A non-English ad needs one English track for the reviewer. Nothing else is translated.
    try {
      await muxRobots('jobs/translate-captions', {
        parameters: {
          asset_id: args.assetId,
          track_id: args.trackId,
          to_language_code: 'en',
          upload_to_mux: true,
        },
        passthrough: `${args.dropId}:en`,
      });
    } catch (error) {
      await failTranscription(
        args.dropId,
        args.assetId,
        'Mux could not start English caption translation.',
      );
      throw error;
    }
    return { state: 'processing' as const };
  }

  // Mux Robots attaches the translated English VTT as a second ready track.
  // The database lease above prevents a replayed source-track webhook from
  // starting another translation job while that track is being prepared.
  if (isEnglishCaptionLanguage(track.language_code))
    return finishMuxCaptions({ ...args, trackId: args.trackId });
  return { state: 'pending' as const };
}

export async function requestTranscription(drop: {
  id: string;
  title: string;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
}) {
  if (!drop.mux_asset_id || !drop.mux_playback_id)
    throw new Error('The video is not ready yet.');
  const asset = (
    await mux<MuxAsset>(`assets/${encodeURIComponent(drop.mux_asset_id)}`)
  ).data;
  const caption = selectReadyMuxCaptionTrack(asset.tracks);
  if (caption)
    return processMuxCaptionTrack({
      dropId: drop.id,
      assetId: drop.mux_asset_id,
      playbackId: drop.mux_playback_id,
      trackId: caption.id!,
      title: drop.title,
    });

  // Direct uploads already request generated subtitles. If Mux has created a
  // pending track, wait for its track.ready webhook instead of starting a
  // duplicate generate-subtitles job when a moderator presses Retry.
  const captionPreparing = asset.tracks?.some(
    (track) => track.type === 'text' && track.status === 'preparing',
  );
  if (captionPreparing) {
    const { error } = await database()
      .from('bought_ads')
      .update({ transcription_status: 'pending', transcription_error: null })
      .eq('id', drop.id)
      .eq('mux_asset_id', drop.mux_asset_id);
    dbError(error);
    return { state: 'pending' as const };
  }

  const audio = asset.tracks?.find(
    (track) => track.type === 'audio' && track.id,
  );
  if (!audio?.id) throw new Error('The audio is not ready yet.');
  await mux(
    `assets/${encodeURIComponent(drop.mux_asset_id)}/tracks/${encodeURIComponent(audio.id)}/generate-subtitles`,
    {
      generated_subtitles: muxGeneratedSubtitles(drop.id),
    },
  );
  const { error } = await database()
    .from('bought_ads')
    .update({ transcription_status: 'pending', transcription_error: null })
    .eq('id', drop.id)
    .eq('mux_asset_id', drop.mux_asset_id);
  dbError(error);
  return { state: 'pending' as const };
}
