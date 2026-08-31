import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { navItems } from '@/config/nav-config';
import { useFilteredNavItems, useRoleGroupPermissions } from '@/hooks/use-nav';
import { authClient, useSession } from '@/lib/auth/auth-client';
import { BrandLogo, BrandName } from '@/features/branding/components/brand-logo';
import { Link } from '@tanstack/react-router';
import { useLocation, useRouter } from '@tanstack/react-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { NavItem } from '@/types';
import { Icons } from '../icons';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';

export const navTitleKeys: Record<string, string> = {
  Dashboard: 'navigation.dashboard',
  'My Work': 'navigation.myWork',
  Attendance: 'navigation.attendance',
  Schedule: 'navigation.schedule',
  Leave: 'navigation.leave',
  Profile: 'navigation.profile',
  Customers: 'navigation.customers',
  Employees: 'navigation.employees',
  Payroll: 'navigation.payroll',
  Payslips: 'navigation.payslips',
  'Payroll Profiles': 'navigation.payrollProfiles',
  'Payroll Settings': 'navigation.payrollSettings',
  'Ready to Pay': 'navigation.payQueue',
  Broadcast: 'navigation.broadcast',
  Settings: 'navigation.settings',
  'Attendance Locations': 'navigation.attendanceLocations',
  'Attendance Schedules': 'navigation.attendanceSchedules',
  'Attendance Assignments': 'navigation.attendanceAssignments',
  'Attendance Reports': 'navigation.attendanceReports',
  'Attendance Face Settings': 'navigation.attendanceFaceSettings',
  'Attendance Management': 'navigation.attendanceManagement',
  Users: 'navigation.users',
  Departments: 'navigation.departments',
  'Job Titles': 'navigation.jobTitles',
  'Audit Log': 'navigation.auditLog',
  'Role Groups': 'navigation.roleGroups',
  'Holiday Calendar': 'navigation.holidayCalendar',
  'Work Log Settings': 'navigation.workLogSettings',
  Tickets: 'navigation.tickets',
  'Available Jobs': 'navigation.availableJobs',
  'New Ticket': 'navigation.newTicket'
};

function isPathActive(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`);
}

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.items && item.items.length > 0) {
    return item.items.some((sub) => isPathActive(pathname, sub.url));
  }
  return isPathActive(pathname, item.url);
}

function isSubItemActive(pathname: string, url: string): boolean {
  return pathname === url;
}

function NavItemMenu({
  item,
  pathname,
  t
}: {
  item: NavItem;
  pathname: string;
  t: (key: string) => string;
}) {
  const active = isItemActive(item, pathname);
  const [open, setOpen] = React.useState(active);
  // Auto-expand when the item becomes active (adjust-state-during-render
  // pattern; replaces the previous effect).
  const [prevActive, setPrevActive] = React.useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (active) setOpen(true);
  }

  const label = t(navTitleKeys[item.title] ?? item.title);
  const Icon =
    item.icon && item.icon in Icons ? Icons[item.icon as keyof typeof Icons] : Icons.logo;

  if (item.items && item.items.length > 0) {
    return (
      <Collapsible open={open} onOpenChange={setOpen} asChild className='group/collapsible'>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={label} isActive={active}>
              {item.icon && <Icon />}
              <span>{label}</span>
              <Icons.chevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton asChild isActive={isSubItemActive(pathname, subItem.url)}>
                    <Link to={subItem.url}>
                      <span>{t(navTitleKeys[subItem.title] ?? subItem.title)}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label} isActive={active}>
        <Link to={item.url}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default function AppSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const router = useRouter();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const filteredItems = useFilteredNavItems(navItems, permissions, isAdmin);
  const { data: session } = useSession();
  const user = session?.user;
  const name = user?.name ?? 'User';
  const email = user?.email ?? '';

  return (
    <Sidebar variant='inset' collapsible='icon'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <Link to='/dashboard/overview'>
                <BrandLogo className='size-8 shrink-0 rounded-md' />
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>
                    <BrandName fallback='Kolonios' />
                  </span>
                  <span className='text-muted-foreground truncate text-xs'>
                    {t('navigation.dashboard')}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        <SidebarGroup className='py-0'>
          <SidebarMenu>
            {filteredItems.map((item) => (
              <NavItemMenu key={item.title} item={item} pathname={pathname} t={t} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size='lg'
                  className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                >
                  <div className='bg-muted flex aspect-square size-8 shrink-0 items-center justify-center rounded-full'>
                    <Icons.account className='size-4' />
                  </div>
                  <div className='grid flex-1 text-left text-sm leading-tight'>
                    <span suppressHydrationWarning className='truncate font-medium'>
                      {name}
                    </span>
                    <span
                      suppressHydrationWarning
                      className='text-muted-foreground truncate text-xs'
                    >
                      {email}
                    </span>
                  </div>
                  <Icons.chevronsDown className='ml-auto size-4' />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => router.navigate({ to: '/dashboard/notifications' })}
                  >
                    <Icons.notification className='mr-2 h-4 w-4' />
                    {t('notifications.title')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await authClient.signOut();
                    router.navigate({ to: '/auth/v2/sign-in' });
                  }}
                >
                  <Icons.logout className='mr-2 h-4 w-4' />
                  {t('common.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
