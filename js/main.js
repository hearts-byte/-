// js/main.js
// الكود الصحيح
import { 
    loadComponent, createAndShowPrivateChatDialog, createUserInfoModal, updatePrivateButtonNotification, hideUserInfoModal, checkAndSendJoinMessage, 
    createSystemMessageElement, createMessageElement, addRegistrationButtonToBottomBar 
} from './chat-ui.js';
import { 
    loadInitialMessages, loadMoreMessages, listenForNewMessages,
    sendMessage, getPrivateChatContacts, getAllUsersAndVisitors, getUserData, setupPrivateMessageNotificationListener, sendJoinMessage, deleteChatRoomMessages, sendSystemMessage, getChatRooms, listenForUserRankChanges
} from './chat-firestore.js';
import { RANK_ORDER, RANK_IMAGE_MAP, RANK_PERMISSIONS } from './constants.js';
import { showLevelInfoModal, showNotificationsModal, listenForUnreadNotifications } from './modals.js';
import { uploadFileToCloudinary } from './cloudinary-utils.js';
import { auth, db } from './firebase-config.js';
import { doc, onSnapshot, updateDoc, getDoc, deleteDoc, query, where, and, or, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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
 
let isReloading = false;
 

auth.onAuthStateChanged(user => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        onSnapshot(userDocRef, (docSnap) => {
            const userData = docSnap.data();
            if (userData) {
                // تحديث الواجهة العامة
                const mainMessageInput = document.getElementById('message-input');
                const mainSendButton = document.querySelector('.send-btn');
                const mainEmojiButton = document.querySelector('.emoji-btn-circle');
                const mainPlusButton = document.getElementById('plus-btn-toggle');
                const mainImageUpload = document.getElementById('image-upload-input');
                checkMuteStatusAndUpdateUI(mainMessageInput, mainSendButton, mainEmojiButton, mainPlusButton, mainImageUpload);

                // ✨ تحديث الواجهة الخاصة إذا كانت مفتوحة
                const privateChatInput = document.querySelector('.private-chat-input');
                if (privateChatInput) {
                    const privateChatSendBtn = document.querySelector('.private-chat-send-btn');
                    const privateEmojiButton = null;
                    const privatePlusButton = null;
                    const privateImageUpload = null;
                    checkMuteStatusAndUpdateUI(privateChatInput, privateChatSendBtn, privateEmojiButton, privatePlusButton, privateImageUpload);
                }

                if (userData.needsRefresh && !isReloading) {
                    isReloading = true;
                    if (userData.rank) {
                        localStorage.setItem('chatUserRank', userData.rank);
                    }
                    updateDoc(userDocRef, {
                        needsRefresh: false
                    }).then(() => {
                        console.log("تم تحديث بيانات المستخدم بنجاح.");
                    }).catch((error) => {
                        console.error("خطأ في إعادة تعيين حقل التحديث:", error);
                        window.location.reload();
                    });
                }
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
    if (privateChatModal && privateChatModal.classList.contains('show')) {
        return; 
    }

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
    <button class="delete-all-btn"><i class="fas fa-trash-alt"></i></button>
</div>
        <ul class="private-chat-list">
            <div class="spinner-container">
                <div class="loading-spinner"></div>
            </div>
        </ul>
    `;
    document.body.appendChild(privateChatModal);

    const buttonRect = buttonElement.getBoundingClientRect();
    const modalWidth = 200;
    const topBarElement = document.querySelector('.top-bar');
    const inputBarElement = document.querySelector('.bottom-bar');
    const topBarHeight = topBarElement ? topBarElement.offsetHeight : 0;
    const inputBarHeight = inputBarElement ? inputBarElement.offsetHeight : 0;
    const padding = 5;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let modalLeft = buttonRect.right - modalWidth;
    let modalTop = buttonRect.bottom + padding;

    if (modalLeft < padding) modalLeft = padding;
    if (modalLeft + modalWidth > viewportWidth - padding) modalLeft = viewportWidth - modalWidth - padding;
    if (modalTop < topBarHeight + padding) modalTop = topBarHeight + padding;

    const maxModalHeight = viewportHeight - modalTop - inputBarHeight - (2 * padding);
    privateChatModal.style.maxHeight = `${maxModalHeight}px`;
    privateChatModal.style.overflowY = 'auto';

    privateChatModal.style.left = `${modalLeft}px`;
    privateChatModal.style.top = `${modalTop}px`;
    privateChatModal.classList.add('show');
    privateChatModal.querySelector('.delete-all-btn').addEventListener('click', () => {
    showDeleteAllConfirmationModal(deleteAllPrivateChats);
});

    document.addEventListener('click', handlePrivateChatModalOutsideClick);

    const currentUserId = localStorage.getItem('chatUserId');
    if (currentUserId) {
        try {
            const ulElement = privateChatModal.querySelector('.private-chat-list');
            const contacts = await getPrivateChatContacts(currentUserId);
            ulElement.innerHTML = '';
            if (contacts.length === 0) {
                ulElement.innerHTML = `
                    <li class="empty-chat-message">
                        <img src="nodata.png" alt="صندوق رسائل فارغ" class="empty-chat-icon">
                        <p>صندوق رسائلك فارغ</p>
                    </li>
                `;
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
    <span class="delete-contact-btn" data-user-id="${contact.id}">&times;</span>
`;
                    li.addEventListener('click', () => {
                        hidePrivateChatModal();
                        createAndShowPrivateChatDialog(contact);
                    });
                    ulElement.appendChild(li);
                });
            }

            ulElement.querySelectorAll('.delete-contact-btn').forEach(deleteBtn => {
                deleteBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const contactIdToDelete = deleteBtn.getAttribute('data-user-id');
                    const currentUserId = localStorage.getItem('chatUserId');
                    if (!currentUserId || !contactIdToDelete) {
                        console.error("معرف المستخدم أو جهة الاتصال غير موجود.");
                        return;
                    }
                    try {
                        const chatQuery = query(collection(db, 'privateChats'), 
                                                or(
                                                    and(where('senderId', '==', currentUserId), where('receiverId', '==', contactIdToDelete)),
                                                    and(where('senderId', '==', contactIdToDelete), where('receiverId', '==', currentUserId))
                                                ));
                        const chatSnapshot = await getDocs(chatQuery);
                        if (!chatSnapshot.empty) {
                            const chatDoc = chatSnapshot.docs[0];
                            await deleteDoc(doc(db, 'privateChats', chatDoc.id));
                        }
                        const listItem = deleteBtn.closest('li');
                        if (listItem) {
                            listItem.remove();
                            console.log(`تم حذف المحادثة بنجاح: ${contactIdToDelete}`);
                            const ulElement = privateChatModal.querySelector('.private-chat-list');
                            const remainingItems = ulElement.querySelectorAll('li:not(.empty-chat-message)');
                            if (remainingItems.length === 0) {
                                ulElement.innerHTML = `
                                    <li class="empty-chat-message">
                                        <img src="nodata.png" alt="صندوق رسائل فارغ" class="empty-chat-icon">
                                        <p>صندوق رسائلك فارغ</p>
                                    </li>
                                `;
                            }
                        }
                    } catch (error) {
                        console.error("خطأ في حذف المحادثة:", error);
                        alert("فشل حذف المحادثة. يرجى التأكد من صلاحيات الحذف.");
                    }
                });
            });

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
    <div class="user-main-info">
        <span class="user-name">${user.name}</span>
        <span class="user-status">${user.statusText || ''}</span>
    </div>
    <div class="user-rank-box">
        <img src="${rankImageSrc}" alt="${user.rank}" class="user-rank-image" title="${user.rank}" />
    </div>
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
    <div class="user-main-info">
        <span class="user-name">${user.name}</span>
        <span class="user-status">${user.statusText || ''}</span>
    </div>
    <div class="user-rank-box">
        <img src="${rankImageSrc}" alt="${user.rank}" class="user-rank-image" title="${user.rank}" />
    </div>
