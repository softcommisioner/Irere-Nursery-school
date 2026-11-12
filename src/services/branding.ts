const SCHOOL_LOGO_KEY = 'irere.school.logo.v1';

export function loadSchoolLogo(): string | null {
  try {
    const value = window.localStorage.getItem(SCHOOL_LOGO_KEY);
    return value && value.startsWith('data:image/') ? value : null;
  } catch {
    return null;
  }
}

export function saveSchoolLogo(dataUrl: string | null): void {
  try {
    if (!dataUrl) {
      window.localStorage.removeItem(SCHOOL_LOGO_KEY);
      return;
    }
    window.localStorage.setItem(SCHOOL_LOGO_KEY, dataUrl);
  } catch {
    return;
  }
}
