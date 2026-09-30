import { database, dbError } from './security';
import {
  mux,
  muxPlaybackToken,
  muxRobots,
  muxRobotsGet,
  type MuxAsset,
} from './providers';
import { HttpError } from './config';
import {
  FEATURED_CAPTION_LANGUAGE_CODES,
  captionLanguageBaseCode,
  isCaptionLanguageCode,
} from '../caption-languages';

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

export function captionTranslationTargets(
  tracks: MuxAsset['tracks'] | undefined,
  sourceLanguage: string | undefined,
) {
  const existing = new Set(
    tracks
      ?.filter((track) => track.type === 'text' && track.status !== 'errored')
      .map((track) => captionLanguageBaseCode(track.language_code))
      .filter(Boolean),
  );
  existing.add(captionLanguageBaseCode(sourceLanguage));
  return FEATURED_CAPTION_LANGUAGE_CODES.filter((code) => !existing.has(code));
}

async function startCaptionTranslations(args: {
  dropId: string;
  assetId: string;
  trackId: string;
  targets: string[];
}) {
  const results = await Promise.allSettled(
    args.targets.map((language) =>
      muxRobots('jobs/translate-captions', {
        parameters: {
          asset_id: args.assetId,
          track_id: args.trackId,
          to_language_code: language,
          upload_to_mux: true,
        },
        passthrough: `${args.dropId}:${language}`,
      }),
    ),
  );
  return new Map(
    args.targets.map((language, index) => [language, results[index]]),
  );
}

type MuxCaptionTranslationJob = {
  status?: string;
  parameters?: {
    asset_id?: string;
    track_id?: string;
    to_language_code?: string;
  };
  outputs?: { uploaded_track_id?: string };
};

export async function requestCaptionLanguage(args: {
  dropId: string;
  assetId: string;
  language: string;
}) {
  if (!isCaptionLanguageCode(args.language))
    throw new HttpError(400, 'Choose a supported caption language.');
  const asset = (
    await mux<MuxAsset>(`assets/${encodeURIComponent(args.assetId)}`)
  ).data;
  const existing = asset.tracks?.find(
    (track) =>
      track.type === 'text' &&
      track.status === 'ready' &&
      track.id &&
      captionLanguageBaseCode(track.language_code) === args.language,
  );
  if (existing?.id) return { state: 'ready' as const, trackId: existing.id };
  const preparing = asset.tracks?.some(
    (track) =>
      track.type === 'text' &&
      track.status === 'preparing' &&
      captionLanguageBaseCode(track.language_code) === args.language,
  );
  if (preparing) return { state: 'processing' as const, trackId: null };

  const source = asset.tracks?.find(
    (track) =>
      track.type === 'text' &&
      track.status === 'ready' &&
      track.text_source === 'generated_vod' &&
      track.id,
  );
  if (!source?.id)
    throw new HttpError(
      409,
      'The original captions are still being prepared.',
    );

  const query = new URLSearchParams({
    workflow: 'translate-captions',
    asset_id: args.assetId,
    limit: '100',
  });
  const jobs = (await muxRobotsGet<MuxCaptionTranslationJob[]>(`jobs?${query}`))
    .data;
  const active = jobs.find(
    (job) =>
      ['pending', 'processing'].includes(job.status ?? '') &&
      job.parameters?.to_language_code === args.language,
  );
  if (active) return { state: 'processing' as const, trackId: null };

  await muxRobots('jobs/translate-captions', {
    parameters: {
      asset_id: args.assetId,
      track_id: source.id,
      to_language_code: args.language,
      upload_to_mux: true,
    },
    passthrough: `${args.dropId}:${args.language}`,
  });
  return { state: 'processing' as const, trackId: null };
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
    const [transcriptSource, captionsSource] = await Promise.all([
      fetchMuxTextTrack(args.playbackId, args.trackId, 'txt'),
      fetchMuxTextTrack(args.playbackId, args.trackId, 'vtt'),
    ]);
    const transcript = clip(transcriptSource, 100_000);
    const captions = captionsSource.replace(/^\uFEFF/, '');
    if (!transcript || !/^WEBVTT(?:\s|$)/.test(captions))
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
  const track = asset.tracks?.find(
    (candidate) => candidate.id === args.trackId,
  );
  if (!track || track.type !== 'text' || track.status !== 'ready')
    return { state: 'pending' as const };

  if (track.text_source === 'generated_vod') {
    const { data: claimed, error } = await database().rpc(
      'bought_claim_transcription',
      { p_drop_id: args.dropId, p_asset_id: args.assetId },
    );
    dbError(error);
    if (!claimed) return { state: 'unchanged' as const };
    const targets = captionTranslationTargets(
      asset.tracks,
      track.language_code,
    );
    const translations = await startCaptionTranslations({
      dropId: args.dropId,
      assetId: args.assetId,
      trackId: args.trackId,
      targets,
    });
    for (const [language, result] of translations) {
      if (language !== 'en' && result.status === 'rejected')
        console.error(
          `BOUGHT ${language} caption translation could not start:`,
          result.reason instanceof Error
            ? result.reason.message
            : result.reason,
        );
    }
    if (isEnglishCaptionLanguage(track.language_code))
      return finishMuxCaptions({ ...args, trackId: args.trackId });

    const english = translations.get('en');
    if (!english || english.status === 'rejected') {
      const translationError =
        english?.status === 'rejected' ? english.reason : null;
      await failTranscription(
        args.dropId,
        args.assetId,
        translationError instanceof Error
          ? translationError.message
          : 'Mux could not start English caption translation.',
      );
      if (translationError instanceof Error) throw translationError;
      throw new Error('Mux could not start English caption translation.');
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
  category: string;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
}) {
  if (!drop.mux_asset_id || !drop.mux_playback_id)
    throw new Error('The broadcast media is not ready yet.');
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
      category: drop.category,
    });

  // Direct uploads already request generated subtitles. If Mux has created a
  // pending track, wait for its track.ready webhook instead of starting a
  // duplicate generate-subtitles job when a moderator presses Retry.
  const captionPreparing = asset.tracks?.some(
    (track) => track.type === 'text' && track.status === 'preparing',
  );
  if (captionPreparing) {
    const { error } = await database()
      .from('bought_drops')
      .update({ transcription_status: 'pending', transcription_error: null })
      .eq('id', drop.id)
      .eq('mux_asset_id', drop.mux_asset_id);
    dbError(error);
    return { state: 'pending' as const };
  }

  const audio = asset.tracks?.find(
    (track) => track.type === 'audio' && track.id,
  );
  if (!audio?.id) throw new Error('The broadcast audio is not ready yet.');
  await mux(
    `assets/${encodeURIComponent(drop.mux_asset_id)}/tracks/${encodeURIComponent(audio.id)}/generate-subtitles`,
    {
      generated_subtitles: muxGeneratedSubtitles(drop.id),
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
