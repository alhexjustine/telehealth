import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, isPasswordPolicyValid } from './password-policy.js';

/**
 * DTO-level password policy check for endpoints where the email is a sibling
 * field (registration). Reads `email` off the object being validated; when no
 * sibling `email` field exists (password change), it falls back to a
 * length-only check, and the service layer separately re-checks the full
 * policy (including the email match) against the signed-in user's own email
 * via `isPasswordPolicyValid`, so the rule is never bypassed either way.
 */
export function IsPasswordPolicy(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isPasswordPolicy',
      target: object.constructor,
      propertyName,
      options: {
        message: `password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters and must not equal the email`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') {
            return false;
          }
          const email = (args.object as { email?: unknown }).email;
          if (typeof email !== 'string') {
            return value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH;
          }
          return isPasswordPolicyValid(value, email);
        },
      },
    });
  };
}
