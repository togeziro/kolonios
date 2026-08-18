import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FaceEnrollment } from '@/features/attendance/components/face-enrollment';
import { myFaceEnrollmentQueryOptions } from '@/features/face/api/queries';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/dashboard/attendance/face-settings')({
  component: FaceSettingsPage
});

function FaceSettingsPage() {
  const { t } = useTranslation();
  const { data: enrollment } = useQuery(myFaceEnrollmentQueryOptions());

  return (
    <PageContainer
      pageTitle={t('faceEnrollment.title')}
      pageDescription={t('faceEnrollment.subtitle')}
    >
      <div className='grid max-w-xl gap-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle>{t('faceEnrollment.statusTitle')}</CardTitle>
            <Badge
              variant='outline'
              className={
                enrollment?.enrolled
                  ? 'border-green-500 text-green-400'
                  : 'border-zinc-600 text-zinc-400'
              }
            >
              {enrollment?.enrolled
                ? t('faceEnrollment.statusEnrolled', { count: enrollment.count })
                : t('faceEnrollment.statusNotEnrolled')}
            </Badge>
          </CardHeader>
          <CardContent>
            <FaceEnrollment />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
