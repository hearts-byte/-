import { getPrivateChatId, sendPrivateMessage, setupPrivateMessagesListener } from './chat-firestore.js';
import { db, serverTimestamp, auth } from './firebase-config.js';
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { RANK_IMAGE_MAP, RANK_PERMISSIONS } from './constants.js';
import { showCommandsModal } from './chat-commands-modal.js';

// في ملف js/chat-ui.js
// ... (الاستيرادات)
 
// دالة شاملة لتحديث رتبة المستخدم في كل مكان بالواجهة
export function updateUserRankInUI(userId, newRank) {
    // 1. تحديث الرسائل الموجودة في الدردشة
    const userMessages = document.querySelectorAll(`.message-item[data-sender-id="${userId}"]`);
    userMessages.forEach(messageElement => {
        const rankImage = messageElement.querySelector('.rank-icon');
        if (rankImage) {
            rankImage.src = RANK_IMAGE_MAP[newRank] || 'images/default-rank.png';
            rankImage.alt = newRank;
        }
    });
 
    // 2. تحديث قائمة المتصلين
    const onlineUserItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (onlineUserItem) {
        const rankImage = onlineUserItem.querySelector('.user-rank-image-small');
        if (rankImage) {
            rankImage.src = RANK_IMAGE_MAP[newRank] || 'images/default-rank.png';
            rankImage.alt = newRank;
        }
    }
 
    // 3. تحديث المودال إذا كان مفتوحًا
    if (window.userInfoModal && window.userInfoModal.dataset.userId === userId) {
        const rankImage = window.userInfoModal.querySelector('.user-rank-image-modal');
        if (rankImage) {
            rankImage.src = RANK_IMAGE_MAP[newRank] || 'images/default-rank.png';
            rankImage.alt = newRank;
        }
    }
}
 
// ... (بقية الكود في chat-ui.js)

export async function loadComponent(id, file) {
  const res = await fetch(file);
  const html = await res.text();
  document.getElementById(id).innerHTML = html;
}

let currentOpenMenu = null;
let minimizedPrivateChat = null;
export let activeQuoteData = null;
export let currentOpenPrivateChatId = null;

function displayActiveQuoteBubble(senderName, content) {
  const chatContainer = document.querySelector('.chat-container');
  let quoteBubble = document.querySelector('.active-quote-bubble');

  if (!quoteBubble) {
    quoteBubble = document.createElement('div');
    quoteBubble.classList.add('active-quote-bubble');
    quoteBubble.innerHTML = `
      <div class="quote-content-wrapper">
        <div class="quote-sender-name"></div>
        <div class="quote-text-preview"></div>
      </div>
      <button class="close-quote-btn">&times;</button>
    `;
    chatContainer.appendChild(quoteBubble);

    quoteBubble.querySelector('.close-quote-btn').addEventListener('click', () => {
      hideActiveQuoteBubble();
    });
  }

  quoteBubble.querySelector('.quote-sender-name').textContent = senderName;
  quoteBubble.querySelector('.quote-text-preview').textContent = content.split('\n')[0].substring(0, 50) + (content.length > 50 ? '...' : '');

  quoteBubble.style.display = 'flex';
}

export function hideActiveQuoteBubble() {
  const quoteBubble = document.querySelector('.active-quote-bubble');
  if (quoteBubble) {
    quoteBubble.style.display = 'none';
  }
  activeQuoteData = null;
}

window.userInfoModal = null;

