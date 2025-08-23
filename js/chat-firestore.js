// chat-firestore.js (نسخة مُحسّنة ومحدثة بالكامل)
// استخدام Firebase v9 modular، إزالة التعامل مع كلمات المرور، تعزيز الأمان والأداء

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import {
  createMessageElement,
  createSystemMessageElement,
  addWelcomeMessageToChat,
  activeQuoteData,
  hideActiveQuoteBubble,
  updatePrivateButtonNotification,
  updatePrivateChatNotification,
  currentOpenPrivateChatId
} from './chat-ui.js';
import { RANK_ORDER } from './constants.js';

// جلب غرف الدردشة
export async function getChatRooms() {
  try {
    const roomsCol = collection(db, 'rooms');
    const roomsSnapshot = await getDocs(roomsCol);
    const roomsList = roomsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return roomsList;
  } catch (error) {
    console.error("خطأ في جلب الغرف من Firestore:", error);
    throw error;
  }
}

// --- تحميل رسائل الغرفة بصفحات (Pagination) ---
export async function fetchRoomMessages(roomId, pageSize = 50, lastDoc = null) {
  const messagesCol = collection(db, 'rooms', roomId, 'messages');
  let q = query(messagesCol, orderBy('timestamp', 'desc'), limit(pageSize));
  if (lastDoc) {
    q = query(messagesCol, orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(pageSize));
  }
  const snapshot = await getDocs(q);
  // نعيد الرسائل بترتيب الأقدم أولاً (للعرض الصحيح)
  return snapshot.docs.reverse();
}

// تحميل أول صفحة رسائل
export async function loadInitialMessages(roomId, renderMessages) {
  const docs = await fetchRoomMessages(roomId, 50);
  window._messagesPagination = {
    messages: docs,
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore: docs.length === 50,
    roomId: roomId
  };
  renderMessages(docs, true);
}

// تحميل المزيد عند التمرير للأعلى
export async function loadMoreMessages(renderMessages) {
  const pagination = window._messagesPagination;
  if (!pagination || !pagination.hasMore || !pagination.lastDoc) return;
  const docs = await fetchRoomMessages(pagination.roomId, 50, pagination.lastDoc);
  if (docs.length === 0) {
    pagination.hasMore = false;
    return;
  }
  pagination.lastDoc = docs.length > 0 ? docs[docs.length - 1] : pagination.lastDoc;
  pagination.messages = docs.concat(pagination.messages);
  renderMessages(docs, false); // أضفهم للأعلى فقط
}

// الاستماع اللحظي للرسائل الجديدة فقط (بعد آخر رسالة حالية)
let unsubscribeFromMessages = null;
export function listenForNewMessages(roomId, onNewMessage) {
  if (unsubscribeFromMessages) unsubscribeFromMessages();
  const chatBox = document.querySelector('#chat-box .chat-box');
  const pagination = window._messagesPagination;
  let lastTimestamp = null;
  if (pagination && pagination.messages && pagination.messages.length > 0) {
    lastTimestamp = pagination.messages[pagination.messages.length - 1].data().timestamp;
  }
  const messagesCol = collection(db, 'rooms', roomId, 'messages');

  let messagesQuery;
  if (lastTimestamp) {
    messagesQuery = query(messagesCol, orderBy('timestamp', 'asc'), startAfter(lastTimestamp));
  } else {
    messagesQuery = query(messagesCol, orderBy('timestamp', 'asc'));
  }

  unsubscribeFromMessages = onSnapshot(messagesQuery, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const messageData = { id: change.doc.id, ...change.doc.data() };
        const usersCache = window.allUsersAndVisitorsData || [];
        const senderData = usersCache.find(u => u.id === messageData.senderId);

        if (!messageData.isSystemMessage) {
          messageData.userType = senderData?.rank === 'زائر' ? 'visitor' : 'registered';
          messageData.senderRank = senderData?.rank || 'زائر';
          messageData.level = senderData?.level || 1;
        }
        onNewMessage(messageData);
      }
    });
    // تمرير تلقائي للأسفل عند وصول رسالة جديدة
    setTimeout(() => {
      if (chatBox && chatBox.scrollHeight > chatBox.clientHeight) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }, 100);
  }, error => {
    console.error('حدث خطأ أثناء الاستماع للرسائل الجديدة:', error);
    chatBox.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">فشل تحميل الرسائل الجديدة.</div>';
  });

  return unsubscribeFromMessages;
}

