import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isValidBirthDate } from '../patient-profile-validation.js';

/** `YYYY-MM-DD`, in the past, implying an age of at most 120 years. */
export function IsBirthDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isBirthDate',
      target: object.constructor,
      propertyName,
      options: {
        message: 'birthDate must be a past date (YYYY-MM-DD) implying an age of at most 120 years',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidBirthDate(value);
        },
      },
    });
  };
}
