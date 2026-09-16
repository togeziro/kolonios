import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  basePath: '/api/v1/auth',
  plugins: [adminClient()]
});

export const { signOut, useSession } = authClient;