export function createUserInfoModal(targetElement, userData, allUsersAndVisitorsData) {
  if (userInfoModal) {
    userInfoModal.remove();
    userInfoModal = null;
  }

  const currentUserId = localStorage.getItem('chatUserId');
  const isCurrentUser = (userData.id === currentUserId);

  let isTargetUserVisitor = false;
  const targetUserDataFull = allUsersAndVisitorsData.find(user => user.id === userData.id);
  if (targetUserDataFull && targetUserDataFull.rank === 'زائر') {
    isTargetUserVisitor = true;
  }

  let viewerIsVisitor = false;
  if (currentUserId) {
    const viewerData = allUsersAndVisitorsData.find(user => user.id === currentUserId);
    if (viewerData && viewerData.rank === 'زائر') {
      viewerIsVisitor = true;
    }
  } else {
    viewerIsVisitor = true;
  }

 userInfoModal = document.createElement('div');
userInfoModal.classList.add('user-info-modal');
userInfoModal.innerHTML = `
<div class="modal-content">
  <span class="close-button">&times;</span>
  <div class="user-profile-header">
    <img src="${userData.innerImage || 'images/Interior.png'}" alt="صورة الخلفية" class="profile-header-image">
  </div>
  <img src="${userData.avatar || 'images/default-user.png'}" alt="${userData.name}" class="user-avatar-large">
  <div class="user-info-group"> ${userData.rank ? `<p class="user-rank-info"> <img src="${RANK_IMAGE_MAP[userData.rank] || 'images/default-rank.png'}" alt="${userData.rank}" class="user-rank-image-modal" title="${userData.rank}"/></p>` : ''}
    <div class="user-name-display">${userData.name}</div>
    <div class="modal-buttons">
      <button class="modal-button view-profile">عرض الملف الشخصي</button>
      <button class="modal-button start-private">بدء خاص</button>
      <button class="modal-button commands-btn">الأوامر</button>
    </div>
  </div>
</div>
`;



// ... (داخل دالة createUserInfoModal)

// تحديد هوية المستخدم الحالي

// ... (بقية الكود)

const commandsButton = userInfoModal.querySelector('.modal-button.commands-btn');
if (commandsButton) {
  // ✨ هذا هو الشرط الجديد
  if (isCurrentUser) {
    commandsButton.style.display = 'none';
  } else {
    // إذا لم يكن المستخدم هو صاحب الحساب، نضيف له معالج النقر
    commandsButton.addEventListener('click', (event) => {
      event.stopPropagation();
      hideUserInfoModal();
      showCommandsModal(userData);
    });
  }
}

  userInfoModal.querySelector('.user-name-display').textContent = userData.name;

  document.body.appendChild(userInfoModal);

  if (targetElement) {
    const targetRect = targetElement.getBoundingClientRect();
    const modalWidth = userInfoModal.offsetWidth;
    const modalHeight = userInfoModal.offsetHeight;
    const padding = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let modalLeft = targetRect.left;
    let modalTop = targetRect.bottom + padding;
    if (modalLeft + modalWidth > viewportWidth - padding) {
      modalLeft = viewportWidth - modalWidth - padding;
    }
    if (modalLeft < padding) {
      modalLeft = padding;
    }
    if (modalTop + modalHeight > viewportHeight - padding) {
      modalTop = targetRect.top - modalHeight - padding;
      if (modalTop < padding) {
        modalTop = padding;
      }
    }
    userInfoModal.style.left = `${modalLeft}px`;
    userInfoModal.style.top = `${modalTop}px`;
    userInfoModal.style.transform = 'none';
  } else {
    userInfoModal.style.left = '50%';
    userInfoModal.style.top = '50%';
    userInfoModal.style.transform = 'translate(-50%, -50%)';
  }

  userInfoModal.style.visibility = 'visible';
  userInfoModal.classList.add('show');

  document.addEventListener('click', handleUserInfoModalOutsideClick);

  userInfoModal.querySelector('.close-button').addEventListener('click', (event) => {
    event.stopPropagation();
    hideUserInfoModal();
  });

  userInfoModal.querySelector('.modal-button.view-profile').addEventListener('click', (event) => {
    event.stopPropagation();
    hideUserInfoModal();
    window.showViewProfileModal(userData, window.allUsersAndVisitorsData);
  });

  const startPrivateButton = userInfoModal.querySelector('.modal-button.start-private');
  if (startPrivateButton) {
    if (isCurrentUser || viewerIsVisitor || isTargetUserVisitor) {
      startPrivateButton.style.display = 'none';
    } else {
      startPrivateButton.style.display = 'block';
      startPrivateButton.addEventListener('click', (event) => {
        event.stopPropagation();
        createAndShowPrivateChatDialog(userData);
        hideUserInfoModal();
      });
    }
  }
}

function handleUserInfoModalOutsideClick(event) {
  const isClickedInsideModal = window.userInfoModal && window.userInfoModal.contains(event.target);
  const isClickedOnMessageUserElement = event.target.closest('.chat-message .user-avatar') || event.target.closest('.chat-message .message-name');
  const isClickedOnOnlineUserAvatar = event.target.closest('.user-item .user-avatar-small');
  if (window.userInfoModal && !isClickedInsideModal && !isClickedOnMessageUserElement && !isClickedOnOnlineUserAvatar) {
    hideUserInfoModal();
  }
}