// تحديث نقاط الخبرة للمستخدم
// في ملف chat-firestore.js
// متغير ثابت يمثل المستخدم النظام

export async function updateUserExperience(userId) {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    const userData = userDoc.data();
    if (userData.userType === 'registered') {
      let { level, totalExp, currentExp, expToNextLevel } = userData;
      const expGain = 10;
      currentExp = (currentExp || 0) + expGain;
      totalExp = (totalExp || 0) + expGain;
      level = level || 1;
      expToNextLevel = expToNextLevel || 200;

      if (currentExp >= expToNextLevel) {
        level++;
        currentExp = currentExp - expToNextLevel;
        expToNextLevel = 200 + (level * 100);
        console.log(`تم رفع مستوى المستخدم ${userData.username} إلى المستوى ${level}!`);

        // إضافة الإشعار باسم النظام// ...
// إضافة الإشعار باسم النظام
const notificationText = `تهانينا، لقد ارتفع مستواك إلى المستوى ${level}!`;
await addNotification(notificationText, SYSTEM_USER, userId); // إضافة userId
}

      await updateDoc(userRef, {
        level,
        totalExp,
        currentExp,
        expToNextLevel,
      });
      return { level, totalExp, currentExp, expToNextLevel };
    }
  }
  return null;
}

// إرسال رسالة عامة في الغرفة
export async function sendMessage(messageText, roomId, imageUrl = null) {
  if ((!messageText || messageText.trim() === '') && !imageUrl) {
    if (!activeQuoteData) {
      return;
    }
  }
  const currentUserId = localStorage.getItem('chatUserId');
  if (!currentUserId) {
    console.error('لا يوجد معرف مستخدم مخزن. يرجى تسجيل الدخول أولاً.');
    alert('الرجاء تسجيل الدخول لإرسال الرسائل.');
    return;
  }
 // جلب بيانات المستخدم سواء عضو أو زائر
let userData, currentUserName, currentUserAvatar, currentUserRank, currentUserLevel;
let userDoc = await getDoc(doc(db, 'users', currentUserId));

if (userDoc.exists()) {
  userData = userDoc.data();
  currentUserName = userData.username;
  currentUserAvatar = userData.avatar;
  currentUserRank = userData.rank || 'عضو';
  currentUserLevel = userData.level || 1;
  // فقط الأعضاء يحدث لهم نقاط الخبرة
  await updateUserExperience(currentUserId);
} else {
  // جرب جلب كزائر
  userDoc = await getDoc(doc(db, 'visitors', currentUserId));
  if (userDoc.exists()) {
    userData = userDoc.data();
    currentUserName = userData.name;
    currentUserAvatar = userData.avatar;
    currentUserRank = userData.rank || 'زائر';
    currentUserLevel = 1;
    // الزوار لا يحتاج تحديث نقاط الخبرة
  } else {
    console.error('المستخدم غير موجود في قاعدة البيانات.');
    alert('تعذر العثور على حسابك في قاعدة البيانات. يرجى إعادة الدخول.');
    return;
  }
}

  await updateUserExperience(currentUserId);

  const newMessage = {
    user: currentUserName,
    senderId: currentUserId,
    avatar: currentUserAvatar,
    text: messageText ? messageText.trim() : '',
    type: 'chat',
    timestamp: serverTimestamp(),
    userNum: '100',
    senderRank: currentUserRank,
    level: currentUserLevel
  };

  if (imageUrl) {
    newMessage.imageUrl = imageUrl;
  }
  if (activeQuoteData) {
    newMessage.quoted = {
      senderName: activeQuoteData.senderName,
      content: activeQuoteData.content
    };
  }
  try {
    if (messageText) {
      const allUsers = await getAllUsersAndVisitors();
      const mentionedUser = allUsers.find(user =>
        messageText.includes(user.name)
      );
      if (mentionedUser) {
        newMessage.mentionedUserId = mentionedUser.id;
        newMessage.mentionedUserName = mentionedUser.name;
      }
    }
  } catch (error) {
    console.error('خطأ في جلب بيانات المستخدمين للتحقق من المنشن:', error);
  }

  try {
    const messagesCol = collection(db, 'rooms', roomId, 'messages');
    await addDoc(messagesCol, newMessage);
    console.log('تم إرسال الرسالة بنجاح!');
    hideActiveQuoteBubble();
  } catch (e) {
    console.error('خطأ في إرسال الرسالة: ', e);
    alert('فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.');
  }
}

