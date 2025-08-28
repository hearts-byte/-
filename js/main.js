// js/main.js
// الكود الصحيح
import { 
    loadComponent, createAndShowPrivateChatDialog, createUserInfoModal, updatePrivateButtonNotification, hideUserInfoModal, checkAndSendJoinMessage, 
    createSystemMessageElement, createMessageElement 
} from './chat-ui.js';
import { 
    loadInitialMessages, loadMoreMessages, listenForNewMessages,
    sendMessage, getPrivateChatContacts, getAllUsersAndVisitors, getUserData, setupPrivateMessageNotificationListener, sendJoinMessage, deleteChatRoomMessages, sendSystemMessage, getChatRooms, listenForUserRankChanges
} from './chat-firestore.js';
import { RANK_ORDER, RANK_IMAGE_MAP, RANK_PERMISSIONS } from './constants.js';
import { showLevelInfoModal, showNotificationsModal, listenForUnreadNotifications } from './modals.js';
import { uploadFileToCloudinary } from './cloudinary-utils.js';
import { db, auth } from './firebase-config.js'; // تأكد من استيراد db و auth
import { doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

export let allUsersAndVisitorsData = [];
let privateChatModal = null;
let onlineUsersModal = null;
let searchModal = null;
let notificationsModal = null;
let profileDropdownMenu = null;
let profileButton = null;
let cachedRooms = null;
let currentRoomId;
let messagesUnsubscriber = null;
let isLoadingMoreMessages = false;
// إضافة المتغيرات هنا لتعريفها عالميًا
let chatUserId = null;
let chatUserName = null;
let chatUserAvatar = null;
// js/main.js
let userType = null;

// js/main.js
 
// ...
 
let isReloading = false;
 
// إضافة مستمع لحالة المستخدم لتحديث الرتبة والصلاحيات عند تغييرها
auth.onAuthStateChanged(user => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        onSnapshot(userDocRef, (docSnap) => {
            const userData = docSnap.data();
            if (userData && userData.needsRefresh && !isReloading) {
                isReloading = true;
 
                // تحديث الرتبة في localStorage
                if (userData.rank) {
                    localStorage.setItem('chatUserRank', userData.rank);
                }
 
                // إعادة تعيين الحقل إلى false
                updateDoc(userDocRef, {
                    needsRefresh: false
                }).then(() => {
                    // تحديث الصفحة بعد إعادة تعيين الحقل بنجاح
                    window.location.reload();
                }).catch((error) => {
                    console.error("خطأ في إعادة تعيين حقل التحديث:", error);
                    window.location.reload();
                });
            }
        });
    }
});

async function fetchUsersWithRetry(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await getAllUsersAndVisitors(true);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000)); // انتظر ثانية وأعد المحاولة
        }
    }
}

function hideNotificationsModal() {
    if (notificationsModal) {
        notificationsModal.remove();
        notificationsModal = null;
        document.removeEventListener('click', handleNotificationsModalOutsideClick);
    }
}

function hideOnlineUsersModal() {
    if (onlineUsersModal) {
        onlineUsersModal.remove();
        onlineUsersModal = null;
        document.removeEventListener('click', handleOnlineUsersModalOutsideClick);
    }
}

function handlePrivateChatModalOutsideClick(event) {
    const privateButton = document.querySelector('.top-bar .btn.private');
    const isClickInsidePrivateModal = privateChatModal && privateChatModal.contains(event.target);
    const isClickOnPrivateButton = privateButton && privateButton.contains(event.target);
    const isClickInsideUserInfoModal = window.userInfoModal && window.userInfoModal.contains(event.target);
    if (privateChatModal && privateChatModal.classList.contains('show') && !isClickInsidePrivateModal && !isClickOnPrivateButton && !isClickInsideUserInfoModal) {
        hidePrivateChatModal();
    }
}

function hidePrivateChatModal() {
    if (privateChatModal) {
        privateChatModal.classList.remove('show');
        privateChatModal.addEventListener('transitionend', () => {
            if (privateChatModal) {
                privateChatModal.remove();
                privateChatModal = null;
            }
        }, { once: true });
        document.removeEventListener('click', handlePrivateChatModalOutsideClick);
    }
}

function hideSearchModal() {
    if (searchModal) {
        searchModal.remove();
        searchModal = null;
    }
}

function hideProfileDropdown() {
    if (profileDropdownMenu && profileDropdownMenu.classList.contains('show')) {
        profileDropdownMenu.classList.remove('show');
        document.removeEventListener('click', handleProfileDropdownOutsideClick);
    }
}

function hideAllOpenModals() {
    if (typeof hideUserInfoModal === 'function') hideUserInfoModal();
    if (typeof hideOnlineUsersModal === 'function') hideOnlineUsersModal();
    if (typeof hidePrivateChatModal === 'function') hidePrivateChatModal();
    if (typeof hideSearchModal === 'function') hideSearchModal();
    if (typeof window.hideEditProfileModal === 'function') window.hideEditProfileModal();
    if (typeof hideProfileDropdown === 'function') hideProfileDropdown();
    if (typeof hideNotificationsModal === 'function') hideNotificationsModal();
}

function scrollToBottom() {
    const chatBox = document.querySelector('.chat-box') || 
                    document.querySelector('.chat-messages') || 
                    document.querySelector('#chat-container');
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}

