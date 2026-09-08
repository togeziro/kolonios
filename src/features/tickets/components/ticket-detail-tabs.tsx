import { completedLegCount } from './leg-timeline';
import type { TicketLeg } from '../api/types';

export type TicketDetailTab = 'overview' | 'legs' | 'work';

export default function TicketDetailTabs({
  tab,
  onTabChange,
  legs
}: {
  tab: TicketDetailTab;
  onTabChange: (tab: TicketDetailTab) => void;
  legs: TicketLeg[];
}) {
  return (
    <div className='flex gap-2 rounded-full bg-zinc-900 p-1'>
      {(['overview', 'legs', 'work'] as const).map((k) => (
        <button
          key={k}
          onClick={() => onTabChange(k)}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold ${tab === k ? 'bg-white text-zinc-900' : 'text-zinc-400'}`}
        >
          {k === 'overview'
            ? 'Overview'
            : k === 'legs'
              ? `Legs ${completedLegCount(legs)}/${legs.length}`
              : 'Work Session'}
        </button>
      ))}
    </div>
  );
}
