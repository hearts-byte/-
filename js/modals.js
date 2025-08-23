// js/modals.js

// js/modals.js

import { RANK_IMAGE_MAP } from './constants.js';
import { uploadFileToCloudinary } from './cloudinary-utils.js';
import { updateUserData, addLike, removeLike, SYSTEM_USER } from './chat-firestore.js';
import { db, auth } from './firebase-config.js'; // تأكد من وجود هذا السطر

// --- Firebase Auth imports for password change modal ---
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { collection, query, orderBy, onSnapshot, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// **متغيرات ودوال المودال الرئيسي**
// js/modals.js
// ... (الاستيرادات)
window.notificationsModalUnsubscribe = null;

// تعريف المتغيرات الرئيسية
const currentUserId = localStorage.getItem('chatUserId');
const notificationsBadge = document.getElementById('notifications-badge');

// **متغيرات ودوال المودال الرئيسي**
window.editProfileModal = null;
window.editProfileCloseButton = null;
// ... (بقية الكود)

const showLoadingSpinner = (buttonElement) => {
    const icon = buttonElement.querySelector('i');
    if (icon) icon.style.display = 'none';
    let spinner = buttonElement.querySelector('.spinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.className = 'spinner';
        buttonElement.appendChild(spinner);
    }
    spinner.style.display = 'block';
};

const hideLoadingSpinner = (buttonElement) => {
    const icon = buttonElement.querySelector('i');
    if (icon) icon.style.display = 'block';
    const spinner = buttonElement.querySelector('.spinner');
    if (spinner) spinner.style.display = 'none';
};

function createEditProfileModalHTML() {
    const modalHTML = `
        <div id="editProfileModal" class="modal-overlay">
            <div class="edit-profile-container">
                <div class="header-section-new">
                    <img id="profile-modal-inner-image" src="images/Interior.png" alt="صورة خلفية المستخدم" class="inner-profile-background-image">
                    <input type="file" id="innerImageUploadInput" accept="image/*" style="display: none;">
                    <input type="file" id="avatarUploadInput" accept="image/*" style="display: none;">
                    <div class="header-left-actions">
                        <span class="header-icon close-profile-modal"><i class="fas fa-times"></i></span>
                        <span class="header-icon change-inner-image"><i class="fas fa-camera"></i></span>
                        <span class="header-icon delete-inner-image"><i class="fas fa-trash-alt"></i></span>
                    </div>
                    <div class="header-right-profile">
                        <div class="user-main-section-wrapper">
                            <div class="likes-and-level">
                                <div class="likes"><span>14</span> <span class="like-icon"><i class="fas fa-thumbs-up"></i></span></div>
                                <div class="level"><span>3</span> <span class="level-icon"><i class="fas fa-star"></i></span></div>
                            </div>
                            <div class="user-main-info">
                                <div class="user-avatar-wrapper">
                                    <img id="profile-modal-avatar" src="https://via.placeholder.com/150/000000/FFFFFF?text=User" alt="صورة المستخدم" />
                                    <div class="avatar-overlay-buttons">
                                        <span class="camera-overlay"><i class="fas fa-camera"></i></span>
                                        <span class="trash-overlay"><i class="fas fa-trash-alt"></i></span>
                                    </div>
                                </div>
                                <div class="user-info-section">
                                    <div class="user-details">
                                        <div class="user-rank-container">
                                            <div class="rank-info">
                                                <img id="profile-modal-rank-image" src="" alt="Rank Image" class="rank-image">
                                                <p class="user-rank" id="profile-modal-user-rank"></p>
                                            </div>
                                        </div>
                                        <div class="user-name-container">
                                            <p class="user-name-display" id="profile-modal-username-display"></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tabs-container">
                    <button class="tab-button active" data-tab="account">حساب</button>
                    <button class="tab-button" data-tab="gifts">الهدايا</button>
                    <button class="tab-button" data-tab="more">المزيد</button>
                </div>
                <div class="tab-content" id="account-tab-content">
                    <ul class="profile-options-list">
                      <li>
                        <button id="editDetailsButton" class="option-btn">
                            <span class="option-icon"><i class="fas fa-user-edit"></i></span>
                            <span class="option-text">تعديل بياناتك</span>
                        </button>
                      </li>
                      <li>
                        <button id="editInfoButton" class="option-btn">
                            <span class="option-icon"><i class="fas fa-user-edit"></i></span>
                            <span class="option-text">تعديل المعلومات</span>
                        </button>
                      </li>
                      <li>
                        <button id="editStatusButton" class="option-btn">
                            <span class="option-icon"><i class="fas fa-pencil-alt"></i></span>
                            <span class="option-text">تعديل الحالة</span>
                        </button>
                      </li>
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-palette"></i></span><span class="option-text">تغيير لون او خط الاسم</span></button></li>
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-font"></i></span><span class="option-text">تغيير لون او خط الرسالة</span></button></li>
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-volume-up"></i></span><span class="option-text">اعدادات الأصوات</span></button></li>
                    </ul>
                </div>
                <div class="tab-content" id="gifts-tab-content" style="display: none;"><p style="color: #333; text-align: center; padding: 20px;">لا توجد هدايا لعرضها حاليًا.</p></div>
                <div class="tab-content" id="more-tab-content" style="display: none;">
                    <ul class="profile-options-list">
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-user-friends"></i></span><span class="option-text">تعديل قائمة الأصدقاء</span></button></li>
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-ban"></i></span><span class="option-text">قائمة المحظورين</span></button></li>
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-share-alt"></i></span><span class="option-text">إعدادات المشاركة</span></button></li>
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-shield-alt"></i></span><span class="option-text">إعدادات الخصوصية</span></button></li>
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-globe"></i></span><span class="option-text">اللغة / الموقع</span></button></li>
                        <li><button id="editEmailButton" class="option-btn"><span class="option-icon"><i class="fas fa-envelope"></i></span><span class="option-text">تعديل البريد الإلكتروني</span></button></li>
                        <li>
                            <button id="changePasswordButton" class="option-btn">
                                <span class="option-icon"><i class="fas fa-key"></i></span>
                                <span class="option-text">تغيير رمز حسابك</span>
                            </button>
                        </li>
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-sign-out-alt"></i></span><span class="option-text">تسجيل الخروج من الحساب</span></button></li>
                        <li><button class="option-btn"><span class="option-icon"><i class="fas fa-trash-alt"></i></span><span class="option-text">حذف عضوية</span></button></li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    window.editProfileModal = document.getElementById('editProfileModal');
    window.editProfileCloseButton = window.editProfileModal ? window.editProfileModal.querySelector('.header-left-actions .close-profile-modal') : null;

    if (window.editProfileCloseButton) {
        window.editProfileCloseButton.addEventListener('click', window.hideEditProfileModal);
    }

    const innerImageUploadInput = document.getElementById('innerImageUploadInput');
    const avatarUploadInput = document.getElementById('avatarUploadInput');
    const changeInnerImageBtn = window.editProfileModal.querySelector('.change-inner-image');
    const deleteInnerImageBtn = window.editProfileModal.querySelector('.delete-inner-image');
    const changeAvatarBtn = window.editProfileModal.querySelector('.avatar-overlay-buttons .camera-overlay');
    const deleteAvatarBtn = window.editProfileModal.querySelector('.avatar-overlay-buttons .trash-overlay');

    if (changeAvatarBtn) changeAvatarBtn.addEventListener('click', () => { avatarUploadInput.click(); });
    if (changeInnerImageBtn) changeInnerImageBtn.addEventListener('click', () => { innerImageUploadInput.click(); });

    if (deleteInnerImageBtn) {
        deleteInnerImageBtn.addEventListener('click', async () => {
            const currentUserId = localStorage.getItem('chatUserId');
            const defaultInnerImage = 'images/Interior.png';
            if (currentUserId) {
                await updateUserData(currentUserId, { innerImage: defaultInnerImage });
                const innerImageElement = document.getElementById('profile-modal-inner-image');
                if (innerImageElement) innerImageElement.src = defaultInnerImage;
                localStorage.setItem('chatUserInnerImage', defaultInnerImage);
                if (window.allUsersAndVisitorsData && Array.isArray(window.allUsersAndVisitorsData)) {
                    const currentUserIndex = window.allUsersAndVisitorsData.findIndex(user => user.id === currentUserId);
                    if (currentUserIndex !== -1) window.allUsersAndVisitorsData[currentUserIndex].innerImage = defaultInnerImage;
                }
            }
        });
    }

    if (deleteAvatarBtn) {
        deleteAvatarBtn.addEventListener('click', async () => {
            const currentUserId = localStorage.getItem('chatUserId');
            const defaultAvatar = 'images/default-user.png';
            if (currentUserId) {
                await updateUserData(currentUserId, { avatar: defaultAvatar });
                const profileModalAvatar = document.getElementById('profile-modal-avatar');
                if (profileModalAvatar) profileModalAvatar.src = defaultAvatar;
                const userProfileImage = document.getElementById('user-profile-image');
                if (userProfileImage) userProfileImage.src = defaultAvatar;
                localStorage.setItem('chatUserAvatar', defaultAvatar);
                if (window.allUsersAndVisitorsData && Array.isArray(window.allUsersAndVisitorsData)) {
                    const currentUserIndex = window.allUsersAndVisitorsData.findIndex(user => user.id === currentUserId);
                    if (currentUserIndex !== -1) window.allUsersAndVisitorsData[currentUserIndex].avatar = defaultAvatar;
                }
                const modalProfileImageInDropdown = document.getElementById('modal-profile-image');
                if (modalProfileImageInDropdown) modalProfileImageInDropdown.src = defaultAvatar;
            }
        });
    }

    if (innerImageUploadInput) {
        innerImageUploadInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                showLoadingSpinner(deleteInnerImageBtn);
                try {
                    const compressedFile = await compressImage(file, 0.7);
                    const imageUrl = await uploadFileToCloudinary(compressedFile);
                    if (imageUrl) {
                        const currentUserId = localStorage.getItem('chatUserId');
                        if (currentUserId) {
                            await updateUserData(currentUserId, { innerImage: imageUrl });
                            const innerImageElement = document.getElementById('profile-modal-inner-image');
                            if (innerImageElement) innerImageElement.src = imageUrl;
                            localStorage.setItem('chatUserInnerImage', imageUrl);
                            if (window.allUsersAndVisitorsData && Array.isArray(window.allUsersAndVisitorsData)) {
                                const currentUserIndex = window.allUsersAndVisitorsData.findIndex(user => user.id === currentUserId);
                                if (currentUserIndex !== -1) window.allUsersAndVisitorsData[currentUserIndex].innerImage = imageUrl;
                            }
                        }
                    } else { alert('فشل رفع الصورة الداخلية.'); }
                } catch (error) {
                    console.error('فشل رفع الصورة الداخلية:', error);
                    alert('حدث خطأ أثناء رفع الصورة الداخلية.');
                } finally {
                    hideLoadingSpinner(deleteInnerImageBtn);
                }
            }
            event.target.value = '';
        });
    }

    if (avatarUploadInput) {
        avatarUploadInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                showLoadingSpinner(deleteAvatarBtn);
                try {
                    const compressedFile = await compressImage(file, 0.7);
                    const imageUrl = await uploadFileToCloudinary(compressedFile);
                    if (imageUrl) {
                        const currentUserId = localStorage.getItem('chatUserId');
                        if (currentUserId) {
                            await updateUserData(currentUserId, { avatar: imageUrl });
                            const profileModalAvatar = document.getElementById('profile-modal-avatar');
                            if (profileModalAvatar) profileModalAvatar.src = imageUrl;
                            const userProfileImage = document.getElementById('user-profile-image');
                            if (userProfileImage) userProfileImage.src = imageUrl;
                            localStorage.setItem('chatUserAvatar', imageUrl);
                            if (window.allUsersAndVisitorsData && Array.isArray(window.allUsersAndVisitorsData)) {
                                const currentUserIndex = window.allUsersAndVisitorsData.findIndex(user => user.id === currentUserId);
                                if (currentUserIndex !== -1) window.allUsersAndVisitorsData[currentUserIndex].avatar = imageUrl;
                            }
                            const modalProfileImageInDropdown = document.getElementById('modal-profile-image');
                            if (modalProfileImageInDropdown) modalProfileImageInDropdown.src = imageUrl;
                        }
                    } else { alert('فشل رفع صورة البروفايل.'); }
                } catch (error) {
                    console.error('فشل رفع صورة البروفايل:', error);
                    alert('حدث خطأ أثناء رفع صورة البروفايل.');
                } finally {
                    hideLoadingSpinner(deleteAvatarBtn);
                }
            }
            event.target.value = '';
        });
    }

    // ---- تفعيل مودال تغيير كلمة المرور من تبويب المزيد ----
    const changePasswordButton = document.getElementById('changePasswordButton');
    if (changePasswordButton) {
        changePasswordButton.onclick = showChangePasswordModal;
    }

    // --- منطق التبويبات
    const tabButtons = window.editProfileModal.querySelectorAll('.tabs-container .tab-button');
    const tabContents = window.editProfileModal.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.style.display = 'none');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.style.display = 'none');
            button.classList.add('active');
            const targetTabId = button.getAttribute('data-tab') + '-tab-content';
            const targetTabContent = document.getElementById(targetTabId);
            if (targetTabContent) targetTabContent.style.display = 'block';
        });
    });
    const accountTabContent = document.getElementById('account-tab-content');
    if (accountTabContent) accountTabContent.style.display = 'block';
}

window.hideEditProfileModal = function() {
    if (window.editProfileModal && window.editProfileModal.classList.contains('show')) {
        window.editProfileModal.classList.remove('show');
        document.removeEventListener('click', window.handleEditProfileModalOutsideClick);
    }
};

window.handleEditProfileModalOutsideClick = function(event) {
    const editProfileButton = document.getElementById('editProfileButton');
    if (window.editProfileModal && !window.editProfileModal.contains(event.target) && event.target !== editProfileButton) {
        window.hideEditProfileModal();
    }
};

window.updateEditProfileModalContent = async function(user) {
    if (!window.editProfileModal) {
        console.warn("Edit Profile Modal not yet created when trying to update content.");
        return;
    }
    const profileModalAvatar = document.getElementById('profile-modal-avatar');
    const userNameDisplay = document.getElementById('profile-modal-username-display');
    const userRankDisplay = document.getElementById('profile-modal-user-rank');
    const profileModalRankImage = document.getElementById('profile-modal-rank-image');
    const innerImageElement = document.getElementById('profile-modal-inner-image');
    const isVisitor = user && user.rank === 'زائر';
    const changeInnerImageBtn = window.editProfileModal.querySelector('.change-inner-image');
    const deleteInnerImageBtn = window.editProfileModal.querySelector('.delete-inner-image');
    const changeAvatarBtn = window.editProfileModal.querySelector('.avatar-overlay-buttons .camera-overlay');
    const deleteAvatarBtn = window.editProfileModal.querySelector('.avatar-overlay-buttons .trash-overlay');

    if (changeInnerImageBtn) changeInnerImageBtn.style.display = isVisitor ? 'none' : '';
    if (deleteInnerImageBtn) deleteInnerImageBtn.style.display = isVisitor ? 'none' : '';
    if (changeAvatarBtn) changeAvatarBtn.style.display = isVisitor ? 'none' : '';
    if (deleteAvatarBtn) deleteAvatarBtn.style.display = isVisitor ? 'none' : '';

    if (user) {
        if (profileModalAvatar) profileModalAvatar.src = user.avatar || 'https://i.imgur.com/Uo9V2Yx.png';
        if (userNameDisplay) userNameDisplay.textContent = user.name || 'غير معروف';
        const userRank = user.rank || 'زائر';
        const userLevel = user.level || 1;
        const userLikes = user.likes ? user.likes.length : 0;
        if (userRankDisplay) userRankDisplay.textContent = userRank;
        if (profileModalRankImage) {
            const rankImageSrc = RANK_IMAGE_MAP[userRank] || RANK_IMAGE_MAP['default'];
            profileModalRankImage.src = rankImageSrc;
            profileModalRankImage.alt = userRank ? `${userRank} Image` : 'Default Rank Image';
        }
        const likesElement = window.editProfileModal.querySelector('.likes span');
        if (likesElement) likesElement.textContent = userLikes;
        const levelElement = window.editProfileModal.querySelector('.level span');
        if (levelElement) levelElement.textContent = userLevel;
        if (innerImageElement) innerImageElement.src = user.innerImage || 'images/Interior.png';
    } else {
        if (profileModalAvatar) profileModalAvatar.src = 'https://i.imgur.com/Uo9V2Yx.png';
        if (userNameDisplay) userNameDisplay.textContent = 'زائر';
        if (userRankDisplay) userRankDisplay.textContent = 'زائر';
        if (profileModalRankImage) profileModalRankImage.src = RANK_IMAGE_MAP['default'];
        if (innerImageElement) innerImageElement.src = 'images/Interior.png';
        const likesElement = window.editProfileModal.querySelector('.likes span');
        if (likesElement) likesElement.textContent = '0';
        const levelElement = window.editProfileModal.querySelector('.level span');
        if (levelElement) levelElement.textContent = '1';
    }
};

document.addEventListener('DOMContentLoaded', createEditProfileModalHTML);

// ---- مودال تغيير كلمة المرور الآمن مع Firebase Auth ----

export const showChangePasswordModal = () => {
    let changePasswordModal = document.getElementById('changePasswordModal');
    if (!changePasswordModal) {
        const modalHTML = `
            <div id="changePasswordModal" class="change-password-overlay">
                <div class="change-password-modal">
                    <div class="modal-header">
                        <h2>تغيير كلمة المرور</h2>
                        <span class="close-button" id="closeChangePasswordModalBtn">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="changePasswordForm" autocomplete="off">
                            <div class="form-group">
                                <label for="currentPassword">كلمة المرور الحالية:</label>
                                <input type="password" id="currentPassword" required autocomplete="current-password">
                            </div>
                            <div class="form-group">
                                <label for="newPassword">كلمة المرور الجديدة:</label>
                                <input type="password" id="newPassword" required autocomplete="new-password">
                            </div>
                            <div class="form-group">
                                <label for="confirmNewPassword">تأكيد كلمة المرور الجديدة:</label>
                                <input type="password" id="confirmNewPassword" required autocomplete="new-password">
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn save-btn">حفظ</button>
                            </div>
                            <div id="changePasswordAlert" style="margin-top:10px;font-size:15px;min-height:22px;"></div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        changePasswordModal = document.getElementById('changePasswordModal');
        
        // زر الإغلاق
        const closeBtn = document.getElementById('closeChangePasswordModalBtn');
        const hideModal = () => {
            if (changePasswordModal) changePasswordModal.classList.remove('show');
        };
        if (closeBtn) closeBtn.addEventListener('click', hideModal);

        // إغلاق عند الضغط على خلفية المودال فقط
        changePasswordModal.addEventListener('click', (e) => {
            if (e.target === changePasswordModal) hideModal();
        });

        // معالجة إرسال النموذج
        const changePasswordForm = document.getElementById('changePasswordForm');
        const alertDiv = document.getElementById('changePasswordAlert');
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            alertDiv.textContent = '';
            const currentPassword = document.getElementById('currentPassword').value.trim();
            const newPassword = document.getElementById('newPassword').value.trim();
            const confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();

            if (newPassword.length < 6) {
                alertDiv.textContent = "كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أكثر.";
                alertDiv.style.color = "red";
                return;
            }
            if (newPassword !== confirmNewPassword) {
                alertDiv.textContent = "تأكيد كلمة المرور غير متطابق.";
                alertDiv.style.color = "red";
                return;
            }

            const user = auth.currentUser;
            if (!user || !user.email) {
                alertDiv.textContent = "يجب أن تسجل دخول بالبريد الإلكتروني لتغيير كلمة المرور.";
                alertDiv.style.color = "red";
                return;
            }
            const cred = EmailAuthProvider.credential(user.email, currentPassword);

            try {
                await reauthenticateWithCredential(user, cred);
                await updatePassword(user, newPassword);
                alertDiv.textContent = "تم تغيير كلمة المرور بنجاح!";
                alertDiv.style.color = "green";
                setTimeout(() => hideModal(), 1500);
            } catch (error) {
                let msg = "حدث خطأ!";
                if (error.code === "auth/wrong-password") msg = "كلمة المرور الحالية غير صحيحة.";
                else if (error.code === "auth/weak-password") msg = "كلمة المرور ضعيفة جداً.";
                else if (error.code === "auth/too-many-requests") msg = "محاولات كثيرة! انتظر قليلاً.";
                else if (error.message) msg = error.message;
                alertDiv.textContent = msg;
                alertDiv.style.color = "red";
            }
        });
    }
    // تهيئة الحقول عند كل إظهار
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    document.getElementById('changePasswordAlert').textContent = '';
    // إظهار المودال (سيعمل مع CSS الذي وضعته)
    changePasswordModal.classList.add('show');
};

