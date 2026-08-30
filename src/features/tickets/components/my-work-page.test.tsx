// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { groupMyWork } from './my-work-page';
import type { Ticket } from '../api/types';

function ticket(status: Ticket['status']): Ticket {
  return {
    id: 1,
    ticketCode: null,
    title: 'T',
    description: '',
    channel: 'field',
    customer: null,
    assetName: '',
    taskType: 'installation',
    domain: 'field',
    status,
    priority: 'medium',
    location: null,
    dueAt: null,
    estimatedMinutes: null,
    requiredSkills: [],
    assignedTo: null,
    takenBy: null,
    takenByName: null,
    takenAt: null,
    completedAt: null,
    createdByName: null,
    createdAt: new Date().toISOString(),
    reviewNote: null,
    reviewedBy: null,
    rating: null
  };
}

describe('groupMyWork', () => {
  it('splits tickets into active, upcoming, and pending approval', () => {
    const grouped = groupMyWork([ticket('in_progress'), ticket('assigned'), ticket('submitted')]);
    expect(grouped.active.map((t) => t.status)).toEqual(['in_progress']);
    expect(grouped.upcoming.map((t) => t.status)).toEqual(['assigned']);
    expect(grouped.pendingApproval.map((t) => t.status)).toEqual(['submitted']);
  });

  it('keeps sections empty when there are no tickets', () => {
    const grouped = groupMyWork([]);
    expect(grouped.active).toHaveLength(0);
    expect(grouped.upcoming).toHaveLength(0);
    expect(grouped.pendingApproval).toHaveLength(0);
  });
});
