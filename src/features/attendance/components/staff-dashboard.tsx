import MobileAttendanceSummary from './mobile-attendance-summary';
import MyWorkSection from '@/features/tickets/components/my-work-section';
import AvailableJobsSection from '@/features/tickets/components/available-jobs-section';
import PerformanceSnapshot from './performance-snapshot';
import ChecklistEntryCard from '@/features/checklist/components/checklist-entry-card';

export default function StaffDashboard() {
  return (
    <div className='mt-2 space-y-6'>
      <MobileAttendanceSummary />
      <ChecklistEntryCard variant='card' />
      <MyWorkSection />
      <AvailableJobsSection />
      <PerformanceSnapshot />
    </div>
  );
}
