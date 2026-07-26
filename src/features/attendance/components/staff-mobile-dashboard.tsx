import MobileAttendanceSummary from './mobile-attendance-summary';
import InProgressTasks from './in-progress-tasks';
import TaskGroups from './task-groups';

export default function StaffMobileDashboard() {
  return (
    <div className='mt-2 space-y-5'>
      <MobileAttendanceSummary />
      <InProgressTasks />
      <TaskGroups />
    </div>
  );
}
