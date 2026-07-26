import LeaveRequestForm from './leave-request-form';
import LeaveHistory from './leave-history';

export default function LeavePage() {
  return (
    <div className='space-y-6'>
      <LeaveRequestForm />
      <LeaveHistory />
    </div>
  );
}
