importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAVHnPVmRegwOQGTugDN7oltRqlSM-5_wA",
  authDomain: "p-726bc.firebaseapp.com",
  projectId: "p-726bc",
  storageBucket: "p-726bc.firebasestorage.app",
  messagingSenderId: "752913389065",
  appId: "1:752913389065:web:20cf8c03fe4ace03650ad8"
});

const messaging = firebase.messaging();

const DB_NAME = 'talibatBadgeDB';
const STORE_NAME = 'state';

const SUBJECT_NAMES = {
  aqida: 'ط§ظ„ط¹ظ‚ظٹط¯ط©',
  hadith: 'ط§ظ„ط­ط¯ظٹط«',
  fiqh: 'ط§ظ„ظپظ‚ظ‡',
  usul: 'ط£طµظˆظ„ ط§ظ„ظپظ‚ظ‡',
  history: 'طھط§ط±ظٹط® ط§ظ„ط®ظ„ظپط§ط، ط§ظ„ط±ط§ط´ط¯ظٹظ†',
  dawah: 'ظ…ظ†ظ‡ط¬ ط§ظ„ط¯ط¹ظˆط©',
  tajweed: 'ط£ط­ظƒط§ظ… ظˆطھط¬ظˆظٹط¯ ط§ظ„ظ‚ط±ط¢ظ†',
  literature: 'ط§ظ„ط¯ط±ط§ط³ط§طھ ط§ظ„ط£ط¯ط¨ظٹط©',
  nahw: 'ط§ظ„ظ†ط­ظˆ ظˆط§ظ„طµط±ظپ',
  computer: 'ط§ظ„ط­ط§ط³ظˆط¨',
  english: 'ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹ',
  tafsir: 'ط§ظ„طھظپط³ظٹط±'
};

function openBadgeDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(key, fallback) {
  try {
    const db = await openBadgeDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : fallback);
      req.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

async function dbSet(key, val) {
  try {
    const db = await openBadgeDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function applyAppIconBadge(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  await dbSet('unreadCount', safeCount);
  try {
    if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
      if (safeCount > 0) {
        await self.navigator.setAppBadge(safeCount);
      } else if (typeof self.navigator.clearAppBadge === 'function') {
        await self.navigator.clearAppBadge();
      }
    }
  } catch (err) {
    // Some environments reject badge calls outside installed PWA context
  }
  return safeCount;
}

async function showTopShadeNotification(title, body, url, tag) {
  try {
    await self.registration.showNotification(title, {
      body: body || 'طھظ…طھ ط¥ط¶ط§ظپط© ظ…ط­طھظˆظ‰ ط¬ط¯ظٹط¯ ظپظٹ ظ…ظ†طµط© ط·ط§ظ„ط¨ط© ط¹ظ„ظ… ط´ط±ط¹ظٹ',
      icon: './pwa-192x192.png',
      badge: './pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: tag || ('talibat-alert-' + Date.now()),
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: url || './index.html' }
    });
  } catch (e) {
    // Permission may not be granted yet
  }
}

function getFirestoreNumberField(fields, name) {
  const f = fields && fields[name];
  if (!f) return 0;
  if (f.integerValue !== undefined) return Number(f.integerValue) || 0;
  if (f.doubleValue !== undefined) return Number(f.doubleValue) || 0;
  return 0;
}

function getFirestoreStringField(fields, name) {
  const f = fields && fields[name];
  return (f && f.stringValue) ? f.stringValue : '';
}

function getDocIdFromName(docName) {
  if (!docName) return '';
  const parts = String(docName).split('/');
  return parts[parts.length - 1] || '';
}

async function syncUnreadFromFirestoreRest() {
  const seenState = await dbGet('seenState', null);
  if (!seenState) return;
  try {
    const base = 'https://firestore.googleapis.com/v1/projects/p-726bc/databases/(default)/documents';
    const [lessonsRes, postsRes] = await Promise.all([
      fetch(`${base}/lessons?pageSize=300`),
      fetch(`${base}/posts?pageSize=300`)
    ]);

    const notifiedIds = new Set(await dbGet('notifiedIds', []));
    const newlyNotified = [];
    let unread = 0;

    if (lessonsRes.ok) {
      const lessonsData = await lessonsRes.json();
      const docs = lessonsData.documents || [];
      for (const d of docs) {
        const docId = getDocIdFromName(d.name);
        const fields = d.fields || {};
        const subject = getFirestoreStringField(fields, 'subject');
        if (!subject) continue;
        const lessonTitle = getFirestoreStringField(fields, 'title') || 'ظ…ظ„ط®طµ ط¬ط¯ظٹط¯';
        const t = getFirestoreNumberField(fields, 'time') || getFirestoreNumberField(fields, 'createdAt');
        const seenTime = (seenState.subjects && seenState.subjects[subject]) || 0;
        if (t > seenTime) {
          unread++;
          const nKey = 'lesson_' + docId;
          if (docId && !notifiedIds.has(nKey)) {
            notifiedIds.add(nKey);
            newlyNotified.push({
              title: `ًں“ڑ ظ…ظ„ط®طµ ط¬ط¯ظٹط¯ ظپظٹ ${SUBJECT_NAMES[subject] || subject}`,
              body: lessonTitle,
              url: `./subject.html?id=${encodeURIComponent(subject)}`,
              tag: `talibat-lesson-${docId}`
            });
          }
        }
      }
    }

    if (postsRes.ok) {
      const postsData = await postsRes.json();
      const docs = postsData.documents || [];
      const seenPosts = seenState.posts || 0;
      for (const d of docs) {
        const docId = getDocIdFromName(d.name);
        const fields = d.fields || {};
        const postText = getFirestoreStringField(fields, 'text') || 'ظ…ظ†ط´ظˆط± ط¬ط¯ظٹط¯ ظپظٹ ط§ظ„ظ…ظ†طµط©';
        const t = getFirestoreNumberField(fields, 'time') || getFirestoreNumberField(fields, 'createdAt');
        if (t > seenPosts) {
          unread++;
          const nKey = 'post_' + docId;
          if (docId && !notifiedIds.has(nKey)) {
            notifiedIds.add(nKey);
            newlyNotified.push({
              title: 'ًں“¢ ظ…ظ†ط´ظˆط± ط¬ط¯ظٹط¯ â€” ط·ط§ظ„ط¨ط© ط¹ظ„ظ… ط´ط±ط¹ظٹ',
              body: postText.length > 110 ? postText.slice(0, 110) + '...' : postText,
              url: `./index.html?post=${encodeURIComponent(docId)}`,
              tag: `talibat-post-${docId}`
            });
          }
        }
      }
    }

    await applyAppIconBadge(unread);

    if (newlyNotified.length > 0) {
      await dbSet('notifiedIds', Array.from(notifiedIds).slice(-600));
      for (const n of newlyNotified.slice(0, 3)) {
        await showTopShadeNotification(n.title, n.body, n.url, n.tag);
      }
    }
  } catch (e) {
    // Silent fallback when offline
  }
}

messaging.onBackgroundMessage(async (payload) => {
  const current = await dbGet('unreadCount', 0);
  const explicit = payload && payload.data && payload.data.badgeCount !== undefined
    ? Number(payload.data.badgeCount)
    : null;
  const nextCount = explicit !== null && !Number.isNaN(explicit) ? explicit : (Number(current) || 0) + 1;
  await applyAppIconBadge(nextCount);

  const title = (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    'ط·ط§ظ„ط¨ط© ط¹ظ„ظ… ط´ط±ط¹ظٹ';
  const body = (payload.notification && payload.notification.body) ||
    (payload.data && payload.data.body) ||
    'طھظ…طھ ط¥ط¶ط§ظپط© ظ…ظ„ط®طµ ط£ظˆ ظ…ظ†ط´ظˆط± ط¬ط¯ظٹط¯ ظپظٹ ط§ظ„ظ…ظ†طµط©';
  const url = (payload.data && payload.data.url) || './index.html';
  const tag = (payload.data && payload.data.tag) || ('talibat-fcm-' + Date.now());

  return showTopShadeNotification(title, body, url, tag);
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = null;
  try {
    data = event.data.json();
  } catch (_) {
    return;
  }
  if (!data || data.source !== 'talibat-webpush') {
    return;
  }
  event.waitUntil((async () => {
    const current = await dbGet('unreadCount', 0);
    await applyAppIconBadge((Number(current) || 0) + 1);
    await showTopShadeNotification(
      data.title || 'ط·ط§ظ„ط¨ط© ط¹ظ„ظ… ط´ط±ط¹ظٹ',
      data.body || 'طھظ…طھ ط¥ط¶ط§ظپط© ظ…ط­طھظˆظ‰ ط¬ط¯ظٹط¯ ظپظٹ ط§ظ„ظ…ظ†طµط©',
      data.url || './index.html',
      data.tag || ('talibat-webpush-' + Date.now())
    );
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SET_APP_BADGE') {
    event.waitUntil(applyAppIconBadge(data.count));
  } else if (data.type === 'CLEAR_APP_BADGE') {
    event.waitUntil(applyAppIconBadge(0));
  } else if (data.type === 'SYNC_SEEN_STATE' && data.seenState) {
    event.waitUntil(dbSet('seenState', data.seenState));
  } else if (data.type === 'SYNC_NOTIFIED_IDS' && Array.isArray(data.ids)) {
    event.waitUntil(dbSet('notifiedIds', data.ids.slice(-600)));
  } else if (data.type === 'SHOW_SYSTEM_NOTIFICATION') {
    event.waitUntil(showTopShadeNotification(data.title, data.body, data.url, data.tag));
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'talibat-check-updates') {
    event.waitUntil(syncUnreadFromFirestoreRest());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const relUrl = (event.notification.data && event.notification.data.url) || './index.html';
  const fullUrl = new URL(relUrl, self.registration.scope).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && client.url !== fullUrl) {
            try { await client.navigate(fullUrl); } catch {}
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(fullUrl);
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
