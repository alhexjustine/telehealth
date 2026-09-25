import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Wraps `@node-rs/argon2` (argon2id defaults; prebuilt N-API binaries, so no
 * node-gyp build and no pnpm build-script approval, and it works on Alpine/musl).
 * `verifyOrDummy` lets sign-in always pay the cost of a hash verification, even
 * for an unknown email, so response timing does not reveal whether an account
 * exists.
 */
@Injectable()
export class PasswordHasherService {
  // A fixed, precomputed argon2id hash of an unused literal. Never matches a real
  // password; verifying against it keeps the "unknown email" branch of sign-in as
  // slow as the "wrong password" branch.
  private dummyHashPromise: Promise<string> | undefined;

  async hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  async verifyOrDummy(passwordHash: string | undefined, password: string): Promise<boolean> {
    if (passwordHash) {
      return this.verify(passwordHash, password);
    }
    await this.verify(await this.getDummyHash(), password);
    return false;
  }

  private async getDummyHash(): Promise<string> {
    this.dummyHashPromise ??= hash('dummy-password-for-timing-equalization-only');
    return this.dummyHashPromise;
  }
}