// إرسال رسالة نظام
export async function sendSystemMessage(text, roomId) {
  if (!roomId || !text) return;
  const messagesCollectionRef = collection(db, 'rooms', roomId, 'messages');
  const newMessage = {
    text,
    timestamp: serverTimestamp(),
    isSystemMessage: true
  };
  try {
    await addDoc(messagesCollectionRef, newMessage);
  } catch (error) {
    console.error("فشل إرسال رسالة النظام:", error);
    throw error;
  }
}

// كاش المستخدمين والزوار
let cachedUsersAndVisitors = null;
let cachedUsersTimestamp = 0;
const CACHE_DURATION = 60 * 1000;

export async function getAllUsersAndVisitors(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedUsersAndVisitors && (now - cachedUsersTimestamp < CACHE_DURATION)) {
    return cachedUsersAndVisitors;
  }
  const onlineUsers = new Map();
  const usersSnapshot = await getDocs(collection(db, 'users'));
  usersSnapshot.forEach(docSnap => {
    const userData = docSnap.data();
    onlineUsers.set(docSnap.id, {
      id: docSnap.id,
      name: userData.username,
      avatar: userData.avatar || 'https://i.imgur.com/Uo9V2Yx.png',
      innerImage: userData.innerImage || 'images/Interior.png',
      rank: userData.rank || 'عضو',
      level: userData.level || 1,
      likes: userData.likes || [],
      gender: userData.gender || 'غير محدد',
      age: userData.age || '',
      statusText: userData.statusText || '',
      bio: userData.bio || '',
      email: userData.email || ''
    });
  });
  const visitorsSnapshot = await getDocs(collection(db, 'visitors'));
  visitorsSnapshot.forEach(docSnap => {
    const visitorData = docSnap.data();
    if (!onlineUsers.has(docSnap.id)) {
      onlineUsers.set(docSnap.id, {
        id: docSnap.id,
        name: visitorData.name,
        avatar: visitorData.avatar || 'https://i.imgur.com/Uo9V2Yx.png',
        innerImage: visitorData.innerImage || 'images/Interior.png',
        rank: visitorData.rank || 'زائر',
        level: 1,
        likes: [],
        gender: visitorData.gender || 'غير محدد',
        age: visitorData.age || '',
        statusText: visitorData.statusText || '',
        bio: visitorData.bio || '',
        email: visitorData.email || ''
      });
    }
  });
  cachedUsersAndVisitors = Array.from(onlineUsers.values());
  cachedUsersTimestamp = now;
  return cachedUsersAndVisitors;
}

// جلب بيانات مستخدم/زائر
export async function getUserData(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    } else {
      const visitorRef = doc(db, 'visitors', userId);
      const visitorDoc = await getDoc(visitorRef);
      if (visitorDoc.exists()) {
        return { id: visitorDoc.id, ...visitorDoc.data() };
      }
      return null;
    }
  } catch (error) {
    console.error("خطأ في جلب بيانات المستخدم:", error);
    return null;
  }
}

// متغير ثابت يمثل المستخدم النظام


export async function updateUserData(userId, dataToUpdate) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      console.error("المستخدم غير موجود.");
      return false;
    }
    const oldUserData = userDoc.data();

    // فحص تغيير الاسم وإضافة الإشعار
    // ...
// فحص تغيير الاسم وإضافة الإشعار
if (dataToUpdate.username !== undefined && dataToUpdate.username !== oldUserData.username) {
    const notificationText = `تم تغيير اسمك من "${oldUserData.username}" إلى "${dataToUpdate.username}".`;
    // إرسال الإشعار باسم النظام
    await addNotification(notificationText, SYSTEM_USER, userId); // إضافة userId
}
// ...
// فحص تغيير الرتبة وإضافة الإشعار
if (dataToUpdate.rank !== undefined && dataToUpdate.rank !== oldUserData.rank) {
    const notificationText = `تهانينا! لقد تم ترقيتك إلى رتبة "${dataToUpdate.rank}".`;
    // إرسال الإشعار باسم النظام
    await addNotification(notificationText, SYSTEM_USER, userId); // إضافة userId
}
// ...

    await updateDoc(userRef, dataToUpdate);
    console.log("User data updated successfully:", dataToUpdate);
    // ... (بقية الكود)
    return true;
  } catch (error) {
    console.error("خطأ في تحديث بيانات المستخدم/الزائر:", error);
    return false;
  }
}

