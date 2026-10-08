import { describe, it, expect } from 'vitest';
import {
  buildCommunicationView,
  isSubscribed,
  setSubscribed,
  textOf,
  type NotificationSettings,
} from './communication';

const tr = (language: string, title: string, description?: string) => ({
  language,
  content: { title, description },
});

// What Cloud saves for a project: Marketing has a "News" group with two tags,
// Transactional an "Orders" group; "surveys" is in no group (orphaned) and
// "internal" sends nowhere.
const settings = {
  channels: [
    {
      channel: 'Marketing',
      groups: [{ tag: 'news', tags: ['weekly', 'offers', 'internal'] }],
    },
    {
      channel: 'Transactional',
      groups: [{ tag: 'orders', tags: ['shipping'] }],
    },
    { channel: 'System', groups: [{ tag: 'sys', tags: ['security'] }] },
  ],
  allGroups: [
    {
      tag: 'news',
      translations: [tr('en', 'News', 'What is new'), tr('lt', 'Naujienos')],
    },
    { tag: 'orders', translations: [tr('en', 'Orders')] },
  ],
  allTags: [
    {
      tag: 'weekly',
      translations: [tr('en', 'Weekly digest')],
      defaultDelivery: { Email: true, Sms: false },
    },
    {
      tag: 'offers',
      translations: [],
      defaultDelivery: { Email: true, Push: true },
    },
    { tag: 'internal', translations: [], defaultDelivery: { Email: false } },
    {
      tag: 'shipping',
      translations: [tr('en', 'Shipping updates')],
      defaultDelivery: { Sms: true },
    },
    { tag: 'security', translations: [], defaultDelivery: { Email: true } },
    {
      tag: 'surveys',
      translations: [tr('en', 'Surveys')],
      defaultDelivery: { Email: true },
    },
  ],
} as unknown as NotificationSettings;

describe('buildCommunicationView', () => {
  const view = buildCommunicationView(settings, 'en');

  it('renders Marketing and Transactional, never System', () => {
    expect(view.channels.map((c) => c.channel)).toEqual([
      'Marketing',
      'Transactional',
    ]);
  });

  it('keeps Cloud group order and titles, drops tags that send nowhere', () => {
    const news = view.channels[0].groups[0];
    expect(news).toMatchObject({
      tag: 'news',
      title: 'News',
      description: 'What is new',
    });
    expect(news.tags.map((t) => [t.tag, t.title, t.deliveries])).toEqual([
      ['weekly', 'Weekly digest', ['Email']],
      ['offers', 'offers', ['Email', 'Push']],
    ]);
  });

  it('lists tags in no group as "Other options" (Cloud\'s orphaned tags)', () => {
    expect(view.otherOptions.map((t) => t.tag)).toEqual(['surveys']);
  });

  it('is empty when Cloud defined no structure', () => {
    expect(buildCommunicationView(null, 'en')).toEqual({
      channels: [],
      otherOptions: [],
    });
  });
});

describe('textOf', () => {
  it('uses the user language, then English, then the tag', () => {
    const def = settings.allGroups[0];
    expect(textOf(def, 'news', 'lt-LT').title).toBe('Naujienos');
    expect(textOf(def, 'news', 'de').title).toBe('News');
    expect(textOf(undefined, 'news', 'en').title).toBe('news');
  });
});

describe('blockedTags', () => {
  it('turning a tag off adds it under that delivery channel only', () => {
    const next = setSubscribed({}, 'Email', 'offers', false);
    expect(next).toEqual({ Email: ['offers'] });
    expect(isSubscribed(next, 'Email', 'offers')).toBe(false);
    expect(isSubscribed(next, 'Push', 'offers')).toBe(true);
  });

  it('turning it back on removes it and drops the empty entry', () => {
    const before = { Email: ['offers'], Sms: ['shipping'] };
    expect(setSubscribed(before, 'Email', 'offers', true)).toEqual({
      Sms: ['shipping'],
    });
    expect(before.Email).toEqual(['offers']); // input not mutated
  });
});
