export const DIRECT_MESSAGES_EVENT = 'bought-direct-messages-change';
export const MAX_DIRECT_MESSAGE_LENGTH = 240;

export type DirectMessageContact = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  imageSrc?: string;
  imagePosition?: string;
};

export type DirectMessageContext = {
  broadcastId: string;
  broadcastTitle: string;
  categoryName: string;
};

export type DirectMessage = {
  id: string;
  body: string;
  sentAt: string;
  direction: 'outgoing' | 'incoming';
};

export type DirectMessageThread = {
  id: string;
  contact: DirectMessageContact;
  context: DirectMessageContext;
  messages: DirectMessage[];
  updatedAt: string;
};

function storageKey(ownerId: string) {
  return `bought-direct-messages:v1:${encodeURIComponent(ownerId || 'guest')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validDate(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function normalizeThread(value: unknown): DirectMessageThread | null {
  if (!isRecord(value) || !isRecord(value.contact) || !isRecord(value.context))
    return null;

  const id = cleanText(value.id, 180);
  const name = cleanText(value.contact.name, 80);
  const handle = cleanText(value.contact.handle, 80);
  const initials = cleanText(value.contact.initials, 4);
  const contactId = cleanText(value.contact.id, 120);
  const broadcastId = cleanText(value.context.broadcastId, 180);
  const broadcastTitle = cleanText(value.context.broadcastTitle, 160);
  const categoryName = cleanText(value.context.categoryName, 80);
  if (!id || !name || !handle || !initials || !contactId || !broadcastId)
    return null;

  const messages = Array.isArray(value.messages)
    ? value.messages
        .map((message): DirectMessage | null => {
          if (!isRecord(message)) return null;
          const messageId = cleanText(message.id, 180);
          const body = cleanText(message.body, MAX_DIRECT_MESSAGE_LENGTH);
          const sentAt = validDate(message.sentAt)
            ? String(message.sentAt)
            : '';
          const direction =
            message.direction === 'incoming' ? 'incoming' : 'outgoing';
          return messageId && body && sentAt
            ? { id: messageId, body, sentAt, direction }
            : null;
        })
        .filter((message): message is DirectMessage => Boolean(message))
        .slice(-200)
    : [];

  if (!messages.length) return null;
  const fallbackUpdatedAt = messages[messages.length - 1].sentAt;

  return {
    id,
    contact: {
      id: contactId,
      name,
      handle,
      initials,
      imageSrc: cleanText(value.contact.imageSrc, 240) || undefined,
      imagePosition: cleanText(value.contact.imagePosition, 40) || undefined,
    },
    context: {
      broadcastId,
      broadcastTitle,
      categoryName,
    },
    messages,
    updatedAt: validDate(value.updatedAt)
      ? String(value.updatedAt)
      : fallbackUpdatedAt,
  };
}

export function directMessageThreadId(handle: string) {
  const normalized = handle.trim().toLowerCase().replace(/^@/, '');
  return `contact:${normalized || 'unknown'}`;
}

export function parseDirectMessageThreads(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeThread)
      .filter((thread): thread is DirectMessageThread => Boolean(thread))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  } catch {
    return [];
  }
}

export function readDirectMessageThreads(ownerId: string) {
  if (typeof window === 'undefined') return [];
  return parseDirectMessageThreads(
    window.localStorage.getItem(storageKey(ownerId)),
  );
}

function mergeThreads(
  primary: DirectMessageThread[],
  secondary: DirectMessageThread[],
) {
  const merged = new Map<string, DirectMessageThread>();
  for (const thread of [...secondary, ...primary]) {
    const current = merged.get(thread.id);
    if (!current) {
      merged.set(thread.id, thread);
      continue;
    }
    const messages = new Map(
      [...current.messages, ...thread.messages].map((message) => [
        message.id,
        message,
      ]),
    );
    const newest =
      Date.parse(thread.updatedAt) >= Date.parse(current.updatedAt)
        ? thread
        : current;
    merged.set(thread.id, {
      ...newest,
      messages: [...messages.values()]
        .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt))
        .slice(-200),
    });
  }
  return [...merged.values()]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 100);
}

export function adoptGuestDirectMessageThreads(ownerId: string) {
  if (typeof window === 'undefined' || !ownerId || ownerId === 'guest') return;
  const guestKey = storageKey('guest');
  const guestThreads = parseDirectMessageThreads(
    window.localStorage.getItem(guestKey),
  );
  if (!guestThreads.length) return;
  const nextThreads = mergeThreads(
    readDirectMessageThreads(ownerId),
    guestThreads,
  );
  window.localStorage.setItem(storageKey(ownerId), JSON.stringify(nextThreads));
  window.localStorage.removeItem(guestKey);
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function appendDirectMessage({
  ownerId,
  contact,
  context,
  body,
}: {
  ownerId: string;
  contact: DirectMessageContact;
  context: DirectMessageContext;
  body: string;
}) {
  if (typeof window === 'undefined')
    throw new Error('Messages are available in the browser.');
  const nextBody = body.trim().slice(0, MAX_DIRECT_MESSAGE_LENGTH);
  if (!nextBody) throw new Error('Write a message first.');

  const now = new Date().toISOString();
  const threadId = directMessageThreadId(contact.handle);
  const threads = readDirectMessageThreads(ownerId);
  const current = threads.find((thread) => thread.id === threadId);
  const nextMessage: DirectMessage = {
    id: makeId(),
    body: nextBody,
    sentAt: now,
    direction: 'outgoing',
  };
  const nextThread: DirectMessageThread = {
    id: threadId,
    contact,
    context,
    messages: [...(current?.messages ?? []), nextMessage].slice(-200),
    updatedAt: now,
  };
  const nextThreads = mergeThreads(
    [nextThread],
    threads.filter((thread) => thread.id !== threadId),
  );

  window.localStorage.setItem(storageKey(ownerId), JSON.stringify(nextThreads));
  window.dispatchEvent(
    new CustomEvent(DIRECT_MESSAGES_EVENT, { detail: { ownerId } }),
  );
  return nextThread;
}