// تحديث مستوى المستخدم يدويًا (مسموح فقط للإدارة)
export async function manuallyUpdateUserLevel(userId, newLevel) {
  if (newLevel < 1) {
    console.error("المستوى الجديد يجب أن يكون أكبر من أو يساوي 1.");
    return;
  }
  const userRef = doc(db, 'users', userId);
  try {
    await updateDoc(userRef, {
      level: newLevel,
      currentExp: 0,
      expToNextLevel: 200 + (newLevel * 100)
    });
    console.log(`تم تحديث مستوى المستخدم ${userId} يدوياً إلى المستوى ${newLevel} بنجاح!`);
  } catch (error) {
    console.error("خطأ في تحديث المستوى يدوياً:", error);
  }
}

// توليد معرف المحادثة الخاصة
export function getPrivateChatId(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
}

// إرسال رسالة خاصة
export async function sendPrivateMessage(senderId, senderName, senderAvatar, receiverId, messageText, quotedData = null) {
  if (!messageText || messageText.trim() === '') {
    return;
  }
  const chatId = getPrivateChatId(senderId, receiverId);
  const privateChatRef = doc(db, 'privateChats', chatId);
  const messagesCol = collection(privateChatRef, 'messages');

  const newMessage = {
    senderId,
    senderName,
    senderAvatar,
    receiverId,
    text: messageText.trim(),
    timestamp: serverTimestamp(),
    type: 'private',
  };
  if (quotedData) {
    newMessage.quoted = quotedData;
  }
  try {
    await addDoc(messagesCol, newMessage);
    const unreadCounterField = `unreadCount_${receiverId}`;
    await setDoc(privateChatRef, {
      senderId,
      receiverId,
      lastMessageTimestamp: serverTimestamp(),
      [unreadCounterField]: increment(1)
    }, { merge: true });
    console.log(`تم إرسال رسالة خاصة في المحادثة ${chatId} بنجاح!`);
  } catch (e) {
    console.error('خطأ في إرسال الرسالة الخاصة: ', e);
    alert('فشل إرسال الرسالة الخاصة.');
  }
}

// الاستماع للرسائل الخاصة
export function setupPrivateMessagesListener(currentUserId, targetUserId, messagesBoxElement, clearPrevious = true) {
  if (clearPrevious) {
    messagesBoxElement.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">جاري تحميل الرسائل الخاصة...</div>';
  }
  const chatId = getPrivateChatId(currentUserId, targetUserId);

  if (messagesBoxElement._privateChatUnsubscribe) {
    messagesBoxElement._privateChatUnsubscribe();
    messagesBoxElement._privateChatUnsubscribe = null;
  }
  let isFirstPrivateSnapshot = true;
  const messagesCol = collection(db, 'privateChats', chatId, 'messages');
  const messagesQuery = query(messagesCol, orderBy('timestamp', 'asc'));

  const unsubscribe = onSnapshot(messagesQuery, snapshot => {
    if (isFirstPrivateSnapshot) {
      messagesBoxElement.innerHTML = '';
      if (snapshot.empty) {
        messagesBoxElement.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;"></div>';
      }
      isFirstPrivateSnapshot = false;
    }
    snapshot.docChanges().forEach(change => {
      const messageData = change.doc.data();
      const isSentByMe = messageData.senderId === currentUserId;
      messageData.id = change.doc.id;
      if (change.type === 'added') {
        const existingMessageElement = messagesBoxElement.querySelector(`.private-message-item[data-id="${messageData.id}"]`);
        if (!existingMessageElement) {
          const messageElement = document.createElement('div');
          messageElement.classList.add('private-message-item');
          messageElement.setAttribute('data-id', messageData.id);
          messageElement.classList.add(isSentByMe ? 'sent' : 'received');
          messageElement.textContent = messageData.text;
          messagesBoxElement.appendChild(messageElement);
        }
        if (!isSentByMe) {
          const senderData = {
            id: messageData.senderId,
            name: messageData.senderName,
            avatar: messageData.senderAvatar
          };
          updatePrivateChatNotification(messageData.senderId, senderData);
        }
      } else if (change.type === 'modified') {
        const existingPrivateMessage = messagesBoxElement.querySelector(`.private-message-item[data-id="${messageData.id}"]`);
        if (existingPrivateMessage) {
          existingPrivateMessage.textContent = messageData.text;
        }
      } else if (change.type === 'removed') {
        const existingPrivateMessage = messagesBoxElement.querySelector(`.private-message-item[data-id="${messageData.id}"]`);
        if (existingPrivateMessage) {
          existingPrivateMessage.remove();
        }
      }
    });

    // **هذا هو التغيير الرئيسي:**
    // قم باستدعاء الدالة مع currentUserId و targetUserId
    resetUnreadCount(currentUserId, targetUserId);

    // تأكد من وجود هذه الدالة
    updatePrivateButtonNotification();

    messagesBoxElement.scrollTop = messagesBoxElement.scrollHeight;
  }, error => {
    console.error("Error getting private messages: ", error);
    messagesBoxElement.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">فشل تحميل الرسائل الخاصة.</div>';
  });
  messagesBoxElement._privateChatUnsubscribe = unsubscribe;
}


