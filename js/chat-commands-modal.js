// chat-commands-modal.js
import { RANK_ORDER, RANK_IMAGE_MAP } from './constants.js';
import { db } from './firebase-config.js';
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { addNotification, SYSTEM_USER, sendSystemMessage } from './chat-firestore.js';
 
const currentUserRank = localStorage.getItem('chatUserRank') || 'زائر';
 
const permissions = {
  'مالك': { tabs: ['account', 'commands', 'room-commands'], commands: ['all'] },
  'اونر اداري': { tabs: ['account', 'commands'], commands: ['all', '-delete-account'] },
  'اونر': { tabs: ['account', 'commands'], commands: ['all', '-change-rank', '-delete-account'] },
  'سوبر اداري': { tabs: ['account', 'commands'], commands: ['warn', 'mute', 'mute-main', 'mute-private', 'kick', 'ban'] },
  'مشرف': { tabs: ['account', 'commands'], commands: ['warn', 'mute', 'mute-main', 'mute-private', 'kick'] },
  'سوبر ادمن': { tabs: ['account', 'commands'], commands: ['warn', 'mute', 'mute-main', 'mute-private'] },
  'ادمن': { tabs: ['account', 'commands'], commands: ['warn'] },
  'بريميوم': { tabs: ['account'], commands: [] },
  'بلاتينيوم': { tabs: ['account'], commands: [] },
  'ملكي': { tabs: ['account'], commands: [] },
  'ذهبي': { tabs: ['account'], commands: [] },
  'برونزي': { tabs: ['account'], commands: [] },
  'عضو': { tabs: ['account'], commands: [] },
  'زائر': { tabs: ['account'], commands: [] }
};
 
 // دالة لعرض رسائل التنبيهات المنبثقة
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `app-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('hide');
        notification.addEventListener('transitionend', () => {
            notification.remove();
        });
    }, 3000); // 3 ثواني
}

// الآن، في دالة confirm-mute-btn.onclick، استدع الدالة بعد تحديث البيانات
// ...

    // ... الكود السابق ...
    
// ...


export function showCommandsModal(userData = {}, onRankChange) {
  let existingModal = document.getElementById('commandsModal');
  if (existingModal) existingModal.remove();
  let overlay = document.getElementById('commandsModalOverlay');
  if (overlay) overlay.remove();
 
  overlay = document.createElement('div');
  overlay.className = 'commands-modal-overlay';
  overlay.id = 'commandsModalOverlay';
  document.body.appendChild(overlay);
 
  function openActionModal(title, content, opts = {}) {
    let old = document.getElementById('actionModal');
    if (old) old.remove();
    let oldOv = document.getElementById('actionModalOverlay');
    if (oldOv) oldOv.remove();
 
    const ov = document.createElement('div');
    ov.className = 'action-modal-overlay';
    ov.id = 'actionModalOverlay';
    document.body.appendChild(ov);
 
    const m = document.createElement('div');
    m.className = 'action-modal';
    m.id = 'actionModal';
    m.innerHTML = `
      <div class="action-modal-header">
        <span class="action-modal-title">${title}</span>
        <button class="action-modal-close" title="إغلاق">&times;</button>
      </div>
      <div class="action-modal-content">${content}</div>
      <div class="action-modal-footer">
        <button class="action-modal-close btn-main">إغلاق</button>
        ${opts.footerExtra || ""}
      </div>
    `;
    document.body.appendChild(m);
 
    function close() {
      m.classList.remove('show'); ov.classList.remove('show');
      setTimeout(() => { m.remove(); ov.remove(); }, 140);
    }
    m.querySelectorAll('.action-modal-close').forEach(b => b.onclick = close);
    ov.onclick = close;
 
    setTimeout(() => { m.classList.add('show'); ov.classList.add('show'); }, 5);
 
    if (opts.onReady) opts.onReady(m, close);
  }
 
  const modal = document.createElement('div');
  modal.className = 'commands-modal modal-top';
  modal.id = 'commandsModal';
  modal.innerHTML = `
    <div class="commands-modal-header">
      <span class="commands-modal-title">الأوامر</span>
      <button class="commands-modal-close" title="إغلاق">&times;</button>
    </div>
    <div class="commands-modal-tabs">
      <button class="commands-tab active" data-tab="account"><span>حساب</span></button>
      <button class="commands-tab" data-tab="commands"><span>أوامر</span></button>
      <button class="commands-tab" data-tab="room-commands"><span>أوامر الغرفة</span></button>
    </div>
    <div class="commands-modal-content no-scroll">
      <div class="commands-tab-content" id="tab-account">
        <div class="account-actions-grid">
          <button class="act-btn" data-modal="add-friend">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#4f46e5" d="M12 2a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm7 17v-1a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1Zm-7-7a3 3 0 1 0 0-6a3 3 0 0 0 0 6Zm8 5v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 1 1 2 0Z"/></svg></span>
            <span class="act-btn-text">إضافة صديق</span>
          </button>
          <button class="act-btn" data-modal="share-wallet">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#059669" d="M16.59 5.59a2 2 0 1 1 2.82 2.82l-8.88 8.88a2 2 0 0 1-2.83 0l-2.12-2.12a2 2 0 0 1 2.83-2.83l7.17-7.17zm-1.42 1.41l-7.17 7.17l2.12 2.12l7.17-7.17l-2.12-2.12z"/></svg></span>
            <span class="act-btn-text">مشاركة المحفظة</span>
          </button>
          <button class="act-btn" data-modal="report-user">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#f59e42" d="M12.87 2.17c-.48-.73-1.26-.73-1.74 0L1.57 17.35A1.27 1.27 0 0 0 2.64 19h18.72a1.27 1.27 0 0 0 1.07-1.65ZM13 17a1 1 0 1 1-2 0a1 1 0 0 1 2 0Zm-1-3a1 1 0 0 1-1-1V9a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1Z"/></svg></span>
            <span class="act-btn-text">إبلاغ</span>
          </button>
          <button class="act-btn" data-modal="send-gift">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#e11d48" d="M20 7h-1.17A3 3 0 0 0 17 2.83A3 3 0 0 0 12 6.58A3 3 0 0 0 7 2.83A3 3 0 0 0 5.17 7H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7h1a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm-4-2a1 1 0 1 1-2 0a1 1 0 0 1 2 0ZM7 5a1 1 0 1 1-2 0a1 1 0 0 1 2 0Zm10 14H7v-7h10ZM20 9v2h-1v-2Zm-13 0v2H4V9ZM12 8a1 1 0 1 1 0-2a1 1 0 0 1 0 2Z"/></svg></span>
            <span class="act-btn-text">إرسال هدية</span>
          </button>
        </div>
      </div>
      <div class="commands-tab-content" id="tab-commands" style="display:none">
        <div class="account-actions-grid">
          <button class="act-btn" data-modal="change-rank">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 20 20"><path fill="#7c3aed" d="M6 2a2 2 0 0 0-2 2v2h2V4h8v2h2V4a2 2 0 0 0-2-2H6Zm10 4V4a4 4 0 0 0-4-4H8A4 4 0 0 0 4 4v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2ZM4 16a4 4 0 0 1-4-4V8a2 2 0 0 1 2-2V4a6 6 0 0 1 12 0v2a2 2 0 0 1 2 2v4a4 4 0 0 1-4 4H4Zm10-2V8H6v6h8Z"/></svg></span>
            <span class="act-btn-text">تغيير الرتبة</span>
          </button>
          <button class="act-btn" data-modal="warn">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#f59e42" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-.88 15.29l-4.2-4.2a1 1 0 111.41-1.41l2.79 2.79 5.79-5.79a1 1 0 111.41 1.41l-6.5 6.5a1 1 0 01-1.41 0z"/></svg></span>
            <span class="act-btn-text">تحذير</span>
          </button>
          <button class="act-btn" data-modal="mute">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#475569" d="M12 22q-2.075 0-3.537-1.463Q7 19.075 7 17V7q0-2.075 1.463-3.538Q9.925 2 12 2t3.538 1.462Q17 4.925 17 7v10q0 2.075-1.462 3.537Q14.075 22 12 22Zm0-2q1.25 0 2.125-.875T15 17V7q0-1.25-.875-2.125T12 4q-1.25 0-2.125.875T9 7v10q0 1.25.875 2.125T12 20Zm0-8Zm-1 6v-4h2v4Zm0-6V8h2v2Z"/></svg></span>
            <span class="act-btn-text">كتم</span>
          </button>
          <button class="act-btn" data-modal="mute-main">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#64748b" d="M21 6.5a1 1 0 0 0-1.707-.707l-1.086 1.085a7.963 7.963 0 0 0-3.02-1.172l.198-1.189a1 1 0 1 0-1.968-.334l-.199 1.194a8.058 8.058 0 0 0-4.436 2.315l-1.104-1.104A1 1 0 1 0 3.5 7.207l1.085 1.086A7.963 7.963 0 0 0 3.413 12h1.194a6.02 6.02 0 0 1 1.177-2.96l1.104 1.104A8.058 8.058 0 0 0 11 15.5v1.193a1 1 0 1 0 2 0V15.5a8.058 8.058 0 0 0 4.436-2.315l1.104 1.104A6.02 6.02 0 0 1 19.393 12h1.194a7.963 7.963 0 0 0-1.366-3.707l1.085-1.086A1 1 0 0 0 21 6.5ZM12 17a5 5 0 1 1 0-10a5 5 0 0 1 0 10Z"/></svg></span>
            <span class="act-btn-text">كتم الرئيسية</span>
          </button>
          <button class="act-btn" data-modal="mute-private">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#64748b" d="M20 2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6.83l-4.42 4.42A1 1 0 0 1 1 20V4a2 2 0 0 1 2-2h17Zm0 2H3v13.59l3.29-3.3A1 1 0 0 1 7.83 14H20V4Zm8 9a1 1 0 1 1 0-2a1 1 0 0 1 0 2Zm4 0a1 1 0 1 1 0-2a1 1 0 0 1 0 2Zm4 0a1 1 0 1 1 0-2a1 1 0 0 1 0 2Z"/></svg></span>
            <span class="act-btn-text">كتم الخاصة</span>
          </button>
          <button class="act-btn" data-modal="kick">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#e11d48" d="M5 20q-.825 0-1.412-.587Q3 18.825 3 18V8q0-.825.588-1.413Q4.175 6 5 6h14q.825 0 1.413.587Q21 7.175 21 8v10q0 .825-.587 1.413Q19.825 20 19 20Zm7-7Zm-1-4q-.425 0-.712.288Q10 9.575 10 10v4q0 .425.288.712.287.288.712.288.425 0 .713-.288Q12 14.425 12 14v-4q0-.425-.287-.712Q11.425 9 11 9Zm0 0h2v4h-2Zm-5 7h14V8H5Zm2-9h10V8H7Z"/></svg></span>
            <span class="act-btn-text">طرد</span>
          </button>
          <button class="act-btn" data-modal="ban">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#c026d3" d="M15 12a3 3 0 1 0-6 0a3 3 0 0 0 6 0Zm-3-5a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm7 8.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3.5a8 8 0 1 1 16 0Zm-2 0A6 6 0 0 0 7 15.5V19h10v-3.5Z"/></svg></span>
            <span class="act-btn-text">حظر</span>
          </button>
          <button class="act-btn" data-modal="delete-account">
            <span class="act-btn-icon"><svg width="21" height="21" viewBox="0 0 24 24"><path fill="#ef4444" d="M16 9v-2a4 4 0 1 0-8 0v2H4v13h16V9h-4Zm-6-2a2 2 0 1 1 4 0v2h-4v-2Zm8 13H6v-9h12v9ZM9 17h6v-2H9v2Z"/></svg></span>
            <span class="act-btn-text">حذف الحساب</span>
          </button>
        </div>
      </div>
      <div class="commands-tab-content" id="tab-room-commands" style="display:none">
        <div class="cmds-glass-card">
          <h3>أوامر الغرفة</h3>
          <ul class="nice-list">
            <li><b>/kick [username]</b> <span>طرد مستخدم</span></li>
            <li><b>/mute [username]</b> <span>كتم مستخدم</span></li>
            <li><b>/unmute [username]</b> <span>فك الكتم</span></li>
          </ul>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
 
  modal.querySelector('.commands-modal-close').onclick = closeModal;
  overlay.onclick = closeModal;
  function closeModal() {
    modal.classList.remove('show');
    overlay.classList.remove('show');
    setTimeout(() => {
      modal.remove();
      overlay.remove();
    }, 150);
  }
 
  const tabButtons = modal.querySelectorAll('.commands-tab');
  const tabContents = {
    'account': modal.querySelector('#tab-account'),
    'commands': modal.querySelector('#tab-commands'),
    'room-commands': modal.querySelector('#tab-room-commands')
  };
  tabButtons.forEach(btn => {
    btn.onclick = () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      for (const key in tabContents) {
        tabContents[key].style.display = 'none';
      }
      tabContents[btn.dataset.tab].style.display = 'block';
    };
  });
  
  const userPermissions = permissions[currentUserRank];
  const targetUserRank = userData.rank || 'زائر';
  const targetUserRankOrder = RANK_ORDER.indexOf(targetUserRank);
  const currentUserRankOrder = RANK_ORDER.indexOf(currentUserRank);
  if (userPermissions) {
    tabButtons.forEach(btn => {
      if (!userPermissions.tabs.includes(btn.dataset.tab)) {
        btn.style.display = 'none';
      }
      if (targetUserRankOrder <= currentUserRankOrder && btn.dataset.tab !== 'account') {
          btn.style.display = 'none';
      }
    });
    const commandsTabContent = modal.querySelector('#tab-commands');
    if (commandsTabContent) {
      const commandButtons = commandsTabContent.querySelectorAll('.act-btn');
      commandButtons.forEach(btn => {
        const command = btn.getAttribute('data-modal');
        if (userPermissions.commands.includes('all')) {
          if (userPermissions.commands.includes(`-${command}`)) {
            btn.style.display = 'none';
          }
        } else if (!userPermissions.commands.includes(command)) {
          btn.style.display = 'none';
        }
      });
    }
    const roomCommandsTabContent = modal.querySelector('#tab-room-commands');
    if (roomCommandsTabContent && !userPermissions.tabs.includes('room-commands')) {
        roomCommandsTabContent.innerHTML = '';
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === 'room-commands') {
                btn.style.display = 'none';
            }
        });
    }
  }
 
  const modalInfo = {
    "add-friend": { title: "إضافة صديق", content: "يمكنك هنا إضافة هذا المستخدم لقائمة أصدقائك." },
    "share-wallet": { title: "مشاركة المحفظة", content: "يمكنك مشاركة عنوان محفظتك مع الآخرين." },
    "report-user": { title: "إبلاغ", content: "يمكنك الإبلاغ عن المستخدم في حال وجود إساءة أو مخالفة." },
    "send-gift": { title: "إرسال هدية", content: "أرسل هدية لهذا المستخدم مباشرة!" },
    "warn": { title: "تحذير", content: "يمكنك إرسال تحذير لهذا المستخدم بسبب مخالفة أو تنبيه." },
    "mute": {
        title: "كتم المستخدم",
        content: `
            <div class="form-group">
                <label for="mute-duration-select">مدة الكتم:</label>
                <select id="mute-duration-select">
                    <option value="60000">دقيقة واحدة</option>
                    <option value="300000">5 دقائق</option>
                    <option value="1800000">30 دقيقة</option>
                    <option value="3600000">ساعة واحدة</option>
                    <option value="86400000">يوم واحد</option>
                    <option value="604800000">أسبوع واحد</option>
                    <option value="permanent">دائم</option>
                </select>
            </div>
        `,
        footerExtra: `<button id="confirm-mute-btn" class="btn-main">كتم</button>`
    },
    "mute-main": { title: "كتم الدردشة الرئيسية", content: "سيتم منع المستخدم من الكتابة في الدردشة العامة فقط." },
    "mute-private": { title: "كتم الدردشة الخاصة", content: "سيتم منع المستخدم من إرسال رسائل خاصة." },
    "kick": { title: "طرد", content: "سيتم طرد المستخدم من الغرفة الحالية." },
    "ban": { title: "حظر", content: "سيتم حظر المستخدم ولن يستطيع الدخول مرة أخرى." },
    "delete-account": { title: "حذف الحساب", content: "سيتم حذف حساب المستخدم بشكل نهائي، هذا الإجراء لا يمكن التراجع عنه!" }
  };
 
  modal.querySelectorAll('.act-btn[data-modal]').forEach(btn => {
    btn.onclick = function() {
      const key = btn.getAttribute('data-modal');
      if (key === "change-rank") {
        let html = `<div class="ranks-list">`;
        for (const rank of RANK_ORDER) {
          if (rank === 'المالك' || rank === 'زائر') continue;
          html += `<div class="rank-option" data-rank="${rank}"><img src="${RANK_IMAGE_MAP[rank] || ''}" alt="${rank}" class="rank-img"><span>${rank}</span></div>`;
        }
        html += `</div>`;
        openActionModal("تغيير الرتبة", html, {
          onReady: (m, close) => {
            m.querySelectorAll('.rank-option').forEach(opt => {
              opt.onclick = async () => {
                m.querySelectorAll('.rank-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                let rank = opt.getAttribute('data-rank');
                let footer = m.querySelector('.action-modal-footer');
                let old = footer.querySelector('.btn-set-rank');
                if (old) old.remove();
                let btn = document.createElement('button');
                btn.className = 'btn-main btn-set-rank';
                btn.textContent = 'تأكيد التغيير';
                btn.onclick = async () => {
                    try {
                        const userId = userData.id || userData.uid;
                        if (!userId) {
                            alert('لا يمكن تحديد المستخدم!');
                            return;
                        }
                        await updateDoc(doc(db, "users", userId), { 
                            rank: rank,
                            needsRefresh: true
                        });
                        const notificationText = `تم تغيير رتبتك أنت الان ${rank}`;
                        await addNotification(notificationText, SYSTEM_USER, userId);
                        if (typeof onRankChange === "function") onRankChange(rank);
                        close();
                    } catch (e) {
                        alert('حصل خطأ أثناء تغيير الرتبة: ' + (e.message || e));
                    }
                };
                footer.appendChild(btn);
              };
            });
          }
        });
        return;
      }
      if (key === 'mute') {
        openActionModal(modalInfo[key].title, modalInfo[key].content, {
          footerExtra: modalInfo[key].footerExtra,
          onReady: (m, close) => {
            const confirmBtn = m.querySelector('#confirm-mute-btn');
            const durationSelect = m.querySelector('#mute-duration-select');
 
            confirmBtn.onclick = async () => {
              const muteDuration = durationSelect.value;
              const userIdToMute = userData.id || userData.uid;
              const currentUserName = localStorage.getItem('chatUserName');
              const currentRoomId = localStorage.getItem('lastVisitedRoomId');
 
              if (!userIdToMute) {
                alert('لا يمكن تحديد المستخدم!');
                return;
              }
 
              // التحقق من وجود المستخدم في أي من المجموعتين
              let userDocRef = doc(db, "users", userIdToMute);
              let userDocSnap = await getDoc(userDocRef);
 
              if (!userDocSnap.exists()) {
                userDocRef = doc(db, "visitors", userIdToMute);
                userDocSnap = await getDoc(userDocRef);
                if (!userDocSnap.exists()) {
                  alert('خطأ: المستخدم غير موجود في قاعدة البيانات.');
                  return;
                }
              }
 
              let muteUntil;
              let muteText;
 
              if (muteDuration === 'permanent') {
                muteUntil = 'permanent';
                muteText = `تم كتم المستخدم ${userData.name} بشكل دائم.`;
              } else {
                const durationMs = parseInt(muteDuration, 10);
                muteUntil = Date.now() + durationMs;
                muteText = `تم كتم المستخدم ${userData.name} لمدة ${durationSelect.options[durationSelect.selectedIndex].text}.`;
              }
 
              // ... (الكود السابق) ...
try {
    await updateDoc(userDocRef, {
        isMuted: true,
        mutedUntil: muteUntil,
        mutedBy: currentUserName
    });

    // استدعاء دالة التنبيه
    showNotification(`تم كتم المستخدم ${userData.name} بنجاح.`);

    await sendSystemMessage({
        text: muteText,
        type: 'mute'
    }, currentRoomId);

    await addNotification(`تم كتمك بواسطة ${currentUserName}، لن تتمكن من الكتابة في الدردشة.`, SYSTEM_USER, userIdToMute);

    // احذف هذا السطر
    // alert('تم كتم المستخدم بنجاح!');

    close();
} catch (e) {
    console.error('Error muting user: ', e);
    alert('حدث خطأ أثناء محاولة الكتم.');
}
};
          }
        });
        return;
      }
      if (modalInfo[key]) {
        openActionModal(modalInfo[key].title, modalInfo[key].content);
      }
    };
  });
 
  if (!document.getElementById('commands-modal-style')) {
    const link = document.createElement('link');
    link.id = 'commands-modal-style';
    link.rel = 'stylesheet';
    link.href = 'styles/commands-modal.css';
    document.head.appendChild(link);
  }
 
  setTimeout(() => {
    modal.classList.add('show');
    overlay.classList.add('show');
  }, 10);
}
