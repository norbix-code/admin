// The project's communication structure, as Cloud defines it
// (Cloud → Project Settings → Communication Preferences), turned into what the
// end user switches on and off.
//
// Cloud's shape (NotificationSettingsDto, carried on the project read model):
//   channels[]  — one per CommunicationChannel (Marketing, Transactional, …)
//     groups[]  — { tag: group tag, tags: tag names in that group }
//   allGroups[] — group definitions (translations = title / description)
//   allTags[]   — tag definitions (translations + defaultDelivery per delivery
//                 channel: Email, Sms, Push, …)
// Tags that are in no group are "orphaned"; Cloud shows them to end users as
// "Other options".
//
// The user's choice is UserMarketingPreferencesDto.blockedTags: per DELIVERY
// channel (Email, Sms, …), the tags they turned off. A tag only sends on a
// delivery channel where its defaultDelivery is on (gateway Campaign.cs), so a
// switch is shown only for those channels. Marketing also has the global
// blockAllMarketingMessages switch.

import { CodeMashHub2 } from '@norbix.ai/ts/types/hub';

export type NotificationSettings = CodeMashHub2.NotificationSettingsDto;
type TagDefinitionBase = CodeMashHub2.TagDefinitionBaseDto;

/** blockedTags as the API takes it: delivery channel → blocked tag names. */
export type BlockedTags = Record<string, string[]>;

export interface TagRow {
  tag: string;
  title: string;
  description?: string;
  /** Delivery channels this tag sends on (defaultDelivery = true). */
  deliveries: string[];
}

export interface GroupView {
  tag: string;
  title: string;
  description?: string;
  tags: TagRow[];
}

export interface ChannelView {
  /** CommunicationChannel: Marketing | Transactional. */
  channel: string;
  groups: GroupView[];
}

export interface CommunicationView {
  channels: ChannelView[];
  /** Tags in no group — Cloud's "Other options". */
  otherOptions: TagRow[];
}

// End users switch Marketing and Transactional messages — the two channels
// Cloud lets the developer structure. System messages are never optional.
const USER_CHANNELS = ['Marketing', 'Transactional'];

/** Display text for a tag/group in `language` (then English, then the first). */
export function textOf(
  def: TagDefinitionBase | undefined,
  fallbackTag: string,
  language: string,
): { title: string; description?: string } {
  const list = def?.translations ?? [];
  const lang = language.toLowerCase().split('-')[0];
  const pick =
    list.find((t) => t.language?.toLowerCase().split('-')[0] === lang) ??
    list.find((t) => t.language?.toLowerCase().startsWith('en')) ??
    list[0];
  const title = pick?.content?.title?.trim() || fallbackTag;
  const description = pick?.content?.description?.trim() || undefined;
  return { title, description };
}

function tagRow(
  tag: string,
  defs: Map<string, CodeMashHub2.TagDefinitionDto>,
  language: string,
): TagRow {
  const def = defs.get(tag);
  const deliveries = Object.entries(def?.defaultDelivery ?? {})
    .filter(([, on]) => on)
    .map(([channel]) => channel);
  return { tag, ...textOf(def, tag, language), deliveries };
}

/** Build the view the page renders. Tags that send nowhere are left out. */
export function buildCommunicationView(
  settings: NotificationSettings | null | undefined,
  language: string,
): CommunicationView {
  const tagDefs = new Map((settings?.allTags ?? []).map((t) => [t.tag, t]));
  const groupDefs = new Map((settings?.allGroups ?? []).map((g) => [g.tag, g]));
  const channels: ChannelView[] = [];
  for (const name of USER_CHANNELS) {
    const ch = settings?.channels?.find((c) => c.channel === name);
    if (!ch) continue;
    const groups: GroupView[] = [];
    for (const g of ch.groups ?? []) {
      const tags = (g.tags ?? [])
        .map((t) => tagRow(t, tagDefs, language))
        .filter((r) => r.deliveries.length > 0);
      if (tags.length === 0) continue;
      groups.push({
        tag: g.tag,
        ...textOf(groupDefs.get(g.tag), g.tag, language),
        tags,
      });
    }
    if (groups.length > 0) channels.push({ channel: name, groups });
  }

  // Tags in a group of ANY channel (System included) are not "other options".
  const grouped = new Set<string>();
  for (const ch of settings?.channels ?? []) {
    for (const g of ch.groups ?? [])
      (g.tags ?? []).forEach((t) => grouped.add(t));
  }
  const otherOptions = (settings?.allTags ?? [])
    .filter((t) => !grouped.has(t.tag))
    .map((t) => tagRow(t.tag, tagDefs, language))
    .filter((r) => r.deliveries.length > 0);

  return { channels, otherOptions };
}

/** True when the user receives `tag` on `delivery` (it is not blocked). */
export function isSubscribed(
  blocked: BlockedTags | undefined,
  delivery: string,
  tag: string,
): boolean {
  return !(blocked?.[delivery] ?? []).includes(tag);
}

/**
 * The new blockedTags after switching `tag` on `delivery` (full replacement,
 * as UpdateUserPreferences expects). Empty delivery entries are dropped.
 */
export function setSubscribed(
  blocked: BlockedTags | undefined,
  delivery: string,
  tag: string,
  subscribed: boolean,
): BlockedTags {
  const next: BlockedTags = {};
  for (const [k, v] of Object.entries(blocked ?? {})) next[k] = [...v];
  const set = new Set(next[delivery] ?? []);
  if (subscribed) set.delete(tag);
  else set.add(tag);
  if (set.size > 0) next[delivery] = [...set];
  else delete next[delivery];
  return next;
}

/** Readable name for a delivery channel key. */
export const DELIVERY_LABEL: Record<string, string> = {
  Email: 'Email',
  Sms: 'SMS',
  Push: 'Push',
  WebPush: 'Browser',
  InApp: 'In-app',
  ChatBot: 'Chat bot',
  ChatPlatform: 'Chat',
};

/** Readable name for a communication channel tab. */
export const CHANNEL_LABEL: Record<string, string> = {
  Marketing: 'Marketing',
  Transactional: 'Service messages',
};