export function hideUserInfoModal() {
  if (window.userInfoModal) {
    const modalToClose = window.userInfoModal;
    modalToClose.classList.remove('show');
    const handler = function() {
      if (!modalToClose.classList.contains('show')) {
        modalToClose.remove();
        document.removeEventListener('click', handleUserInfoModalOutsideClick);
        modalToClose.removeEventListener('transitionend', handler);
      }
    };
    modalToClose.addEventListener('transitionend', handler, { once: true });
    window.userInfoModal = null;
  }
}

export function hideAllModals() {
  hideUserInfoModal();
}

let privateChatDialog = null;

export const privateChatDialogHTML = `
<div class="private-chat-header">
  <div class="private-user-info"><img src="images/default-user.png" alt="" class="private-chat-avatar">
    <span class="private-chat-username"></span>
  </div>
  <div class="header-buttons">
    <button class="minimize-private-chat-btn" title="تصغير">_</button>
    <button class="close-private-chat-btn" title="إغلاق">&times;</button>
  </div>
</div>
<div class="private-chat-messages"></div>
<div class="private-chat-input-area">
  <input type="text" class="private-chat-input" placeholder="اكتب رسالتك...">
  <button class="private-chat-send-btn">
    <i class="fas fa-paper-plane"></i>
  </button>
</div>
`;

function minimizePrivateChatDialog(targetUserData) {
  if (privateChatDialog) {
    privateChatDialog.style.display = 'none';
    minimizedPrivateChat = targetUserData;
    showMinimizedChatAvatar(targetUserData);
  }
}

function showMinimizedChatAvatar(userData, showNotification = false) {
  const bottomBar = document.querySelector('.bottom-bar');
  if (!bottomBar) return;
  let minimizedAvatar = document.querySelector(`.minimized-chat-avatar[data-user-id="${userData.id}"]`);
  if (!minimizedAvatar) {
    minimizedAvatar = document.createElement('div');
    minimizedAvatar.classList.add('minimized-chat-avatar');
    minimizedAvatar.setAttribute('data-user-id', userData.id);
    minimizedAvatar.title = `محادثة مع ${userData.name}`;
    minimizedAvatar.innerHTML = `<img src="${userData.avatar}" alt="${userData.name}">`;
    minimizedAvatar.addEventListener('click', () => {
      restorePrivateChatDialog(userData);
    });
    bottomBar.appendChild(minimizedAvatar);
  }
  if (showNotification) {
    minimizedAvatar.classList.add('has-new-messages');
  } else {
    minimizedAvatar.classList.remove('has-new-messages');
  }
}

function restorePrivateChatDialog(userData) {
  if (privateChatDialog) {
    privateChatDialog.style.display = 'flex';
    minimizedPrivateChat = null;
    hideMinimizedChatAvatar(userData.id);
    const minimizedAvatar = document.querySelector(`.minimized-chat-avatar[data-user-id="${userData.id}"]`);
    if (minimizedAvatar) {
      minimizedAvatar.classList.remove('has-new-messages');
    }
  }
}

function hideMinimizedChatAvatar(userId) {
  const minimizedAvatar = document.querySelector(`.minimized-chat-avatar[data-user-id="${userId}"]`);
  if (minimizedAvatar) {
    minimizedAvatar.remove();
  }
}

