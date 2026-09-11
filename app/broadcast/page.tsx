'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { MarketTopbar } from '@/components/market-topbar';
import { useBought } from '@/components/bought-provider';
import { DropSignIn } from '@/components/drop-sign-in';
import { DropRecorder } from '@/components/drop-recorder';
import { CapturePreflight } from '@/components/capture-preflight';
import {
  CATEGORIES,
  captureModeForCategory,
  money,
  parseBid,
  validUuid,
  type Drop,
  type PaymentProvider,
} from '@/lib/drop-domain';
import { deleteTake } from '@/lib/local-recording';

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: () => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: string, callback: () => void) => void;
    };
  }
}

async function razorpayScript() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('Payment checkout could not load. Try again.'));
    };
    document.head.appendChild(script);
  });
}

export default function BroadcastPage() {
  const { config, client, session, authReady, api, market, marketFresh } =
    useBought();
  const [dropId, setDropId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [saved, setSaved] = useState<Drop[]>([]);
  const [category, setCategory] = useState<string>('UNPOPULAR OPINION');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('500');
  const [provider, setProvider] = useState<PaymentProvider>('razorpay');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [captureReady, setCaptureReady] = useState(false);
  const draftId = useRef<string | null>(null);
  const [queryReady, setQueryReady] = useState(false);

  useEffect(() => {
    let frame: number;
    const syncQuery = () => {
      frame = requestAnimationFrame(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('dropId');
        setDrop(null);
        if (id && validUuid(id)) {
          setDropId(id);
          setLoading(true);
        } else {
          setDropId(null);
          setLoading(false);
          draftId.current = null;
        }
        if (id && !validUuid(id)) setError('This broadcast link is not valid.');
        const selected = params.get('category');
        if (selected && (CATEGORIES as readonly string[]).includes(selected))
          setCategory(selected);
        setQueryReady(true);
      });
    };
    syncQuery();
    window.addEventListener('popstate', syncQuery);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('popstate', syncQuery);
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (config && !config.providers.razorpay && config.providers.stripe)
        setProvider('stripe');
    });
    return () => cancelAnimationFrame(frame);
  }, [config]);

  const refresh = useCallback(async () => {
    if (!dropId || !session) return;
    const result = await api<{ drop: Drop }>(`drops/${dropId}`);
    setDrop(result.drop);
    setLoading(false);
    if (result.drop.state === 'published')
      void deleteTake(result.drop.id).catch(() => {});
  }, [api, dropId, session]);

  useEffect(() => {
    if (!session) {
      const frame = requestAnimationFrame(() => {
        setDrop(null);
        setSaved([]);
      });
      return () => cancelAnimationFrame(frame);
    }
    let active = true;
    void api<{ drops: Drop[] }>('drops')
      .then((result) => {
        if (active) setSaved(result.drops);
      })
      .catch(() => {});
    if (dropId)
      void api<{ drop: Drop }>(`drops/${dropId}`)
        .then((result) => {
          if (active) {
            setDrop(result.drop);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            setError(err.message);
            setLoading(false);
          }
        });
    return () => {
      active = false;
    };
  }, [api, dropId, session, refresh]);

  useEffect(() => {
    if (!dropId || !session || !client) return;
    const update = () => void refresh().catch(() => {});
    const poll = window.setInterval(update, 5000);
    const channel = client
      .channel(`drop:${dropId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bought_drops',
          filter: `id=eq.${dropId}`,
        },
        update,
      )
      .subscribe();
    window.addEventListener('focus', update);
    return () => {
      clearInterval(poll);
      void client.removeChannel(channel);
      window.removeEventListener('focus', update);
    };
  }, [client, dropId, refresh, session]);

  function openSaved(id: string) {
    setDrop(null);
    setDropId(id);
    setLoading(true);
    setError('');
    setNotice('');
    window.history.replaceState(null, '', `/broadcast?dropId=${id}`);
  }

  async function checkout() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!captureReady && !dropId)
        throw new Error('Complete the recording check before opening checkout.');
      let id = dropId;
      if (!id) {
        const amountMinor = parseBid(amount);
        if (title.trim().length < 3 || title.trim().length > 120)
          throw new Error('Add a title between 3 and 120 characters.');
        draftId.current ??= crypto.randomUUID();
        const result = await api<{ dropId: string }>('drops', {
          id: draftId.current,
          category,
          amountMinor,
          title: title.trim(),
          provider,
        });
        id = result.dropId;
        setDropId(id);
        window.history.replaceState(null, '', `/broadcast?dropId=${id}`);
      }
      const payment = await api<{
        provider: PaymentProvider;
        url: string | null;
        orderId: string;
        key: string;
        amount: number;
        currency: string;
      }>(`drops/${id}/checkout`, {});
      if (payment.provider === 'stripe' && payment.url) {
        window.location.assign(payment.url);
        return;
      }
      await razorpayScript();
      if (!window.Razorpay)
        throw new Error('Payment checkout is unavailable. Try again.');
      const modal = new window.Razorpay({
        key: payment.key,
        order_id: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        name: 'BOUGHT',
        description: 'Your position in today’s market',
        theme: { color: '#ef2b32' },
        // Browser callbacks only show waiting copy. Only the signed webhook can mark paid.
        handler: () => {
          setNotice(
            'Payment received by checkout. Waiting for server confirmation…',
          );
          setBusy(false);
        },
        modal: {
          ondismiss: () => {
            setNotice(
              'Checkout closed. You can continue this saved broadcast when you’re ready.',
            );
            setBusy(false);
          },
        },
      });
      modal.on('payment.failed', () => {
        setError('Payment did not complete. Resume checkout to try again.');
        setBusy(false);
      });
      modal.open();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Checkout failed. Your broadcast is saved.',
      );
    } finally {
      setBusy(false);
    }
  }

  const paid = !!session && drop?.payment_state === 'paid';
  const submitted =
    drop && ['processing', 'review', 'published'].includes(drop.state);
  const paymentsAvailable =
    !!config && Object.values(config.providers).some(Boolean);
  const shownAmount =
    drop?.amount_minor ?? (/^\d+$/.test(amount) ? Number(amount) * 100 : 0);
  const selectedCategory = drop?.category ?? category;
  const captureMode =
    drop?.capture_mode ?? captureModeForCategory(selectedCategory);
  const steps = ['RESERVE', 'RECORD', 'THUMBNAIL', 'PUBLISH'];
  const currentStep = submitted ? 3 : paid ? 1 : 0;

  return (
    <main className="market-shell dashboard-shell">
      <MarketTopbar active="broadcast" />
      <div className="drop-page">
        <Link href="/" className="drop-back">
          <ArrowLeft size={15} /> BACK TO THE FLOOR
        </Link>
        <header className="drop-page-heading">
          <div>
            <span className="drop-eyebrow">
              <i /> YOUR NEXT MOVE
            </span>
            <h1>
              MAKE YOUR BROADCAST<span>.</span>
            </h1>
            <p>Choose your category. Back your voice. Take the floor.</p>
          </div>
          <span className="drop-market-badge">
            <Clock3 size={16} />
            {marketFresh && market
              ? market.phase === 'bidding'
                ? 'BIDDING OPEN · UNTIL 12:00 UTC'
                : 'NEXT AUCTION · 00:00 UTC'
              : 'SYNCING MARKET…'}
          </span>
        </header>
        <ol className="drop-steps" aria-label="Broadcast progress">
          {steps.map((step, index) => (
            <li
              key={step}
              className={
                index === currentStep
                  ? 'current'
                  : index < currentStep
                    ? 'complete'
                    : ''
              }
              aria-current={index === currentStep ? 'step' : undefined}
            >
              <span>
                {index < currentStep ? <Check size={15} /> : `0${index + 1}`}
              </span>
              {step}
            </li>
          ))}
        </ol>
        {!paymentsAvailable && config && (
          <output className="drop-service-notice">
            <LockKeyhole size={20} />
            <div>
              <strong>CHECKOUT IS COMING SOON</strong>
              <p>
                Explore the broadcast flow below. Payments and recording will
                open when BOUGHT is ready to accept broadcasts.
              </p>
            </div>
          </output>
        )}
        <div className="drop-layout">
          <section className="drop-workspace">
            {error && (
              <p className="drop-error" role="alert">
                {error}
              </p>
            )}
            {notice && <output className="drop-notice">{notice}</output>}
            {!queryReady || (loading && session) ? (
              <div className="drop-loading">Loading your saved broadcast…</div>
            ) : paid && drop && !submitted ? (
              <DropRecorder key={drop.id} drop={drop} refresh={refresh} />
            ) : submitted && drop ? (
              <div className="drop-submitted">
                <div className="drop-success-icon">
                  {drop.state === 'published' ? (
                    <Check size={42} />
                  ) : (
                    <Clock3 size={42} />
                  )}
                </div>
                <span className="drop-eyebrow">
                  {drop.state === 'published'
                    ? 'BROADCAST ACCEPTED'
                    : 'PAYMENT CONFIRMED'}
                </span>
                <h2>
                  {drop.state === 'published'
                    ? 'YOU’RE LIVE ON THE FLOOR.'
                    : drop.state === 'review'
                      ? 'YOUR BROADCAST IS IN REVIEW.'
                      : 'YOUR BROADCAST IS PROCESSING.'}
                </h2>
                <p>
                  {drop.state === 'published'
                    ? 'Your paid bid, broadcast, and thumbnail are linked to your position. Final ranking locks at 12:00 UTC.'
                    : drop.state === 'review'
                      ? 'We’re checking your face, audio, broadcast, and thumbnail before publishing. You can close this page; your broadcast is saved.'
                      : 'Your broadcast is being prepared for playback. It moves to review as soon as processing finishes.'}
                </p>
                <div className="drop-progress-list">
                  <span>
                    <Check size={17} />
                    Payment verified
                  </span>
                  <span>
                    <Check size={17} />
                    Broadcast and thumbnail received
                  </span>
                  <span>
                    {drop.media_state === 'ready' ? (
                      <Check size={17} />
                    ) : (
                      <Clock3 size={17} />
                    )}
                    Broadcast processed
                  </span>
                  <span>
                    {drop.state === 'published' ? (
                      <Check size={17} />
                    ) : (
                      <Clock3 size={17} />
                    )}
                    Review and publication
                  </span>
                </div>
                {drop.exposure_starts_at && (
                  <p className="drop-notice">
                    Reserved exposure:{' '}
                    {new Date(drop.exposure_starts_at).toLocaleString('en-GB', {
                      timeZone: 'UTC',
                    })}{' '}
                    –{' '}
                    {new Date(drop.exposure_ends_at!).toLocaleString('en-GB', {
                      timeZone: 'UTC',
                    })}{' '}
                    UTC.
                  </p>
                )}
                <Link className="drop-button primary" href="/">
                  RETURN TO TODAY
                  <ArrowUpRight size={17} />
                </Link>
              </div>
            ) : drop &&
              ['refunded', 'disputed'].includes(drop.payment_state) ? (
              <div className="drop-error">
                This payment was reversed. Your broadcast cannot be published.
                Contact support with broadcast ID {drop.id}.
              </div>
            ) : (
              <>
                <div className="drop-section-label">
                  <span>01 /</span> RESERVE YOUR POSITION
                </div>
                <fieldset className="drop-category-grid">
                  <legend>Your category</legend>
                  {CATEGORIES.map((item) => (
                    <button
                      key={item}
                      disabled={!!dropId}
                      onClick={() => {
                        setCategory(item);
                        setCaptureReady(false);
                      }}
                      aria-pressed={(drop?.category ?? category) === item}
                      className={
                        (drop?.category ?? category) === item ? 'selected' : ''
                      }
                    >
                      {item}
                      {(drop?.category ?? category) === item && (
                        <Check size={14} />
                      )}
                    </button>
                  ))}
                </fieldset>
                {!dropId && (
                  <CapturePreflight
                    mode={captureMode}
                    passed={captureReady}
                    onPassed={() => setCaptureReady(true)}
                  />
                )}
                <label className="drop-field">
                  Give your broadcast a title
                  <input
                    maxLength={120}
                    minLength={3}
                    placeholder="What do you have to say?"
                    value={drop?.title ?? title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!!dropId}
                  />
                  <small>{(drop?.title ?? title).length} / 120</small>
                </label>
                <label className="drop-field">
                  Your bid{' '}
                  <div className="drop-bid-input">
                    <span>$</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Bid amount in dollars"
                      value={drop ? String(drop.amount_minor / 100) : amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={!!dropId}
                    />
                    <span>USD</span>
                  </div>
                </label>
                {!dropId && (
                  <div className="drop-bid-presets">
                    {[100, 500, 1000, 5000].map((value) => (
                      <button
                        key={value}
                        onClick={() => setAmount(String(value))}
                        className={amount === String(value) ? 'selected' : ''}
                      >
                        {money(value * 100)}
                      </button>
                    ))}
                  </div>
                )}
                <p className="drop-fineprint">
                  Minimum $100. Higher paid bids rank above lower bids. Equal
                  bids are ordered by payment confirmation time.
                </p>
                <div className="drop-section-label">
                  <CreditCard size={17} /> PAYMENT METHOD
                </div>
                <div className="drop-payment-methods">
                  <button
                    disabled={!!dropId || !config?.providers.razorpay}
                    aria-pressed={(drop?.provider ?? provider) === 'razorpay'}
                    className={
                      (drop?.provider ?? provider) === 'razorpay'
                        ? 'selected'
                        : ''
                    }
                    onClick={() => setProvider('razorpay')}
                  >
                    <strong>Razorpay</strong>
                    <span>India · UPI, cards & netbanking</span>
                  </button>
                  <button
                    disabled={!!dropId || !config?.providers.stripe}
                    aria-pressed={(drop?.provider ?? provider) === 'stripe'}
                    className={
                      (drop?.provider ?? provider) === 'stripe'
                        ? 'selected'
                        : ''
                    }
                    onClick={() => setProvider('stripe')}
                  >
                    <strong>Stripe</strong>
                    <span>International · cards</span>
                  </button>
                </div>
                {!session ? (
                  <DropSignIn />
                ) : (
                  <div className="drop-signed-in">
                    <ShieldCheck size={16} /> Signed in as {session.user.email}
                    <button onClick={() => void client?.auth.signOut()}>
                      Sign out
                    </button>
                  </div>
                )}
                {drop?.checkout_state === 'ready' && (
                  <p className="drop-notice">
                    Waiting for payment confirmation. Already paid? Stay on this
                    page or come back to this broadcast later.
                  </p>
                )}
                <button
                  className="drop-button primary drop-pay"
                  disabled={
                    busy ||
                    !session ||
                    (!dropId && !captureReady) ||
                    !paymentsAvailable ||
                    !config?.providers[drop?.provider ?? provider] ||
                    !marketFresh ||
                    market?.phase !== 'bidding'
                  }
                  onClick={checkout}
                >
                  {busy
                    ? 'OPENING CHECKOUT…'
                    : `PAY ${money(shownAmount)} & RESERVE`}
                  <ArrowUpRight size={20} />
                </button>
                <p className="drop-fineprint">
                  <LockKeyhole size={13} />
                  Recording access unlocks only after payment is confirmed.
                </p>
              </>
            )}
          </section>
          <aside className="drop-sidebar">
            <section className="drop-receipt">
              <div className="drop-section-label">YOUR POSITION</div>
              <span className="drop-receipt-category">
                {drop?.category ?? category}
              </span>
              <strong className="drop-receipt-amount">
                {money(shownAmount)}
              </strong>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{paid ? 'PAID & RESERVED' : 'AWAITING PAYMENT'}</dd>
                </div>
                <div>
                  <dt>Broadcast</dt>
                  <dd>UP TO 2 MINUTES</dd>
                </div>
                <div>
                  <dt>Capture</dt>
                  <dd>
                    {captureMode === 'screen'
                      ? 'SCREEN + MICROPHONE'
                      : 'CAMERA + MICROPHONE'}
                  </dd>
                </div>
                <div>
                  <dt>Exposure</dt>
                  <dd>12 HOURS</dd>
                </div>
                <div>
                  <dt>Ranking</dt>
                  <dd>GLOBAL · BY PAID BID</dd>
                </div>
              </dl>
              <div className="drop-receipt-note">
                <ShieldCheck size={20} />
                <p>
                  Your payment stays with your broadcast. If an upload fails, return
                  here and pick up where you left off.
                </p>
              </div>
              {dropId && (
                <small className="drop-id">
                  BROADCAST ID
                  <br />
                  {dropId}
                </small>
              )}
            </section>
            <section className="drop-next-card">
              <Video size={23} />
              <h3>THEN, THE FLOOR IS YOURS.</h3>
              <p>
                Record inside BOUGHT, preview your take, and choose a thumbnail.
                Your broadcast and image are checked before publication.
              </p>
              <p>
                If processing or review passes the cutoff, your paid entry
                carries into the next auction.
              </p>
            </section>
            {authReady && saved.length > 0 && (
              <section className="drop-saved">
                <div className="drop-section-label">YOUR SAVED BROADCASTS</div>
                {saved.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openSaved(item.id)}
                    className={dropId === item.id ? 'selected' : ''}
                  >
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {item.payment_state === 'paid'
                          ? item.state === 'draft'
                            ? 'PAID · READY TO RECORD'
                            : item.state.toUpperCase()
                          : item.payment_state.toUpperCase()}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
