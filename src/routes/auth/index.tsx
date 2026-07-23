import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/')({
  beforeLoad: () => {
    throw redirect({ to: '/auth/v2/sign-in' });
  }
});
