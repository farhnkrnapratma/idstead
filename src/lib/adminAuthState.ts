export type AdminAuthStatus =
  'signed-out' | 'invalid' | 'unauthorized' | 'mfa-required' | 'authenticated';

type AssuranceLevels = {currentLevel: string | null; nextLevel: string | null};

type AdminAuthClient = {
  auth: {
    getSession: () => Promise<{
      data: {session: {access_token: string} | null};
      error: unknown | null;
    }>;
    getUser: (
      jwt?: string
    ) => Promise<{
      data: {user: {app_metadata?: Record<string, unknown> | null} | null};
      error: unknown | null;
    }>;
    mfa: {
      getAuthenticatorAssuranceLevel: (
        jwt?: string
      ) => Promise<{data: AssuranceLevels | null; error: unknown | null}>;
    };
    signOut: (options?: {
      scope?: 'global' | 'local' | 'others';
    }) => Promise<{error: unknown | null}>;
  };
};

type AdminAuthInspection =
  | {status: 'invalid'; error: unknown}
  | {status: Exclude<AdminAuthStatus, 'invalid'>};

export function requiresAdminMfa(
  assurance: AssuranceLevels | null | undefined
): boolean {
  return assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2';
}

export function resolveAdminAuthStatus(
  role: unknown,
  assurance: AssuranceLevels | null | undefined
): Exclude<AdminAuthStatus, 'signed-out'> {
  if (role !== 'admin') return 'unauthorized';
  if (!assurance) return 'invalid';
  return requiresAdminMfa(assurance) ? 'mfa-required' : 'authenticated';
}

export async function inspectAdminAuth(
  client: AdminAuthClient
): Promise<AdminAuthInspection> {
  const {data: sessionData, error: sessionError} =
    await client.auth.getSession();
  if (sessionError) return {status: 'invalid', error: sessionError};
  if (!sessionData.session) return {status: 'signed-out'};

  const {data: userData, error: userError} = await client.auth.getUser(
    sessionData.session.access_token
  );
  if (userError || !userData.user)
    return {
      status: 'invalid',
      error:
        userError ?? new Error('The authenticated user could not be verified.')
    };

  const {data: assurance, error: assuranceError} =
    await client.auth.mfa.getAuthenticatorAssuranceLevel(
      sessionData.session.access_token
    );
  if (assuranceError || !assurance)
    return {
      status: 'invalid',
      error:
        assuranceError
        ?? new Error(
          'The authentication assurance level could not be verified.'
        )
    };

  const status = resolveAdminAuthStatus(
    userData.user.app_metadata?.role,
    assurance
  );
  if (status === 'invalid')
    return {
      status,
      error: new Error('The authentication assurance level is incomplete.')
    };
  return {status};
}

export async function clearLocalAdminSession(
  client: AdminAuthClient
): Promise<void> {
  try {
    const {error} = await client.auth.signOut({scope: 'local'});
    if (error)
      console.error('Could not clear the incomplete admin session:', error);
  } catch (error) {
    console.error('Could not clear the incomplete admin session:', error);
  }
}
