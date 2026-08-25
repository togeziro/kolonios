import i18next from '@/i18n/config';
import { toast } from 'sonner';

// Central stub for actions whose backend does not exist yet (UI-first
// screens). Fires a localized informational toast and does nothing else —
// no navigation, no request. The later wiring pass replaces call sites.
export function stubAction(label?: string): void {
  const message = i18next.t('common.comingSoon');
  toast.info(label ? `${label} — ${message}` : message);
}
