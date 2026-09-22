alter table public.bought_drops
add column transcription_status text not null default 'pending'
check (transcription_status in ('pending', 'processing', 'ready', 'errored')),
add column transcription_asset_id text,
add column transcript_english text,
add column captions_vtt text,
add column editorial_summary text,
add column editorial_headline text,
add column editorial_quote text,
add column editorial_keywords text[] not null default '{}',
add column transcription_claimed_at timestamptz,
add column transcribed_at timestamptz,
add column transcription_error text,
add column transcription_attempts integer not null default 0
check (transcription_attempts between 0 and 10),
add constraint bought_transcript_english_size
check (transcript_english is null or char_length(transcript_english) <= 100000),
add constraint bought_captions_vtt_size
check (captions_vtt is null or char_length(captions_vtt) <= 200000),
add constraint bought_editorial_summary_size
check (editorial_summary is null or char_length(editorial_summary) <= 600),
add constraint bought_editorial_headline_size
check (editorial_headline is null or char_length(editorial_headline) <= 120),
add constraint bought_editorial_quote_size
check (editorial_quote is null or char_length(editorial_quote) <= 500),
add constraint bought_editorial_keywords_size
check (cardinality(editorial_keywords) <= 6);

create index bought_drops_transcription_queue
on public.bought_drops(transcription_status, transcription_claimed_at)
where transcription_status in ('pending', 'processing', 'errored');

create function public.bought_claim_transcription(
  p_drop_id uuid,
  p_asset_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  d public.bought_drops;
  new_asset boolean;
begin
  select *
  into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'BOUGHT: Broadcast not found.';
  end if;
  if d.mux_asset_id is distinct from p_asset_id or d.media_state <> 'ready' then
    raise exception 'BOUGHT: This media version is not ready for transcription.';
  end if;
  if d.transcription_status = 'ready'
    and d.transcription_asset_id = p_asset_id
  then
    return false;
  end if;
  if d.transcription_status = 'processing'
    and d.transcription_asset_id = p_asset_id
    and d.transcription_claimed_at > clock_timestamp() - interval '5 minutes'
  then
    return false;
  end if;

  new_asset := d.transcription_asset_id is distinct from p_asset_id;
  if not new_asset and d.transcription_attempts >= 10 then
    raise exception 'BOUGHT: English transcription has reached its retry limit.';
  end if;

  update public.bought_drops
  set
    transcription_status = 'processing',
    transcription_asset_id = p_asset_id,
    transcript_english = case when new_asset then null else transcript_english end,
    captions_vtt = case when new_asset then null else captions_vtt end,
    editorial_summary = case when new_asset then null else editorial_summary end,
    editorial_headline = case when new_asset then null else editorial_headline end,
    editorial_quote = case when new_asset then null else editorial_quote end,
    editorial_keywords = case when new_asset then '{}' else editorial_keywords end,
    transcription_error = null,
    transcription_claimed_at = clock_timestamp(),
    transcribed_at = case when new_asset then null else transcribed_at end,
    transcription_attempts = case
      when new_asset then 1
      else transcription_attempts + 1
    end
  where id = p_drop_id;
  return true;
end
$$;

create function public.bought_finish_transcription(
  p_drop_id uuid,
  p_asset_id text,
  p_transcript text,
  p_captions text,
  p_summary text,
  p_headline text,
  p_quote text,
  p_keywords text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  d public.bought_drops;
begin
  select *
  into d
  from public.bought_drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'BOUGHT: Broadcast not found.';
  end if;
  if d.mux_asset_id is distinct from p_asset_id
    or d.transcription_asset_id is distinct from p_asset_id
  then
    raise exception 'BOUGHT: The transcription belongs to an older recording.';
  end if;
  if length(trim(coalesce(p_transcript, ''))) = 0
    or left(coalesce(p_captions, ''), 6) <> 'WEBVTT'
  then
    raise exception 'BOUGHT: The transcription response is incomplete.';
  end if;

  update public.bought_drops
  set
    transcription_status = 'ready',
    transcript_english = p_transcript,
    captions_vtt = p_captions,
    editorial_summary = p_summary,
    editorial_headline = p_headline,
    editorial_quote = nullif(p_quote, ''),
    editorial_keywords = coalesce(p_keywords, '{}'),
    transcription_error = null,
    transcription_claimed_at = null,
    transcribed_at = clock_timestamp()
  where id = p_drop_id;
end
$$;

create function public.bought_fail_transcription(
  p_drop_id uuid,
  p_asset_id text,
  p_error text
)
returns void
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
begin
  update public.bought_drops
  set
    transcription_status = 'errored',
    transcription_error = left(
      coalesce(nullif(trim(p_error), ''), 'English transcription failed.'),
      500
    ),
    transcription_claimed_at = null
  where id = p_drop_id
    and mux_asset_id = p_asset_id
    and transcription_asset_id = p_asset_id;
end
$$;

revoke all on function
  public.bought_claim_transcription(uuid, text),
  public.bought_finish_transcription(uuid, text, text, text, text, text, text, text[]),
  public.bought_fail_transcription(uuid, text, text)
from public, anon, authenticated;

grant execute on function
  public.bought_claim_transcription(uuid, text),
  public.bought_finish_transcription(uuid, text, text, text, text, text, text, text[]),
  public.bought_fail_transcription(uuid, text, text)
to service_role;
