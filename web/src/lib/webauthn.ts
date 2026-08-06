import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { webauthnApi } from './api';

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

export async function registerPasskey(name: string): Promise<void> {
  const { options, challengeToken } = await webauthnApi.registerOptions();
  const response = await startRegistration({ optionsJSON: options });
  await webauthnApi.registerVerify(response, challengeToken, name);
}

// Returns the resolved identity on success (same shape /api/auth/status returns for `user`) so
// the caller can just refresh auth status, mirroring how PIN/password login completes.
export async function loginWithPasskey(): Promise<void> {
  const { options, challengeToken } = await webauthnApi.loginOptions();
  const response = await startAuthentication({ optionsJSON: options });
  await webauthnApi.loginVerify(response, challengeToken);
}
