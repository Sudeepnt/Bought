import { database, dbError } from './security';
import { mux, muxPlaybackToken, muxRobots, type MuxAsset } from './providers';

const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

export type EditorialNotes = {
  headline: string;
  summary: string;
  notableQuote: string;
  keywords: string[];
};

function clip(value: string, max: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function fallbackNotes(title: string, transcript: string): EditorialNotes {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return {
    headline: clip(title, 120),
    summary: clip(sentences.slice(0, 2).join(' ') || transcript, 600),
    notableQuote: '',
    keywords: [],
  };
}

export function isEnglishCaptionLanguage(language: string | undefined) {
  const normalized = language?.toLowerCase();
  return normalized === 'en' || normalized?.startsWith('en-') === true;
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
  const { error } = await database().rpc('bought_fail_transcription', {
    p_drop_id: dropId,
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
    const [transcriptSource, captions] = await Promise.all([
      fetchMuxTextTrack(args.playbackId, args.trackId, 'txt'),
      fetchMuxTextTrack(args.playbackId, args.trackId, 'vtt'),
    ]);
    const transcript = clip(transcriptSource, 100_000);
    if (!transcript || !captions.startsWith('WEBVTT'))
      throw new Error('Mux did not return a complete English transcript.');
    const notes = fallbackNotes(args.title, transcript);
    const { error } = await database().rpc('bought_finish_transcription', {
      p_drop_id: args.dropId,
      p_asset_id: args.assetId,
      p_transcript: transcript,
      p_captions: captions.slice(0, 200_000),
      p_summary: notes.summary,
      p_headline: notes.headline,
      p_quote: null,
      p_keywords: [],
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
  category: string;
}) {
  const asset = (
    await mux<MuxAsset>(`assets/${encodeURIComponent(args.assetId)}`)
  ).data;
  const track = asset.tracks?.find((candidate) => candidate.id === args.trackId);
  if (!track || track.type !== 'text' || track.status !== 'ready')
    return { state: 'pending' as const };

  if (track.text_source === 'generated_vod') {
    const { data: claimed, error } = await database().rpc(
      'bought_claim_transcription',
      { p_drop_id: args.dropId, p_asset_id: args.assetId },
    );
    dbError(error);
    if (!claimed) return { state: 'unchanged' as const };
    if (isEnglishCaptionLanguage(track.language_code))
      return finishMuxCaptions({ ...args, trackId: args.trackId });

    try {
      await muxRobots('jobs/translate-captions', {
        parameters: {
          asset_id: args.assetId,
          track_id: args.trackId,
          to_language_code: 'en',
          upload_to_mux: true,
        },
        passthrough: args.dropId,
      });
      return { state: 'processing' as const };
    } catch (error) {
      await failTranscription(
        args.dropId,
        args.assetId,
        error instanceof Error
          ? error.message
          : 'Mux could not start English caption translation.',
      );
      throw error;
    }
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
  category: string;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
}) {
  if (!drop.mux_asset_id || !drop.mux_playback_id)
    throw new Error('The broadcast media is not ready yet.');
  const asset = (
    await mux<MuxAsset>(`assets/${encodeURIComponent(drop.mux_asset_id)}`)
  ).data;
  const caption = asset.tracks?.find(
    (track) => track.type === 'text' && track.status === 'ready',
  );
  if (caption)
    return processMuxCaptionTrack({
      dropId: drop.id,
      assetId: drop.mux_asset_id,
      playbackId: drop.mux_playback_id,
      trackId: caption.id!,
      title: drop.title,
      category: drop.category,
    });

  const audio = asset.tracks?.find(
    (track) => track.type === 'audio' && track.id,
  );
  if (!audio?.id) throw new Error('The broadcast audio is not ready yet.');
  await mux(
    `assets/${encodeURIComponent(drop.mux_asset_id)}/tracks/${encodeURIComponent(audio.id)}/generate-subtitles`,
    {
      generated_subtitles: [
        {
          language_code: 'auto',
          name: 'Original captions',
          passthrough: drop.id,
        },
      ],
    },
  );
  const { error } = await database()
    .from('bought_drops')
    .update({ transcription_status: 'pending', transcription_error: null })
    .eq('id', drop.id)
    .eq('mux_asset_id', drop.mux_asset_id);
  dbError(error);
  return { state: 'pending' as const };
}
