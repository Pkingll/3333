importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({

apiKey: "AIzaSyBG_Jmj4gFcYBs8zN2wTXRLOUg7IlVkhF0",

authDomain: "talibat-ilm.firebaseapp.com",

projectId: "talibat-ilm",

storageBucket: "talibat-ilm.firebasestorage.app",

messagingSenderId: "381987453673",

appId: "1:381987453673:web:085dcae14d1cdccb2ace78"

});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload){

self.registration.showNotification(
payload.notification.title,
{
body: payload.notification.body,
icon: 'https://a.top4top.io/p_38068co2c0.jpg'
}
);

});