export async function createAndShowPrivateChatDialog(targetUserData) {
  const existingDialog = document.getElementById('privateChatDialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
  if (minimizedPrivateChat && minimizedPrivateChat.id === targetUserData.id) {
    restorePrivateChatDialog(targetUserData);
    return;
  }
  currentOpenPrivateChatId = targetUserData.id;
  updatePrivateButtonNotification(false);
  const minimizedAvatar = document.querySelector(`.minimized-chat-avatar[data-user-id="${targetUserData.id}"]`);
  if (minimizedAvatar) {
    minimizedAvatar.classList.remove('has-new-messages');
  }
  if (privateChatDialog) {
    hidePrivateChatDialog();
  }
  privateChatDialog = document.createElement('div');
  privateChatDialog.classList.add('private-chat-dialog');
  privateChatDialog.id = 'privateChatDialog';
  document.body.appendChild(privateChatDialog);
  privateChatDialog.innerHTML = privateChatDialogHTML;
  setTimeout(() => {
    privateChatDialog.classList.add('show');
  }, 10);

  const avatarElement = privateChatDialog.querySelector('.private-chat-avatar');
  const usernameElement = privateChatDialog.querySelector('.private-chat-username');
  const privateChatMessagesBox = privateChatDialog.querySelector('.private-chat-messages');

  if (avatarElement) avatarElement.src = targetUserData.avatar;
  if (usernameElement) usernameElement.textContent = targetUserData.name;

  privateChatDialog.querySelector('.close-private-chat-btn').addEventListener('click', () => {
    hidePrivateChatDialog();
  });
  privateChatDialog.querySelector('.minimize-private-chat-btn').addEventListener('click', () => {
    minimizePrivateChatDialog(targetUserData);
  });

  const privateChatInput = privateChatDialog.querySelector('.private-chat-input');
  const privateChatSendBtn = privateChatDialog.querySelector('.private-chat-send-btn');

  const currentUserId = localStorage.getItem('chatUserId');
  if (currentUserId) {
    await 
    setupPrivateMessagesListener(currentUserId, targetUserData.id, privateChatMessagesBox, true);
  } else {
    console.error('معرف المستخدم الحالي غير موجود لفتح الدردشة الخاصة.');
    privateChatMessagesBox.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">الرجاء تسجيل الدخول لبدء محادثة خاصة.</div>';
    return;
  }

  if (privateChatSendBtn && privateChatInput && privateChatMessagesBox) {
    privateChatSendBtn.addEventListener('click', async () => {
      const messageText = privateChatInput.value.trim();
      if (messageText) {
        privateChatSendBtn.disabled = true;
        privateChatInput.disabled = true;
        try {
          const senderId = localStorage.getItem('chatUserId');
          const senderName = localStorage.getItem('chatUserName');
          const senderAvatar = localStorage.getItem('chatUserAvatar');
          await sendPrivateMessage(senderId, senderName, senderAvatar, targetUserData.id, messageText);
          privateChatInput.value = '';
        } finally {
          privateChatSendBtn.disabled = false;
          privateChatInput.disabled = false;
        }
      }
    });
    privateChatInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        privateChatSendBtn.click();
      }
    });
  } else {
    console.error("Failed to find private chat input elements. Check private chat dialog HTML structure.");
  }
  hideUserInfoModal();
}

export function hidePrivateChatDialog() {
  if (privateChatDialog) {
    privateChatDialog.classList.remove('show');
    const messagesBoxElement = privateChatDialog.querySelector('.private-chat-messages');
    if (messagesBoxElement && messagesBoxElement._privateChatUnsubscribe) {
      messagesBoxElement._privateChatUnsubscribe();
      messagesBoxElement._privateChatUnsubscribe = null;
    }
    privateChatDialog.addEventListener('transitionend', () => {
      if (privateChatDialog) {
        privateChatDialog.remove();
        privateChatDialog = null;
        minimizedPrivateChat = null;
        currentOpenPrivateChatId = null;
      }
    }, { once: true });
  }
}

function mentionUserInInput(userName) {
  const chatInput = document.querySelector('#input-bar input');
  if (chatInput) {
    chatInput.value += `${userName} `;
    chatInput.focus();
  }
}

