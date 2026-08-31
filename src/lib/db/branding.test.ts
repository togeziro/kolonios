import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { companySettings } from '@/lib/db/schema/masterdata';
import { auditLog } from '@/lib/db/schema/audit-log';
import { getCompanyBranding, updateCompanyBranding } from './branding';
import { resetAllTables, seedUser } from '@/test-utils/db';

const ACTOR = 'branding-admin-user';

describe('company branding data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('getCompanyBranding', () => {
    it('returns nulls for every slot when nothing was configured yet', async () => {
      const branding = await getCompanyBranding();
      expect(branding).toEqual({
        logoLight: null,
        logoDark: null,
        favicon: null,
        profile: {
          company_name: null,
          company_address: null,
          company_email: null,
          company_phone: null
        }
      });
    });

    it('returns stored branding values', async () => {
      await updateCompanyBranding(ACTOR, {
        logoLight: 'data:image/png;base64,AAA',
        profile: { name: 'PT Nusa' }
      });
      const branding = await getCompanyBranding();
      expect(branding.logoLight).toBe('data:image/png;base64,AAA');
      expect(branding.profile.company_name).toBe('PT Nusa');
      expect(branding.favicon).toBeNull();
    });
  });

  describe('updateCompanyBranding', () => {
    it('overwrites the given slots and leaves other slots untouched', async () => {
      await updateCompanyBranding(ACTOR, {
        logoLight: 'light-v1',
        logoDark: 'dark-v1',
        favicon: 'favicon-v1'
      });
      await updateCompanyBranding(ACTOR, { logoLight: 'light-v2' });

      const branding = await getCompanyBranding();
      expect(branding.logoLight).toBe('light-v2');
      expect(branding.logoDark).toBe('dark-v1');
      expect(branding.favicon).toBe('favicon-v1');
    });

    it('creates the singleton row on first save when it does not exist', async () => {
      await updateCompanyBranding(ACTOR, { profile: { name: 'First Save' } });
      const [row] = await db.select().from(companySettings).limit(1);
      expect(row.company_name).toBe('First Save');
    });

    it('clears a slot when explicitly set to null', async () => {
      await updateCompanyBranding(ACTOR, { logoLight: 'light-v1' });
      await updateCompanyBranding(ACTOR, { logoLight: null });
      const branding = await getCompanyBranding();
      expect(branding.logoLight).toBeNull();
    });

    it('writes an audit entry with before/after snapshots of changed slots', async () => {
      await seedUser(ACTOR);
      await updateCompanyBranding(ACTOR, {
        logoLight: 'light-v1',
        profile: { name: 'Old Name' }
      });
      await updateCompanyBranding(ACTOR, {
        logoLight: 'light-v2',
        profile: { name: 'New Name' }
      });

      const entries = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, 'branding.update'))
        .orderBy(desc(auditLog.id))
        .limit(1);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.actorUserId).toBe(ACTOR);
      // Assets are logged as set/unset markers, not full base64 payloads,
      // so audit rows stay small.
      expect(entries[0]?.before).toMatchObject({ logoLight: 'set' });
      expect(entries[0]?.after).toMatchObject({ logoLight: 'set' });
    });
  });
});
