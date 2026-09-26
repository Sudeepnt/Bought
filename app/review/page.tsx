'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Quote, RefreshCw } from 'lucide-react';
import { useBought } from '@/components/bought-provider';
import { DropSignIn } from '@/components/drop-sign-in';
import { DropPlayer } from '@/components/drop-player';
import { MarketTopbar } from '@/components/market-topbar';
import { money, type Drop } from '@/lib/drop-domain';

function TranscriptPanel({
  drop,
  busy,
  onGenerate,
}: {
  drop: Drop;
  busy: boolean;
  onGenerate: () => void;
}) {
  const statusLabel =
    drop.transcription_status === 'ready'
      ? 'READY'
      : drop.transcription_status === 'processing'
        ? 'TRANSLATING'
        : drop.transcription_status === 'errored'
          ? 'NEEDS RETRY'
          : 'QUEUED';
  return (
    <section
      className="review-transcript"
      aria-label="English transcript and editorial notes"
    >
      <header>
        <div>
          <FileText size={17} />
          <span>MAGAZINE TRANSCRIPT / ENGLISH</span>
        </div>
        <strong data-state={drop.transcription_status}>{statusLabel}</strong>
      </header>
      {drop.transcription_status === 'ready' && drop.transcript_english ? (
        <>
          <div className="review-editorial-note">
            <span>SUGGESTED EDITORIAL ANGLE</span>
            <h3>{drop.editorial_headline || drop.title}</h3>
            <p>{drop.editorial_summary}</p>
          </div>
          {drop.editorial_quote && (
            <blockquote>
              <Quote size={17} aria-hidden="true" />“{drop.editorial_quote}”
            </blockquote>
          )}
          {drop.editorial_keywords.length > 0 && (
            <div
              className="review-transcript-keywords"
              aria-label="Editorial keywords"
            >
              {drop.editorial_keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
          )}
          <details>
            <summary>READ FULL ENGLISH TRANSCRIPT</summary>
            <p>{drop.transcript_english}</p>
          </details>
          <small>
            Machine-generated translation. Check names and quotations against
            the video before publication.
          </small>
        </>
      ) : (
        <div className="review-transcript-waiting">
          <p>
            {drop.transcription_status === 'processing'
              ? 'Mux is generating or translating English captions.'
              : (drop.transcription_error ??
                'Mux will generate English captions from this broadcast.')}
          </p>
          {drop.transcription_status !== 'processing' && (
            <button
              type="button"
              className="drop-button"
              disabled={busy}
              onClick={onGenerate}
            >
              <RefreshCw size={14} className={busy ? 'is-spinning' : ''} />
              {busy ? 'STARTING…' : 'GENERATE ENGLISH TRANSCRIPT'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default function ReviewPage() {
  const { session, api } = useBought();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const reload = useCallback(async () => {
    const data = await api<{ drops: Drop[] }>('review');
    setDrops(data.drops);
  }, [api]);
  useEffect(() => {
    let active = true;
    if (session)
      void api<{ drops: Drop[] }>('review')
        .then((data) => {
          if (active) setDrops(data.drops);
        })
        .catch((err) => {
          if (active) setError(err.message);
        });
    return () => {
      active = false;
    };
  }, [api, session]);
  async function decide(drop: Drop, approve: boolean) {
    setBusy(drop.id);
    setError('');
    try {
      await api(`review/${drop.id}`, {
        assetId: drop.mux_asset_id,
        approve,
        reason: reasons[drop.id],
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save review.');
    } finally {
      setBusy(null);
    }
  }
  async function transcribe(drop: Drop) {
    const busyKey = `transcribe:${drop.id}`;
    setBusy(busyKey);
    setError('');
    try {
      await api(`review/${drop.id}/transcribe`, {});
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not start transcription.',
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <main className="market-shell dashboard-shell">
      <MarketTopbar active="review" />
      <div className="drop-page">
        <header className="drop-page-heading">
          <div>
            <span className="drop-eyebrow">MODERATOR WORKSPACE</span>
            <h1>
              REVIEW THE BROADCAST<span>.</span>
            </h1>
            <p>
              Check the complete broadcast and thumbnail before approving
              publication.
            </p>
          </div>
        </header>
        {!session ? (
          <DropSignIn />
        ) : (
          <>
            {error && (
              <p className="drop-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="drop-button"
              onClick={() =>
                void reload().catch((err) => setError(err.message))
              }
            >
              REFRESH QUEUE
            </button>
            {drops.length === 0 && !error && (
              <p className="drop-notice">
                No broadcasts are waiting for review.
              </p>
            )}
            <div className="review-grid">
              {drops.map((drop) => (
                <article className="drop-workspace" key={drop.id}>
                  <span className="drop-eyebrow">
                    {drop.category} · {money(drop.amount_minor)}
                  </span>
                  <h2>{drop.title}</h2>
                  <span className="review-capture-mode">
                    {drop.capture_mode === 'screen'
                      ? 'SCREEN EVIDENCE + MICROPHONE'
                      : 'CAMERA + MICROPHONE'}
                  </span>
                  <DropPlayer dropId={drop.id} />
                  <TranscriptPanel
                    drop={drop}
                    busy={busy === `transcribe:${drop.id}`}
                    onGenerate={() => void transcribe(drop)}
                  />
                  <p>
                    {drop.capture_mode === 'screen'
                      ? 'Confirm that the required screen evidence remains visible, speech is audible, and the broadcast, title, and thumbnail meet BOUGHT’s content rules.'
                      : 'Confirm that a face remains visible, speech is audible, and the broadcast, title, and thumbnail meet BOUGHT’s content rules.'}
                  </p>
                  <label className="review-check">
                    <input
                      type="checkbox"
                      checked={!!checks[drop.id]}
                      onChange={(event) =>
                        setChecks((values) => ({
                          ...values,
                          [drop.id]: event.target.checked,
                        }))
                      }
                    />
                    I watched the full broadcast and checked the thumbnail.
                  </label>
                  <label className="drop-field">
                    Reason for a retake
                    <textarea
                      maxLength={500}
                      value={reasons[drop.id] ?? ''}
                      onChange={(event) =>
                        setReasons((values) => ({
                          ...values,
                          [drop.id]: event.target.value,
                        }))
                      }
                      placeholder="Explain what needs to change."
                    />
                  </label>
                  <div className="drop-actions">
                    <button
                      className="drop-button"
                      disabled={!!busy || !reasons[drop.id]?.trim()}
                      onClick={() => void decide(drop, false)}
                    >
                      REQUEST RETAKE
                    </button>
                    <button
                      className="drop-button primary"
                      disabled={
                        !!busy ||
                        !checks[drop.id] ||
                        drop.transcription_status !== 'ready'
                      }
                      onClick={() => void decide(drop, true)}
                    >
                      APPROVE & PUBLISH
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