async function createPrivateChatModal(buttonElement) {
    hideAllOpenModals();

    if (privateChatModal) {
        privateChatModal.remove();
        privateChatModal = null;
    }

    privateChatModal = document.createElement('div');
    privateChatModal.classList.add('private-chat-modal-strip');
    privateChatModal.innerHTML = `
        <div class="modal-header">
            <h3>الرسائل الخاصة</h3>
            <button class="close-btn">&times;</button>
        </div>
        <ul class="private-chat-list"><li style="text-align: center; padding: 10px; color: #888;">جاري تحميل جهات الاتصال...</li></ul>
    `;
    document.body.appendChild(privateChatModal);

    const buttonRect = buttonElement.getBoundingClientRect();
    const modalWidth = 200;
    const topBarElement = document.querySelector('.top-bar');
    const topBarHeight = topBarElement ? topBarElement.offsetHeight : 0;
    const padding = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let modalLeft = buttonRect.right - modalWidth;
    let modalTop = buttonRect.bottom + padding;
    if (modalLeft < padding) modalLeft = padding;
    if (modalLeft + modalWidth > viewportWidth - padding) modalLeft = viewportWidth - modalWidth - padding;
    if (modalTop + privateChatModal.clientHeight > viewportHeight - padding) {
        modalTop = viewportHeight - privateChatModal.clientHeight - padding;
        if (modalTop < topBarHeight + padding) modalTop = topBarHeight + padding;
    }
    privateChatModal.style.left = `${modalLeft}px`;
    privateChatModal.style.top = `${modalTop}px`;
    privateChatModal.classList.add('show');
    privateChatModal.querySelector('.close-btn').addEventListener('click', () => hidePrivateChatModal());
    document.addEventListener('click', handlePrivateChatModalOutsideClick);

    const currentUserId = localStorage.getItem('chatUserId');
    if (currentUserId) {
        try {
            const ulElement = privateChatModal.querySelector('.private-chat-list');
            const contacts = await getPrivateChatContacts(currentUserId);
            ulElement.innerHTML = '';
            if (contacts.length === 0) {
                ulElement.innerHTML = `<li style="text-align: center; padding: 10px; color: #888;">لا توجد محادثات خاصة بعد.</li>`;
            } else {
                contacts.sort((a, b) => b.unreadCount - a.unreadCount);
                contacts.forEach(contact => {
                    const li = document.createElement('li');
                    li.setAttribute('data-user-id', contact.id);
                    const unreadBadge = contact.unreadCount > 0 ? `<span class="unread-count">${contact.unreadCount}</span>` : '';
                    li.innerHTML = `
                        <img src="${contact.avatar || 'images/default-user.png'}" alt="${contact.name}" class="user-avatar-small">
                        <span class="user-name">${contact.name}</span>
                        ${unreadBadge}
                    `;
                    li.addEventListener('click', () => {
                        hidePrivateChatModal();
                        createAndShowPrivateChatDialog(contact);
                    });
                    ulElement.appendChild(li);
                });
            }
        } catch (error) {
            console.error('خطأ في جلب جهات الاتصال الخاصة:', error);
            const ulElement = privateChatModal.querySelector('.private-chat-list');
            ulElement.innerHTML = `<li style="text-align: center; padding: 10px; color: red;">فشل تحميل جهات الاتصال.</li>`;
        }
    } else {
        const ulElement = privateChatModal.querySelector('.private-chat-list');
        ulElement.innerHTML = `<li style="text-align: center; padding: 10px; color: red;">الرجاء تسجيل الدخول لعرض المحادثات الخاصة.</li>`;
    }
}

function handleOnlineUsersModalOutsideClick(event) {
    const onlineUsersButton = document.querySelector('#online-users-btn');
    const isClickInsideOnlineUsersModal = window.onlineUsersModal && window.onlineUsersModal.contains(event.target);
    const isClickInsideUserInfoModal = window.userInfoModal && window.userInfoModal.contains(event.target);
    const isClickOnOnlineUsersButton = onlineUsersButton && onlineUsersButton.contains(event.target);
    if (window.onlineUsersModal && !isClickInsideOnlineUsersModal && !isClickOnOnlineUsersButton && !isClickInsideUserInfoModal) {
        hideOnlineUsersModal();
        document.removeEventListener('click', handleOnlineUsersModalOutsideClick);
    }
}

async function createOnlineUsersModal(buttonElement) {
    hideAllOpenModals();
    if (onlineUsersModal) {
        onlineUsersModal.remove();
        onlineUsersModal = null;
    }
    onlineUsersModal = document.createElement('div');
    onlineUsersModal.classList.add('online-users-modal');
    const currentUserName = localStorage.getItem('chatUserName') || 'زائر';
    onlineUsersModal.innerHTML = `
        <div class="modal-header new-header-buttons">
            <div class="header-buttons-container">
                <button class="header-btn" id="rooms-btn"><i class="fa-solid fa-house"></i> الغرف</button>
                <button class="header-btn" id="friends-btn"><i class="fa-solid fa-user-group"></i> الأصدقاء</button>
                <button class="header-btn" id="visitors-btn"><i class="fa-solid fa-users"></i> الزوار</button>
                <button class="header-btn" id="search-btn"><i class="fa-solid fa-magnifying-glass"></i> بحث</button>
            </div>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-content-area"></div>
    `;
    document.body.appendChild(onlineUsersModal);

    const modalContentArea = onlineUsersModal.querySelector('.modal-content-area');
    const roomsBtn = onlineUsersModal.querySelector('#rooms-btn');
    const friendsBtn = onlineUsersModal.querySelector('#friends-btn');
    const visitorsBtn = onlineUsersModal.querySelector('#visitors-btn');
    const searchBtn = onlineUsersModal.querySelector('#search-btn');
    const updateActiveButton = (activeButton) => {
        [roomsBtn, friendsBtn, visitorsBtn, searchBtn].forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
    };
    if (modalContentArea) {
        await fetchAndDisplayOnlineUsers(modalContentArea, currentUserName);
        updateActiveButton(friendsBtn);
    }
    onlineUsersModal.style.display = 'flex';
    if (roomsBtn) roomsBtn.addEventListener('click', async () => { updateActiveButton(roomsBtn); if (modalContentArea) await fetchAndDisplayRooms(modalContentArea); });
    [friendsBtn, visitorsBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => { updateActiveButton(btn); if (modalContentArea) fetchAndDisplayOnlineUsers(modalContentArea, currentUserName); });
    });
    if (searchBtn) searchBtn.addEventListener('click', () => { updateActiveButton(searchBtn); if (modalContentArea) showSearchInterface(modalContentArea, currentUserName); });
    onlineUsersModal.querySelector('.close-btn').addEventListener('click', () => hideOnlineUsersModal());
    document.addEventListener('click', handleOnlineUsersModalOutsideClick);
}

