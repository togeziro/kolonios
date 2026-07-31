import MobileAttendanceSummary from './mobile-attendance-summary';
import MyWorkSection from '@/features/tasks/components/my-work-section';
import AvailableJobsSection from '@/features/tasks/components/available-jobs-section';
import PerformanceSnapshot from './performance-snapshot';

export default function StaffDashboard() {
  return (
    <div className='mt-2 space-y-6'>
      <MobileAttendanceSummary />
      <MyWorkSection />
      <AvailableJobsSection />
      <PerformanceSnapshot />
    </div>
  );
}
