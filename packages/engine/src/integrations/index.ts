export { decodeVaultMasterKey, openCredential, sealCredential, VAULT_KEY_VERSION } from "./crypto";
export {
  VaultError,
  VaultKeyInvalidError,
  VaultKeyMissingError,
  VaultNotConnectedError,
  VaultOpenError,
  VaultShapeError,
} from "./errors";
export {
  vaultSocialEnvView,
  vaultSocialPublisherResolver,
} from "./social-arming";
export {
  validateDestination,
  VALIDATE_PROBES,
  type ProbeContext,
  type ProbeOutcome,
  type ValidateResult,
} from "./validate";
export {
  connectDestination,
  disconnectDestination,
  listCredentialCards,
  openCredentialRow,
  openDestinationCredentials,
  toCredentialCard,
  type CredentialCard,
  type DestinationCredentials,
  type VaultDeps,
  type VaultRepos,
} from "./vault";
