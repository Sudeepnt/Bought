'use client';

import {
  ArrowLeft,
  MessageCircle,
  Search,
  Send,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { useBought } from '@/components/bought-provider';
import { MarketPageShell } from '@/components/market-page-shell';
import { ProfileAvatar } from '@/components/profile-avatar';
import Link from '@/components/site-link';
import {
  adoptGuestDirectMessageThreads,
  appendDirectMessage,
  DIRECT_MESSAGES_EVENT,
  MAX_DIRECT_MESSAGE_LENGTH,
  readDirectMessageThreads,
  type DirectMessageThread,
} from '@/lib/direct-messages';

function relativeTime(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days}d`
    : new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
      }).format(new Date(value));
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function ChatPage() {
  const { session } = useBought();
  const ownerId = session?.user.id ?? 'guest';
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => {
      adoptGuestDirectMessageThreads(ownerId);
      setThreads(readDirectMessageThreads(ownerId));
    };
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ ownerId?: string }>).detail;
      if (!detail?.ownerId || detail.ownerId === ownerId) refresh();
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener(DIRECT_MESSAGES_EVENT, handleChange);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(DIRECT_MESSAGES_EVENT, handleChange);
    };
  }, [ownerId]);

  useEffect(() => {
    if (!threads.length) {
      setSelectedId(null);
      return;
    }
    const requested = new URLSearchParams(window.location.search).get('thread');
    setSelectedId((current) => {
      if (threads.some((thread) => thread.id === current)) return current;
      const requestedThread = threads.find((thread) => thread.id === requested);
      if (requestedThread) return requestedThread.id;
      return window.matchMedia('(max-width: 760px)').matches
        ? null
        : threads[0].id;
    });
  }, [threads]);

  const filteredThreads = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter((thread) =>
      [
        thread.contact.name,
        thread.contact.handle,
        thread.context.categoryName,
        thread.context.broadcastTitle,
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [query, threads]);

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected?.messages.length]);

  function selectThread(threadId: string) {
    setSelectedId(threadId);
    setDraft('');
    setError('');
    const params = new URLSearchParams(window.location.search);
    params.set('thread', threadId);
    window.history.replaceState({}, '', `/chat?${params.toString()}`);
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim()) return;
    try {
      appendDirectMessage({
        ownerId,
        contact: selected.contact,
        context: selected.context,
        body: draft,
      });
      setDraft('');
      setError('');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'The message was not saved.',
      );
    }
  }

  return (
    <MarketPageShell
      active="chat"
      eyebrow="DIRECT MESSAGES"
      title="Your conversations"
      description="Continue the private conversations you started from a broadcast."
      showIntro={false}
    >
      <section className="chat-workspace route-panel" aria-label="Direct messages">
        <aside className={`chat-sidebar ${selected ? 'has-selection' : ''}`}>
          <header className="chat-sidebar-heading">
            <div>
              <span>PRIVATE CHANNEL</span>
              <h1>MESSAGES</h1>
            </div>
            <strong>{threads.length.toString().padStart(2, '0')}</strong>
          </header>

          <label className="chat-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search conversations</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search messages"
            />
          </label>

          <div className="chat-thread-list" aria-label="Conversations">
            {filteredThreads.map((thread) => {
              const lastMessage = thread.messages[thread.messages.length - 1];
              return (
                <button
                  className={`chat-thread ${thread.id === selectedId ? 'is-active' : ''}`}
                  type="button"
                  key={thread.id}
                  onClick={() => selectThread(thread.id)}
                >
                  <ProfileAvatar
                    initials={thread.contact.initials}
                    imageSrc={thread.contact.imageSrc}
                    imagePosition={thread.contact.imagePosition}
                    className="chat-thread-avatar"
                    alt={thread.contact.name}
                  />
                  <span className="chat-thread-copy">
                    <span className="chat-thread-name">
                      <strong>{thread.contact.name}</strong>
                      <time dateTime={thread.updatedAt}>
                        {relativeTime(thread.updatedAt)}
                      </time>
                    </span>
                    <small>{thread.contact.handle}</small>
                    <p>{lastMessage.body}</p>
                  </span>
                </button>
              );
            })}
            {threads.length > 0 && filteredThreads.length === 0 && (
              <p className="chat-no-results">No conversations match that search.</p>
            )}
          </div>
        </aside>

        <div className={`chat-conversation ${selected ? 'is-open' : ''}`}>
          {selected ? (
            <>
              <header className="chat-conversation-heading">
                <button
                  className="chat-mobile-back"
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                <ProfileAvatar
                  initials={selected.contact.initials}
                  imageSrc={selected.contact.imageSrc}
                  imagePosition={selected.contact.imagePosition}
                  className="chat-heading-avatar"
                  alt={selected.contact.name}
                />
                <div>
                  <strong>{selected.contact.name}</strong>
                  <span>{selected.contact.handle}</span>
                </div>
                <span className="chat-private-badge">PRIVATE</span>
              </header>

              <div className="chat-context">
                <span>{selected.context.categoryName}</span>
                <p>&ldquo;{selected.context.broadcastTitle}&rdquo;</p>
              </div>

              <div className="chat-message-stream" aria-live="polite">
                <div className="chat-date-divider">
                  <span>CONVERSATION STARTED</span>
                </div>
                {selected.messages.map((message) => (
                  <article
                    className={`chat-bubble is-${message.direction}`}
                    key={message.id}
                  >
                    <p>{message.body}</p>
                    <time dateTime={message.sentAt}>
                      {messageTime(message.sentAt)}
                    </time>
                  </article>
                ))}
                <div ref={messageEndRef} />
              </div>

              <form className="chat-composer" onSubmit={submitMessage}>
                <label className="sr-only" htmlFor="chat-message">
                  Message {selected.contact.name}
                </label>
                <textarea
                  id="chat-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Message ${selected.contact.name} directly...`}
                  maxLength={MAX_DIRECT_MESSAGE_LENGTH}
                  rows={1}
                />
                <span className="chat-character-count">
                  {draft.length}/{MAX_DIRECT_MESSAGE_LENGTH}
                </span>
                <button type="submit" disabled={!draft.trim()}>
                  <Send size={15} aria-hidden="true" />
                  SEND
                </button>
                {error && <small role="alert">{error}</small>}
              </form>
            </>
          ) : (
            <div className="chat-empty">
              <span className="chat-empty-icon">
                <MessageCircle size={28} aria-hidden="true" />
              </span>
              <span>YOUR PRIVATE CHANNEL</span>
              <h2>{threads.length ? 'Choose a conversation' : 'No messages yet'}</h2>
              <p>
                {threads.length
                  ? 'Select a person to reopen your direct messages.'
                  : 'Start a private conversation from any category broadcast.'}
              </p>
              {!threads.length && <Link href="/categories">EXPLORE BROADCASTS</Link>}
            </div>
          )}
        </div>
      </section>
    </MarketPageShell>
  );
}