async function fetchAndDisplayOnlineUsers(modalContentArea, currentUserName) {
    modalContentArea.innerHTML = `
        <div class="welcome-message-box">
            أهلاً وسهلاً بك معنا، ${currentUserName} يسعد مساءك بكل خير 🌙
        </div>
        <div class="online-users-list">
            <div style="text-align: center; padding: 20px; color: #888;">جاري تحميل المستخدمين...</div>
        </div>
    `;
    const onlineUsersList = modalContentArea.querySelector('.online-users-list');
    try {
        const users = await getAllUsersAndVisitors();
        onlineUsersList.innerHTML = '';
        if (users.length === 0) {
            onlineUsersList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">لا يوجد مستخدمون متصلون حالياً.</div>`;
            return;
        }
        const groupedUsers = {};
        users.forEach(user => {
            const rank = user.rank || 'زائر';
            if (!groupedUsers[rank]) groupedUsers[rank] = [];
            groupedUsers[rank].push(user);
        });
        const sortedRanks = RANK_ORDER.filter(rank => groupedUsers[rank]);
        const otherRanks = Object.keys(groupedUsers).filter(rank => !RANK_ORDER.includes(rank));
        sortedRanks.push(...otherRanks.sort());
        sortedRanks.forEach(rank => {
            const usersInRank = groupedUsers[rank];
            if (usersInRank && usersInRank.length > 0) {
                const rankHeader = document.createElement('div');
                rankHeader.classList.add('rank-header');
                rankHeader.setAttribute('data-rank', rank);
                let iconHtml = '';
                switch(rank) {
                    case 'المالك': iconHtml = '<i class="fas fa-crown"></i>'; break;
                    case 'اونر اداري': iconHtml = '<i class="fas fa-gavel"></i>'; break;
                    case 'اونر': iconHtml = '<i class="fas fa-star"></i>'; break;
                    case 'سوبر اداري': iconHtml = '<i class="fas fa-shield-alt"></i>'; break;
                    case 'مشرف': iconHtml = '<i class="fas fa-user-tie"></i>'; break;
                    case 'سوبر ادمن': iconHtml = '<i class="fas fa-user-shield"></i>'; break;
                    case 'ادمن': iconHtml = '<i class="fas fa-user-cog"></i>'; break;
                    case 'بريميوم': iconHtml = '<i class="fas fa-gem"></i>'; break;
                    case 'بلاتينيوم': iconHtml = '<i class="fas fa-medal"></i>'; break;
                    case 'ملكي': iconHtml = '<i class="fas fa-chess-king"></i>'; break;
                    case 'ذهبي': iconHtml = '<i class="fas fa-money-bill-wave"></i>'; break;
                    case 'برونزي': iconHtml = '<i class="fas fa-medal"></i>'; break;
                    case 'عضو': iconHtml = '<i class="fas fa-user"></i>'; break;
                    case 'زائر': iconHtml = '<i class="fas fa-ghost"></i>'; break;
                    default: iconHtml = '<i class="fas fa-users"></i>';
                }
                rankHeader.innerHTML = `${iconHtml}<h3>${rank}</h3>`;
                onlineUsersList.appendChild(rankHeader);
                usersInRank.sort((a, b) => a.name.localeCompare(b.name));
                usersInRank.forEach(user => {
                    const userItemDiv = document.createElement('div');
                    userItemDiv.classList.add('user-item');
                    const rankImageSrc = RANK_IMAGE_MAP[user.rank] || RANK_IMAGE_MAP['default'];
                    userItemDiv.innerHTML = `
                        <img src="${user.avatar || 'images/default-user.png'}" alt="${user.name}" class="user-avatar-small">
                        <div class="user-info-text">
                            <span class="user-name">${user.name}</span>
                            <p class="user-status">${user.statusText || ''}</p>
                        </div>
                        <img src="${rankImageSrc}" alt="${user.rank}" class="user-rank-image" title="${user.rank}" />
                    `;
                    const userAvatarElement = userItemDiv.querySelector('.user-avatar-small');
                    if (userAvatarElement) {
                        userAvatarElement.addEventListener('click', (event) => {
                            event.stopPropagation();
                            createUserInfoModal(userAvatarElement, user, window.allUsersAndVisitorsData);
                        });
                    }
                    onlineUsersList.appendChild(userItemDiv);
                });
            }
        });
    } catch (error) {
        console.error("خطأ في جلب المستخدمين المتصلين:", error);
        onlineUsersList.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">فشل تحميل قائمة المستخدمين.</div>`;
    }
}

async function fetchAndDisplayRooms(modalContentArea) {
    modalContentArea.innerHTML = `
        <div class="welcome-message-box">اختر غرفة للانضمام إليها.</div>
        <div class="rooms-list"><div style="text-align: center; padding: 20px; color: #888;">جاري تحميل الغرف...</div></div>
    `;
    const roomsList = modalContentArea.querySelector('.rooms-list');
    if (!roomsList) {
        console.error("خطأ: لم يتم العثور على عنصر قائمة الغرف.");
        return;
    }
    try {
        const rooms = await getChatRooms();
        roomsList.innerHTML = '';
        if (rooms.length === 0) {
            roomsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">لا توجد غرف متاحة حالياً.</div>`;
        } else {
            rooms.forEach(room => {
    const roomItemDiv = document.createElement('div');
    roomItemDiv.classList.add('room-item');
    roomItemDiv.setAttribute('data-room-id', room.id);
    roomItemDiv.setAttribute('data-locked', room.locked ? "true" : "false");
    roomItemDiv.innerHTML = `
        <div class="room-info">
            <span class="room-name">${room.name}</span>
            <span class="room-user-count"><i class="fas fa-users"></i> ${room.userCount || 0}</span>
            ${room.locked ? '<span class="room-lock-icon"><i class="fas fa-lock"></i></span>' : ''}
        </div>
    `;

    roomItemDiv.addEventListener('click', () => {
    if (room.locked) {
        showRoomsPasswordModal(room.id, room.name, room.password);
    } else {
        localStorage.setItem('lastVisitedRoomId', room.id);
        window.location.href = `chat.html?roomId=${room.id}`;
    }
});
roomsList.appendChild(roomItemDiv);
});
        }
    } catch (error) {
        console.error("خطأ في جلب الغرف:", error);
        roomsList.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">فشل تحميل قائمة الغرف.</div>`;
    }
}

