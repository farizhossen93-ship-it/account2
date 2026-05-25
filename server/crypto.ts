import crypto from 'node:crypto';

// Use a master key from environment, with a strong fallback to guarantee system stability
const MASTER_SECRET = process.env.VAULT_MASTER_KEY || 'd1g1t_v4ult_pr0_3ncrypt_k3y_s3cr3t'; // 32 characters fallback

// Ensure we have a 32-byte key for AES-256-CBC
const ENCRYPTION_KEY = crypto.createHash('sha256').update(MASTER_SECRET).digest();

/**
 * Encrypts a plaintext string using AES-256-CBC with a random Initialization Vector.
 * Returns the IV and ciphertext as a combined colon-separated hex string.
 */
export function encrypt(text: string): string {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    return '';
  }
}

/**
 * Decrypts a hex-encoded cipher text string created by encrypt().
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      // Not encrypted / Legacy plain text support for fallback / imports
      return encryptedText;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Decryption Error]';
  }
}

/**
 * Hashes a password using PBKDF2 with salt.
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

/**
 * Generates a random salt string.
 */
export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a standard JWT-like secure session token.
 */
export function generateToken(): string {
  return crypto.randomBytes(48).toString('hex');
}