export function createMessageElement(messageData) {
  const messageItem = document.createElement('div');
  messageItem.classList.add('message-item');
  messageItem.setAttribute('data-id', messageData.id);

  const currentUserId = localStorage.getItem('chatUserId');
  const currentUserName = localStorage.getItem('chatUserName');

  let customMessageClass = '';
  if (messageData.type === 'join') {
    messageData.text = `انضم ${messageData.user} إلى الغرفة!`;
    customMessageClass = 'join-message-text';
  }

  let userNameClass = '';
  let avatarGradientClass = '';
  switch (messageData.avatarColor) {
    case 'red': userNameClass = 'name-red'; avatarGradientClass = 'gradient-pink'; break;
    case 'blue': userNameClass = 'name-blue'; avatarGradientClass = 'gradient-purple'; break;
    case 'green': userNameClass = 'name-green'; avatarGradientClass = 'gradient-green'; break;
    case 'gold': userNameClass = 'name-gold'; avatarGradientClass = 'gradient-gold'; break;
    default: userNameClass = ''; avatarGradientClass = 'gradient-purple';
  }

  let profileImageSrc = '';
  if (messageData.avatar) {
    profileImageSrc = messageData.avatar;
  } else if (messageData.userType === 'visitor') {
    profileImageSrc = 'images/default-visitor.png';
  } else {
    profileImageSrc = 'images/default-user.png';
  }

  const starHtml = messageData.hasStar ? '<span class="star-icon">⭐</span>' : '';
  const badgeHtml = messageData.badge ? `<span class="message-badge">${messageData.badge}</span>` : '';

  let rankImageHtml = '';
  const rankImagePath = RANK_IMAGE_MAP[messageData.senderRank];
  if (rankImagePath) {
    rankImageHtml = `<img src="${rankImagePath}" alt="${messageData.senderRank}" class="rank-icon">`;
  }

  const messageInfoDiv = document.createElement('div');
  messageInfoDiv.classList.add('message-info');
  let messageContentHtml = '';
  if (messageData.imageUrl) {
    messageContentHtml += `
      <div class="message-image-container">
        <img src="${messageData.imageUrl}" alt="صورة مرفقة" class="chat-image" onclick="window.showImageInModal('${messageData.imageUrl}')" />
      </div>
    `;
  }
  let messageTextContent = '';
  if (messageData.quoted && messageData.quoted.senderName && messageData.quoted.content) {
    messageTextContent += `
      <div class="quoted-message">
        <div class="quoted-sender-name">${messageData.quoted.senderName}</div>
        <div class="quoted-content">${messageData.quoted.content}</div>
      </div>
    `;
  }
  if (messageData.text) {
    const isMentioned =
      (messageData.mentionedUserId && messageData.mentionedUserId === currentUserId) ||
      (messageData.mentionedUserName && messageData.mentionedUserName === currentUserName);

    if (isMentioned && messageData.user !== currentUserName) {
      const regex = new RegExp(currentUserName, 'gi');
      messageTextContent += messageData.text.replace(regex, `<span class="mentioned-user">${currentUserName}</span>`);
    } else {
      messageTextContent += messageData.text;
    }
  }
  if (messageTextContent.length > 0) {
    messageContentHtml += `<div class="message-text ${customMessageClass}">${messageTextContent}</div>`;
  }

  const userLevel = messageData.level || 1;
  let levelColorClass = '';
  if (userLevel >= 50) {
    levelColorClass = 'level-50';
  } else if (userLevel >= 40) {
    levelColorClass = 'level-40';
  } else if (userLevel >= 30) {
    levelColorClass = 'level-30';
  } else if (userLevel >= 20) {
    levelColorClass = 'level-20';
  } else if (userLevel >= 10) {
    levelColorClass = 'level-10';
  } else if (userLevel >= 5) {
    levelColorClass = 'level-5';
  }

  messageItem.innerHTML = `
    <div class="user-avatar ${avatarGradientClass}"
      data-user-id="${messageData.senderId}"
      data-user-name="${messageData.user}"
      data-user-avatar="${profileImageSrc}">
      <img src="${profileImageSrc}" alt="صورة الملف الشخصي" class="profile-image" />
      ${userLevel > 0 ? `<div class="level-badge ${levelColorClass}">${userLevel}</div>` : ''}
    </div>
    <div class="message-info">
      <div class="message-header">
        <div class="message-name ${userNameClass}" 
          data-user-name="${messageData.user}">${rankImageHtml}<strong>${messageData.user}</strong> ${starHtml}
        </div>
      </div>
      ${messageContentHtml}
      ${badgeHtml}
    </div>
    <div class="dots-options">
      <span class="dots">&#8226;&#8226;&#8226;</span>
      <div class="message-options-menu">
        <div class="option-item" data-action="quote">اقتباس</div>
        <div class="option-item" data-action="report">إبلاغ</div>
      </div>
    </div>
  `;

  const messageNameDiv = messageItem.querySelector('.message-header .message-name');
  if (messageNameDiv) {
    messageNameDiv.addEventListener('click', (event) => {
      event.stopPropagation();
      const userName = messageNameDiv.dataset.userName;
      mentionUserInInput(userName);
    });
  }

  const userAvatarDiv = messageItem.querySelector('.user-avatar');
if (userAvatarDiv) {
  userAvatarDiv.addEventListener('click', (event) => {
    event.stopPropagation();
    const userId = userAvatarDiv.dataset.userId;

    // ✨ ابحث عن الكائن الكامل للمستخدم في ذاكرة التخزين المؤقت.
    const fullUserData = window.allUsersAndVisitorsData.find(user => user.id === userId);

    if (fullUserData) {
      // إذا تم العثور على المستخدم في الذاكرة المؤقتة، استخدم بياناته الكاملة.
      createUserInfoModal(userAvatarDiv, fullUserData, window.allUsersAndVisitorsData);
    } else {
      // إذا لم يتم العثور عليه (لسبب ما)، عد إلى البيانات الأساسية.
      const partialUserData = {
        id: userId,
        name: userAvatarDiv.dataset.userName,
        avatar: userAvatarDiv.dataset.userAvatar
      };
      createUserInfoModal(userAvatarDiv, partialUserData, window.allUsersAndVisitorsData);
    }
  });
}

  const dotsOptionsDiv = messageItem.querySelector('.dots-options');
  if (dotsOptionsDiv) {
    dotsOptionsDiv.addEventListener('click', (event) => {
      event.stopPropagation();
      const menu = dotsOptionsDiv.querySelector('.message-options-menu');
      if (currentOpenMenu && currentOpenMenu !== menu) {
        currentOpenMenu.classList.remove('show-options');
      }
      menu.classList.toggle('show-options');
      if (menu.classList.contains('show-options')) {
        currentOpenMenu = menu;
      } else {
        currentOpenMenu = null;
      }
      if (currentOpenMenu) {
        document.addEventListener('click', function closeMenuOnOutsideClick(e) {
          if (!dotsOptionsDiv.contains(e.target) && !menu.contains(e.target) && currentOpenMenu && currentOpenMenu.classList.contains('show-options')) {
            currentOpenMenu.classList.remove('show-options');
            currentOpenMenu = null;
            document.removeEventListener('click', closeMenuOnOutsideClick);
          } else if (!currentOpenMenu || !currentOpenMenu.classList.contains('show-options')) {
            document.removeEventListener('click', closeMenuOnOutsideClick);
          }
        });
      }
    });

    const optionItems = dotsOptionsDiv.querySelectorAll('.option-item');
    optionItems.forEach(item => {
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        const action = event.target.dataset.action;
        const originalMessageText = messageData.text;
        const senderName = messageData.user;
        const messageId = messageData.id;
        if (action === 'quote') {
          activeQuoteData = {
            id: messageId,
            senderName: senderName,
            content: originalMessageText
          };
          displayActiveQuoteBubble(senderName, originalMessageText);
          document.querySelector('#input-bar input').focus();
        } else if (action === 'report') {
          alert(`سيتم الإبلاغ عن الرسالة: "${originalMessageText}"`);
        }
        const menu = dotsOptionsDiv.querySelector('.message-options-menu');
        menu.classList.remove('show-options');
        currentOpenMenu = null;
      });
    });
  }

  messageItem.addEventListener('dblclick', () => {
    const senderName = messageData.user;
    const content = messageData.text;
    activeQuoteData = {
      id: messageData.id,
      senderName: senderName,
      content: content
    };
    displayActiveQuoteBubble(senderName, content);
    document.querySelector('#input-bar input').focus();
  });

  return messageItem;
}

