// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { progressFromLegs } from './leg-timeline';
import type { TicketLeg } from '../api/types';

// Note: no shared i18n test harness exists (src/test-utils/ has only db.ts) —
// assert raw strings; component tests here follow the pure-helper pattern
// (see attendance-check-card.test.tsx).

function leg(status: TicketLeg['status']): TicketLeg {
  return {
    id: 1,
    legNumber: 1,
    name: 'Survey',
    description: '',
    status,
    assigneeId: 'u1',
    takenAt: null,
    completedAt: null,
    notes: ''
  };
}

describe('progressFromLegs', () => {
  it('computes completed/total from terminal leg statuses', () => {
    const completed = progressFromLegs([leg('in_progress'), leg('approved')]);
    expect(completed).toBe('1/2');
  });

  it('counts a submitted leg as complete', () => {
    const completed = progressFromLegs([leg('submitted'), leg('in_progress')]);
    expect(completed).toBe('1/2');
  });

  it('returns 0/0 for an empty leg list', () => {
    expect(progressFromLegs([])).toBe('0/0');
  });
});
