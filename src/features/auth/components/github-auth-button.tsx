import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useTranslation } from 'react-i18next';

export default function GithubSignInButton() {
  const { t } = useTranslation();
  return (
    <Button className='w-full' variant='outline' type='button' onClick={() => void 0}>
      <Icons.github className='mr-2 h-4 w-4' />
      {t('auth.signInWithGithub')}
    </Button>
  );
}