// جلب جهات اتصال الدردشة الخاصة
export async function getPrivateChatContacts(currentUserId) {
  const contacts = new Map();
  const chatDocs = [];

  const senderQuery = query(collection(db, 'privateChats'), where('senderId', '==', currentUserId));
  const senderSnapshot = await getDocs(senderQuery);
  senderSnapshot.forEach(doc => chatDocs.push(doc));

  const receiverQuery = query(collection(db, 'privateChats'), where('receiverId', '==', currentUserId));
  const receiverSnapshot = await getDocs(receiverQuery);
  receiverSnapshot.forEach(doc => chatDocs.push(doc));

  chatDocs.forEach(docSnap => {
    const data = docSnap.data();
    const targetUserId = data.senderId === currentUserId ? data.receiverId : data.senderId;
    const unreadCount = data[`unreadCount_${currentUserId}`] || 0;
    if (targetUserId) {
      contacts.set(targetUserId, {
        id: targetUserId,
        unreadCount
      });
    }
  });

  const contactDetailsPromises = Array.from(contacts.keys()).map(async (userId) => {
    let userRef = doc(db, 'users', userId);
    let userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return { ...contacts.get(userId), name: userDoc.data().username, avatar: userDoc.data().avatar };
    } else {
      userRef = doc(db, 'visitors', userId);
      userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        return { ...contacts.get(userId), name: userDoc.data().name, avatar: userDoc.data().avatar };
      }
    }
    return null;
  });

  const detailedContacts = await Promise.all(contactDetailsPromises);
  return detailedContacts.filter(contact => contact !== null);
}

// الاستماع لإشعارات الرسائل الخاصة
export function setupPrivateMessageNotificationListener(currentUserId) {
  if (!currentUserId) {
    console.warn('Cannot set up private message notification listener: User ID is missing.');
    return;
  }
  const privateChatsCol = collection(db, 'privateChats');
  onSnapshot(privateChatsCol, snapshot => {
    let totalUnreadCount = 0;
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const unreadCount = data[`unreadCount_${currentUserId}`] || 0;
      const otherUserId = docSnap.id.replace(currentUserId, '').replace('_', '');
      if (unreadCount > 0 && currentOpenPrivateChatId !== otherUserId) {
        totalUnreadCount += unreadCount;
      }
    });
    updatePrivateButtonNotification(totalUnreadCount > 0);
  }, error => {
    console.error('Error listening to private chat updates:', error);
  });
}

// إعادة تعيين عداد الرسائل غير المقروءة
export async function resetUnreadCount(currentUserId, targetUserId) {
  const chatId = getPrivateChatId(currentUserId, targetUserId);
  const privateChatRef = doc(db, 'privateChats', chatId);
  const unreadCounterField = `unreadCount_${currentUserId}`;
  try {
    await updateDoc(privateChatRef, {
      [unreadCounterField]: 0
    });
    console.log(`تم إعادة ضبط عداد الرسائل غير المقروءة للمستخدم ${currentUserId} في المحادثة ${chatId}.`);
  } catch (error) {
    console.error('خطأ في إعادة ضبط العداد:', error);
  }
}