function showSearchInterface(modalContentArea) {
    modalContentArea.innerHTML = `
        <div class="search-input-container">
            <input type="text" id="user-search-input" placeholder="ابحث بالاسم..." />
            <button id="clear-search-btn">&times;</button>
        </div>
        <div class="search-results-list online-users-list">
            <div style="text-align: center; padding: 20px; color: #888;">ابدأ الكتابة للبحث عن المستخدمين...</div>
        </div>
    `;
    const searchInput = modalContentArea.querySelector('#user-search-input');
    const searchResultsList = modalContentArea.querySelector('.search-results-list');
    const clearSearchBtn = modalContentArea.querySelector('#clear-search-btn');
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">ابدأ الكتابة للبحث عن المستخدمين...</div>`;
        clearSearchBtn.style.display = 'none';
    });
    searchInput.addEventListener('input', async (event) => {
        const searchTerm = event.target.value.toLowerCase().trim();
        if (searchTerm.length > 0) clearSearchBtn.style.display = 'block';
        else clearSearchBtn.style.display = 'none';
        if (searchTerm.length < 2) {
            searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">الرجاء إدخال حرفين على الأقل للبحث.</div>`;
            return;
        }
        searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">جاري البحث عن "${searchTerm}"...</div>`;
        try {
            const allUsers = await getAllUsersAndVisitors();
            const filteredUsers = allUsers.filter(user =>
                user.name.toLowerCase().includes(searchTerm)
            );
            searchResultsList.innerHTML = '';
            if (filteredUsers.length === 0) {
                searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">لا يوجد مستخدمون يطابقون بحثك.</div>`;
            } else {
                filteredUsers.forEach(user => {
                    const userItemDiv = document.createElement('div');
                    userItemDiv.classList.add('user-item');
                    const rankImageSrc = RANK_IMAGE_MAP[user.rank] || RANK_IMAGE_MAP['default'];
                    userItemDiv.innerHTML = `
                        <img src="${user.avatar || 'images/default-user.png'}" alt="${user.name}" class="user-avatar-small">
                        <span class="user-name">${user.name}</span>
                        <img src="${rankImageSrc}" alt="${user.rank}" class="user-rank-image" title="${user.rank}" />
                    `;
                    const userAvatarElement = userItemDiv.querySelector('.user-avatar-small');
                    if (userAvatarElement) {
                        userAvatarElement.addEventListener('click', (event) => {
                            event.stopPropagation();
                            createUserInfoModal(userAvatarElement, user);
                        });
                    }
                    searchResultsList.appendChild(userItemDiv);
                });
            }
        } catch (error) {
            console.error("خطأ في البحث عن المستخدمين:", error);
            searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">فشل البحث عن المستخدمين.</div>`;
        }
    });
}

function handleProfileDropdownOutsideClick(event) {
    if (profileDropdownMenu && profileDropdownMenu.classList.contains('show') && !profileDropdownMenu.contains(event.target) && !profileButton.contains(event.target)) {
        hideProfileDropdown();
    }
}

function showRoomsPasswordModal(roomId, roomName, roomPassword) {
    // إذا المودال موجود مسبقاً، احذفه أولاً
    let existingModal = document.getElementById('jsRoomsPasswordModal');
    if (existingModal) existingModal.remove();

    // أنشئ عناصر المودال
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'jsRoomsPasswordModal';
    modal.innerHTML = `
        <div class="modal-content password-modal-content">
            <span class="close" id="closeJsPasswordModal">&times;</span>
            <h4 style="margin-bottom:15px;color:#7c3aed;">الغرفة مغلقة: ${roomName}</h4>
            <form id="jsRoomPasswordForm" autocomplete="off">
                <div class="form-group" style="margin-bottom:10px;">
                    <label for="jsEnterRoomPassword">أدخل كلمة المرور للغرفة</label>
                    <input type="password" id="jsEnterRoomPassword" name="jsEnterRoomPassword" maxlength="40" autocomplete="current-password" placeholder="كلمة المرور" required>
                </div>
                <button type="submit" class="submit-btn">دخول</button>
            </form>
            <div id="jsPasswordModalMsg" class="modal-msg"></div>
        </div>
    `;
    document.body.appendChild(modal);

    // حدث إغلاق المودال
    document.getElementById('closeJsPasswordModal').onclick = function() {
        modal.remove();
    };

    // حدث إرسال كلمة المرور
    document.getElementById('jsRoomPasswordForm').onsubmit = function(e) {
        e.preventDefault();
        const msgDiv = document.getElementById('jsPasswordModalMsg');
        msgDiv.textContent = '';
        const enteredPassword = document.getElementById('jsEnterRoomPassword').value.trim();
        if (!enteredPassword) {
            msgDiv.textContent = 'يرجى إدخال كلمة المرور.';
            return;
        }
        if (enteredPassword === roomPassword) {
            modal.remove();
            localStorage.setItem('lastVisitedRoomId', roomId);
            window.location.href = `chat.html?roomId=${roomId}`;
        } else {
            msgDiv.textContent = 'كلمة المرور غير صحيحة!';
        }
    };
}

