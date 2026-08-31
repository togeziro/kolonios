import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { distance } from '@turf/distance';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Icons } from '@/components/icons';
import { EnRouteMap } from '@/components/ui/route-map';
import { ticketDetailQueryOptions } from '../api/queries';
import { useArriveTicket } from '../api/hooks';
import {
  getCurrentLocation,
  type DeviceLocation,
  type LocationResult
} from '@/features/attendance/utils/geolocation';

const priorityTone: Record<string, string> = {
  high: 'bg-red-500/15 text-red-500 dark:text-red-400',
  medium: 'bg-amber-500/15 text-amber-500 dark:text-amber-400',
  low: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400'
};

export default function EnRouteNavigationPage({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(ticketDetailQueryOptions(ticketId));
  const arrive = useArriveTicket();
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [arriving, setArriving] = useState(false);

  // Best-effort device fix for the map preview; failures just leave the
  // marker off — arrival is not gated on GPS. `inaccurate`/`stale` results
  // still carry a usable location for the preview, so any result with
  // coordinates is accepted here.
  useEffect(() => {
    let cancelled = false;
    void getCurrentLocation().then((loc: LocationResult) => {
      if (
        cancelled ||
        loc.status === 'permission-denied' ||
        loc.status === 'unavailable' ||
        loc.status === 'timeout'
      )
        return;
      setDeviceLocation(loc.location);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const distanceToDestination = useMemo(() => {
    if (!deviceLocation) return null;
    const deviceValid =
      Number.isFinite(deviceLocation.latitude) &&
      Number.isFinite(deviceLocation.longitude) &&
      (deviceLocation.latitude !== 0 || deviceLocation.longitude !== 0);
    if (!deviceValid) return null;
    const dest = data?.ticket?.customer;
    if (!dest || (dest.latitude === 0 && dest.longitude === 0)) return null;
    const km = distance(
      [deviceLocation.longitude, deviceLocation.latitude],
      [dest.longitude, dest.latitude]
    );
    return km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`;
  }, [deviceLocation, data]);

  if (isLoading) {
    return (
      <div className='flex justify-center py-16'>
        <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  const ticket = data?.ticket;
  if (!ticket) {
    return (
      <div className='space-y-4 p-4 text-center'>
        <p className='text-sm text-muted-foreground'>{t('ticket.invalidTicket')}</p>
        <Link to='/dashboard/my-work' className='text-xs font-semibold'>
          {t('ticket.seeAll')}
        </Link>
      </div>
    );
  }

  if (ticket.status === 'in_progress') {
    return (
      <div className='space-y-4 p-4 text-center'>
        <p className='text-sm text-muted-foreground'>{t('enRoute.inProgressHint')}</p>
        <Link to='/dashboard/work-session/$ticketId' params={{ ticketId: String(ticketId) }}>
          <Button variant='outline' size='sm'>
            {t('enRoute.back')}
          </Button>
        </Link>
      </div>
    );
  }

  if (ticket.status !== 'assigned') {
    return (
      <div className='space-y-4 p-4 text-center'>
        <p className='text-sm text-muted-foreground'>{t('enRoute.notAssigned')}</p>
        <Link to='/dashboard/tickets/$ticketId' params={{ ticketId: String(ticketId) }}>
          <Button variant='outline' size='sm'>
            {t('enRoute.back')}
          </Button>
        </Link>
      </div>
    );
  }

  const customer = ticket.customer;
  const destination =
    customer && (customer.latitude !== 0 || customer.longitude !== 0)
      ? { lat: customer.latitude, lng: customer.longitude }
      : null;
  const address = customer?.address || ticket.location?.name || '';
  const hasPhone = !!customer?.phone;

  const openMapsHref = destination
    ? `geo:${destination.lat},${destination.lng}?q=${destination.lat},${destination.lng}${address ? `(${encodeURIComponent(address)})` : ''}`
    : address
      ? `geo:0,0?q=${encodeURIComponent(address)}`
      : null;

  const handleArrived = async () => {
    if (arriving || arrive.isPending) return;
    setArriving(true);
    try {
      const loc = await getCurrentLocation();
      if (loc.status === 'success' || loc.status === 'stale' || loc.status === 'inaccurate') {
        confirmArrival({
          latitude: loc.location.latitude,
          longitude: loc.location.longitude,
          accuracy: loc.location.accuracy
        });
      } else {
        setConfirmOpen(true);
      }
    } finally {
      setArriving(false);
    }
  };

  const confirmArrival = (loc?: { latitude: number; longitude: number; accuracy: number }) => {
    arrive.mutate(
      { ticketId, ...loc },
      {
        onSuccess: (res) => {
          if (res?.success) {
            navigate({
              to: '/dashboard/work-session/$ticketId',
              params: { ticketId: String(ticketId) }
            });
          }
        }
      }
    );
  };

  return (
    <div className='space-y-4 p-4 pb-28'>
      <button
        type='button'
        onClick={() => navigate({ to: '/dashboard/my-work' })}
        className='flex items-center gap-1 text-xs font-semibold text-muted-foreground'
      >
        <Icons.chevronLeft className='h-3.5 w-3.5' /> {t('enRoute.back')}
      </button>

      <Card className='space-y-3 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900'>
        <div className='flex items-start justify-between gap-2'>
          <div>
            {ticket.ticketCode && (
              <span className='inline-block rounded-lg bg-orange-500/15 px-2 py-1 text-[10px] font-bold tracking-widest text-orange-500 dark:text-orange-400'>
                {ticket.ticketCode}
              </span>
            )}
            <h2 className='mt-2 text-lg font-bold leading-tight dark:text-white'>{ticket.title}</h2>
          </div>
          <Badge className='h-6 rounded-full bg-blue-500/15 px-3 text-[11px] font-bold text-blue-500 dark:text-blue-400'>
            {t('enRoute.title')}
          </Badge>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge
            className={`h-6 rounded-full px-3 text-[11px] font-bold ${ticket.priority === 'high' ? priorityTone.high : ticket.priority === 'medium' ? priorityTone.medium : priorityTone.low}`}
          >
            {t(`priority.${ticket.priority}`)}
          </Badge>
          {ticket.location && (
            <Badge variant='outline' className='h-6 rounded-full px-3 text-[11px] font-bold'>
              {ticket.location.name}
            </Badge>
          )}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button asChild variant='outline' size='sm' className='flex-1'>
            {hasPhone ? (
              <a href={`tel:${customer?.phone}`}>
                <Icons.phone className='mr-2 h-4 w-4' />
                {t('enRoute.callCustomer')}
              </a>
            ) : (
              <span className='flex items-center justify-center gap-2 opacity-60'>
                <Icons.phone className='h-4 w-4' />
                {t('enRoute.noPhone')}
              </span>
            )}
          </Button>
          {openMapsHref && (
            <Button asChild variant='outline' size='sm' className='flex-1'>
              <a href={openMapsHref} target='_blank' rel='noreferrer'>
                <Icons.location className='h-4 w-4' />
                {t('enRoute.openMaps')}
              </a>
            </Button>
          )}
        </div>
      </Card>

      <Card className='overflow-hidden rounded-2xl border dark:border-zinc-800/50 dark:bg-zinc-900'>
        <div className='h-64'>
          <EnRouteMap
            deviceLocation={deviceLocation}
            destination={destination}
            onDeviceFix={setDeviceLocation}
            className='h-full w-full'
          />
        </div>
        <div className='space-y-1 border-t p-4 dark:border-zinc-800/50'>
          <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
            {t('enRoute.destination')}
          </p>
          <p className='text-sm font-semibold dark:text-white'>
            {customer?.name ?? ticket.location?.name ?? t('enRoute.destinationUnavailable')}
          </p>
          {address && <p className='text-sm text-muted-foreground'>{address}</p>}
          {distanceToDestination && (
            <p className='flex items-center gap-1 text-xs font-semibold text-muted-foreground'>
              <Icons.location className='h-3 w-3' />
              {t('enRoute.distanceTo')} {distanceToDestination}
            </p>
          )}
        </div>
      </Card>

      <div className='fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur dark:border-zinc-800/50 dark:bg-zinc-950/95 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))]'>
        <Button className='w-full' onClick={handleArrived} disabled={arriving || arrive.isPending}>
          {arriving || arrive.isPending ? (
            <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Icons.check className='mr-2 h-4 w-4' />
          )}
          {t('enRoute.arrived')}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('enRoute.arriveConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('enRoute.arriveConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('enRoute.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmArrival()}>
              {t('enRoute.arriveWithoutLocation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