export function createSystemMessageElement(messageText) {
  const systemMessageItem = document.createElement('div');
  systemMessageItem.classList.add('system-message');
  const contentDiv = document.createElement('div');
  contentDiv.classList.add('system-message-content');
  contentDiv.textContent = messageText;
  systemMessageItem.appendChild(contentDiv);
  return systemMessageItem;
}

export function addWelcomeMessageToChat(chatBoxElement) {
  const currentUserName = localStorage.getItem('chatUserName') || 'زائر';
  const welcomeMessageText = `مرحبًا بك يا ${currentUserName} في الدردشة! نتمنى لك وقتًا ممتعًا.`;
  const welcomeMessageElement = createSystemMessageElement(welcomeMessageText);
  chatBoxElement.appendChild(welcomeMessageElement);
}

export function updatePrivateButtonNotification(show) {
  const privateButton = document.querySelector('#top-bar .btn.private');
  if (privateButton) {
    if (show) {
      privateButton.classList.add('has-new-messages');
    } else {
      privateButton.classList.remove('has-new-messages');
    }
  }
}

export function updatePrivateChatNotification(senderId, senderData) {
  const minimizedAvatar = document.querySelector(`.minimized-chat-avatar[data-user-id="${senderId}"]`);
  if (minimizedAvatar) {
    minimizedAvatar.classList.add('has-new-messages');
    updatePrivateButtonNotification(false);
  } else {
    updatePrivateButtonNotification(true);
  }
}

