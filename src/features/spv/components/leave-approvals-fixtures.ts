// TODO(wire): local fixtures for the Leave Approvals queue. Replace with a
// reviewer-scoped leave listing server function once it exists. Balance
// quotas and hourly permits ("Izin Jam") are explicitly out of scope.
export type LeaveRequestFixture = {
  id: number;
  requesterName: string;
  requesterRole: string;
  requesterDepartment: string;
  type: 'annual' | 'sick' | 'personal' | 'emergency' | 'maternity' | 'paternity';
  paid: boolean;
  durationDays: number;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
};

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const LEAVE_REQUESTS: LeaveRequestFixture[] = [
  {
    id: 1,
    requesterName: 'Andi Nugroho',
    requesterRole: 'Technician',
    requesterDepartment: 'Engineering',
    type: 'annual',
    paid: true,
    durationDays: 4,
    startDate: dayOffset(3),
    endDate: dayOffset(6),
    reason: 'Family event — Balikpapan',
    status: 'pending'
  },
  {
    id: 2,
    requesterName: 'Ratna Sari',
    requesterRole: 'Admin',
    requesterDepartment: 'Operations',
    type: 'sick',
    paid: false,
    durationDays: 1,
    startDate: dayOffset(1),
    endDate: dayOffset(1),
    reason: 'Doctor appointment',
    status: 'pending'
  },
  {
    id: 3,
    requesterName: 'Budi Santoso',
    requesterRole: 'Technician',
    requesterDepartment: 'Field Service',
    type: 'personal',
    paid: true,
    durationDays: 2,
    startDate: dayOffset(-40),
    endDate: dayOffset(-39),
    reason: 'Personal errand out of town',
    status: 'pending'
  },
  {
    id: 4,
    requesterName: 'Dewi Lestari',
    requesterRole: 'Technician',
    requesterDepartment: 'Field Service',
    type: 'annual',
    paid: true,
    durationDays: 3,
    startDate: dayOffset(-2),
    endDate: dayOffset(0),
    reason: 'Annual leave — hometown visit',
    status: 'approved'
  },
  {
    id: 5,
    requesterName: 'Eko Prabowo',
    requesterRole: 'Admin',
    requesterDepartment: 'Operations',
    type: 'emergency',
    paid: false,
    durationDays: 1,
    startDate: dayOffset(-5),
    endDate: dayOffset(-5),
    reason: 'Family emergency',
    status: 'rejected'
  }
];
