// js/script.js

import { db, serverTimestamp, auth } from './firebase-config.js';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const storedUsername = localStorage.getItem('chatUserName');
  const storedUserId = localStorage.getItem('chatUserId');
  const storedUserAvatar = localStorage.getItem('chatUserAvatar');
  const storedUserRank = localStorage.getItem('chatUserRank');
  const storedUserType = localStorage.getItem('userType');

  if (storedUsername && storedUserId && storedUserAvatar && storedUserRank && storedUserType) {
    window.location.href = 'chat.html';
    return;
  }

  const visitorModal = document.getElementById('visitorModal');
  const registerModal = document.getElementById('registerModal');
  const memberModal = document.getElementById('memberModal');

  const openVisitorModalBtn = document.getElementById('openVisitorModal');
  const openRegisterModalBtn = document.getElementById('openRegisterModal');
  const openMemberModalBtn = document.getElementById('openMemberModal');

  const closeVisitorModalBtn = document.querySelector('.visitor-close-button');
  const closeRegisterModalBtn = document.querySelector('.register-close-button');
  const closeMemberModalBtn = document.querySelector('.member-close-button');

  const visitorForm = document.getElementById('visitorForm');
  const registerForm = document.getElementById('registerForm');
  const memberForm = document.getElementById('memberForm');

  const alertMessageDiv = document.getElementById('alertMessage');

  const DEFAULT_USER_AVATAR = 'images/default-user.png';
  const DEFAULT_VISITOR_AVATAR = 'images/default-visitor.png';

  function populateAgeDropdown(selectElementId, minAge, maxAge) {
    const selectElement = document.getElementById(selectElementId);
    if (selectElement) {
      if (!selectElement.querySelector('option[value=""]')) {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'اختر عمرك';
        selectElement.appendChild(defaultOption);
      }
      for (let i = minAge; i <= maxAge; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        selectElement.appendChild(option);
      }
    }
  }
  populateAgeDropdown('visitorAge', 15, 99);
  populateAgeDropdown('registerAge', 15, 99);

  function openModal(modal) {
    modal.style.display = 'flex';
  }
  function closeModal(modal) {
    modal.style.display = 'none';
    if (modal === visitorModal) visitorForm.reset();
    else if (modal === registerModal) registerForm.reset();
    else if (modal === memberModal) memberForm.reset();
  }

  function showMessage(message, type = 'info', duration = 4000) {
    alertMessageDiv.textContent = message;
    alertMessageDiv.className = 'alert-message show';
    alertMessageDiv.classList.add(type);
    setTimeout(() => {
      alertMessageDiv.classList.remove('show');
      setTimeout(() => {
        alertMessageDiv.className = 'alert-message';
      }, 500);
    }, duration);
  }

  openVisitorModalBtn.addEventListener('click', () => openModal(visitorModal));
  openRegisterModalBtn.addEventListener('click', () => openModal(registerModal));
  openMemberModalBtn.addEventListener('click', () => openModal(memberModal));
  closeVisitorModalBtn.addEventListener('click', () => closeModal(visitorModal));
  closeRegisterModalBtn.addEventListener('click', () => closeModal(registerModal));
  closeMemberModalBtn.addEventListener('click', () => closeModal(memberModal));

  // تحقق من وجود اسم مستخدم في الزوار أو الأعضاء
  async function isUsernameTaken(username) {
    const visitorsQuery = query(
      collection(db, 'visitors'),
      where('name', '==', username),
      limit(1)
    );
    const visitorSnapshot = await getDocs(visitorsQuery);
    if (!visitorSnapshot.empty) return true;

    const usersQuery = query(
      collection(db, 'users'),
      where('username', '==', username),
      limit(1)
    );
    const userSnapshot = await getDocs(usersQuery);
    if (!userSnapshot.empty) return true;
    return false;
  }
  
  // دالة لتوليد أربعة أرقام عشوائية
  function generateRandomFourDigits() {
  const randomNumber = Math.floor(Math.random() * 9000) + 1000;
  return randomNumber;
}

  // ================= دخول الزوار ==================
  visitorForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const visitorName = document.getElementById('visitorName').value.trim();
    const visitorAge = document.getElementById('visitorAge').value;
    const visitorGender = document.getElementById('visitorGender').value;
    const userRank = 'زائر';

    if (visitorName === '' || visitorAge === '' || visitorGender === '') {
      showMessage('يرجى ملء جميع الحقول للمتابعة كزائر.', 'error');
      return;
    }

    try {
      if (await isUsernameTaken(visitorName)) {
        showMessage('اسم المستخدم الذي أدخلته مستخدم بالفعل. الرجاء اختيار اسم آخر غير مكرر.', 'error');
        return;
      }
      const docRef = await addDoc(collection(db, 'visitors'), {
        name: visitorName,
        age: visitorAge,
        gender: visitorGender,
        timestamp: serverTimestamp(),
        userType: 'visitor',
        avatar: DEFAULT_VISITOR_AVATAR,
        rank: userRank,
        likes: []
      });

      localStorage.setItem('chatUserName', visitorName);
      localStorage.setItem('userType', 'visitor');
      localStorage.setItem('chatUserId', docRef.id);
      localStorage.setItem('chatUserAvatar', DEFAULT_VISITOR_AVATAR);
      localStorage.setItem('chatUserRank', userRank);

      localStorage.setItem('fromRegistrationPage', 'true');
      window.location.href = 'rooms.html';

    } catch (error) {
      console.error("خطأ أثناء تسجيل الزائر:", error);
      showMessage('حدث خطأ غير متوقع أثناء التسجيل كزائر. يرجى إعادة المحاولة أو التواصل مع الدعم.', 'error');
    }
  });

