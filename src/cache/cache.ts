export class SignatureCache {
  private cache: Set<string>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
      this.cache = new Set<string>();
      this.maxSize = maxSize;
  }

  /**
   * Add a signature to the cache
   * @param signature The signature to add
   * @returns boolean indicating if the signature was added successfully
   */
  add(signature: string): boolean {
      if (this.cache.size >= this.maxSize) {
          // Remove oldest entry if cache is full
          const firstKey = this.cache.keys().next().value;
          if (firstKey) {
              this.cache.delete(firstKey);
          }
      }
      return this.cache.add(signature).has(signature);
  }

  /**
   * Check if a signature exists in the cache
   * @param signature The signature to check
   * @returns boolean indicating if the signature exists in cache
   */
  has(signature: string): boolean {
      return this.cache.has(signature);
  }

  /**
   * Get the current size of the cache
   * @returns number of items in cache
   */
  size(): number {
      return this.cache.size;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
      this.cache.clear();
  }
}

// Create a singleton instance
export const signatureCache = new SignatureCache();
