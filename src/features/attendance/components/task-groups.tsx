import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { departmentsQueryOptions } from '@/features/masterdata/api/queries';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';

export default function TaskGroups() {
  const { data } = useQuery(departmentsQueryOptions());
  const departments = data?.departments ?? [];

  if (departments.length === 0) return null;

  return (
    <div className='px-4 pb-24'>
      <div className='mb-3 flex items-center gap-2'>
        <h2 className='text-sm font-semibold'>My Groups</h2>
        <span className='bg-muted text-muted-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium'>
          {departments.length}
        </span>
      </div>

      <div className='space-y-2.5'>
        {departments.map((dept, i) => (
          <motion.div
            key={dept.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.04 }}
          >
            <Card className='flex items-center gap-3 rounded-xl p-3.5'>
              <div className='bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'>
                <Icons.workspace className='text-primary h-5 w-5' />
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-semibold leading-tight'>{dept.name}</p>
                <p className='text-muted-foreground truncate text-[11px]'>
                  {dept.description ?? 'No description'}
                </p>
              </div>
              <div className='flex items-center gap-1'>
                <svg className='h-8 w-8' viewBox='0 0 32 32'>
                  <circle
                    cx='16'
                    cy='16'
                    r='14'
                    fill='none'
                    stroke='hsl(var(--muted))'
                    strokeWidth='2.5'
                  />
                  <motion.circle
                    cx='16'
                    cy='16'
                    r='14'
                    fill='none'
                    stroke='hsl(var(--primary))'
                    strokeWidth='2.5'
                    strokeLinecap='round'
                    strokeDasharray='88'
                    initial={{ strokeDashoffset: 88 }}
                    animate={{ strokeDashoffset: 88 * 0.3 }}
                    transition={{ duration: 0.6, delay: 0.2 + i * 0.04 }}
                  />
                </svg>
                <span className='text-[10px] font-medium'>70%</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
