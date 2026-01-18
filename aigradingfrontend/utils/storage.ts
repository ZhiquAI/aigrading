/**
 * Storage utility for Chrome extension
 */

export const storage = {
    /**
     * Get item from storage
     */
    async getItem(key: string): Promise<string | null> {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise((resolve) => {
                chrome.storage.local.get([key], (result: any) => {
                    resolve(result[key] || null);
                });
            });
        }
        // Fallback to localStorage for development
        return localStorage.getItem(key);
    },

    /**
     * Set item in storage
     */
    async setItem(key: string, value: string): Promise<void> {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise((resolve) => {
                chrome.storage.local.set({ [key]: value }, () => {
                    console.log(`[Storage] Saved ${key}:`, value.substring(0, 50) + '...');
                    resolve();
                });
            });
        }
        // Fallback to localStorage for development
        localStorage.setItem(key, value);
    },

    /**
     * Remove item from storage
     */
    async removeItem(key: string): Promise<void> {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise((resolve) => {
                chrome.storage.local.remove([key], () => {
                    resolve();
                });
            });
        }
        // Fallback to localStorage for development
        localStorage.removeItem(key);
    },

    /**
     * Clear all storage
     */
    async clear(): Promise<void> {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise((resolve) => {
                chrome.storage.local.clear(() => {
                    resolve();
                });
            });
        }
        // Fallback to localStorage for development
        localStorage.clear();
    }
};
