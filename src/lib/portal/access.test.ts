import { describe, expect, it } from 'vitest';
import { classifyPortalAccess } from './access';

describe('classifyPortalAccess', () => {
  it('allows an active customer', () => {
    expect(classifyPortalAccess('customer', 'active')).toEqual({ ok: true });
  });

  it('rejects non-customer roles', () => {
    expect(classifyPortalAccess('employee', 'active')).toEqual({
      ok: false,
      reason: 'not_customer'
    });
    expect(classifyPortalAccess(undefined, 'active')).toEqual({
      ok: false,
      reason: 'not_customer'
    });
  });

  it('rejects customers without a profile row', () => {
    expect(classifyPortalAccess('customer', undefined)).toEqual({
      ok: false,
      reason: 'no_profile'
    });
  });

  it('rejects customers whose status is not active', () => {
    expect(classifyPortalAccess('customer', 'suspended')).toEqual({
      ok: false,
      reason: 'inactive'
    });
  });
});
