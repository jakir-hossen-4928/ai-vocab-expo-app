Building an Offline-First AI Vocabulary App with Expo, Firestore, and TanStack Query
1. Problem Context
An AI vocabulary app must satisfy three non-negotiable requirements:

Fast vocabulary access, even on slow or unavailable networks

Reliable search across large vocabulary datasets

Predictable data consistency between local and cloud data

Because Firestore is a network-first, server-centric database, using it directly for every read will result in:

Poor offline behavior

Expensive reads

Slower search performance

The correct solution is an offline-first architecture, where Firestore is the source of truth, but local storage is the primary read layer.

2. High-Level Architecture
Core Principle
Firestore is used for synchronization, not for every read.

Data Flow Overview
scss
Copy code
Firestore (Cloud)
        ↓
TanStack Query (cache + sync)
        ↓
Persistent Local DB (SQLite)
        ↓
UI & Search
3. Technology Stack
Layer	Technology
UI	Expo + React Native
Data Fetching	TanStack Query
Cloud Database	Firebase Firestore
Local Storage	Expo SQLite
Search	Local indexed search
Offline Detection	expo-network

4. Why TanStack Query Is the Right Choice
TanStack Query excels at:

Cache management

Background refetching

Stale-while-revalidate

Offline persistence (with custom adapters)

However, TanStack Query is not a database. It must be paired with SQLite for durable offline storage.

5. Data Modeling Strategy
Firestore Structure (Read-Optimized)
markdown
Copy code
vocabularies/
  └── docId
      ├── english
      ├── bangla
      ├── pronunciation
      ├── partOfSpeech
      ├── examples
      ├── updatedAt (serverTimestamp)
      ....more have
SQLite Schema (Offline-Optimized)
sql
Copy code
CREATE TABLE vocabularies (
  id TEXT PRIMARY KEY,
  english TEXT,
  bangla TEXT,
  pronunciation TEXT,
  partOfSpeech TEXT,
  examples TEXT,
  updatedAt INTEGER
);

CREATE INDEX idx_vocab_english ON vocabularies(english);
CREATE INDEX idx_vocab_bangla ON vocabularies(bangla);
6. Offline-First Fetch Strategy
Step 1: Always Read from SQLite First
UI never waits for Firestore.

ts
Copy code
function getLocalVocabularies() {
  return db.getAllAsync('SELECT * FROM vocabularies');
}
Step 2: Background Sync from Firestore
Firestore is used only to sync changes.

ts
Copy code
function fetchRemoteVocabularies(lastSync: number) {
  const q = query(
    collection(db, 'vocabularies'),
    where('updatedAt', '>', lastSync)
  );
  return getDocs(q);
}
Step 3: Merge & Persist
ts
Copy code
function upsertVocabularies(vocabs) {
  db.withTransactionAsync(() => {
    vocabs.forEach(v => {
      db.runAsync(`
        INSERT OR REPLACE INTO vocabularies VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [...]);
    });
  });
}
7. TanStack Query Integration
TanStack Query controls sync state, not storage.

ts
Copy code
useQuery({
  queryKey: ['vocab-sync'],
  queryFn: syncVocabularies,
  staleTime: Infinity,
  cacheTime: Infinity,
});
Why staleTime: Infinity
Prevents unnecessary refetches

Sync happens explicitly

8. Search Architecture (Critical)
❌ Do NOT search Firestore
Slow

Expensive

Requires network

✅ Search SQLite Locally
ts
Copy code
function searchVocabulary(keyword: string) {
  return db.getAllAsync(`
    SELECT * FROM vocabularies
    WHERE english LIKE ? OR bangla LIKE ?
    ORDER BY english ASC
  `, [`%${keyword}%`, `%${keyword}%`]);
}
Optional enhancements:

Prefix search

Full-text search (FTS5)

Phonetic matching

9. Handling Network State
ts
Copy code
import * as Network from 'expo-network';

const isOnline = (await Network.getNetworkStateAsync()).isConnected;
Behavior:

Offline → use SQLite only

Online → sync in background

10. Initial App Launch Strategy
Scenario	Behavior
First launch	Download batch → save to SQLite
Subsequent launches	Load from SQLite instantly
Online	Background delta sync
Offline	Fully functional