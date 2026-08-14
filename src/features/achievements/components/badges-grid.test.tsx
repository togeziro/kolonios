// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { BadgesGrid } from './badges-grid';
import type { AchievementBadge } from '../utils/evaluate';

const badges: AchievementBadge[] = [
  {
    key: 'olt_master',
    title: 'OLT Master',
    description: 'Complete 10 OLT checks',
    icon: 'phone',
    unlocked: true
  },
  {
    key: 'early_bird',
    title: 'Early Bird',
    description: 'Check in before 07:00',
    icon: 'sun',
    unlocked: true
  },
  {
    key: 'fast_finisher',
    title: 'Fast Finisher',
    description: 'Finish 5 tasks under 30 min',
    icon: 'clock',
    unlocked: false
  }
];

describe('BadgesGrid', () => {
  it('renders badge titles', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BadgesGrid badges={badges} recentUnlocks={[]} />
      </I18nextProvider>
    );
    expect(screen.getByText('OLT Master')).toBeTruthy();
    expect(screen.getByText('Early Bird')).toBeTruthy();
    expect(screen.getByText('Fast Finisher')).toBeTruthy();
  });

  it('marks locked badges with data-locked', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BadgesGrid badges={badges} recentUnlocks={[]} />
      </I18nextProvider>
    );
    const locked = screen.getByText('Fast Finisher').closest('[data-locked]');
    expect(locked).toBeTruthy();
    const unlocked = screen.getByText('OLT Master').closest('[data-locked]');
    expect(unlocked).toBeFalsy();
  });

  it('renders recent unlocks banner', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BadgesGrid
          badges={badges}
          recentUnlocks={[{ badgeKey: 'olt_master', unlockedAt: '2026-08-14' }]}
        />
      </I18nextProvider>
    );
    expect(screen.getAllByText(/OLT Master/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders localized badge copy from i18n keys', async () => {
    await i18n.changeLanguage('id');
    try {
      render(
        <I18nextProvider i18n={i18n}>
          <BadgesGrid badges={badges} recentUnlocks={[]} />
        </I18nextProvider>
      );
      expect(screen.getByText('Selesaikan 10 cek OLT')).toBeTruthy();
      expect(screen.getByText('Check-in sebelum 07:00')).toBeTruthy();
      expect(screen.getByText('Selesaikan 5 tugas dalam <30 menit')).toBeTruthy();
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('falls back to server title and description for unknown badge keys', () => {
    const unknownBadges: AchievementBadge[] = [
      {
        key: 'mystery_badge',
        title: 'Mystery Badge',
        description: 'Mystery description',
        icon: 'phone',
        unlocked: true
      }
    ];
    render(
      <I18nextProvider i18n={i18n}>
        <BadgesGrid badges={unknownBadges} recentUnlocks={[]} />
      </I18nextProvider>
    );
    expect(screen.getByText('Mystery Badge')).toBeTruthy();
    expect(screen.getByText('Mystery description')).toBeTruthy();
  });
});
