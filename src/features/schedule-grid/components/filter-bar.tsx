import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { NativeSelect } from '@/components/ui/native-select';
import { SEARCH_DEBOUNCE_MS } from '../utils/constants';

export type ScheduleGridFilterBarProps = {
  divisions: Array<{ id: number; name: string }>;
  divisionId: string | null;
  onDivisionChange: (divisionId: string | null) => void;
  search: string;
  /** Local pending search string — owned by the parent so debouncing stays
   * pure (test-friendly via fake timers in ticket 04). */
  pendingSearch: string;
  onPendingSearchChange: (next: string) => void;
  isPending?: boolean;
};

/**
 * Non-form filter bar — bare `<NativeSelect>` for the division dropdown
 * (per repo convention: non-form selects never use `FormSelectField`) and
 * a debounced search input. The parent owns the debounce timer so the
 * component itself stays a pure view layer.
 */
export function FilterBar({
  divisions,
  divisionId,
  onDivisionChange,
  search,
  pendingSearch,
  onPendingSearchChange,
  isPending = false
}: ScheduleGridFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <InputGroup className='h-9 w-full md:w-64'>
        <InputGroupAddon align='inline-start'>
          <Search className='size-3.5' />
        </InputGroupAddon>
        <InputGroupInput
          className='h-9'
          placeholder={t('scheduleGrid.filter.searchPlaceholder')}
          value={pendingSearch}
          onChange={(event) => {
            const next = event.target.value;
            onPendingSearchChange(next);
          }}
          aria-label={t('scheduleGrid.filter.searchLabel')}
          // Help tests: consumers wire a debounce that uses
          // `SEARCH_DEBOUNCE_MS` from the constants module.
          data-search-debounce-ms={SEARCH_DEBOUNCE_MS}
        />
      </InputGroup>

      <NativeSelect
        aria-label={t('scheduleGrid.filter.divisionLabel')}
        className='h-9 w-full md:w-56'
        value={divisionId ?? ''}
        onChange={(event) => {
          const next = event.target.value;
          onDivisionChange(next === '' ? null : next);
        }}
        disabled={isPending}
      >
        <option value=''>{t('scheduleGrid.filter.divisionAll')}</option>
        {divisions.map((division) => (
          <option key={division.id} value={String(division.id)}>
            {division.name}
          </option>
        ))}
      </NativeSelect>

      {/* Hidden sentinel that exposes the committed search value for tests
          and snapshot queries without forcing a re-render on every keystroke. */}
      <input type='hidden' data-testid='schedule-grid-search' value={search} readOnly />
    </div>
  );
}
