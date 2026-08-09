// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { filterBottomNavItems, navItems, BottomNav } from './bottom-nav';
import '@/i18n/config';

const mockUseRoleGroupPermissions = vi.fn();

vi.mock('@/hooks/use-nav', () => ({
  useRoleGroupPermissions: () => mockUseRoleGroupPermissions()
}));

vi.mock('@tanstack/react-router', () => {
  const MockLink = ({ to, children }: { to: string; children?: ReactNode }) =>
    createElement('a', { href: to }, children);
  return {
    Link: MockLink,
    useLocation: () => ({ pathname: '/dashboard/overview' })
  };
});

beforeEach(() => {
  mockUseRoleGroupPermissions.mockReturnValue({ isAdmin: false, permissions: {} });
});

describe('filterBottomNavItems', () => {
  it('hides payslips without payroll.view and keeps it for permitted staff', () => {
    const items = [
      { icon: (() => null) as never, labelKey: 'home', to: '/home', module: undefined },
      { icon: (() => null) as never, labelKey: 'payslips', to: '/payslips', module: 'payroll' }
    ] as never;

    expect(filterBottomNavItems(items, { payroll: { view: false } })).toHaveLength(1);
    expect(filterBottomNavItems(items, { payroll: { view: true } })).toHaveLength(2);
    expect(filterBottomNavItems(items, undefined, true)).toHaveLength(2);
  });
});

describe('navItems', () => {
  it('exposes four core tabs', () => {
    expect(navItems.map((item) => item.to)).toEqual([
      '/dashboard/overview',
      '/dashboard/my-work',
      '/dashboard/payroll/payslips',
      '/dashboard/profile'
    ]);
  });

  it('no longer contains a leave tab (Leave lives in My Work)', () => {
    expect(navItems.some((item) => (item.to as string) === '/dashboard/leave')).toBe(false);
  });
});

describe('BottomNav slot layout', () => {
  function tabRow(container: HTMLElement) {
    const nav = container.querySelector('nav');
    expect(nav).toBeTruthy();
    return nav!.children[1] as HTMLElement;
  }

  it('keeps four slots when payslips is filtered out, with an inert placeholder in its slot', () => {
    const { container } = render(createElement(BottomNav));

    const row = tabRow(container);
    expect(row.children).toHaveLength(4);

    const links = Array.from(row.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/dashboard/overview',
      '/dashboard/my-work',
      '/dashboard/profile'
    ]);

    const payslipsSlot = row.children[2] as HTMLElement;
    expect(payslipsSlot.tagName).toBe('DIV');
    expect(payslipsSlot.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders payslips as a link when admin', () => {
    mockUseRoleGroupPermissions.mockReturnValue({ isAdmin: true, permissions: {} });
    const { container } = render(createElement(BottomNav));

    const row = tabRow(container);
    expect(row.children).toHaveLength(4);

    const links = Array.from(row.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/dashboard/overview',
      '/dashboard/my-work',
      '/dashboard/payroll/payslips',
      '/dashboard/profile'
    ]);
  });
});
