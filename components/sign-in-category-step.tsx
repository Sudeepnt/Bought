'use client';

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  Lightbulb,
  MessageCircle,
  Radio,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import { CATEGORIES } from '@/lib/drop-domain';

const CATEGORY_DETAILS: Record<
  (typeof CATEGORIES)[number],
  { description: string; icon: LucideIcon }
> = {
  BEEF: { description: 'Call-outs. Responses. Receipts.', icon: MessageCircle },
  CHAOS: { description: 'Unexpected turns and wild stories.', icon: Sparkles },
  'UNPOPULAR OPINION': {
    description: "Say what others won't.",
    icon: MessageCircle,
  },
  'I WAS WRONG': { description: 'Change your mind.', icon: ArrowLeft },
  'THE RANT': { description: 'Let it out.', icon: Radio },
  CONFESSIONS: { description: 'True stories.', icon: UserRound },
  'MONEY I SET ON FIRE': {
    description: 'Expensive lessons.',
    icon: TrendingUp,
  },
  'THE PITCH THAT GOT REJECTED': {
    description: 'Still worth hearing.',
    icon: Target,
  },
  BUILDING: { description: 'Products in public.', icon: Building2 },
  'THE ASK': { description: 'Questions worth answering.', icon: Lightbulb },
  HIRING: { description: 'Roles, teams, talent.', icon: BriefcaseBusiness },
  'AGENCY ROW': { description: 'Brands, agencies, truth.', icon: UsersRound },
  'INDIAN D2C': { description: 'Operators building for India.', icon: Sprout },
};

export function SignInCategoryStep({
  busy = false,
  error = '',
  onContinue,
}: {
  busy?: boolean;
  error?: string;
  onContinue: (categories: string[]) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.length < 3 || busy) return;
    void onContinue(selected);
  }

  return (
    <form className="sign-in-category-step" onSubmit={submit}>
      <div className="sign-in-category-heading">
        <div>
          <h2 id="category-step-title">Choose your categories</h2>
          <p>Pick at least 3. This helps us personalize your feed.</p>
        </div>
        <span>{selected.length} selected (min 3)</span>
      </div>

      <div className="sign-in-category-grid">
        {CATEGORIES.map((category) => {
          const details = CATEGORY_DETAILS[category];
          const Icon = details.icon;
          const isSelected = selected.includes(category);
          return (
            <button
              className={`sign-in-category-option${isSelected ? ' is-selected' : ''}`}
              type="button"
              key={category}
              aria-pressed={isSelected}
              onClick={() =>
                setSelected((current) =>
                  isSelected
                    ? current.filter((item) => item !== category)
                    : [...current, category],
                )
              }
            >
              <span className="sign-in-category-icon">
                <Icon size={19} />
              </span>
              <span className="sign-in-category-copy">
                <strong>{category}</strong>
                <small>{details.description}</small>
              </span>
              <span className="sign-in-category-check">
                {isSelected ? <Check size={14} /> : ''}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="sign-in-category-error" role="alert">
          {error}
        </p>
      )}

      <button
        className="sign-in-category-continue"
        type="submit"
        disabled={busy || selected.length < 3}
      >
        {busy ? 'SAVING…' : 'CONTINUE TO PROFILE'} <ArrowRight size={16} />
      </button>
    </form>
  );
}
