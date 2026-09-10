import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Employee } from '@/features/employees/api/types';
import { EmployeePersonalInfoSubTab } from './-personal-info-sub-tab';
import { CareerTimelineSubTab } from './-career-timeline-tab';

type SubTab = 'personal' | 'career';

export function EmployeeProfileTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>('personal');

  return (
    <Tabs value={subTab} onValueChange={(value) => setSubTab(value as SubTab)} className='w-full'>
      <TabsList>
        <TabsTrigger value='personal'>{t('employee.subTab.personalInformation')}</TabsTrigger>
        <TabsTrigger value='career'>{t('employee.subTab.careerTimeline')}</TabsTrigger>
      </TabsList>
      <TabsContent value='personal' className='mt-4'>
        <EmployeePersonalInfoSubTab employee={employee} />
      </TabsContent>
      <TabsContent value='career' className='mt-4'>
        <CareerTimelineSubTab employee={employee} />
      </TabsContent>
    </Tabs>
  );
}