// -------------------------------------------------------------------
// منطق مودال الإعدادات (إذا كنت ستستخدمه)
// -------------------------------------------------------------------

// المتغيرات العالمية لمودال الإعدادات
window.settingsModal = null;
window.settingsCloseButton = null;

function createSettingsModalHTML() {
    const modalHTML = `
        <div id="settingsModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>إعدادات التطبيق</h2>
                    <span class="close-button"><i class="fas fa-times"></i></span>
                </div>
                <div class="modal-body">
                    <p style="color: #333;">خيارات الإعدادات هنا.</p>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window.settingsModal = document.getElementById('settingsModal');
    window.settingsCloseButton = window.settingsModal ? window.settingsModal.querySelector('.close-button') : null;
    if (window.settingsCloseButton) {
        window.settingsCloseButton.addEventListener('click', window.hideSettingsModal);
    }
}

window.hideSettingsModal = function() {
    if (window.settingsModal && window.settingsModal.classList.contains('show')) {
        window.settingsModal.classList.remove('show');
        document.removeEventListener('click', window.handleSettingsModalOutsideClick);
    }
};

window.handleSettingsModalOutsideClick = function(event) {
    const settingsButton = document.getElementById('settingsButton');
    if (window.settingsModal && !window.settingsModal.contains(event.target) && event.target !== settingsButton) {
        window.hideSettingsModal();
    }
};

document.addEventListener('DOMContentLoaded', createSettingsModalHTML);

// -------------------------------------------------------------------
// منطق مودال معلومات المستوى (Level Info Modal)
// -------------------------------------------------------------------

// دالة لإنشاء هيكل HTML لمودال معلومات// دالة لإنشاء هيكل HTML لمودال معلومات المستوى وإضافته إلى DOM
function createLevelInfoModalHTML() {
    const modalHTML = `
        <div id="level-info-backdrop" class="level-info-backdrop"></div>
        <div id="level-info-modal" class="level-info-modal">
            <div class="modal-content">
                <button class="close-btn">&times;</button>
                <h3>معلومات المستوى</h3>
                <div class="level-info-card">
                    <div class="level-item">
                        <span class="label">الرتبة:</span>
                        <span id="modal-level-rank" class="value"></span>
                    </div>
                    <div class="level-item">
                        <span class="label">المستوى الحالي:</span>
                        <span id="modal-current-level" class="value"></span>
                    </div>
                    <div class="level-item">
                        <span class="label">إجمالي نقاط الخبرة:</span>
                        <span id="modal-total-exp" class="value"></span>
                    </div>
                    <div class="progress-bar-container">
                        <div id="modal-exp-progress" class="progress-bar"></div>
                    </div>
                </div>
                <button class="close-button-footer">إغلاق</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const levelInfoModal = document.getElementById('level-info-modal');
    const closeLevelModalBtn = levelInfoModal.querySelector('.close-btn');
    const closeFooterBtn = levelInfoModal.querySelector('.close-button-footer');

    closeLevelModalBtn.addEventListener('click', hideLevelInfoModal);
    closeFooterBtn.addEventListener('click', hideLevelInfoModal);
}

