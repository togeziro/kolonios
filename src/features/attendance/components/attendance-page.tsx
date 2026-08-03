import AttendanceCheckCard from './attendance-check-card';
import AttendanceHistory from './attendance-history';
import { useQuery } from '@tanstack/react-query';
import { myAttendanceQueryOptions } from '../api/queries';
import { AttendanceCorrectionForm } from './attendance-correction-form';

export default function AttendancePage() {
  const { data: todayData } = useQuery(myAttendanceQueryOptions());
  const attendanceId = todayData?.attendance?.attendance?.id;

  return (
    <div className='space-y-6'>
      <AttendanceCheckCard />
      {attendanceId != null && <AttendanceCorrectionForm attendanceId={attendanceId} />}
      <AttendanceHistory />
    </div>
  );
}
