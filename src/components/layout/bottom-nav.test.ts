// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { navItems, BottomNav } from './bottom-nav';
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

describe('navItems', () => {
  it('exposes the four core technician tabs', () => {
    expect(navItems.map((item) => item.to)).toEqual([
      '/dashboard/overview',
      '/dashboard/my-work',
      '/dashboard/jobs',
      '/dashboard/profile'
    ]);
  });

  it('does not contain a payslips tab (payroll lives elsewhere)', () => {
    const payslipPath = '/dashboard/payroll/payslips' as string;
    expect(navItems.some((item) => item.to === payslipPath)).toBe(false);
  });
});

describe('BottomNav slot layout', () => {
  function tabRow(container: HTMLElement) {
    const nav = container.querySelector('nav');
    expect(nav).toBeTruthy();
    return nav!.children[1] as HTMLElement;
  }

  it('renders four tab links plus the centered check-in action', () => {
    const { container } = render(createElement(BottomNav));

    const row = tabRow(container);
    expect(row.children).toHaveLength(4);

    const links = Array.from(row.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/dashboard/overview',
      '/dashboard/my-work',
      '/dashboard/jobs',
      '/dashboard/profile'
    ]);
  });
});
