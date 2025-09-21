// sync_to_algolia.js (محسّن)

const admin = require('firebase-admin');
const algoliasearch = require('algoliasearch');

// 1️⃣ تهيئة Firebase Admin SDK
const serviceAccount = require('./arab-myths-chat-firebase-adminsdk-fbsvc-720286c60c.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2️⃣ تهيئة Algolia Admin Client
const ALGOLIA_APP_ID = 'BLAEWYZHN7';
const ALGOLIA_ADMIN_KEY = 'b68dd809886fd30996f86e25921f3dfd';
const ALGOLIA_INDEX_NAME = 'users';

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
const index = client.initIndex(ALGOLIA_INDEX_NAME);

// 3️⃣ دالة لجلب المستخدمين وإرسالهم إلى Algolia
async function syncUsersToAlgolia() {
  try {
    const usersSnapshot = await db.collection('users').get();
    const algoliaObjects = [];

    usersSnapshot.forEach(doc => {
      const userData = doc.data();

      // دعم الأسماء المزخرفة وتحويلها لصيغة قابلة للبحث
      const normalizedUsername = userData.username
        .normalize('NFKD') // تفكيك الحروف المزخرفة
        .replace(/[\u0300-\u036f]/g, '') // إزالة التشكيل
        .replace(/[^a-z0-9\u0621-\u064A]/gi, '') // إزالة الرموز
        .toLowerCase();

      const algoliaObject = {
        objectID: doc.id,
        name: userData.username,
        searchableUsername: normalizedUsername
      };

      algoliaObjects.push(algoliaObject);
    });

    if (algoliaObjects.length > 0) {
      await index.saveObjects(algoliaObjects);
      console.log('✅ تمت مزامنة المستخدمين بنجاح مع Algolia!');
    } else {
      console.log('⚠️ لا يوجد مستخدمين للمزامنة.');
    }

  } catch (error) {
    console.error('❌ فشل مزامنة المستخدمين:', error);
  }
}

// 4️⃣ تنفيذ المزامنة الآن
syncUsersToAlgolia();

// 5️⃣ لتشغيل تلقائي كل 5 دقائق في Termux استخدم:
// a) افتح crontab:
//    crontab -e
// b) أضف السطر التالي:
//    */5 * * * * cd /data/data/com.termux/files/home/my_chat_ap/mnshn && node sync_to_algolia.js >> sync_log.txt 2>&1
// هذا يشغّل السكربت كل 5 دقائق ويحفظ السجل في sync_log.txt