/**
 * Session placeholders.
 *
 * Until authentication is wired to Supabase Auth, these values stand in for the
 * signed-in user so each portal has an identity to work with. Replace with the
 * real session (e.g. `supabase.auth.getUser()`) when available.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'HEADMASTER' | 'ACCOUNTANT' | 'TEACHER' | 'PARENT' | 'SPONSOR';
}

export const SESSION_USER: SessionUser = {
  id: 'current-session-user',
  name: 'Signed-in User',
  email: '',
  role: 'HEADMASTER'
};

export const TEACHER_SESSION = {
  id: 'current-teacher',
  name: 'Signed-in Teacher'
};
