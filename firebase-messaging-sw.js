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

// استقبال الإشعار بالخلفية
messaging.onBackgroundMessage(function(payload) {

  console.log("رسالة بالخلفية:", payload);

  const notificationTitle =
    payload.notification?.title || "إشعار جديد";

  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url:
        payload.data?.url ||
        "https://talibat-ilm.web.app/"
    }
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );

});

// الضغط على الإشعار
self.addEventListener('notificationclick', function(event) {

  event.notification.close();

  const urlToOpen =
    event.notification.data.url;

  event.waitUntil(

    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {

      // إذا الموقع مفتوح
      for (let i = 0; i < clientList.length; i++) {

        let client = clientList[i];

        if (client.url.includes(urlToOpen) &&
            'focus' in client) {

          return client.focus();
        }
      }

      // فتح الموقع
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }

    })

  );

});
