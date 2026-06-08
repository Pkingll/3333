importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBG_Jmj4gFcYBs8zN2wTXRLOUg7IlVkhF0",
  authDomain: "talibat-ilm.firebaseapp.com",
  projectId: "talibat-ilm",
  storageBucket: "talibat-ilm.firebasestorage.app",
  messagingSenderId: "381987453673",
  appId: "1:381987453673:web:085dcae14d1cdccb2ace78",
  measurementId: "G-SPG9FR05WV"
});

const messaging = firebase.messaging();

// استقبال الإشعارات بالخلفية
messaging.onBackgroundMessage((payload) => {

  const notificationTitle =
    payload.notification?.title || "إشعار جديد";

  const notificationOptions = {

    body:
      payload.notification?.body || "",

    // أيقونة الإشعار
    icon:
      "https://pkingll.github.io/3333/icon-192.png",

    // الشعار الصغير
    badge:
      "https://pkingll.github.io/3333/icon-192.png",

    // صورة كبيرة داخل الإشعار
    image:
      payload.notification?.image ||
      "https://pkingll.github.io/3333/icon-512.png",

    vibrate: [200, 100, 200],

    requireInteraction: true,

    data: {
      url:
        "https://pkingll.github.io/3333/"
    }

  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );

});

// عند الضغط على الإشعار
self.addEventListener('notificationclick', function(event) {

  event.notification.close();

  const urlToOpen =
    event.notification.data.url;

  event.waitUntil(

    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {

      // إذا الموقع مفتوح يركز عليه
      for (const client of clientList) {

        if (client.url.includes(urlToOpen) &&
            'focus' in client) {

          return client.focus();
        }
      }

      // إذا مغلق يفتحه
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }

    })

  );

});
