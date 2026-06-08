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

messaging.onBackgroundMessage((payload) => {

  const notificationTitle =
    payload.notification?.title || "إشعار جديد";

  const notificationOptions = {
    body:
      payload.notification?.body || "",
    icon:
      payload.notification?.icon ||
      "/icon-192.png"
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );

});

// عند الضغط على الإشعار
self.addEventListener('notificationclick', function(event) {

  event.notification.close();

  event.waitUntil(
    clients.openWindow(
      'https://pkingll.github.io/3333/'
    )
  );

});
