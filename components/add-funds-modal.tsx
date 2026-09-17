'use client';

import { ArrowRight, Building2, CreditCard, LockKeyhole, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const presetAmounts = [5, 10, 20, 50] as const;

type PaymentMethod = 'card' | 'bank';

export function AddFundsModal({ onClose }: { onClose: () => void }) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(10);
  const [customAmount, setCustomAmount] = useState('');

  const amount = customAmount
    ? Number.parseFloat(customAmount)
    : selectedAmount ?? 0;
  const amountLabel = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const formattedAmount = `$${amountLabel.toFixed(2).replace(/\.00$/, '')}`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  function selectAmount(amountValue: number) {
    setSelectedAmount(amountValue);
    setCustomAmount('');
  }

  return (
    <div
      className="add-funds-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        open
        className="add-funds-dialog"
        aria-modal="true"
        aria-labelledby="add-funds-title"
      >
        <div className="add-funds-heading">
          <div>
            <h2 id="add-funds-title">Put your signal on the board</h2>
            <p>Back the ideas worth hearing.</p>
          </div>
          <div className="add-funds-balance">
            <span>BOUGHT balance</span>
            <strong>$0.00</strong>
          </div>
          <button
            className="add-funds-close"
            type="button"
            onClick={onClose}
            aria-label="Close add funds dialog"
          >
            <X size={25} strokeWidth={1.8} />
          </button>
        </div>

        <div className="add-funds-methods" role="tablist" aria-label="Payment method">
          <button
            className={`add-funds-method${paymentMethod === 'card' ? ' is-selected' : ''}`}
            type="button"
            role="tab"
            aria-selected={paymentMethod === 'card'}
            onClick={() => setPaymentMethod('card')}
          >
            <CreditCard size={23} strokeWidth={1.9} />
            <span>Card</span>
          </button>
          <button
            className={`add-funds-method${paymentMethod === 'bank' ? ' is-selected' : ''}`}
            type="button"
            role="tab"
            aria-selected={paymentMethod === 'bank'}
            onClick={() => setPaymentMethod('bank')}
          >
            <Building2 size={24} strokeWidth={1.9} />
            <span>Bank Transfer</span>
          </button>
        </div>

        <div className="add-funds-amount-section">
          <h3>Choose your position</h3>
          <div className="add-funds-presets">
            {presetAmounts.map((preset) => (
              <button
                className={`add-funds-preset${selectedAmount === preset && !customAmount ? ' is-selected' : ''}`}
                type="button"
                key={preset}
                onClick={() => selectAmount(preset)}
              >
                ${preset}
              </button>
            ))}
          </div>
          <label className={`add-funds-custom${customAmount ? ' is-filled' : ''}`}>
            <span>$</span>
            <input
              type="number"
              min="1"
              inputMode="decimal"
              placeholder="Custom amount"
              value={customAmount}
              aria-label="Custom amount"
              onChange={(event) => {
                setCustomAmount(event.target.value);
                setSelectedAmount(null);
              }}
            />
          </label>
        </div>

        <div className="add-funds-explainer">
          <div className="add-funds-steps">
            <div className="add-funds-step is-current">
              <span className="add-funds-step-number">1</span>
              <div>
                <strong>Choose a position</strong>
                <small>Start with what matters.</small>
              </div>
            </div>
            <div className="add-funds-step">
              <span className="add-funds-step-number">2</span>
              <div>
                <strong>Back a signal</strong>
                <small>Put weight behind your view.</small>
              </div>
            </div>
            <div className="add-funds-step">
              <span className="add-funds-step-number">3</span>
              <div>
                <strong>Get seen</strong>
                <small>Top positions rise on BOUGHT.</small>
              </div>
            </div>
          </div>
          <div className="add-funds-chart-copy">
            <div className="add-funds-chart" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <ArrowRight size={16} />
            </div>
            <strong>Your point of view<br />belongs on the board.</strong>
            <p>Back what matters<br />to you.</p>
          </div>
        </div>

        <button className="add-funds-submit" type="button" disabled={amountLabel < 1}>
          <span>Continue with {formattedAmount}</span>
          <ArrowRight size={24} strokeWidth={1.7} />
        </button>

        <div className="add-funds-payment-brands" aria-label="Accepted payment methods">
          <span className="add-funds-visa">VISA</span>
          <span className="add-funds-mastercard"><i /><i /></span>
          <span className="add-funds-apple">Pay</span>
          <span className="add-funds-google"><b>G</b> Pay</span>
        </div>

        <div className="add-funds-footer-note">
          <span><LockKeyhole size={18} strokeWidth={2} /> Secure checkout by Stripe.</span>
          <i />
          <span>Your balance powers your positions.</span>
        </div>
      </dialog>
    </div>
  );
}
