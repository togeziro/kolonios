import LeaveRequestForm from './leave-request-form';
import MobileLeaveRequestSheet from './mobile-leave-request-sheet';
import LeaveHistory from './leave-history';

export default function LeavePage() {
  return (
    <div className='space-y-6'>
      <LeaveRequestForm />
      <MobileLeaveRequestSheet />
      <LeaveHistory />
    </div>
  );
}