// ================= تسجيل عضوية جديدة ==================
registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const registerName = document.getElementById('registerName').value.trim();
  const registerPassword = document.getElementById('registerPassword').value;
  const registerAge = document.getElementById('registerAge').value;
  const registerGender = document.getElementById('registerGender').value;
  const userRank = 'عضو';
  
  // توليد بريد إلكتروني تلقائي
  const randomDigits = generateRandomFourDigits();
  const registerEmail = `user_${randomDigits}@gmail.com`;

  if (registerName === '' || registerPassword === '' || registerAge === '' || registerGender === '') {
    showMessage('يرجى ملء جميع الحقول لإنشاء حساب جديد.', 'error');
    return;
  }

  // داخل registerForm.addEventListener('submit', ...)
try {
  if (await isUsernameTaken(registerName)) {
    showMessage('اسم المستخدم مستخدم سابقاً. الرجاء اختيار اسم فريد.', 'error');
    return;
  }
  // إنشاء معرف عشوائي للمستخدم
  const userId = crypto.randomUUID();

  // حفظ بيانات المستخدم في Firestore بما فيها كلمة المرور
  await setDoc(doc(db, 'users', userId), {
    username: registerName,
    email: registerEmail,
    password: registerPassword, // ⚠️ غير آمن، يفضل التشفير
    age: registerAge,
    gender: registerGender,
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

  localStorage.setItem('fromRegistrationPage', 'true');
  window.location.href = 'rooms.html';

} catch (error) {
    console.error("خطأ أثناء تسجيل الحساب:", error);
    if (error.code === 'auth/weak-password') {
      showMessage('كلمة المرور ضعيفة. يجب أن تحتوي على 6 أحرف على الأقل.', 'error');
    } else {
      showMessage('حدث خطأ غير متوقع أثناء التسجيل. يرجى إعادة المحاولة أو التواصل مع الدعم الفني.', 'error');
    }
  }
});

  // ================= دخول الأعضاء ==================
  memberForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const memberInput = document.getElementById('memberName').value.trim();
  const memberPassword = document.getElementById('memberPassword').value;

  if (memberInput === '' || memberPassword === '') {
    showMessage('يرجى إدخال اسم المستخدم أو البريد الإلكتروني بالإضافة إلى كلمة المرور.', 'error');
    return;
  }

  try {
    // البحث عن المستخدم بالاسم أو البريد الإلكتروني
    let userQuery;
    if (memberInput.includes('@')) {
      userQuery = query(collection(db, 'users'), where('email', '==', memberInput), limit(1));
    } else {
      userQuery = query(collection(db, 'users'), where('username', '==', memberInput), limit(1));
    }
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      showMessage('لم يتم العثور على أي حساب بهذا الاسم أو البريد.', 'error');
      return;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // تحقق من كلمة المرور المدخلة (بدون تشفير – غير آمن للإنتاج)
    if (userData.password !== memberPassword) {
      showMessage('كلمة المرور غير صحيحة. يرجى إعادة المحاولة.', 'error');
      return;
    }

    // تسجيل دخول المستخدم
    const userId = userDoc.id;
    const userAvatar = userData.avatar || DEFAULT_USER_AVATAR;
    const userRank = userData.rank || 'عضو';

    localStorage.setItem('chatUserName', userData.username);
    localStorage.setItem('userType', 'registered');
    localStorage.setItem('chatUserId', userId);
    localStorage.setItem('chatUserAvatar', userAvatar);
    localStorage.setItem('chatUserRank', userRank);

    localStorage.setItem('fromRegistrationPage', 'true');
    window.location.href = 'chat.html';

  } catch (error) {
    console.error("خطأ أثناء تسجيل الدخول:", error);
    showMessage('حدث خطأ غير متوقع أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى أو التواصل مع الدعم.', 'error');
  }
});

  const contactButton = document.querySelector('.contact-button');
  if (contactButton) {
    contactButton.addEventListener('click', () => {
      showMessage('خدمة "اتصل بنا" قيد التطوير وستكون متاحة قريباً.', 'info');
    });
  }
});