export function updateTopBarButtonsVisibility(userRank) {
  const permissions = RANK_PERMISSIONS[userRank] || {};
  const reportButton = document.getElementById('reportButton');
  const privateChatButton = document.getElementById('privateChatButton');
  if (reportButton) {
    reportButton.style.display = permissions.canReport ? 'block' : 'none';
  }
  if (privateChatButton) {
    privateChatButton.style.display = permissions.canPrivateChat ? 'flex' : 'none';
  }
}

export async function checkAndSendJoinMessage(roomId) {
  const fromRoomsPage = localStorage.getItem('fromRoomsPage');
  const fromRegistrationPage = localStorage.getItem('fromRegistrationPage');
  const lastVisitTimestamp = localStorage.getItem('lastVisitTimestamp');
  const currentTime = new Date().getTime();
  const threeHours = 3 * 60 * 60 * 1000;
  let shouldSend = false;
  if (fromRoomsPage === 'true' || fromRegistrationPage === 'true') {
    shouldSend = true;
    localStorage.removeItem('fromRoomsPage');
    localStorage.removeItem('fromRegistrationPage');
  } else if (lastVisitTimestamp && (currentTime - lastVisitTimestamp >= threeHours)) {
    shouldSend = true;
  }
  if (shouldSend && roomId) {
    const { sendJoinMessage } = await import('./chat-firestore.js');
    await sendJoinMessage(roomId);
  }
  localStorage.setItem('lastVisitTimestamp', currentTime);
}

export function showImageInModal(imageUrl) {
  let modal = document.getElementById('imageModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'imageModal';
    modal.classList.add('modal');
    modal.innerHTML = `
      <span class="close-btn">&times;</span>
      <img class="modal-content" id="modalImage">
    `;
    document.body.appendChild(modal);
  }
  const modalImage = document.getElementById('modalImage');
  modalImage.src = imageUrl;
  modal.style.display = "block";
  const closeBtn = modal.querySelector(".close-btn");
  closeBtn.onclick = function() {
    modal.style.display = "none";
  }
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  }
}

// دالة لإضافة زر التسجيل في الشريط السفلي للزوار
// دالة لإضافة زر التسجيل في الشريط السفلي للزوار
// في ملف js/chat-ui.js
// ... (بقية الكود السابق)

export function addRegistrationButtonToBottomBar(userRank) {
    const bottomBar = document.querySelector('.bottom-bar');
    const existingBtn = document.querySelector('.bottom-bar .registration-btn');

    if (userRank === 'زائر') {
        if (!existingBtn) {
            const registerButton = document.createElement('button');
            registerButton.classList.add('registration-btn');
            registerButton.classList.add('bottom-bar-btn');

            registerButton.innerHTML = `
                <i class="icon fa fa-pen"></i>
                <span class="btn-text">تسجيل</span>
            `;

            registerButton.addEventListener('click', () => {
                // ✨ استبدال alert() باستدعاء دالتنا الجديدة
                showRegistrationModal();
            });

            bottomBar.appendChild(registerButton);
        }
    } else {
        if (existingBtn) {
            existingBtn.remove();
        }
    }
}


// في ملف js/chat-ui.js
// في ملف js/chat-ui.js

export const registerModalHTML = `
<div class="registration-modal-content">
  <span class="close-button">&times;</span>
  <h2>تسجيل مستخدم جديد</h2>
  <form id="registrationForm">
    <div class="form-group">
      <label for="reg-username">اسم المستخدم:</label>
      <input type="text" id="reg-username" name="username" required>
    </div>
    <div class="form-group">
      <label for="reg-password">كلمة المرور:</label>
      <input type="password" id="reg-password" name="password" required>
    </div>
    <div class="form-group">
      <label for="reg-email">البريد الإلكتروني:</label>
      <input type="email" id="reg-email" name="email" required>
    </div>
    <button type="submit" class="register-submit-btn">
      <i class="fas fa-user-plus"></i> تسجيل
    </button>
  </form>
</div>
`;

let registrationModal = null;


// في ملف js/chat-ui.js
// ... (بقية الكود السابق)

// في ملف js/chat-ui.js
// ... (بقية الكود)

