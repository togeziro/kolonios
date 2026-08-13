import { describe, expect, it } from 'vitest';
import { toCreateTicketInput } from './create-ticket-form';
import type { NewTicketInput } from '../api/types';

// Pure-form-to-payload mapping test — no i18n harness, raw strings (mirrors
// leg-timeline.test.tsx pattern).

describe('toCreateTicketInput', () => {
  it('maps form values to a NewTicketInput with merged legs', () => {
    const input = toCreateTicketInput(
      {
        title: 'Install OLT',
        description: '',
        taskType: 'installation',
        channel: 'walk_in',
        customerId: undefined,
        assetName: '',
        locationId: 2,
        estimatedMinutes: 90,
        dueDate: '2026-08-20'
      },
      [
        { name: 'Survey', description: '' },
        { name: 'Install', description: 'drop cable' }
      ]
    );
    expect(input).toEqual({
      title: 'Install OLT',
      description: undefined,
      taskType: 'installation',
      channel: 'walk_in',
      locationId: 2,
      estimatedMinutes: 90,
      dueAt: '2026-08-20',
      legs: [
        { name: 'Survey', description: '' },
        { name: 'Install', description: 'drop cable' }
      ]
    });
    expect(input).toSatisfy((i: NewTicketInput) => (i.legs?.length ?? 0) > 1);
  });

  it('omits empty optional fields instead of sending nulls', () => {
    const input = toCreateTicketInput(
      {
        title: 'X',
        description: '',
        taskType: undefined,
        channel: undefined,
        customerId: undefined,
        assetName: '',
        locationId: undefined,
        dueDate: undefined,
        estimatedMinutes: undefined
      },
      [{ name: 'X' }]
    );
    expect(input.customerId).toBeUndefined();
    expect(input.dueAt).toBeUndefined();
    expect(input.priority).toBeUndefined();
    expect(input.taskType).toBeUndefined();
  });
});
