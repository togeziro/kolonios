import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { navGroups } from '@/config/nav-config';
import { useFilteredNavGroups, useRoleGroupPermissions } from '@/hooks/use-nav';
import { authClient } from '@/lib/auth/auth-client';
import { Link } from '@tanstack/react-router';
import { useLocation, useRouter } from '@tanstack/react-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '../icons';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';

const navTitleKeys: Record<string, string> = {
  Overview: 'navigation.overview',
  Dashboard: 'navigation.dashboard',
  'My Work': 'navigation.myWork',
  Attendance: 'navigation.attendance',
  Leave: 'navigation.leave',
  Profile: 'navigation.profile',
  Management: 'navigation.management',
  Customers: 'navigation.customers',
  Employees: 'navigation.employees',
  Settings: 'navigation.settings',
  Users: 'navigation.users',
  Departments: 'navigation.departments',
  'Job Titles': 'navigation.jobTitles',
  'Audit Log': 'navigation.auditLog',
  'Role Groups': 'navigation.roleGroups'
};

export default function AppSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const router = useRouter();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const filteredGroups = useFilteredNavGroups(navGroups, permissions, isAdmin);

  return (
    <Sidebar variant='inset' collapsible='icon'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <Link to='/dashboard/overview'>
                <div className='bg-primary text-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-md'>
                  <Icons.logo className='size-4' />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>TanStack Start</span>
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
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label || 'ungrouped'} className='py-0'>
            {group.label && (
              <SidebarGroupLabel>{t(navTitleKeys[group.label] ?? group.label)}</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon =
                  item.icon && item.icon in Icons
                    ? Icons[item.icon as keyof typeof Icons]
                    : Icons.logo;
                return item?.items && item?.items?.length > 0 ? (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={item.isActive}
                    className='group/collapsible'
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={t(navTitleKeys[item.title] ?? item.title)}
                          isActive={pathname === item.url}
                        >
                          {item.icon && <Icon />}
                          <span>{t(navTitleKeys[item.title] ?? item.title)}</span>
                          <Icons.chevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
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
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={t(navTitleKeys[item.title] ?? item.title)}
                      isActive={pathname === item.url}
                    >
                      <Link to={item.url}>
                        <Icon />
                        <span>{t(navTitleKeys[item.title] ?? item.title)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
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
                    <span className='truncate font-medium'>User</span>
                    <span className='text-muted-foreground truncate text-xs'>user@example.com</span>
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