// دالة لعرض مودال معلومات المستوى وتحديث// دالة لعرض مودال معلومات المستوى وتحديث محتواه
export function showLevelInfoModal(user) {
    const levelInfoModal = document.getElementById('level-info-modal');
    const backdrop = document.getElementById('level-info-backdrop'); // جلب عنصر الخلفية
    if (!levelInfoModal || !backdrop) {
        console.error("Level Info Modal or backdrop not found.");
        return;
    }

    // تحديث المحتوى بناءً على بيانات المستخدم
    document.getElementById('modal-level-rank').textContent = user.levelRank || 'مبتدئ';
    document.getElementById('modal-current-level').textContent = user.level || 1;
    document.getElementById('modal-total-exp').textContent = user.totalExp || 0;
    document.getElementById('modal-exp-progress').style.width = `${user.expProgress || 0}%`;

    // عرض المودال والخلفية
    backdrop.classList.add('show');
    levelInfoModal.classList.add('show');
}

// دالة لإخفاء مودال معلومات المستوى
export function hideLevelInfoModal() {
    const levelInfoModal = document.getElementById('level-info-modal');
    const backdrop = document.getElementById('level-info-backdrop'); // جلب عنصر الخلفية
    if (levelInfoModal && backdrop) {
        levelInfoModal.classList.remove('show');
        backdrop.classList.remove('show');
    }
}

