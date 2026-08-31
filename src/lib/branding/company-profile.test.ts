import { afterEach, describe, expect, it } from 'vitest';
import { resolveCompanyProfile } from './company-profile';

describe('resolveCompanyProfile', () => {
  const ENV_KEYS = ['COMPANY_NAME', 'COMPANY_ADDRESS', 'COMPANY_EMAIL', 'COMPANY_PHONE'] as const;

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('returns the database values when present', () => {
    const profile = resolveCompanyProfile({
      company_name: 'PT Nusa',
      company_address: 'Jl. Mawar 1',
      company_email: 'hr@nusa.id',
      company_phone: '0812'
    });
    expect(profile).toEqual({
      name: 'PT Nusa',
      address: 'Jl. Mawar 1',
      email: 'hr@nusa.id',
      phone: '0812'
    });
  });

  it('omits empty optional fields instead of passing empty strings', () => {
    const profile = resolveCompanyProfile({
      company_name: 'PT Nusa',
      company_address: '',
      company_email: null,
      company_phone: undefined
    });
    expect(profile).toEqual({ name: 'PT Nusa' });
  });

  it('falls back to env vars when the database row has no profile', () => {
    process.env.COMPANY_NAME = 'Env Corp';
    process.env.COMPANY_ADDRESS = 'Env Street 9';
    const profile = resolveCompanyProfile(null);
    expect(profile).toEqual({ name: 'Env Corp', address: 'Env Street 9' });
  });

  it('prefers database values over env vars', () => {
    process.env.COMPANY_NAME = 'Env Corp';
    const profile = resolveCompanyProfile({ company_name: 'DB Corp' });
    expect(profile.name).toBe('DB Corp');
  });

  it('falls back to Kolonios when neither database nor env has a name', () => {
    expect(resolveCompanyProfile(null).name).toBe('Kolonios');
    expect(resolveCompanyProfile({ company_name: '' }).name).toBe('Kolonios');
  });
});