export function showRegistrationModal() {
  if (registrationModal) {
    registrationModal.remove();
  }

  registrationModal = document.createElement('div');
  registrationModal.classList.add('registration-modal');
  registrationModal.innerHTML = registerModalHTML;
  document.body.appendChild(registrationModal);
  
  setTimeout(() => {
    registrationModal.classList.add('show');
  }, 10);

  const currentUserName = localStorage.getItem('chatUserName');
  const usernameInput = registrationModal.querySelector('#reg-username');
  const emailInput = registrationModal.querySelector('#reg-email');

  if (usernameInput && currentUserName) {
    usernameInput.value = currentUserName;
    const sanitizedName = currentUserName.toLowerCase().replace(/\s/g, '');
    const defaultEmail = `${sanitizedName}@example.com`;
    emailInput.value = defaultEmail;
  }

  registrationModal.querySelector('.close-button').addEventListener('click', () => {
    hideRegistrationModal();
  });

  registrationModal.addEventListener('click', (event) => {
    if (event.target === registrationModal) {
      hideRegistrationModal();
    }
  });

  // ✨ ربط النموذج بالدالة الجديدة
  registrationModal.querySelector('#registrationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = registrationModal.querySelector('#reg-username').value.trim();
    const email = registrationModal.querySelector('#reg-email').value.trim();
    const password = registrationModal.querySelector('#reg-password').value;

    if (!username || !email || !password) {
      alert('يرجى ملء جميع الحقول.');
      return;
    }

    // استدعاء الدالة الجديدة للتعامل مع التسجيل
    await handleRegistration(username, email, password);
    hideRegistrationModal();
  });
}

// ... (بقية الدوال)
export function hideRegistrationModal() {
  if (registrationModal) {
    registrationModal.classList.remove('show');
    registrationModal.addEventListener('transitionend', () => {
      if (registrationModal) {
        registrationModal.remove();
        registrationModal = null;
      }
    }, { once: true });
  }
}

// في ملف js/chat-ui.js
// ... (الاستيرادات والدوال الموجودة)


// دالة التحقق من تكرار اسم المستخدم
async function isUsernameTaken(username) {
  const usersQuery = query(
    collection(db, 'users'),
    where('username', '==', username),
    limit(1)
  );
  const userSnapshot = await getDocs(usersQuery);
  if (!userSnapshot.empty) return true;
  return false;
}

// ✨ الدالة الجديدة للتعامل مع التسجيل
export async function handleRegistration(registerName, registerEmail, registerPassword) {
  const DEFAULT_USER_AVATAR = 'images/default-user.png';
  const userRank = 'عضو';

  try {
    if (await isUsernameTaken(registerName)) {
      alert('اسم المستخدم مستخدم سابقاً. الرجاء اختيار اسم فريد.'); // يمكنك استبدالها بدالة عرض رسالة أفضل
      return;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
    const userId = userCredential.user.uid;

    await setDoc(doc(db, 'users', userId), {
      username: registerName,
      email: registerEmail,
      timestamp: serverTimestamp(),
      userType: 'registered',
      avatar: DEFAULT_USER_AVATAR,
      rank: userRank,
      level: 1,
      totalExp: 0,
      currentExp: 0,
      expToNextLevel: 200,
      likes: []
    });

    localStorage.setItem('chatUserName', registerName);
    localStorage.setItem('userType', 'registered');
    localStorage.setItem('chatUserId', userId);
    localStorage.setItem('chatUserAvatar', DEFAULT_USER_AVATAR);
    localStorage.setItem('chatUserRank', userRank);

    // ✨ نقل المستخدم إلى صفحة الدردشة مباشرةً بعد التسجيل
    localStorage.setItem('fromRegistrationPage', 'true');
    window.location.href = 'chat.html'; // أو 'rooms.html' حسب ما تفضله

  } catch (error) {
    console.error("خطأ أثناء تسجيل الحساب:", error);
    if (error.code === 'auth/email-already-in-use') {
      alert('هذا البريد الإلكتروني مرتبط بحساب آخر بالفعل.');
    } else if (error.code === 'auth/weak-password') {
      alert('كلمة المرور ضعيفة. يجب أن تحتوي على 6 أحرف على الأقل.');
    } else if (error.code === 'auth/invalid-email') {
      alert('صيغة البريد الإلكتروني غير صحيحة.');
    } else {
      alert('حدث خطأ غير متوقع أثناء التسجيل. يرجى إعادة المحاولة.');
    }
  }
}
