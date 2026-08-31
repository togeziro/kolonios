import { useTheme } from 'next-themes';
import { usePublicBranding } from '@/features/branding/api/public-queries';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Company brand mark used across app shells. Renders the uploaded logo for
 * the active theme (dark logo in dark mode, light logo otherwise) and falls
 * back to the built-in icon when that slot is unset. Falls back further to
 * the light logo when only it was uploaded.
 */
export function BrandLogo({ className }: { className?: string }) {
  const { data } = usePublicBranding();
  const { resolvedTheme } = useTheme();
  const logo = (resolvedTheme === 'dark' ? data?.logoDark : undefined) ?? data?.logoLight ?? null;

  if (logo) {
    return <img src={logo} alt={data?.name ?? ''} className={cn('object-contain', className)} />;
  }
  return <Icons.logo className={className} />;
}

/**
 * Company display name from Branding with a caller-supplied fallback —
 * used wherever shells hardcode the product name today.
 */
export function BrandName({ fallback }: { fallback: string }) {
  const { data } = usePublicBranding();
  return <>{data?.name ?? fallback}</>;
}