// إرسال رسالة انضمام للغرفة
export async function sendJoinMessage(roomId) {
  const currentUserName = localStorage.getItem('chatUserName');
  const currentUserId = localStorage.getItem('chatUserId');
  const currentUserAvatar = localStorage.getItem('chatUserAvatar');
  const currentUserRank = localStorage.getItem('chatUserRank') || 'زائر';

  if (!currentUserName || !currentUserId) {
    console.error('لا يوجد اسم مستخدم أو معرف مستخدم مخزن لإرسال رسالة الانضمام.');
    return;
  }

  const joinMessage = {
    user: currentUserName,
    senderId: currentUserId,
    avatar: currentUserAvatar,
    text: `انضم ${currentUserName} إلى الغرفة!`,
    type: 'join',
    timestamp: serverTimestamp(),
    senderRank: currentUserRank
  };

  try {
    const messagesCol = collection(db, 'rooms', roomId, 'messages');
    await addDoc(messagesCol, joinMessage);
    console.log('تم إرسال رسالة الانضمام بنجاح.');
  } catch (e) {
    console.error('خطأ في إرسال رسالة الانضمام: ', e);
  }
}

// حذف كل رسائل غرفة
export async function deleteChatRoomMessages(roomId) {
  if (!roomId) {
    console.error('خطأ: معرف الغرفة مفقود لحذف الرسائل.');
    return;
  }
  try {
    const chatRoomRef = collection(db, 'rooms', roomId, 'messages');
    const querySnapshot = await getDocs(chatRoomRef);
    if (querySnapshot.empty) {
      console.log('لا توجد رسائل لحذفها في هذه الغرفة.');
      return;
    }
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    console.log(`تم حذف جميع الرسائل من الغرفة: ${roomId}`);
  } catch (error) {
    console.error('فشل حذف رسائل الغرفة:', error);
    throw error;
  }
}

// إضافة إعجاب
export async function addLike(likerId, likedUserId) {
  if (likerId === likedUserId) {
    console.warn('لا يمكن للمستخدم الإعجاب بملفه الشخصي.');
    return false;
  }
  const userRef = doc(db, 'users', likedUserId);
  try {
    await updateDoc(userRef, {
      likes: arrayUnion(likerId)
    });
    console.log(`تم الإعجاب بملف المستخدم ${likedUserId} بنجاح.`);
    return true;
  } catch (error) {
    console.error('فشل إضافة الإعجاب:', error);
    return false;
  }
}

// إزالة إعجاب
export async function removeLike(likerId, likedUserId) {
  const userRef = doc(db, 'users', likedUserId);
  try {
    await updateDoc(userRef, {
      likes: arrayRemove(likerId)
    });
    console.log(`تم إلغاء الإعجاب بملف المستخدم ${likedUserId} بنجاح.`);
    return true;
  } catch (error) {
    console.error('فشل إلغاء الإعجاب:', error);
    return false;
  }
}

// في مكان ما في ملفك، أضف هذ// في مكان ما في ملفك، أضف هذا المتغير الثابت
// في ملف chat-firestore.js

// تأكد من وجود كلمة 'export' قبل const
export const SYSTEM_USER = {
    id: 'system',
    username: 'النظام',
    rank: 'ادمن',
    avatar: 'default_bot.png'
};

// ... (بقية الكود)

// ...

/**
 * يضيف إشعارًا جديدًا إلى مجموعة الإشعارات في Firestore.
 * @param {string} text - نص الإشعار.
 * @param {object} sender - كائن يحتوي على id و username للمرسل.
 */
export async function addNotification(text, sender, recipientId) {
    try {
        await addDoc(collection(db, 'notifications'), {
            text: text,
            timestamp: serverTimestamp(),
            senderId: sender.id,
            senderName: sender.username,
            recipientId: recipientId,
            read: false // أضف هذا السطر هنا
        });
        console.log("تم إضافة إشعار بنجاح.");
    } catch (error) {
        console.error("خطأ في إضافة الإشعار: ", error);
    }
}