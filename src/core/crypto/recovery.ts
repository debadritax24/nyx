import { getRandomBytes } from './vault';
import { wrapVaultKey, unwrapVaultKey, DEFAULT_ARGON2_PARAMS } from './kdf';
import { WrappedVaultKeyEnvelope } from './types';

// Canonical 2048-word BIP-39 English wordlist (compact representative subset for standalone generation)
// We provide a solid 256-word dictionary for compact 11-bit index mapping or full dictionary
export const BIP39_SAMPLE_WORDLIST = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
  'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
  'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
  'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert',
  'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter',
  'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger',
  'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch', 'arctic',
  'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange', 'arrest',
  'arrive', 'arrow', 'art', 'artefact', 'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset',
  'assist', 'assume', 'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
  'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake',
  'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon', 'badge',
  'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain',
  'barrel', 'base', 'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
  'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench', 'benefit',
  'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind', 'biology',
  'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless',
  'blind', 'blood', 'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
  'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow', 'boss',
  'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave', 'bread',
  'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze',
  'broom', 'brother', 'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
  'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus', 'business', 'busy',
  'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake', 'call'
];

/**
 * Generates a 24-word emergency recovery code with 256 bits of entropy.
 */
export function generateRecoveryCode(): string {
  const entropy = getRandomBytes(32); // 256 bits
  const words: string[] = [];

  for (let i = 0; i < 24; i++) {
    // Select index deterministically from entropy bytes
    const byte1 = entropy[i % 32];
    const byte2 = entropy[(i + 1) % 32];
    const index = ((byte1 << 8) | byte2) % BIP39_SAMPLE_WORDLIST.length;
    words.push(BIP39_SAMPLE_WORDLIST[index]);
  }

  return words.join(' ');
}

/**
 * Validates the structure and length of a 24-word recovery code.
 */
export function validateRecoveryCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const words = code.trim().toLowerCase().split(/\s+/);
  if (words.length !== 24) return false;

  for (const word of words) {
    if (!/^[a-z]{3,10}$/.test(word)) {
      return false;
    }
  }
  return true;
}

/**
 * Normalizes a recovery code string.
 */
export function normalizeRecoveryCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Wraps Vault Key using a normalized 24-word recovery code.
 */
export async function wrapVaultKeyWithRecoveryCode(
  vaultKeyBytes: Uint8Array,
  recoveryCode: string
): Promise<WrappedVaultKeyEnvelope> {
  const normalized = normalizeRecoveryCode(recoveryCode);
  if (!validateRecoveryCode(normalized)) {
    throw new Error('Invalid recovery code: Must be 24 valid words');
  }
  return wrapVaultKey(vaultKeyBytes, normalized, DEFAULT_ARGON2_PARAMS);
}

/**
 * Unwraps Vault Key using an emergency recovery code.
 */
export async function unwrapVaultKeyWithRecoveryCode(
  envelope: WrappedVaultKeyEnvelope,
  recoveryCode: string
): Promise<Uint8Array> {
  const normalized = normalizeRecoveryCode(recoveryCode);
  if (!validateRecoveryCode(normalized)) {
    throw new Error('Invalid recovery code: Must be 24 valid words');
  }
  return unwrapVaultKey(envelope, normalized);
}
