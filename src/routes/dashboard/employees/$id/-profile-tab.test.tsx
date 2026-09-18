// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => useQueryMock() };
});

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  Link: ({ children, ...rest }: { children: React.ReactNode }) =>
    createElement('a', rest, children),
  useParams: () => ({ id: 'emp-1' })
}));

vi.mock('@/features/employees/api/queries', () => ({
  employeeByIdQueryOptions: (id: string) => ({
    queryKey: ['employees', 'detail', id],
    queryFn: async () => ({})
  })
}));

vi.mock('@/features/employees/api/career-events', () => ({
  careerTimelineQueryOptions: (employeeId: string) => ({
    queryKey: ['careerEvents', 'timeline', employeeId],
    queryFn: async () => ({})
  })
}));

import '@/i18n/config';
import { EmployeeProfileTab } from './-profile-tab';
import { EmployeeAttendanceTab } from './-attendance-tab';
import { EmployeePersonalInfoSubTab } from './-personal-info-sub-tab';
import type { Employee } from '@/features/employees/api/types';

const fakeEmployee: Employee = {
  id: 'emp-1',
  employee_code: 'EMP-0001',
  full_name: 'Jane Doe',
  nickname: 'Jan',
  email: 'jane@example.com',
  phone: '+62-812-0000-0000',
  birth_place: 'Jakarta',
  birth_date: '1990-01-15',
  address: 'Jl. Sudirman 1',
  id_number: '3201234567890001',
  department_id: 1,
  designation_id: 2,
  is_internship: false,
  employment_status: 'active',
  join_date: '2024-01-01',
  leave_date: null,
  base_salary: 5_000_000,
  status: 'active',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  department_name: 'Operation',
  designation_name: 'Field Engineer'
};

beforeEach(() => {
  cleanup();
});

function renderProfileTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(EmployeeProfileTab, { employee: fakeEmployee })
    )
  );
}

describe('EmployeeProfileTab — sub-tab shell', () => {
  it('renders the Personal Information and Career Timeline sub-tab triggers', () => {
    renderProfileTab();
    expect(screen.getByRole('tab', { name: 'Personal Information' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Career Timeline' })).toBeInTheDocument();
  });

  it('shows the Personal Information fields by default', () => {
    renderProfileTab();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('EMP-0001')).toBeInTheDocument();
    expect(screen.getByText('Operation')).toBeInTheDocument();
    expect(screen.getByText('Field Engineer')).toBeInTheDocument();
  });

  it('switches to the Career Timeline sub-tab when clicked', async () => {
    const user = userEvent.setup();
    useQueryMock.mockReturnValue({
      data: { lengthOfService: { years: 0, months: 0 }, events: [] },
      isLoading: false,
      isError: false
    });
    renderProfileTab();
    const careerTab = screen.getByRole('tab', { name: 'Career Timeline' });
    await user.click(careerTab);
    expect(screen.getByRole('button', { name: 'Change Department' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Position' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Work Status' })).toBeInTheDocument();
    expect(screen.getByText(/No career events recorded yet/i)).toBeInTheDocument();
  });
});

describe('EmployeePersonalInfoSubTab', () => {
  it('renders identity and employment sections', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(EmployeePersonalInfoSubTab, { employee: fakeEmployee })
      )
    );
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Employment')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Operation')).toBeInTheDocument();
  });
});

describe('EmployeeAttendanceTab — labelled placeholder', () => {
  it('renders the placeholder title and helper text', () => {
    render(<EmployeeAttendanceTab />);
    expect(screen.getByText(/Attendance history ships in the next phase/i)).toBeInTheDocument();
  });
});