function renderMessages(docs, clear = false) {
    const chatBox = document.querySelector('#chat-box .chat-box');
    if (!chatBox) return;
    if (clear) chatBox.innerHTML = '';
    docs.forEach(docSnap => {
        const msgData = { id: docSnap.id, ...docSnap.data() };
        const senderData = window.allUsersAndVisitorsData?.find(u => u.id === msgData.senderId);
        if (!msgData.isSystemMessage) {
            msgData.userType = senderData?.rank === 'زائر' ? 'visitor' : 'registered';
            msgData.senderRank = senderData?.rank || 'زائر';
            msgData.level = senderData?.level || 1;
        }
        const elem = msgData.isSystemMessage ?
            createSystemMessageElement(msgData.text) :
            createMessageElement(msgData);
        if (clear) {
            chatBox.appendChild(elem);
        } else {
            chatBox.insertBefore(elem, chatBox.firstChild);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponent("top-bar", "components/top-bar.html");
    await loadComponent("chat-box", "components/chat-box.html");
    await loadComponent("input-bar", "components/input-bar.html");
    await loadComponent("bottom-bar", "components/bottom-bar.html");
    
    //js/main.js
// ... (الكود السابق لا يتغير) ...

    try {
        // عند الدخول للصفحة، اجلب بيانات كل المستخدمين والزوار
        window.allUsersAndVisitorsData = await getAllUsersAndVisitors(true);
    } catch (error) {
        console.error("خطأ في جلب البيانات الأولية للمستخدمين والزوار:", error);
        const chatBox = document.querySelector('#chat-box .chat-box');
        if (chatBox) {
            chatBox.innerHTML = '<div style="text-align: center; color: red;">فشل تحميل بيانات المستخدمين. قد يكون هناك مشكلة في الاتصال.</div>';
        }
    }

    // تحقق من وجود بيانات المستخدم في localStorage
    let chatUserId = localStorage.getItem('chatUserId');
    let chatUserName = localStorage.getItem('chatUserName');
    let chatUserAvatar = localStorage.getItem('chatUserAvatar');
    let userType = localStorage.getItem('userType');
    
    // إذا لم يكن هناك معرف للمستخدم في localStorage، قم بإعادة التوجيه مرة واحدة فقط
    if (!chatUserId) {
        window.location.href = 'index.html';
        return;
    }

    // تحقق من وجود بيانات المستخدم في allUsersAndVisitorsData
    const userData = window.allUsersAndVisitorsData?.find(user => user.id === chatUserId);

    if (!userData) {
        // إذا لم يتم العثور على بيانات المستخدم، أظهر رسالة تحذير في الواجهة
        console.warn('لم يتم العثور على بيانات الحساب، ربما بسبب مشكلة في الاتصال.');
        const chatBox = document.querySelector('#chat-box .chat-box');
        if (chatBox) {
            const warningMessage = document.createElement('div');
            warningMessage.style.textAlign = 'center';
            warningMessage.style.color = 'orange';
            warningMessage.style.padding = '10px';
            warningMessage.textContent = 'تحذير: قد تواجه بعض المشاكل بسبب ضعف الاتصال.';
            chatBox.insertBefore(warningMessage, chatBox.firstChild);
        }
        // يمكننا السماح للمستخدم بالبقاء والاستمرار
    }

    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('roomId');
    const lastVisitedRoomId = localStorage.getItem('lastVisitedRoomId');
    currentRoomId = roomIdFromUrl || lastVisitedRoomId;
    if (!currentRoomId) {
        window.location.href = 'rooms.html';
        return;
    }
    localStorage.setItem('lastVisitedRoomId', currentRoomId);

    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) {
        document.body.innerHTML = '<div style="text-align: center; color: red; padding-top: 50px;">خطأ: لم يتم العثور على عنصر "chat-container". تأكد من وجوده في ملف HTML (chat.html).</div>';
        return;
    }

// ... (بقية الكود لا يتغير) ..
    try {
        await loadComponent("top-bar", "components/top-bar.html");
        const currentUserId = localStorage.getItem('chatUserId');
        const currentUserData = window.allUsersAndVisitorsData.find(user => user.id === currentUserId);
        let currentUserRank = currentUserData ? currentUserData.rank : 'زائر';
        const topButtonsContainer = document.querySelector('.top-buttons');
        if (topButtonsContainer) {
            if (RANK_PERMISSIONS[currentUserRank]?.canSeeReportButton) {
                const reportBtnDiv = document.createElement('div');
                reportBtnDiv.classList.add('btn', 'report');
                reportBtnDiv.id = 'reportButton';
                reportBtnDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i><br>بلاغ`;
                const profileButton = document.getElementById('profileButton');
                if (profileButton) topButtonsContainer.insertBefore(reportBtnDiv, profileButton.nextSibling);
            }
            if (RANK_PERMISSIONS[currentUserRank]?.canSeePrivateChatButton) {
                const privateBtnDiv = document.createElement('div');
                privateBtnDiv.classList.add('btn', 'private');
                privateBtnDiv.id = 'privateButton';
                privateBtnDiv.innerHTML = `<i class="fas fa-envelope"></i><br>خاص`;
                const friendButton = topButtonsContainer.querySelector('.btn.friend');
                if (friendButton) topButtonsContainer.insertBefore(privateBtnDiv, friendButton.nextSibling);
            }
        }
        await loadComponent("chat-box", "components/chat-box.html");
        await loadComponent("input-bar", "components/input-bar.html");
        const plusButtonToggle = document.querySelector('#input-bar .plus-btn-circle');
        const imageUploadInput = document.getElementById('image-upload-input');
        let optionsMenu = null;
        let currentUploadTask = null;
        function createAndAppendUploadProgressBar() {
            const uploadProgressContainer = document.createElement('div');
            uploadProgressContainer.id = 'upload-progress-container';
            uploadProgressContainer.className = 'upload-progress-container';
            uploadProgressContainer.style.display = 'none';
            uploadProgressContainer.innerHTML = `
                <div class="progress-bar"><div id="progress-fill" class="progress-fill"></div></div>
                <button id="cancel-upload-btn" class="cancel-upload-btn">&times;</button>
            `;
            document.body.appendChild(uploadProgressContainer);
        }
        function createOptionsMenu() {
            optionsMenu = document.createElement('div');
            optionsMenu.classList.add('options-menu');
            optionsMenu.innerHTML = `
                <button class="btn option-btn" id="music-btn" title="مشاركة أغنية"><i class="fas fa-music"></i></button>
                <button class="btn option-btn" id="upload-media-btn" title="رفع ملف"><i class="fas fa-cloud-upload-alt"></i></button>
            `;
            const uploadMediaButton = optionsMenu.querySelector('#upload-media-btn');
            uploadMediaButton.addEventListener('click', () => {
                imageUploadInput.click();
                optionsMenu.classList.remove('show-menu');
            });
            const musicButton = optionsMenu.querySelector('#music-btn');
            musicButton.addEventListener('click', () => {
                alert('سيتم فتح نافذة مشاركة الأغاني قريباً!');
                optionsMenu.classList.remove('show-menu');
            });
            plusButtonToggle.parentElement.appendChild(optionsMenu);
        }
        function hideOptionsMenu() {
            if (optionsMenu) optionsMenu.classList.remove('show-menu');
        }
        createAndAppendUploadProgressBar();
        if (plusButtonToggle && imageUploadInput) {
            plusButtonToggle.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!optionsMenu) createOptionsMenu();
                optionsMenu.classList.toggle('show-menu');
            });
            document.addEventListener('click', (event) => {
                if (optionsMenu && !optionsMenu.contains(event.target) && !plusButtonToggle.contains(event.target)) hideOptionsMenu();
            });
            imageUploadInput.addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (!file) return;
                const uploadProgressContainer = document.getElementById('upload-progress-container');
                const progressFill = document.getElementById('progress-fill');
                const cancelUploadBtn = document.getElementById('cancel-upload-btn');
                if (!uploadProgressContainer || !progressFill || !cancelUploadBtn) {
                    console.error('لم يتم العثور على عناصر شريط التقدم. حدث خطأ في إنشاء العنصر.');
                    return;
                }
                uploadProgressContainer.style.display = 'flex';
                progressFill.style.width = '0%';
                const handleCancel = () => {
                    if (currentUploadTask) currentUploadTask.abort();
                    uploadProgressContainer.style.display = 'none';
                    imageUploadInput.value = '';
                    currentUploadTask = null;
                    cancelUploadBtn.removeEventListener('click', handleCancel);
                };
                cancelUploadBtn.addEventListener('click', handleCancel);
                try {
                    currentUploadTask = new XMLHttpRequest();
                    const imageUrl = await new Promise((resolve, reject) => {
                        uploadFileToCloudinary(file, (progress) => {
                            progressFill.style.width = `${progress}%`;
                        }).then(resolve).catch(reject);
                    });
                    if (imageUrl) {
                        const messageText = '';
                        await sendMessage(messageText, currentRoomId, imageUrl);
                        scrollToBottom();
                    }
                } catch (error) {
                    console.error('فشل إرسال الصورة:', error);
                    alert('فشل إرسال الصورة. يرجى المحاولة مرة أخرى.');
                } finally {
                    uploadProgressContainer.style.display = 'none';
                    imageUploadInput.value = '';
                    currentUploadTask = null;
                    cancelUploadBtn.removeEventListener('click', handleCancel);
                }
            });
        }
        await loadComponent("bottom-bar", "components/bottom-bar.html");
if (chatUserId) await checkAndSendJoinMessage(currentRoomId);

// --- تحميل أول صفحة رسائل ---
await loadInitialMessages(currentRoomId, renderMessages);

// --- الاستماع اللحظي للرسائل الجديدة فقط ---

if (messagesUnsubscriber) messagesUnsubscriber();
messagesUnsubscriber = listenForNewMessages(currentRoomId, (msgData) => {
    const chatBox = document.querySelector('#chat-box .chat-box');
    const senderData = window.allUsersAndVisitorsData?.find(u => u.id === msgData.senderId);
    if (!msgData.isSystemMessage) {
        msgData.userType = senderData?.rank === 'زائر' ? 'visitor' : 'registered';
        msgData.senderRank = senderData?.rank || 'زائر';
        msgData.level = senderData?.level || 1;
    }
    const elem = msgData.isSystemMessage ?
        createSystemMessageElement(msgData.text) :
        createMessageElement(msgData);
    chatBox.appendChild(elem);
    setTimeout(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 100);
});

listenForUserRankChanges();

// --- تحميل المزيد عند التمرير للأعلى ---
let isLoadingMoreMessages = false;
const chatBox = document.querySelector('#chat-box .chat-box');
if (chatBox) {
    chatBox.addEventListener('scroll', async () => {
        if (chatBox.scrollTop <= 0 && !isLoadingMoreMessages) {
            isLoadingMoreMessages = true;
            await loadMoreMessages(renderMessages);
            isLoadingMoreMessages = false;
        }
    });
}

if (chatUserId) setupPrivateMessageNotificationListener(chatUserId);
profileButton = document.getElementById('profileButton');
        async function createAndAppendProfileDropdown() {
            profileDropdownMenu = document.createElement('div');
            profileDropdownMenu.id = 'profileDropdownMenu';
            profileDropdownMenu.classList.add('profile-dropdown-menu');
            let currentUserRank = 'زائر';
            const currentUserId = localStorage.getItem('chatUserId');
            if (currentUserId) {
                try {
                    const allUsersAndVisitors = await getAllUsersAndVisitors();
                    const currentUserData = allUsersAndVisitors.find(user => user.id === currentUserId);
                    if (currentUserData && currentUserData.rank) currentUserRank = currentUserData.rank;
                } catch (error) {
                    console.error("خطأ في جلب رتبة المستخدم:", error);
                }
            }
            const rankImageSrc = RANK_IMAGE_MAP[currentUserRank] || RANK_IMAGE_MAP['default'];
            profileDropdownMenu.innerHTML = `
                <div class="profile-dropdown-content">
                    <div class="profile-header">
                        <img id="modal-profile-image" src="${localStorage.getItem('chatUserAvatar') || 'https://i.imgur.com/Uo9V2Yx.png'}" alt="صورة المستخدم">
                        <div class="profile-info">
                            <div class="profile-rank-display">
                                <span class="rank-text">${currentUserRank}</span>
                                <img src="${rankImageSrc}" alt="${currentUserRank}" class="rank-icon" title="${currentUserRank}" />
                            </div>
                            <p id="modal-username-display">${chatUserName || 'زائر'}</p>
                        </div>
                    </div>
                    <div class="profile-buttons-section">
                        <button class="modal-button level-info-btn">معلومات المستوى <i class="icon fa-solid fa-chart-column"></i></button>
                        <button class="modal-button wallet-btn">المحفظة <i class="icon fa-solid fa-wallet"></i></button>
                        <button class="modal-button edit-account-btn" id="editProfileButton">تعديل الحساب <i class="icon fa-solid fa-user-gear"></i></button>
                        <button class="modal-button leave-room-btn">الخروج من الغرفة <i class="icon fa-solid fa-arrow-right-from-bracket"></i></button>
                        <button class="modal-button logout">الخروج من الحساب <i class="icon fa-solid fa-right-from-bracket"></i></button>
                    </div>
                </div>
            `;
            document.body.appendChild(profileDropdownMenu);
            const levelInfoBtn = profileDropdownMenu.querySelector('.modal-button.level-info-btn');
            if (levelInfoBtn) {
                levelInfoBtn.addEventListener('click', async () => {
                    const currentUserId = localStorage.getItem('chatUserId');
                    if (currentUserId) {
                        try {
                            const userData = await getUserData(currentUserId);
                            if (userData) {
                                const expToNextLevel = userData.expToNextLevel || 1000;
                                const expProgress = Math.floor((userData.currentExp / expToNextLevel) * 100);
                                const userLevelData = {
                                    levelRank: userData.rank || 'مبتدئ',
                                    level: userData.level || 1,
                                    totalExp: userData.totalExp || 0,
                                    expProgress: expProgress
                                };
                                showLevelInfoModal(userLevelData);
                            } else {
                                alert('لم يتم العثور على بيانات المستخدم.');
                            }
                        } catch (error) {
                            alert('حدث خطأ أثناء جلب معلومات المستوى.');
                        }
                    } else {
                        alert('يجب تسجيل الدخول لعرض معلومات المستوى.');
                    }
                    hideProfileDropdown();
                });
            }
            const walletButton = profileDropdownMenu.querySelector('.modal-button.wallet-btn');
            if (walletButton) {
                walletButton.addEventListener('click', () => {
                    alert('سيتم فتح صفحة المحفظة!');
                    hideProfileDropdown();
                });
            }
            const leaveRoomButton = profileDropdownMenu.querySelector('.modal-button.leave-room-btn');
            if (leaveRoomButton) {
                leaveRoomButton.addEventListener('click', () => {
                    localStorage.removeItem('lastVisitedRoomId');
                    window.location.href = 'rooms.html';
                    hideProfileDropdown();
                });
            }
            const logoutButton = profileDropdownMenu.querySelector('.modal-button.logout');
            if (logoutButton) {
                logoutButton.addEventListener('click', () => {
                    localStorage.clear();
                    window.location.href = 'index.html';
                    hideProfileDropdown();
                });
            }
        }
        createAndAppendProfileDropdown();
        if (profileButton) {
            profileButton.addEventListener('click', (event) => {
                event.stopPropagation();
                hideAllOpenModals();
                if (profileDropdownMenu) {
                    profileDropdownMenu.classList.add('show');
                    const buttonRect = profileButton.getBoundingClientRect();
                    profileDropdownMenu.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
                    const dropdownWidth = profileDropdownMenu.offsetWidth;
                    const windowWidth = window.innerWidth;
                    let desiredRight = windowWidth - buttonRect.right - window.scrollX;
                    if (desiredRight + dropdownWidth > windowWidth) desiredRight = windowWidth - dropdownWidth - 10;
                    profileDropdownMenu.style.right = `${desiredRight}px`;
                    profileDropdownMenu.style.left = 'auto';
                    document.addEventListener('click', handleProfileDropdownOutsideClick);
                }
            });
        }
        if (currentUserId) {
            try {
                const allUsersAndVisitors = await getAllUsersAndVisitors();
                const currentUserData = allUsersAndVisitors.find(user => user.id === currentUserId);
                if (currentUserData) {
                    const currentUserRank = currentUserData.rank;
                    const privateBtn = document.querySelector('.top-bar .btn.private');
                    const reportBtn = document.querySelector('.top-bar .btn.report');
                    if (privateBtn) {
                        const canSeePrivateChat = RANK_PERMISSIONS[currentUserRank]?.canSeePrivateChatButton;
                        privateBtn.style.display = canSeePrivateChat === false ? 'none' : 'flex';
                    }
                    if (reportBtn) {
                        const canSeeReport = RANK_PERMISSIONS[currentUserRank]?.canSeeReportButton;
                        reportBtn.style.visibility = canSeeReport === false ? 'hidden' : 'visible';
                        reportBtn.style.pointerEvents = canSeeReport === false ? 'none' : 'auto';
                    }
                }
            } catch (error) {
                console.error('خطأ في جلب بيانات المستخدم أو إدارة ظهور الأزرار:', error);
            }
        }
        const userProfileImage = document.getElementById('user-profile-image');
        if (userProfileImage) {
            userProfileImage.src = chatUserAvatar || 'https://i.imgur.com/Uo9V2Yx.png';
            userProfileImage.style.display = 'block';
        }
        
        const refreshButton = document.querySelector('#top-bar .btn.refresh');
        if (refreshButton) refreshButton.addEventListener('click', () => window.location.reload());
        const privateButton = document.querySelector('#top-bar .btn.private');
        if (privateButton) {
            privateButton.addEventListener('click', (event) => {
                event.stopPropagation();
                createPrivateChatModal(privateButton);
            });
        }
        const onlineUsersButton = document.querySelector('#online-users-btn');
        if (onlineUsersButton) {
            onlineUsersButton.addEventListener('click', (event) => {
                event.stopPropagation();
                createOnlineUsersModal(onlineUsersButton);
            });
        }
        const notificationsBtn = document.getElementById('notifications-btn');
if (notificationsBtn) {
    notificationsBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        showNotificationsModal();
    });
}

if (currentUserId) {
    listenForUnreadNotifications();
}

        const editProfileButton = document.getElementById('editProfileButton');
        if (editProfileButton) {
            editProfileButton.addEventListener('click', async (event) => {
                event.preventDefault(); 
                event.stopPropagation(); 
                if (typeof hideProfileDropdown === 'function') hideProfileDropdown();
                hideAllOpenModals(); 
                const currentUserId = localStorage.getItem('chatUserId');
                let currentUserData = null;
                if (currentUserId && window.allUsersAndVisitorsData && Array.isArray(window.allUsersAndVisitorsData)) {
                    currentUserData = window.allUsersAndVisitorsData.find(user => user.id === currentUserId);
                }
                if (typeof window.hideEditProfileModal === 'function' && window.editProfileModal) {
                    window.editProfileModal.classList.add('show');
                    document.addEventListener('click', window.handleEditProfileModalOutsideClick);
                    if (typeof window.updateEditProfileModalContent === 'function') {
                        window.updateEditProfileModalContent(currentUserData);
                    }
                }
            });
        }
        const messageInput = document.querySelector('#input-bar input');
        const sendButton = document.querySelector('#input-bar .send-btn');
        
        const handleMessageSend = async () => {
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    if (messageText.toLowerCase() === '/clear') {
        // **قم بتفريغ الحقل فوراً لمنع الإرسال المتكرر**
        messageInput.value = ''; 

        try {
            if (messagesUnsubscriber) messagesUnsubscriber();
            
            await deleteChatRoomMessages(currentRoomId);
            
            const chatBox = document.querySelector('#chat-box .chat-box');
            if (chatBox) {
                chatBox.innerHTML = '';
            }
            
            const chatUserName = localStorage.getItem('chatUserName') || 'مستخدم مجهول';
            const confirmationMessage = `تم تنظيف الغرفة من قبل ${chatUserName}`;
            await sendSystemMessage(confirmationMessage, currentRoomId);
            
            messagesUnsubscriber = listenForNewMessages(currentRoomId, (msgData) => {
                const senderData = window.allUsersAndVisitorsData?.find(u => u.id === msgData.senderId);
                if (!msgData.isSystemMessage) {
                    msgData.userType = senderData?.rank === 'زائر' ? 'visitor' : 'registered';
                    msgData.senderRank = senderData?.rank || 'زائر';
                    msgData.level = senderData?.level || 1;
                }
                const elem = msgData.isSystemMessage ?
                    createSystemMessageElement(msgData.text) :
                    createMessageElement(msgData);
                chatBox.appendChild(elem);
                setTimeout(() => {
                    chatBox.scrollTop = chatBox.scrollHeight;
                }, 100);
            });

        } catch (error) {
            alert('فشل تنظيف الدردشة. ليس لديك الصلاحية لفعل ذلك.');
            // يمكنك ترك هذا الجزء كما هو، أو إضافة كود منع الإرسال هنا أيضًا
            messagesUnsubscriber = listenForNewMessages(currentRoomId, (msgData) => {
                const chatBox = document.querySelector('#chat-box .chat-box');
                const senderData = window.allUsersAndVisitorsData?.find(u => u.id === msgData.senderId);
                if (!msgData.isSystemMessage) {
                    msgData.userType = senderData?.rank === 'زائر' ? 'visitor' : 'registered';
                    msgData.senderRank = senderData?.rank || 'زائر';
                    msgData.level = senderData?.level || 1;
                }
                const elem = msgData.isSystemMessage ?
                    createSystemMessageElement(msgData.text) :
                    createMessageElement(msgData);
                chatBox.appendChild(elem);
                setTimeout(() => {
                    chatBox.scrollTop = chatBox.scrollHeight;
                }, 100);
            });
        }
        return;
    }

    // هذا السطر الآن لن يعمل إلا للرسائل العادية
    messageInput.value = '';
    try {
        await sendMessage(messageText, currentRoomId, null);
        scrollToBottom();
    } catch (error) {
        alert('فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.');
    }
};
        if (messageInput && sendButton && currentUserId) {
            sendButton.addEventListener('click', handleMessageSend);
            messageInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleMessageSend();
                }
            });
        } else if (messageInput && sendButton) {
            sendButton.addEventListener('click', async () => {
                const messageText = messageInput.value.trim();
                if (messageText) {
                    messageInput.value = '';
                    try {
                        await sendMessage(messageText, currentRoomId, null);
                        scrollToBottom();
                    } catch (error) {
                        alert('فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.');
                    }
                }
            });
            messageInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const messageText = messageInput.value.trim();
                    if (messageText) {
                        messageInput.value = '';
                        try {
                            await sendMessage(messageText, currentRoomId, null);
                            scrollToBottom();
                        } catch (error) {
                            alert('فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.');
                        }
                    }
                }
            });
        }
    } catch (error) {
        if (chatContainer) {
            chatContainer.innerHTML = `<div style="text-align: center; color: red; padding-top: 50px;">
                                           <p>عذرًا، حدث خطأ أثناء تحميل مكونات الدردشة الأساسية.</p>
                                           <p>الرجاء التأكد من وجود ملفات HTML في مساراتها الصحيحة (components/).</p>
                                           <p>تفاصيل الخطأ: ${error.message}</p>
                                         </div>`;
        } else {
            document.body.innerHTML = `<div style="text-align: center; color: red; padding-top: 50px;">
                                           <p>خطأ فادح: فشل تحميل مكونات التطبيق. يرجى مراجعة Console لمزيد من التفاصيل.</p>
                                         </div>`;
        }
    }
    document.addEventListener('click', (event) => {});
});

window.sendMessage = sendMessage;

function createAndAppendImageModal() {
    if (document.getElementById('image-modal')) return;
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'image-modal';
    modalOverlay.className = 'image-modal-overlay';
    const modalContent = document.createElement('div');
    modalContent.className = 'image-modal-content';
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-image-modal';
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&times;';
    const downloadBtn = document.createElement('a');
    downloadBtn.id = 'download-image-btn';
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
    const imageElement = document.createElement('img');
    imageElement.id = 'modal-image';
    imageElement.src = '';
    imageElement.alt = 'صورة مكبرة';
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(downloadBtn);
    modalContent.appendChild(imageElement);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    closeBtn.addEventListener('click', closeImageModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeImageModal();
    });
}
function openImageModal(imageSrc) {
    const modalOverlay = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const downloadBtn = document.getElementById('download-image-btn');
    if (modalOverlay && modalImage && downloadBtn) {
        modalImage.src = imageSrc;
        downloadBtn.href = imageSrc;
        downloadBtn.download = imageSrc.split('/').pop();
        modalOverlay.style.display = 'flex';
    }
}
function closeImageModal() {
    const modalOverlay = document.getElementById('image-modal');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        document.getElementById('modal-image').src = '';
    }
}
document.addEventListener('DOMContentLoaded', createAndAppendImageModal);
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG') {
        const messageItem = e.target.closest('.message-item');
        if (messageItem) {
            const imageSrc = e.target.src;
            if (imageSrc) openImageModal(imageSrc);
        }
    }
});