import { describe, expect, it } from 'vitest';
import { customerPickerQueryOptions } from './customer-picker';

describe('customerPickerQueryOptions', () => {
  it('routes the search term into the server-side customer query', () => {
    const opts = customerPickerQueryOptions('Budi');

    expect(opts.queryKey).toEqual(['customers', 'list', { search: 'Budi', page: 1, limit: 20 }]);
  });

  it('returns the full first page for an empty search', () => {
    const opts = customerPickerQueryOptions('');

    expect(opts.queryKey).toEqual(['customers', 'list', { search: '', page: 1, limit: 20 }]);
  });
});
