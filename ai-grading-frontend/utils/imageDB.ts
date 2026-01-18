/**
 * IndexedDB 图片存储工具
 * 用于大容量图片缓存，避免 localStorage 配额限制
 */

const DB_NAME = 'ai_grading_assistant';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';

interface StoredImage {
    id: string;          // 唯一标识 (如 recordId)
    data: string;        // base64 数据
    mimeType: string;    // 如 'image/jpeg'
    createdAt: number;   // 创建时间戳
    size: number;        // 数据大小 (bytes)
}

let dbInstance: IDBDatabase | null = null;

/**
 * 初始化数据库连接
 */
export const initImageDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[ImageDB] 打开数据库失败:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            console.log('[ImageDB] 数据库已连接');
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // 创建图片存储
            if (!db.objectStoreNames.contains(STORE_IMAGES)) {
                const store = db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
                store.createIndex('createdAt', 'createdAt', { unique: false });
                console.log('[ImageDB] 图片存储已创建');
            }
        };
    });
};

/**
 * 保存图片
 */
export const saveImage = async (id: string, base64Data: string, mimeType: string = 'image/jpeg'): Promise<void> => {
    const db = await initImageDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_IMAGES], 'readwrite');
        const store = transaction.objectStore(STORE_IMAGES);

        const image: StoredImage = {
            id,
            data: base64Data,
            mimeType,
            createdAt: Date.now(),
            size: base64Data.length
        };

        const request = store.put(image);

        request.onsuccess = () => {
            console.log(`[ImageDB] 图片已保存: ${id} (${(base64Data.length / 1024).toFixed(1)}KB)`);
            resolve();
        };

        request.onerror = () => {
            console.error('[ImageDB] 保存图片失败:', request.error);
            reject(request.error);
        };
    });
};

/**
 * 获取图片
 */
export const getImage = async (id: string): Promise<StoredImage | null> => {
    const db = await initImageDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_IMAGES], 'readonly');
        const store = transaction.objectStore(STORE_IMAGES);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            console.error('[ImageDB] 获取图片失败:', request.error);
            reject(request.error);
        };
    });
};

/**
 * 删除图片
 */
export const deleteImage = async (id: string): Promise<void> => {
    const db = await initImageDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_IMAGES], 'readwrite');
        const store = transaction.objectStore(STORE_IMAGES);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`[ImageDB] 图片已删除: ${id}`);
            resolve();
        };

        request.onerror = () => {
            console.error('[ImageDB] 删除图片失败:', request.error);
            reject(request.error);
        };
    });
};

/**
 * 获取存储统计信息
 */
export const getStorageStats = async (): Promise<{ count: number; totalSize: number }> => {
    const db = await initImageDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_IMAGES], 'readonly');
        const store = transaction.objectStore(STORE_IMAGES);
        const request = store.getAll();

        request.onsuccess = () => {
            const images = request.result as StoredImage[];
            const totalSize = images.reduce((sum, img) => sum + img.size, 0);
            resolve({
                count: images.length,
                totalSize
            });
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

/**
 * 清理过期图片 (默认保留7天)
 */
export const cleanupOldImages = async (maxAgeDays: number = 7): Promise<number> => {
    const db = await initImageDB();
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_IMAGES], 'readwrite');
        const store = transaction.objectStore(STORE_IMAGES);
        const index = store.index('createdAt');
        const range = IDBKeyRange.upperBound(cutoffTime);

        let deletedCount = 0;
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                cursor.delete();
                deletedCount++;
                cursor.continue();
            } else {
                console.log(`[ImageDB] 已清理 ${deletedCount} 张过期图片`);
                resolve(deletedCount);
            }
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

/**
 * 清空所有图片
 */
export const clearAllImages = async (): Promise<void> => {
    const db = await initImageDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_IMAGES], 'readwrite');
        const store = transaction.objectStore(STORE_IMAGES);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('[ImageDB] 所有图片已清空');
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};
