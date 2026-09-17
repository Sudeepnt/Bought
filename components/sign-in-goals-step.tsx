'use client';

import {
  BriefcaseBusiness,
  Building2,
  Check,
  Gamepad2,
  Handshake,
  MessageCircle,
  Sprout,
  UserRoundPlus,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

const GOALS: Array<{
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    label: 'Discover interesting people',
    description: 'Follow builders, investors, creators and more.',
    icon: UsersRound,
  },
  {
    label: 'Find products and companies',
    description: 'Explore what people are building and buying.',
    icon: Building2,
  },
  {
    label: 'Find jobs and hiring opportunities',
    description: 'Discover roles and opportunities.',
    icon: BriefcaseBusiness,
  },
  {
    label: 'Find customers',
    description: 'Connect with people who need what you build.',
    icon: UserRoundPlus,
  },
  {
    label: 'Find founders, partners, or collaborators',
    description: "Meet people to build what's next.",
    icon: Handshake,
  },
  {
    label: 'Follow debates and opinions',
    description: 'See different perspectives on what matters.',
    icon: MessageCircle,
  },
  {
    label: 'Find investors or fundraising opportunities',
    description: 'Connect with capital and backers.',
    icon: Sprout,
  },
  {
    label: 'Just browse and be entertained',
    description: 'Explore, watch and enjoy the community.',
    icon: Gamepad2,
  },
];

export function SignInGoalsStep({
  busy = false,
  error = '',
  onContinue,
}: {
  busy?: boolean;
  error?: string;
  onContinue: (goals: string[]) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length || busy) return;
    void onContinue(selected);
  }

  return (
    <form className="sign-in-goals-step" onSubmit={submit}>
      <div className="sign-in-category-heading">
        <div>
          <h2>
            What brings you to <em>BOUGHT?</em>
          </h2>
        </div>
        <span>{selected.length} selected</span>
      </div>

      <div className="sign-in-goals-grid">
        {GOALS.map(({ label, description, icon: Icon }) => {
          const isSelected = selected.includes(label);
          return (
            <button
              className={`sign-in-goal-option${isSelected ? ' is-selected' : ''}`}
              type="button"
              key={label}
              aria-pressed={isSelected}
              onClick={() =>
                setSelected((current) =>
                  isSelected
                    ? current.filter((item) => item !== label)
                    : [...current, label],
                )
              }
            >
              <span className="sign-in-goal-icon">
                <Icon size={17} />
              </span>
              <span className="sign-in-goal-copy">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <span className="sign-in-goal-check">
                {isSelected ? <Check size={13} /> : ''}
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
        disabled={busy || !selected.length}
      >
        {busy ? 'SAVING…' : 'CONTINUE'}
      </button>
    </form>
  );
}
