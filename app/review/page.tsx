'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBought } from '@/components/bought-provider';
import { DropSignIn } from '@/components/drop-sign-in';
import { DropPlayer } from '@/components/drop-player';
import { MarketTopbar } from '@/components/market-topbar';
import { money, type Drop } from '@/lib/drop-domain';

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
              <p className="drop-notice">No broadcasts are waiting for review.</p>
            )}
            <div className="review-grid">
              {drops.map((drop) => (
                <article className="drop-workspace" key={drop.id}>
                  <span className="drop-eyebrow">
                    {drop.category} · {money(drop.amount_minor)}
                  </span>
                  <h2>{drop.title}</h2>
                  <DropPlayer dropId={drop.id} />
                  <p>
                    Confirm that a face remains visible, speech is audible, and
                    the broadcast, title, and thumbnail meet BOUGHT’s content rules.
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
                      disabled={!!busy || !checks[drop.id]}
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
