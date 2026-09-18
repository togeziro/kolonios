// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import TicketCard from './ticket-card';
import { ticketStatusLabelKey } from './status-label';
import type { Ticket, TicketStatus } from '../api/types';

const STATUSES: TicketStatus[] = [
  'open',
  'assigned',
  'in_progress',
  'submitted',
  'approved',
  'rejected',
  'rework',
  'completed',
  'cancelled'
];

function makeTicket(status: TicketStatus): Ticket {
  return {
    id: 1,
    ticketCode: 'T-001',
    title: 'Install OLT',
    description: '',
    channel: 'field',
    customer: null,
    assetName: 'OLT-1',
    taskType: 'installation',
    domain: 'field',
    status,
    priority: 'high',
    location: { id: 1, name: 'Jakarta Office' },
    dueAt: null,
    estimatedMinutes: null,
    requiredSkills: [],
    assignedTo: null,
    takenBy: null,
    takenByName: null,
    takenAt: null,
    rating: null,
    reviewNote: null,
    reviewedBy: null,
    completedAt: null,
    createdByName: null,
    createdAt: new Date().toISOString()
  };
}

// Regression: ISSUE-003 — ticket status badges rendered the raw lowercase enum
describe('ticket status labels', () => {
  it('maps every status to an existing translated label', () => {
    for (const status of STATUSES) {
      const key = ticketStatusLabelKey[status];
      for (const lng of ['en', 'id'] as const) {
        const label = i18n.getFixedT(lng)(key);
        expect(label).not.toBe(key);
        expect(label).not.toMatch(/_/);
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it('renders a translated badge instead of the raw enum', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TicketCard task={makeTicket('in_progress')} />
      </I18nextProvider>
    );
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.queryByText('in progress')).not.toBeInTheDocument();
  });

  it('invokes the action slot via realistic user interaction', async () => {
    const user = userEvent.setup();
    const onTake = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <TicketCard
          task={makeTicket('open')}
          action={
            <button type='button' onClick={onTake}>
              Take ticket
            </button>
          }
        />
      </I18nextProvider>
    );
    await user.click(screen.getByRole('button', { name: /take ticket/i }));
    expect(onTake).toHaveBeenCalledOnce();
  });
});
