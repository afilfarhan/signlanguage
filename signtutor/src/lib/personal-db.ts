/**
 * IndexedDB persistence for Personal Adapter models
 */

import type { PersonalModel } from './personal-adapter';

const DB_NAME = 'SignTutorPersonalDB';
const DB_VERSION = 1;
const STORE_NAME = 'personalModels';
const METADATA_STORE = 'metadata';

export interface PersonalModelMetadata {
  id: string;
  label: string;
  exampleCount: number;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Personal models store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('label', 'label', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Metadata store for quick listing
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metaStore = db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        metaStore.createIndex('label', 'label', { unique: false });
        metaStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Save personal model to IndexedDB
 */
export async function savePersonalModel(model: PersonalModel): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
    
    // Save full model
    const modelStore = transaction.objectStore(STORE_NAME);
    modelStore.put({
      id: 'personal-model-v1',
      ...model,
    });

    // Update metadata
    const metaStore = transaction.objectStore(METADATA_STORE);
    const labels = Object.keys(model.supportSet);
    const now = Date.now();
    
    for (const label of labels) {
      const exampleCount = model.supportSet[label].length;
      metaStore.put({
        id: label,
        label,
        exampleCount,
        createdAt: model.createdAt,
        updatedAt: now,
        lastUsed: now,
      });
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Load personal model from IndexedDB
 */
export async function loadPersonalModel(): Promise<PersonalModel | null> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('personal-model-v1');

    request.onsuccess = () => {
      if (request.result) {
        const { id, ...model } = request.result;
        resolve(model as PersonalModel);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * List all personal signs with metadata
 */
export async function listPersonalSigns(): Promise<PersonalModelMetadata[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readonly');
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as PersonalModelMetadata[]);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a personal sign
 */
export async function deletePersonalSign(label: string): Promise<void> {
  const db = await openDB();
  
  // Load current model, remove sign, save back
  const model = await loadPersonalModel();
  if (!model) return;

  delete model.supportSet[label];
  delete model.prototypes[label];
  model.updatedAt = Date.now();

  await savePersonalModel(model);

  // Also remove from metadata
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.delete(label);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all personal data
 */
export async function clearPersonalData(): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
    
    transaction.objectStore(STORE_NAME).clear();
    transaction.objectStore(METADATA_STORE).clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Export personal data as JSON (for backup/sharing)
 */
export async function exportPersonalData(): Promise<string> {
  const model = await loadPersonalModel();
  if (!model) return '{}';

  const metadata = await listPersonalSigns();
  
  return JSON.stringify({
    model,
    metadata,
    exportedAt: Date.now(),
    version: 1,
  }, null, 2);
}

/**
 * Import personal data from JSON
 */
export async function importPersonalData(json: string): Promise<void> {
  const data = JSON.parse(json);
  
  if (data.model) {
    await savePersonalModel(data.model);
  }
}

/**
 * Get storage usage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { usage: 0, quota: 0 };
}