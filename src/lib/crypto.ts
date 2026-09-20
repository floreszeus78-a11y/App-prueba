import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const SALT_LENGTH = 64;
const AUTH_TAG_LENGTH = 16;

/**
 * Ensures a valid 32-byte key is derived from the environment variable ENCRYPTION_KEY.
 * In a real-world scenario, you might use a KDF like scrypt or pbkdf2 if the key is just a password,
 * but for AES-256 we strictly need 32 bytes.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is missing.');
  }

  // Assuming the key provided in env is a hex string of 32 bytes (64 chars)
  // or a base64 string. We'll use a SHA-256 hash to ensure it's exactly 32 bytes
  // if we aren't sure it's 32 bytes, but best practice is to require a 32 byte key.
  const bufferKey = Buffer.from(key, 'hex');
  if (bufferKey.length !== 32) {
    // Fallback: hash the key to get 32 bytes.
    return crypto.createHash('sha256').update(key).digest();
  }
  return bufferKey;
}

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param text The plaintext to encrypt.
 * @returns An object containing the hex-encoded encrypted data, iv, and authTag.
 */
export function encryptData(text: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts data using AES-256-GCM.
 * @param encryptedData Hex-encoded encrypted data.
 * @param iv Hex-encoded initialization vector.
 * @param authTag Hex-encoded authentication tag.
 * @returns The decrypted plaintext string.
 */
export function decryptData(encryptedData: string, iv: string, authTag: string): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Calculates the SHA-256 hash of a buffer (used for files).
 * @param buffer The file buffer.
 * @returns The hex-encoded SHA-256 hash.
 */
export function calculateFileHash(buffer: Buffer): string {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}
