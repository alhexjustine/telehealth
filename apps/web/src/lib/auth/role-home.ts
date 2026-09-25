import type { Role } from './types';

export function roleHomePath(role: Role): string {
  switch (role) {
    case 'PATIENT':
      return '/patient';
    case 'DOCTOR':
      return '/doctor';
    case 'ADMIN':
      return '/admin';
  }
}
