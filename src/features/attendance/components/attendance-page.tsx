import AttendanceCheckCard from './attendance-check-card';
import AttendanceHistory from './attendance-history';

export default function AttendancePage() {
  return (
    <div className='space-y-6'>
      <AttendanceCheckCard />
      <AttendanceHistory />
    </div>
  );
}