// استدعاء دالة إنشاء الهيكل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', createLevelInfoModalHTML);

window.g_viewProfileModal = null;

function createViewProfileModalHTML() {
    const modalHTML = `
        <div id="viewProfileModal" class="modal-overlay">
            <div class="edit-profile-container">
                <div class="header-section-new">
                    <img id="view-profile-modal-inner-image" src="images/Interior.png" alt="صورة خلفية المستخدم" class="inner-profile-background-image">
                    <div class="header-left-actions">
                        <span class="header-icon close-profile-modal"><i class="fas fa-times"></i></span>
                    </div>
                    <div class="header-right-profile">
                        <div class="user-main-section-wrapper">
                         <div class="likes-and-level">
    <div id="view-profile-likes" class="likes" data-user-id="">
        <span>-</span> <span class="like-icon"><i class="fas fa-thumbs-up"></i></span>
    </div>
    <div class="level">
        <span>-</span> <span class="level-icon"><i class="fas fa-star"></i></span>
    </div>
                            </div>
                            <div class="user-main-info">
                                <div class="user-avatar-wrapper">
                                    <img id="view-profile-modal-avatar" src="https://via.placeholder.com/150/000000/FFFFFF?text=User" alt="صورة المستخدم" />
                                </div>
                                <div class="user-info-section">
                                    <div class="user-details">
                                        <div class="user-rank-container">
                                            <div class="rank-info">
                                                <img id="view-profile-modal-rank-image" src="" alt="Rank Image" class="rank-image">
                                                <p class="user-rank" id="view-profile-modal-user-rank"></p>
                                            </div>
                                        </div>
                                        <div class="user-name-container">
                                            <p class="user-name-display" id="view-profile-modal-username-display"></p>
                                        </div>
                                        <p class="user-status-display" id="view-profile-modal-status-display"></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tabs-container">
    <button class="tab-button active" data-tab="account">حساب</button>
    <button class="tab-button" data-tab="more">المعلومات</button>
    <button class="tab-button" data-tab="gifts">الهدايا</button>
</div>
              <div class="tab-content" id="view-account-tab-content">
    <ul class="profile-details-list">
        <li>
            <span class="detail-label">العمر:</span>
            <span class="detail-value" id="view-profile-age"></span>
        </li>
        <li>
            <span class="detail-label">الجنس:</span>
            <span class="detail-value" id="view-profile-gender"></span>
        </li>
        <li>
            <span class="detail-label">المستوى:</span>
            <span class="detail-value" id="view-profile-level"></span>
        </li>
    </ul>
</div>
<div class="tab-content" id="view-more-tab-content" style="display: none;">
    <p class="user-info-text" id="view-profile-info"></p>
    <p class="no-info-text" id="no-view-profile-info-message" style="display: none; color: #777; text-align: center; padding: 20px;">لا توجد معلومات إضافية لعرضها.</p>
</div>
<div class="tab-content" id="view-gifts-tab-content" style="display: none;">
    <p style="color: #333; text-align: center; padding: 20px;">لا توجد هدايا لعرضها حاليًا.</p>
</div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    window.g_viewProfileModal = document.getElementById('viewProfileModal');
    const closeButton = window.g_viewProfileModal.querySelector('.close-profile-modal');
    if (closeButton) {
        closeButton.addEventListener('click', window.hideViewProfileModal);
    }
    
    // منطق التبويبات (Tabs)
    const tabButtons = window.g_viewProfileModal.querySelectorAll('.tabs-container .tab-button');
    const tabContents = window.g_viewProfileModal.querySelectorAll('.tab-content');

    tabContents.forEach(content => content.style.display = 'none');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.style.display = 'none');

            button.classList.add('active');
            const targetTabId = 'view-' + button.getAttribute('data-tab') + '-tab-content';
            const targetTabContent = document.getElementById(targetTabId);
            if (targetTabContent) {
                targetTabContent.style.display = 'block';
            }
        });
    });

    const accountTabContent = document.getElementById('view-account-tab-content');
    if (accountTabContent) {
        accountTabContent.style.display = 'block';
    }
}

// تأكد من أنك قمت باستيراد دالة addLike من ملف chat-firestore.js
// import { addLike } from './chat-firestore.js';

// في ملف js/modals.js
// تأكد من استيراد كلتا الدالتين
window.showViewProfileModal = function(userData, allUsersAndVisitorsData) {
    if (!window.g_viewProfileModal) {
        createViewProfileModalHTML();
    }

    const targetUser = allUsersAndVisitorsData.find(user => user.id === userData.id);

    if (targetUser) {
        // تحديث المعلومات الأساسية للملف الشخصي
        document.getElementById('view-profile-modal-avatar').src = targetUser.avatar || 'images/default-user.png';
        document.getElementById('view-profile-modal-username-display').textContent = targetUser.name || 'غير معروف';
        document.getElementById('view-profile-modal-user-rank').textContent = targetUser.rank || 'زائر';
        document.getElementById('view-profile-modal-rank-image').src = RANK_IMAGE_MAP[targetUser.rank] || 'images/default-rank.png';
        document.getElementById('view-profile-modal-inner-image').src = targetUser.innerImage || 'images/Interior.png';
        document.getElementById('view-profile-modal-status-display').textContent = targetUser.statusText || '';

        // تحديث معلومات الإعجابات والمستوى
        const likesElement = document.querySelector('#viewProfileModal .likes span');
        const levelElement = document.querySelector('#viewProfileModal .level span');
        const likesContainer = document.querySelector('#viewProfileModal .likes');
        const likeIcon = document.querySelector('#viewProfileModal .like-icon i');

        const likes = targetUser.likes ? targetUser.likes.length : 0;
        const level = targetUser.level || 1;
        likesElement.textContent = likes;
        levelElement.textContent = level;

        const currentUserId = localStorage.getItem('chatUserId');
        const hasLiked = targetUser.likes && targetUser.likes.includes(currentUserId);
        
        // إزالة مستمع الحدث السابق لتجنب التكرار
        likesContainer.removeEventListener('click', likesContainer._listener);

        if (currentUserId && currentUserId !== targetUser.id) {
            likesContainer.style.cursor = 'pointer';

            if (hasLiked) {
                likesContainer.classList.add('already-liked');
                likeIcon.classList.remove('fa-regular');
                likeIcon.classList.add('fa-solid');
            } else {
                likesContainer.classList.remove('already-liked');
                likeIcon.classList.remove('fa-solid');
                likeIcon.classList.add('fa-regular');
            }

            const newListener = async () => {
                const likedUserId = targetUser.id;
                const userIndex = allUsersAndVisitorsData.findIndex(u => u.id === likedUserId);

                if (hasLiked) {
                    const didRemove = await removeLike(currentUserId, likedUserId);
                    if (didRemove) {
                        if (userIndex !== -1) {
                            const likeIndex = allUsersAndVisitorsData[userIndex].likes.indexOf(currentUserId);
                            if (likeIndex > -1) {
                                allUsersAndVisitorsData[userIndex].likes.splice(likeIndex, 1);
                            }
                        }
                        likesElement.textContent = likes - 1;
                        likesContainer.classList.remove('already-liked');
                        likeIcon.classList.remove('fa-solid');
                        likeIcon.classList.add('fa-regular');
                        likesContainer.removeEventListener('click', likesContainer._listener);
                        showViewProfileModal(userData, allUsersAndVisitorsData);
                    }
                } else {
                    const didLike = await addLike(currentUserId, likedUserId);
                    if (didLike) {
                        if (userIndex !== -1) {
                            if (!allUsersAndVisitorsData[userIndex].likes) {
                                allUsersAndVisitorsData[userIndex].likes = [];
                            }
                            allUsersAndVisitorsData[userIndex].likes.push(currentUserId);
                        }
                        likesElement.textContent = likes + 1;
                        likesContainer.classList.add('already-liked');
                        likeIcon.classList.remove('fa-regular');
                        likeIcon.classList.add('fa-solid');
                        likesContainer.removeEventListener('click', likesContainer._listener);
                        showViewProfileModal(userData, allUsersAndVisitorsData);
                    }
                }
            };
            
            likesContainer.addEventListener('click', newListener);
            likesContainer._listener = newListener;
            
        } else {
            likesContainer.style.cursor = 'default';
        }
        
        // ** إضافة الكود الجديد لتحديث محتوى تبويب "حساب" **
        document.getElementById('view-profile-age').textContent = targetUser.age || 'غير محدد';
        document.getElementById('view-profile-gender').textContent = targetUser.gender || 'غير محدد';
        document.getElementById('view-profile-level').textContent = targetUser.level || 1;

        // ** إضافة الكود الجديد لتحديث محتوى تبويب "المعلومات" **
        const userbioElement = document.getElementById('view-profile-info');
        const noInfoMessageElement = document.getElementById('no-view-profile-info-message');
        if (userbioElement && noInfoMessageElement) {
            if (targetUser.bio && targetUser.bio.trim() !== '') {
                userbioElement.textContent = targetUser.bio;
                userbioElement.style.display = 'block';
                noInfoMessageElement.style.display = 'none';
            } else {
                userbioElement.textContent = '';
                userbioElement.style.display = 'none';
                noInfoMessageElement.style.display = 'block';
            }
        }

    } else {
        console.error('بيانات المستخدم غير موجودة للعرض.');
        return;
    }

    window.g_viewProfileModal.classList.add('show');
    document.addEventListener('click', window.handleViewProfileModalOutsideClick);
};

// ... (تأكد من إضافة دالة addLike في chat-firestore.js وتحديث الـ HTML كما هو موضح في الرد السابق)

window.hideViewProfileModal = function() {
    if (window.g_viewProfileModal) {
        window.g_viewProfileModal.classList.remove('show');
        document.removeEventListener('click', window.handleViewProfileModalOutsideClick);
    }
};

window.handleViewProfileModalOutsideClick = function(event) {
    if (window.g_viewProfileModal && !window.g_viewProfileModal.contains(event.target) && !event.target.closest('.user-info-modal')) {
        window.hideViewProfileModal();
    }
};

document.addEventListener('DOMContentLoaded', createViewProfileModalHTML);

/**
 * تضغط صورة قبل رفعها.
 * @param {File} imageFile - ملف الصورة الأصلي (من حقل الإدخال).
 * @param {number} quality - جودة الصورة بعد الضغط (بين 0 و 1).
 * @returns {Promise<Blob>} - وعد (Promise) يعيد ملف الصورة المضغوطة.
 */
function compressImage(imageFile, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // يمكنك تعديل حجم الصورة هنا إذا أردت
                // حاليًا، نستخدم الحجم الأصلي
                canvas.width = img.width;
                canvas.height = img.height;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // تحويل الصورة إلى blob مع الجودة المطلوبة
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            // Blob هو ملف الصورة المضغوطة
                            resolve(blob);
                        } else {
                            reject(new Error('فشل ضغط الصورة.'));
                        }
                    },
                    'image/jpeg', // يمكنك استخدام 'image/png' إذا كنت تفضل
                    quality
                );
            };
            img.onerror = (error) => reject(error);
            img.src = event.target.result;
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(imageFile);
    });
}

// js/modals.js

// ... (باقي الكود)

/**
 * Creates and shows the notifications modal.
 */
// في ملف modals.js
// ... (الكود السابق)
export function showNotificationsModal() {
    if (window.notificationsModal) {
        return;
    }

    window.notificationsModal = document.createElement('div');
    window.notificationsModal.className = 'notifications-modal modal-overlay';
    window.notificationsModal.innerHTML = `
        <div class="notifications-container">
            <div class="modal-header-new">
                <h3>الإشعارات</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="notifications-list">
                <div class="empty-state">لا يوجد إشعارات حاليًا.</div>
            </div>
        </div>
    `;

    document.body.appendChild(window.notificationsModal);

    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) {
        const btnRect = notificationsBtn.getBoundingClientRect();
        const modalElement = window.notificationsModal;
        const modalWidth = 320;
        const shiftLeft = -110;

        modalElement.style.top = `${btnRect.bottom + 10}px`;
        modalElement.style.left = `${btnRect.right - modalWidth - shiftLeft}px`;
    }

    const notificationsList = window.notificationsModal.querySelector('.notifications-list');
    const emptyState = window.notificationsModal.querySelector('.empty-state');
    
    const currentUserId = localStorage.getItem('chatUserId');

    const notificationsQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', currentUserId),
        orderBy('timestamp', 'desc')
    );
    
    window.notificationsModalUnsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
        notificationsList.innerHTML = '';
        const unreadNotifications = [];
        
        if (snapshot.empty) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            snapshot.forEach((doc) => {
                const notification = doc.data();
                const notificationElement = document.createElement('div');
                // هذا السطر يضيف كلاس "unread" إذا كان الإشعار غير مقروء
                notificationElement.className = `notification-item ${notification.read ? '' : 'unread'}`;
                const timestamp = notification.timestamp ? notification.timestamp.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
                
                const senderName = notification.senderName || 'النظام';
                const senderAvatar = notification.senderAvatar || SYSTEM_USER.avatar;
                const senderRank = notification.senderRank || SYSTEM_USER.rank;

                notificationElement.innerHTML = `
                   <div class="notification-sender-info">
                       <img src="${senderAvatar}" alt="صورة ${senderName}" class="notification-avatar">
                       <span class="notification-sender">${senderName}</span>
                       <span class="notification-rank">${senderRank}</span>
                   </div>
                   <p class="notification-text">${notification.text}</p>
                   <span class="notification-timestamp">${timestamp}</span>
                `;
                notificationsList.appendChild(notificationElement);

                // أضف الإشعارات غير المقروءة إلى المصفوفة
                if (!notification.read) {
                    unreadNotifications.push(doc.ref);
                }
            });

            // إذا كان هناك إشعارات غير مقروءة، قم بتحديثها إلى مقروءة
            if (unreadNotifications.length > 0) {
                const batch = writeBatch(db);
                unreadNotifications.forEach(ref => {
                    batch.update(ref, { read: true });
                });
                batch.commit();
            }
        }
    }, (error) => {
        console.error("خطأ في جلب الإشعارات:", error);
    });

    const closeBtn = window.notificationsModal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideNotificationsModal();
        });
    }

    setTimeout(() => {
        document.addEventListener('click', handleNotificationsModalOutsideClick);
    }, 100);

    setTimeout(() => {
        if (window.notificationsModal) {
            window.notificationsModal.classList.add('show');
        }
    }, 10);
}

// ... (الكود التالي)

// Add this to the hide function to prevent memory leaks
// في دالة hideNotificationsModal في modals.js
export function hideNotificationsModal() {
    if (window.notificationsModal && window.notificationsModal.classList.contains('show')) {
        window.notificationsModal.classList.remove('show');
        
        // إلغاء الاشتراك في المستمع لمنع التكرار
        if (window.notificationsModalUnsubscribe) {
            window.notificationsModalUnsubscribe();
            window.notificationsModalUnsubscribe = null;
        }

        window.notificationsModal.addEventListener('transitionend', () => {
            if (window.notificationsModal) {
                window.notificationsModal.remove();
                window.notificationsModal = null;
            }
        }, { once: true });
        document.removeEventListener('click', handleNotificationsModalOutsideClick);
    }
}

// ... (نهاية دالة hideNotificationsModal)


// دالة جديدة للاستماع إلى الإشعارات غير المقروءة

// ... (بقية الكود)
window.handleNotificationsModalOutsideClick = function(event) {
    const notificationsBtn = document.getElementById('notifications-btn');
    if (window.notificationsModal && !window.notificationsModal.contains(event.target) && !notificationsBtn.contains(event.target)) {
        hideNotificationsModal();
    }
};

// ... (نهاية دالة hideNotificationsModal)


// دالة جديدة للاستماع إلى الإشعارات غير المقروءة بشكل مستمر
export function listenForUnreadNotifications() {
    const currentUserId = localStorage.getItem('chatUserId');
    const notificationsBadge = document.getElementById('notifications-badge');

    if (!currentUserId || !notificationsBadge) {
        return;
    }

    const unreadQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', currentUserId),
        where('read', '==', false)
    );

    onSnapshot(unreadQuery, (snapshot) => {
        if (snapshot.size > 0) {
            notificationsBadge.classList.add('show');
        } else {
            notificationsBadge.classList.remove('show');
        }
    });
}

// ... (نهاية الدوال)

// استدعاء المستمع الجديد عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    listenForUnreadNotifications();
});