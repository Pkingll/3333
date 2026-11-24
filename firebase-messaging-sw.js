const DB_NAME = 'talibatBadgeDB';
const STORE_NAME = 'state';

const SUBJECT_NAMES = {
  aqida: 'العقيدة',
  hadith: 'الحديث',
  fiqh: 'الفقه',
  usul: 'أصول الفقه',
  history: 'تاريخ الخلفاء الراشدين',
  dawah: 'منهج الدعوة',
  tajweed: 'أحكام وتجويد القرآن',
  literature: 'الدراسات الأدبية',
  nahw: 'النحو والصرف',
  computer: 'الحاسوب',
  english: 'الإنجليزي',
  tafsir: 'التفسير'
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

async function showTopShadeNotification(title, body, url, tag, image) {
  try {
    const opts = {
      body: body || '',
      icon: './pwa-192x192.png',
      badge: './pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: tag || ('talibat-alert-' + Date.now()),
      renotify: false,
      vibrate: [200, 100, 200],
      data: { url: url || './index.html' }
    };
    if (image) {
      opts.image = image;
    }
    await self.registration.showNotification(title || 'طالبة علم شرعي', opts);
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
        const lessonTitle = getFirestoreStringField(fields, 'title') || 'ملخص جديد';
        const t = getFirestoreNumberField(fields, 'time') || getFirestoreNumberField(fields, 'createdAt');
        const seenTime = (seenState.subjects && seenState.subjects[subject]) || 0;
        if (t > seenTime) {
          unread++;
          const nKey = 'lesson_' + docId;
          if (docId && !notifiedIds.has(nKey)) {
            notifiedIds.add(nKey);
            newlyNotified.push({
              title: `📚 ملخص جديد في ${SUBJECT_NAMES[subject] || subject}`,
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
        const postText = getFirestoreStringField(fields, 'text') || 'منشور جديد في المنصة';
        const postImage = getFirestoreStringField(fields, 'image') || '';
        const t = getFirestoreNumberField(fields, 'time') || getFirestoreNumberField(fields, 'createdAt');
        if (t > seenPosts) {
          unread++;
          const nKey = 'post_' + docId;
          if (docId && !notifiedIds.has(nKey)) {
            notifiedIds.add(nKey);
            newlyNotified.push({
              title: '📢 منشور جديد — طالبة علم شرعي',
              body: postText.length > 110 ? postText.slice(0, 110) + '...' : postText,
              image: postImage,
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
        await showTopShadeNotification(n.title, n.body, n.url, n.tag, n.image);
      }
    }
  } catch (e) {
    // Silent fallback when offline
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = null;
  try {
    data = event.data.json();
  } catch (_) {
    try {
      data = { title: 'طالبة علم شرعي', body: event.data.text() };
    } catch (__) {
      return;
    }
  }
  if (!data) return;

  const title = data.title || (data.notification && data.notification.title) || (data.data && data.data.title) || 'طالبة علم شرعي';
  const body = data.body || (data.notification && data.notification.body) || (data.data && data.data.body) || '';
  const image = data.image || (data.notification && data.notification.image) || (data.data && data.data.image) || '';
  const url = data.url || (data.data && data.data.url) || './index.html';
  const tag = data.tag || (data.data && data.data.tag) || ('talibat-webpush-' + Date.now());

  event.waitUntil((async () => {
    const current = await dbGet('unreadCount', 0);
    await applyAppIconBadge((Number(current) || 0) + 1);
    await showTopShadeNotification(title, body, url, tag, image);
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
    event.waitUntil(showTopShadeNotification(data.title, data.body, data.url, data.tag, data.image));
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
