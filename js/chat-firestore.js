// chat-firestore.js
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
  currentOpenPrivateChatId, updateUserRankInUI
} from './chat-ui.js';
import { RANK_ORDER } from './constants.js';

// في ملف js/chat-firestore.js
// ... (الاستيرادات)
// ...
 
// دالة المستمع التي تراقب التغييرات في Firestore
// في ملف chat-firestore.js

 
export function listenForUserRankChanges() {
    const usersCollectionRef = collection(db, "users");
    const currentUserId = localStorage.getItem('chatUserId');
 
    onSnapshot(usersCollectionRef, (querySnapshot) => {
        querySnapshot.docChanges().forEach((change) => {
            if (change.type === "modified") {
                const userData = change.doc.data();
                const userId = change.doc.id;
 
                // تحديث الكاش المحلي
                const userInCache = window.allUsersAndVisitorsData.find(u => u.id === userId);
                if (userInCache) {
                    userInCache.rank = userData.rank;
                }
 
                // ✨ هذا هو الكود الجديد الذي يجب إضافته
                // إذا كان المستخدم المحدث هو أنت، قم بتحديث الذاكرة المحلية أيضًا
                if (userId === currentUserId) {
                    localStorage.setItem('chatUserRank', userData.rank);
                    sessionStorage.setItem('chatUserRank', userData.rank);
                }
                // ✨ نهاية الكود الجديد
 
                // استدعاء دالة التحديث الشاملة
                updateUserRankInUI(userId, userData.rank);
            }
        });
    });
}
 
// ... (بقية الكود في chat-firestore.js)

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
    console.error("Error getting rooms:", error);
    throw error;
  }
}

export async function fetchRoomMessages(roomId, pageSize = 50, lastDoc = null) {
  const messagesCol = collection(db, 'rooms', roomId, 'messages');
  let q = query(messagesCol, orderBy('timestamp', 'desc'), limit(pageSize));
  if (lastDoc) {
    q = query(messagesCol, orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(pageSize));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.reverse();
}

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
  renderMessages(docs, false);
}

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
    setTimeout(() => {
      if (chatBox && chatBox.scrollHeight > chatBox.clientHeight) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }, 100);
  }, error => {
    console.error('Error listening to messages:', error);
    chatBox.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Failed to load messages.</div>';
  });

  return unsubscribeFromMessages;
}

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
        const notificationText = `رائع! لقد وصلت إلى مستوى الخبرة  ${level}!`;
        await addNotification(notificationText, SYSTEM_USER, userId);
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

export async function sendMessage(messageText, roomId, imageUrl = null) {
  if ((!messageText || messageText.trim() === '') && !imageUrl) {
    if (!activeQuoteData) {
      return;
    }
  }
  const currentUserId = localStorage.getItem('chatUserId');
  if (!currentUserId) {
    console.error('No user ID found.');
    alert('Please login to send messages.');
    return;
  }

  let userData, currentUserName, currentUserAvatar, currentUserRank, currentUserLevel;
  let userDoc = await getDoc(doc(db, 'users', currentUserId));

  if (userDoc.exists()) {
    userData = userDoc.data();
    currentUserName = userData.username;
    currentUserAvatar = userData.avatar;
    currentUserRank = userData.rank || 'عضو';
    currentUserLevel = userData.level || 1;
    await updateUserExperience(currentUserId);
  } else {
    userDoc = await getDoc(doc(db, 'visitors', currentUserId));
    if (userDoc.exists()) {
      userData = userDoc.data();
      currentUserName = userData.name;
      currentUserAvatar = userData.avatar;
      currentUserRank = userData.rank || 'زائر';
      currentUserLevel = 1;
    } else {
      console.error('User not found.');
      alert('Account not found. Please login again.');
      return;
    }
  }

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
    console.error('Error checking mentions:', error);
  }

  try {
    const messagesCol = collection(db, 'rooms', roomId, 'messages');
    await addDoc(messagesCol, newMessage);
    console.log('Message sent successfully!');
    hideActiveQuoteBubble();
  } catch (e) {
    console.error('Error sending message: ', e);
    alert('Failed to send message. Please try again.');
  }
}

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
    console.error("Failed to send system message:", error);
    throw error;
  }
}

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
    console.error("Error getting user data:", error);
    return null;
  }
}

export async function updateUserData(userId, dataToUpdate) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      console.error("User not found.");
      return false;
    }
    const oldUserData = userDoc.data();

    if (dataToUpdate.username !== undefined && dataToUpdate.username !== oldUserData.username) {
      const notificationText = `تم تغيير اسمك من "${oldUserData.username}" إلى "${dataToUpdate.username}".`;
      await addNotification(notificationText, SYSTEM_USER, userId);
    }

    if (dataToUpdate.rank !== undefined && dataToUpdate.rank !== oldUserData.rank) {
      const notificationText = `تهانينا! لقد تم ترقيتك إلى رتبة "${dataToUpdate.rank}".`;
      await addNotification(notificationText, SYSTEM_USER, userId);
    }

    await updateDoc(userRef, dataToUpdate);
    console.log("User data updated successfully:", dataToUpdate);
    return true;
  } catch (error) {
    console.error("Error updating user data:", error);
    return false;
  }
}

