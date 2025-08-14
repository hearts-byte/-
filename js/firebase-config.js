// js/firebase-config.js

// استيراد Firebase من CDN (بدون npm)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, serverTimestamp as _serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// إعدادات مشروعك من Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAEpHcagYEggX6GyhJZvUPWQFxhpo1mWNA",
  authDomain: "arab-myths-chat.firebaseapp.com",
  projectId: "arab-myths-chat",
  storageBucket: "arab-myths-chat.appspot.com",
  messagingSenderId: "1099257466472",
  appId: "1:1099257466472:web:4ce69d2001143ce121f5dd"
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// تهيئة قواعد البيانات والمصادقة
export const db = getFirestore(app);
export const serverTimestamp = _serverTimestamp;
export const auth = getAuth(app);