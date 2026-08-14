// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getReworkNote } from './rework-banner';

describe('getReworkNote', () => {
  it('returns the review note for a rework ticket', () => {
    expect(getReworkNote({ status: 'rework', reviewNote: 'Redo the cabling' })).toBe(
      'Redo the cabling'
    );
  });

  it('returns the review note for a rejected ticket', () => {
    expect(getReworkNote({ status: 'rejected', reviewNote: 'Photos missing' })).toBe(
      'Photos missing'
    );
  });

  it('returns null for statuses without a note', () => {
    expect(getReworkNote({ status: 'in_progress', reviewNote: null })).toBeNull();
    expect(getReworkNote({ status: 'completed', reviewNote: null })).toBeNull();
  });

  it('returns null when the note is empty', () => {
    expect(getReworkNote({ status: 'rework', reviewNote: '' })).toBeNull();
  });
});