export async function manuallyUpdateUserLevel(userId, newLevel) {
  if (newLevel < 1) {
    console.error("Level must be at least 1.");
    return;
  }
  const userRef = doc(db, 'users', userId);
  try {
    await updateDoc(userRef, {
      level: newLevel,
      currentExp: 0,
      expToNextLevel: 200 + (newLevel * 100)
    });
    console.log(`User level updated to ${newLevel}!`);
  } catch (error) {
    console.error("Error updating level:", error);
  }
}

export function getPrivateChatId(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
}

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
    console.log(`Private message sent to ${chatId}!`);
  } catch (e) {
    console.error('Error sending private message: ', e);
    alert('Failed to send private message.');
  }
}

export function setupPrivateMessagesListener(currentUserId, targetUserId, messagesBoxElement, clearPrevious = true) {
  if (clearPrevious) {
    messagesBoxElement.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading private messages...</div>';
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

    resetUnreadCount(currentUserId, targetUserId);
    updatePrivateButtonNotification();

    messagesBoxElement.scrollTop = messagesBoxElement.scrollHeight;
  }, error => {
    console.error("Error getting private messages: ", error);
    messagesBoxElement.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Failed to load private messages.</div>';
  });
  messagesBoxElement._privateChatUnsubscribe = unsubscribe;
}

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

export async function resetUnreadCount(currentUserId, targetUserId) {
  const chatId = getPrivateChatId(currentUserId, targetUserId);
  const privateChatRef = doc(db, 'privateChats', chatId);
  const unreadCounterField = `unreadCount_${currentUserId}`;
  try {
    await updateDoc(privateChatRef, {
      [unreadCounterField]: 0
    });
    console.log(`Unread count reset for user ${currentUserId} in chat ${chatId}.`);
  } catch (error) {
    console.error('Error resetting unread count:', error);
  }
}

export async function sendJoinMessage(roomId) {
  const currentUserName = localStorage.getItem('chatUserName');
  const currentUserId = localStorage.getItem('chatUserId');
  const currentUserAvatar = localStorage.getItem('chatUserAvatar');
  const currentUserRank = localStorage.getItem('chatUserRank') || 'زائر';

  if (!currentUserName || !currentUserId) {
    console.error('No user data found for join message.');
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
    console.log('Join message sent successfully.');
  } catch (e) {
    console.error('Error sending join message: ', e);
  }
}

export async function deleteChatRoomMessages(roomId) {
  if (!roomId) {
    console.error('Room ID missing for message deletion.');
    return;
  }
  try {
    const chatRoomRef = collection(db, 'rooms', roomId, 'messages');
    const querySnapshot = await getDocs(chatRoomRef);
    if (querySnapshot.empty) {
      console.log('No messages to delete in this room.');
      return;
    }
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    console.log(`All messages deleted from room: ${roomId}`);
  } catch (error) {
    console.error('Failed to delete room messages:', error);
    throw error;
  }
}

export async function addLike(likerId, likedUserId) {
  if (likerId === likedUserId) {
    console.warn('Cannot like your own profile.');
    return false;
  }
  const userRef = doc(db, 'users', likedUserId);
  try {
    await updateDoc(userRef, {
      likes: arrayUnion(likerId)
    });
    console.log(`Liked user ${likedUserId} successfully.`);
    return true;
  } catch (error) {
    console.error('Failed to add like:', error);
    return false;
  }
}

export async function removeLike(likerId, likedUserId) {
  const userRef = doc(db, 'users', likedUserId);
  try {
    await updateDoc(userRef, {
      likes: arrayRemove(likerId)
    });
    console.log(`Unliked user ${likedUserId} successfully.`);
    return true;
  } catch (error) {
    console.error('Failed to remove like:', error);
    return false;
  }
}

export const SYSTEM_USER = {
    id: 'system',
    username: 'النظام',
    rank: 'ادمن',
    avatar: 'default_bot.png'
};

export async function addNotification(text, sender, recipientId) {
    try {
        await addDoc(collection(db, 'notifications'), {
            text: text,
            timestamp: serverTimestamp(),
            senderId: sender.id,
            senderName: sender.username,
            recipientId: recipientId,
            read: false
        });
        console.log("Notification added successfully.");
    } catch (error) {
        console.error("Error adding notification: ", error);
    }
}