`;
const userAvatarElement = userItemDiv.querySelector('.user-avatar-small');
if (userAvatarElement) {
    userAvatarElement.addEventListener('click', (event) => {
        event.stopPropagation();
        createUserInfoModal(userAvatarElement, user, window.allUsersAndVisitorsData);
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

export function renderMessages(docs, clear = false) {
    const chatBox = document.querySelector('#chat-box .chat-box');
    if (!chatBox) return;

    // ✨ حفظ موضع التمرير الحالي قبل إضافة الرسائل الجديدة.
    // ✨ هذا مهم عند تحميل رسائل قديمة لمنع القفز المفاجئ.
    const isAtBottom = (chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 1);
    const oldScrollHeight = chatBox.scrollHeight;

    // ✨ إذا كان 'clear' صحيحاً، امسح كل الرسائل الموجودة.
    if (clear) {
        chatBox.innerHTML = '';
    }

    docs.forEach(docSnap => {
        const msgData = { id: docSnap.id, ...docSnap.data() };
        const senderData = window.allUsersAndVisitorsData?.find(u => u.id === msgData.senderId);
        
        // ✨ هذا الشرط مهم: يجب التأكد من عدم إضافة الرسائل المكررة.
        // ✨ إذا كانت الرسالة موجودة مسبقًا، لا تفعل شيئاً.
        const existingElement = chatBox.querySelector(`[data-id="${msgData.id}"]`);
        if (existingElement) {
            return;
        }

        if (!msgData.isSystemMessage) {
            msgData.userType = senderData?.rank === 'زائر' ? 'visitor' : 'registered';
            msgData.senderRank = senderData?.rank || 'زائر';
            msgData.level = senderData?.level || 1;
        }
        
        const elem = msgData.isSystemMessage ?
            createSystemMessageElement(msgData.text) :
            createMessageElement(msgData);

        if (clear) {
            // ✨ عند التحميل الأولي، أضف الرسائل في النهاية.
            chatBox.appendChild(elem);
        } else {
            // ✨ عند تحميل رسائل أقدم، أضفها في البداية.
            chatBox.insertBefore(elem, chatBox.firstChild);
        }
    });

    // ✨ بعد إضافة الرسائل الجديدة، اضبط موضع التمرير.
    setTimeout(() => {
        if (clear) {
            // ✨ عند التحميل الأولي، مرر للأسفل.
            chatBox.scrollTop = chatBox.scrollHeight;
        } else if (!isAtBottom) {
            // ✨ عند تحميل المزيد من الرسائل القديمة، حافظ على موضع التمرير.
            chatBox.scrollTop = chatBox.scrollHeight - oldScrollHeight;
        }
    }, 0);
}

// في ملف main.js
// ... (بقية الكود) ...
async function showDeleteAllConfirmationModal(onConfirm) {
    let confirmationModal = document.querySelector('.confirmation-modal');
    if (!confirmationModal) {
        confirmationModal = document.createElement('div');
        confirmationModal.classList.add('confirmation-modal');
        confirmationModal.innerHTML = `
            <p>هل أنت متأكد من أنك تريد حذف جميع جهات الاتصال والمحادثات؟</p>
            <div class="modal-buttons">
                <button class="confirm-btn">تأكيد</button>
                <button class="cancel-btn">إلغاء</button>
            </div>
        `;
        document.body.appendChild(confirmationModal);
    }

    confirmationModal.style.display = 'block';

    const confirmBtn = confirmationModal.querySelector('.confirm-btn');
    const cancelBtn = confirmationModal.querySelector('.cancel-btn');

    confirmBtn.onclick = async (event) => {
        event.stopPropagation(); // ✨ منع إغلاق المودال
        await onConfirm();
        confirmationModal.style.display = 'none';
    };

    cancelBtn.onclick = (event) => {
        event.stopPropagation(); // ✨ منع إغلاق المودال
        confirmationModal.style.display = 'none';
    };
}


async function deleteAllPrivateChats() {
    const currentUserId = localStorage.getItem('chatUserId');
    if (!currentUserId) {
        console.error("معرف المستخدم غير موجود.");
        return;
    }

    try {
        const chatQuery = query(collection(db, 'privateChats'), 
                                or(
                                    where('senderId', '==', currentUserId),
                                    where('receiverId', '==', currentUserId)
                                ));
        const chatSnapshot = await getDocs(chatQuery);
        
        const deletePromises = [];
        chatSnapshot.forEach(docSnap => {
            deletePromises.push(deleteDoc(doc(db, 'privateChats', docSnap.id)));
        });
        
        await Promise.all(deletePromises);

        // ✨ تحديث واجهة المستخدم بعد الحذف
        const ulElement = privateChatModal.querySelector('.private-chat-list');
        ulElement.innerHTML = `
            <li class="empty-chat-message">
                <img src="nodata.png" alt="صندوق رسائل فارغ" class="empty-chat-icon">
                <p>صندوق رسائلك فارغ</p>
            </li>
        `;
        console.log("تم حذف جميع المحادثات بنجاح.");

    } catch (error) {
        console.error("خطأ في حذف جميع المحادثات:", error);
        alert("فشل حذف المحادثات. يرجى المحاولة مرة أخرى.");
    }
}


// دالة جديدة للتحقق من حالة الكتم وتحديث واجهة المستخدم
 
export async function checkMuteStatusAndUpdateUI() {
    const currentUserId = localStorage.getItem('chatUserId');
    if (!currentUserId) return;

    // عناصر واجهة المستخدم للدردشة العامة
    const mainMessageInput = document.getElementById('message-input');
    const mainSendButton = document.querySelector('.send-btn');
    const mainEmojiButton = document.querySelector('.emoji-btn-circle');
    const mainPlusButton = document.getElementById('plus-btn-toggle');
    const mainImageUpload = document.getElementById('image-upload-input');

    // عناصر واجهة المستخدم للدردشة الخاصة
    const privateMessageInput = document.getElementById('private-message-input');
    const privateSendButton = document.getElementById('private-send-btn');
    const privateEmojiButton = document.getElementById('private-emoji-btn');
    // 👇🏻 هذا هو السطر الذي يجب تعديله. يجب أن يتطابق مع الـ ID الفعلي.
    const privatePlusButton = document.getElementById('private-plus-btn-toggle'); 
    const privateImageUpload = document.getElementById('private-image-upload');
    
    // تأكد من أن الكود لا ينهار إذا لم يتم العثور على أي عنصر
    if (!mainMessageInput && !privateMessageInput) {
        console.error('فشل في العثور على أي من حقول إدخال الدردشة.');
        return;
    }

    try {
        let userDocRef = doc(db, "users", currentUserId);
        let userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            userDocRef = doc(db, "visitors", currentUserId);
            userDocSnap = await getDoc(userDocRef);
        }

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const isMuted = userData.isMuted || false;
            const mutedUntil = userData.mutedUntil;

            let isMutedNow = isMuted;
            if (isMuted && mutedUntil !== 'permanent' && mutedUntil < Date.now()) {
                await updateDoc(userDocRef, { isMuted: false, mutedUntil: null });
                isMutedNow = false;
            }

            const applyMuteRestrictions = (input, send, emoji, plus, image) => {
                if (input) {
                    input.disabled = true;
                    input.placeholder = 'الدردشة مقفلة';
                    input.value = '';
                }
                if (send) send.disabled = true;
                if (emoji) emoji.disabled = true;
                if (plus) plus.disabled = true;
                if (image) image.disabled = true;
            };

            const removeMuteRestrictions = (input, send, emoji, plus, image) => {
                if (input) {
                    input.disabled = false;
                    input.placeholder = 'اكتب هنا...';
                }
                if (send) send.disabled = false;
                if (emoji) emoji.disabled = false;
                if (plus) plus.disabled = false;
                if (image) image.disabled = false;
            };

            if (isMutedNow) {
                applyMuteRestrictions(mainMessageInput, mainSendButton, mainEmojiButton, mainPlusButton, mainImageUpload);
                applyMuteRestrictions(privateMessageInput, privateSendButton, privateEmojiButton, privatePlusButton, privateImageUpload);
            } else {
                removeMuteRestrictions(mainMessageInput, mainSendButton, mainEmojiButton, mainPlusButton, mainImageUpload);
                removeMuteRestrictions(privateMessageInput, privateSendButton, privateEmojiButton, privatePlusButton, privateImageUpload);
            }
        }
    } catch (error) {
        console.error("خطأ في التحقق من حالة الكتم:", error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponent("top-bar", "components/top-bar.html");
    await loadComponent("chat-box", "components/chat-box.html");
    await loadComponent("input-bar", "components/input-bar.html");
    await loadComponent("bottom-bar", "components/bottom-bar.html");
    
    //js/main.js
// ... (الكود السابق لا يتغير) ...

    try {
    // حاول جلب كل المستخدمين والزوار
    window.allUsersAndVisitorsData = await getAllUsersAndVisitors(true);
} catch (error) {
    // إذا فشل الاتصال، لا تفعل شيئاً حالياً
    console.error("خطأ في جلب البيانات: قد يكون هناك مشكلة في الاتصال.");
}

let chatUserId = localStorage.getItem('chatUserId');
    let chatUserName = localStorage.getItem('chatUserName');
    let chatUserAvatar = localStorage.getItem('chatUserAvatar');
    let userType = localStorage.getItem('userType');
let isOnline = navigator.onLine; // تحقق من حالة الاتصال بالإنترنت

// إذا لم يكن هناك معرف للمستخدم في localStorage، قم بإعادة التوجيه مباشرة
if (!chatUserId) {
    window.location.href = 'index.html';
    return;
}

// إذا كان الاتصال متاحًا (online)
if (isOnline) {
    // ابحث عن المستخدم في البيانات التي تم جلبها
    const userData = window.allUsersAndVisitorsData?.find(user => user.id === chatUserId);

    // إذا لم يتم العثور على بيانات المستخدم، يعني أن الحساب محذوف.
    if (!userData) {
        console.warn('الحساب غير موجود في قاعدة البيانات. يتم إعادة التوجيه.');
        localStorage.clear(); // مسح كل بيانات المستخدم
        window.location.href = 'index.html';
        return;
    }
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

checkMuteStatusAndUpdateUI();

// --- الاستماع اللحظي للرسائل الجديدة فقط ---

if (messagesUnsubscriber) messagesUnsubscriber();
messagesUnsubscriber = listenForNewMessages(currentRoomId);
listenForUserRankChanges();

addRegistrationButtonToBottomBar(currentUserRank); // قم بتمرير الرتبة هنا
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
                    const privateBtn = document.getElementById('privateButton');
if (privateBtn) {
    const canSeePrivateChat = RANK_PERMISSIONS[currentUserRank]?.canSeePrivateChatButton;
    privateBtn.style.display = canSeePrivateChat ? 'flex' : 'none';
}
                    const reportBtn = document.querySelector('.top-bar .btn.report');
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
        
        // main.js
// ... (الاستيرادات الأخرى)

// ... (بقية الكود)

const handleMessageSend = async () => {
    const messageText = messageInput.value.trim();
    if (!messageText) return;

 // في ملف main.js، داخل دالة handleMessageSend
    if (messageText.toLowerCase() === '/clear') {
        messageInput.value = '';

        const currentUserRank = localStorage.getItem('chatUserRank');
        if (!RANK_PERMISSIONS[currentUserRank]?.canClearRoom) {
            showNotification('عذراً، لا تملك صلاحية لتنظيف الغرفة.', 'error');
            return;
        }

        try {
            // 1. إلغاء الاشتراك من المستمع مؤقتاً
            if (messagesUnsubscriber) {
                messagesUnsubscriber();
                messagesUnsubscriber = null;
            }

            // 2. حذف جميع الرسائل من قاعدة البيانات
            await deleteChatRoomMessages(currentRoomId);

            // ✨ هذا هو التعديل الأساسي: مسح الواجهة فوراً
            const chatBox = document.querySelector('#chat-box .chat-box');
            if (chatBox) {
                chatBox.innerHTML = ''; // مسح الرسائل من الواجهة
                const chatUserName = localStorage.getItem('chatUserName') || 'مستخدم مجهول';
                const confirmationMessageText = `تم تنظيف الغرفة من قبل ${chatUserName}`;
                const elem = createSystemMessageElement(confirmationMessageText);
                chatBox.appendChild(elem); // إضافة رسالة النظام فوراً
            }

            // 3. إرسال رسالة نظام نوعها clear (ليراها المستخدمون الآخرون)
            const chatUserName = localStorage.getItem('chatUserName') || 'مستخدم مجهول';
            const confirmationMessage = `تم تنظيف الغرفة من قبل ${chatUserName}`;
            await sendSystemMessage({ text: confirmationMessage, type: 'clear' }, currentRoomId);

            // 4. إعادة الاشتراك في المستمع
            messagesUnsubscriber = listenForNewMessages(currentRoomId);

        } catch (error) {
            showNotification('فشل تنظيف الدردشة.', 'error');
        }
        return;
    }
    // ... (بقية الكود)


    // كود إرسال الرسائل العادية
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
};
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

/**
 * تعرض إشعارًا مؤقتًا في أعلى الصفحة.
 * @param {string} message - نص الرسالة.
 * @param {string} type - نوع الرسالة (e.g., 'error', 'success').
 */
function showNotification(message, type = 'error') {
    // 1. إنشاء العنصر الجديد
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // 2. تطبيق التنسيق الأساسي (يمكنك وضع هذا في ملف CSS)
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.color = '#fff';
    notification.style.zIndex = '1000';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease-in-out';

    // 3. تحديد الألوان حسب النوع
    if (type === 'error') {
        notification.style.backgroundColor = 'rgba(220, 53, 69, 0.9)'; // أحمر
    } else if (type === 'success') {
        notification.style.backgroundColor = 'rgba(40, 167, 69, 0.9)'; // أخضر
    }

    // 4. إضافته إلى الجسم
    document.body.appendChild(notification);

    // 5. إظهار الإشعار تدريجياً
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);

    // 6. إزالته بعد 3 ثوانٍ
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.addEventListener('transitionend', () => {
            notification.remove();
        });
    }, 3000); // يختفي بعد 3 ثوانٍ
}
