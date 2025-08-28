// chat-commands-modal.js
import { RANK_ORDER, RANK_IMAGE_MAP } from './constants.js';
import { db } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
 import { addNotification, SYSTEM_USER } from './chat-firestore.js';

// يمكن الحصول على رتبة المستخدم من التخزين المحلي
// أو تمريرها كمعامل إذا كانت متاحة من مكان آخر.
const currentUserRank = localStorage.getItem('chatUserRank') || 'زائر';
 
// تعريف الصلاحيات لكل رتبة لتسهيل التحكم
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
 
export function showCommandsModal(userData = {}, onRankChange) {
  let existingModal = document.getElementById('commandsModal');
  if (existingModal) existingModal.remove();
  let overlay = document.getElementById('commandsModalOverlay');
  if (overlay) overlay.remove();
 
  overlay = document.createElement('div');
  overlay.className = 'commands-modal-overlay commands-modal-pre';
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
  modal.className = 'commands-modal commands-modal-pre';
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
        <div class="account-actions-vertical">
          <button class="act-btn" data-modal="add-friend">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#4f46e5" d="M12 2a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm7 17v-1a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1Zm-7-7a3 3 0 1 0 0-6a3 3 0 0 0 0 6Zm8 5v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 1 1 2 0Z"/></svg>
            </span>
            إضافة صديق
          </button>
          <button class="act-btn" data-modal="share-wallet">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#059669" d="M16.59 5.59a2 2 0 1 1 2.82 2.82l-8.88 8.88a2 2 0 0 1-2.83 0l-2.12-2.12a2 2 0 0 1 2.83-2.83l7.17-7.17zm-1.42 1.41l-7.17 7.17l2.12 2.12l7.17-7.17l-2.12-2.12z"/></svg>
            </span>
            مشاركة المحفظة
          </button>
          <button class="act-btn" data-modal="report-user">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#f59e42" d="M12.87 2.17c-.48-.73-1.26-.73-1.74 0L1.57 17.35A1.27 1.27 0 0 0 2.64 19h18.72a1.27 1.27 0 0 0 1.07-1.65ZM13 17a1 1 0 1 1-2 0a1 1 0 0 1 2 0Zm-1-3a1 1 0 0 1-1-1V9a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1Z"/></svg>
            </span>
            إبلاغ
          </button>
          <button class="act-btn" data-modal="send-gift">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#e11d48" d="M20 7h-1.17A3 3 0 0 0 17 2.83A3 3 0 0 0 12 6.58A3 3 0 0 0 7 2.83A3 3 0 0 0 5.17 7H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7h1a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm-4-2a1 1 0 1 1-2 0a1 1 0 0 1 2 0ZM7 5a1 1 0 1 1-2 0a1 1 0 0 1 2 0Zm10 14H7v-7h10ZM20 9v2h-1v-2Zm-13 0v2H4V9ZM12 8a1 1 0 1 1 0-2a1 1 0 0 1 0 2Z"/></svg>
            </span>
            إرسال هدية
          </button>
        </div>
      </div>
      <div class="commands-tab-content" id="tab-commands" style="display:none">
        <div class="account-actions-vertical">
          <button class="act-btn" data-modal="change-rank">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 20 20"><path fill="#7c3aed" d="M6 2a2 2 0 0 0-2 2v2h2V4h8v2h2V4a2 2 0 0 0-2-2H6Zm10 4V4a4 4 0 0 0-4-4H8A4 4 0 0 0 4 4v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2ZM4 16a4 4 0 0 1-4-4V8a2 2 0 0 1 2-2V4a6 6 0 0 1 12 0v2a2 2 0 0 1 2 2v4a4 4 0 0 1-4 4H4Zm10-2V8H6v6h8Z"/></svg>
            </span>
            تغيير الرتبة
          </button>
          <button class="act-btn" data-modal="warn">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#f59e42" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-.88 15.29l-4.2-4.2a1 1 0 111.41-1.41l2.79 2.79 5.79-5.79a1 1 0 111.41 1.41l-6.5 6.5a1 1 0 01-1.41 0z"/></svg>
            </span>
            تحذير
          </button>
          <button class="act-btn" data-modal="mute">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#475569" d="M12 22q-2.075 0-3.537-1.463Q7 19.075 7 17V7q0-2.075 1.463-3.538Q9.925 2 12 2t3.538 1.462Q17 4.925 17 7v10q0 2.075-1.462 3.537Q14.075 22 12 22Zm0-2q1.25 0 2.125-.875T15 17V7q0-1.25-.875-2.125T12 4q-1.25 0-2.125.875T9 7v10q0 1.25.875 2.125T12 20Zm0-8Zm-1 6v-4h2v4Zm0-6V8h2v2Z"/></svg>
            </span>
            كتم
          </button>
          <button class="act-btn" data-modal="mute-main">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#64748b" d="M21 6.5a1 1 0 0 0-1.707-.707l-1.086 1.085a7.963 7.963 0 0 0-3.02-1.172l.198-1.189a1 1 0 1 0-1.968-.334l-.199 1.194a8.058 8.058 0 0 0-4.436 2.315l-1.104-1.104A1 1 0 1 0 3.5 7.207l1.085 1.086A7.963 7.963 0 0 0 3.413 12h1.194a6.02 6.02 0 0 1 1.177-2.96l1.104 1.104A8.058 8.058 0 0 0 11 15.5v1.193a1 1 0 1 0 2 0V15.5a8.058 8.058 0 0 0 4.436-2.315l1.104 1.104A6.02 6.02 0 0 1 19.393 12h1.194a7.963 7.963 0 0 0-1.366-3.707l1.085-1.086A1 1 0 0 0 21 6.5ZM12 17a5 5 0 1 1 0-10a5 5 0 0 1 0 10Z"/></svg>
            </span>
            كتم الدردشة الرئيسية
          </button>
          <button class="act-btn" data-modal="mute-private">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#64748b" d="M20 2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6.83l-4.42 4.42A1 1 0 0 1 1 20V4a2 2 0 0 1 2-2h17Zm0 2H3v13.59l3.29-3.3A1 1 0 0 1 7.83 14H20V4ZM8 9a1 1 0 1 1 0-2a1 1 0 0 1 0 2Zm4 0a1 1 0 1 1 0-2a1 1 0 0 1 0 2Zm4 0a1 1 0 1 1 0-2a1 1 0 0 1 0 2Z"/></svg>
            </span>
            كتم الدردشة الخاصة
          </button>
          <button class="act-btn" data-modal="kick">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#e11d48" d="M5 20q-.825 0-1.412-.587Q3 18.825 3 18V8q0-.825.588-1.413Q4.175 6 5 6h14q.825 0 1.413.587Q21 7.175 21 8v10q0 .825-.587 1.413Q19.825 20 19 20Zm7-7Zm-1-4q-.425 0-.712.288Q10 9.575 10 10v4q0 .425.288.712.287.288.712.288.425 0 .713-.288Q12 14.425 12 14v-4q0-.425-.287-.712Q11.425 9 11 9Zm0 0h2v4h-2Zm-5 7h14V8H5Zm2-9h10V8H7Z"/></svg>
            </span>
            طرد
          </button>
          <button class="act-btn" data-modal="ban">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#c026d3" d="M15 12a3 3 0 1 0-6 0a3 3 0 0 0 6 0Zm-3-5a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm7 8.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3.5a8 8 0 1 1 16 0Zm-2 0A6 6 0 0 0 7 15.5V19h10v-3.5Z"/></svg>
            </span>
            حظر
          </button>
          <button class="act-btn" data-modal="delete-account">
            <span class="act-btn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24"><path fill="#ef4444" d="M16 9v-2a4 4 0 1 0-8 0v2H4v13h16V9h-4Zm-6-2a2 2 0 1 1 4 0v2h-4v-2Zm8 13H6v-9h12v9ZM9 17h6v-2H9v2Z"/></svg>
            </span>
            حذف الحساب
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
  
  // تطبيق منطق إخفاء التبويبات والأزرار بناءً على الرتبة
  // ... (الكود السابق في chat-commands-modal.js)

// قم بتحديد صلاحيات المستخدم الحالي (الذي يفتح المودال)
const userPermissions = permissions[currentUserRank];

// قم بتحديد رتبة المستخدم المستهدف (الذي يتم فتح المودال له)
const targetUserRank = userData.rank || 'زائر';
const targetUserRankOrder = RANK_ORDER.indexOf(targetUserRank);
const currentUserRankOrder = RANK_ORDER.indexOf(currentUserRank);

if (userPermissions) {
  tabButtons.forEach(btn => {
    // 1. إخفاء التبويبات بناءً على صلاحيات المستخدم الحالي
    if (!userPermissions.tabs.includes(btn.dataset.tab)) {
      btn.style.display = 'none';
    }
    
    // 2. ✨ إضافة المنطق الجديد: إخفاء التبويبات إذا كانت رتبة المستخدم المستهدف أعلى أو مساوية
    if (targetUserRankOrder <= currentUserRankOrder && btn.dataset.tab !== 'account') {
        btn.style.display = 'none';
    }
  });

  // ... (بقية الكود)


// ... (بقية الكود)
 
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
    "mute": { title: "كتم", content: "سيتم كتم المستخدم ولن يستطيع إرسال رسائل لمدة معينة." },
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
          // الشرط الجديد: تجاهل رتبتي "مالك" و "زائر"
          if (rank === 'المالك' || rank === 'زائر') {
            continue;
          }
          html += `
            <div class="rank-option" data-rank="${rank}">
              <img src="${RANK_IMAGE_MAP[rank] || ''}" alt="${rank}" class="rank-img">
              <span>${rank}</span>
            </div>
          `;
        }
        html += `</div>`;
 
        openActionModal("تغيير الرتبة", html, {
          onReady: (m, close) => {
            m.querySelectorAll('.rank-option').forEach(opt => {
              opt.onclick = async () => {
                m.querySelectorAll('.rank-option').forEach(o=>o.classList.remove('selected'));
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

        // هنا يتم تحديث الرتبة في قاعدة البيانات
        await updateDoc(doc(db, "users", userId), { 
            rank: rank,
            needsRefresh: true
        });

        // ✨ الكود الجديد: يتم إرسال الإشعار قبل تحديث الصفحة وإغلاق المودال
        const notificationText = `تم تغيير رتبتك أنت الان ${rank}`;
        await addNotification(notificationText, SYSTEM_USER, userId);
        
        // الآن يتم تحديث الصفحة وإغلاق المودال
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
      if (modalInfo[key]) {
        openActionModal(modalInfo[key].title, modalInfo[key].content);
      }
    };
  });
 
  if (!document.getElementById('commands-modal-style')) {
    const style = document.createElement('style');
    style.id = 'commands-modal-style';
    style.textContent = `
.ranks-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 13px;
  justify-content: center;
  margin-top: 5px;
  margin-bottom: 3px;
}
.rank-option {
  display: flex;
  align-items: center;
  gap: 7px;
  background: #f3f0fa;
  border-radius: 9px;
  border: 1.2px solid #e0def8;
  box-shadow: 0 1px 4px #ede9fe12;
  cursor: pointer;
  padding: 7px 16px 7px 9px;
  font-size: 15px;
  color: #4a4566;
  font-weight: bold;
  transition: background .13s, border-color .13s;
  margin-bottom: 2px;
}
.rank-option:hover, .rank-option.selected {
  background: #ede9fe;
  border-color: #a78bfa;
  color: #7c3aed;
}
.rank-img {
  width: 27px;
  height: 27px;
  border-radius: 7px;
  background: #fff;
  object-fit: contain;
  border: 1px solid #e0def8;
  margin-left: 5px;
}
.current-rank-info {
  color: #7c3aed;
  font-size: 15px;
  margin-top: 8px;
}
.btn-set-rank {
  background: #059669 !important;
  border-color: #059669 !important;
  color: #fff !important;
  margin-right: 13px;
  margin-left: 13px;
  padding: 7px 30px;
  font-size: 16px;
  margin-top: 5px;
}
.btn-set-rank:hover { background: #047857 !important; }
.commands-modal-overlay, .action-modal-overlay {
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at center,rgba(80,75,130,0.13) 0%,rgba(50,40,90,0.14) 100%);
  z-index: 9998;
  opacity: 0;
  transition: opacity .16s;
}
.commands-modal-overlay.show, .action-modal-overlay.show { opacity: 1; }
.commands-modal, .action-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 9999;
  background: #fff;
  border-radius: 28px;
  box-shadow: 0 8px 36px 0 rgba(52,30,100,0.13), 0 1.5px 14px 0 rgba(120,100,255,0.09);
  padding: 0;
  direction: rtl;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
  transition: opacity .18s, transform .18s cubic-bezier(.7,1.5,.6,1);
}
.commands-modal.commands-modal-pre,
.action-modal:not(.show) {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.96);
  box-shadow: none;
}
.commands-modal.show,
.action-modal.show {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}
.commands-modal {
  width: 20vw; /* تم تعديل هذا السطر */
  height: 30vh; /* تم تعديل هذا السطر */
  max-width: 1050px;
  max-height: 94vh;
  min-width: 340px;
  min-height: 240px;
}
.action-modal {
  width: 95vw;
  max-width: 410px;
  min-width: 260px;
  padding-bottom: 8px;
  min-height: 90px;
}
.action-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 23px 7px 13px;
  border-bottom: 1.3px solid #ece7fa;
  background: #faf8fe;
}
.action-modal-title {
  font-weight: bold;
  font-size: 20px;
  color: #7c3aed;
  display: flex;
  align-items: center;
  letter-spacing: .2px;
}
.action-modal-close {
  background: none;
  border: none;
  font-size: 27px;
  color: #b0aaff;
  cursor: pointer;
  transition: color 0.14s;
  outline: none;
}
.action-modal-close:hover { color: #e74c3c; background: #f9eaea; }
.action-modal-content {
  padding: 22px 20px 11px 18px;
  color: #333;
  font-size: 17px;
  text-align: center;
  min-height: 44px;
}
.action-modal-footer {
  display: flex;
  justify-content: center;
  padding: 0 0 7px 0;
}
.action-modal-footer .btn-main {
  font-size: 16px;
  padding: 7px 32px;
  border-radius: 7px;
  border: 1px solid #a78bfa;
  background: #7c3aed;
  color: #fff;
  font-weight: bold;
  cursor: pointer;
  margin-top: 7px;
  transition: background .16s;
}
.action-modal-footer .btn-main:hover { background: #5b21b6; }
.commands-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px 34px 10px 20px;
  border-bottom: 1.5px solid #ece7fa;
  background: rgba(255,255,255,0.68);
  box-shadow: 0 2px 7px 0 rgba(100,80,180,0.03);
}
.commands-modal-title {
  font-weight: bold;
  font-size: 26px;
  color: #7c3aed;
  display: flex;
  align-items: center;
  letter-spacing: 0.4px;
}
.commands-modal-close {
  background: none;
  border: none;
  font-size: 33px;
  color: #b0aaff;
  cursor: pointer;
  transition: color 0.15s;
  outline: none;
  margin-right: 6px;
  margin-top: -10px;
}
.commands-modal-close:hover { color: #e74c3c; background: #f9eaea; }
.commands-modal-tabs {
  display: flex;
  border-bottom: 1px solid #e7e3f7;
  background: linear-gradient(90deg,#f8f7fd 60%,#ede9fe 100%);
  padding: 0 30px;
}
.commands-tab {
  flex: 1;
  background: none;
  border: none;
  padding: 19px 10px 15px 10px;
  font-size: 19px;
  color: #8673b3;
  cursor: pointer;
  border-radius: 16px 16px 0 0;
  transition: background 0.16s, color 0.18s;
  font-weight: 500;
  position: relative;
}
.commands-tab.active {
  background: #fff;
  color: #7c3aed;
  border-bottom: 3px solid #a78bfa;
  font-weight: bold;
  box-shadow: 0 1.5px 10px #ede9fe16;
}
.commands-tab:not(.active):hover {
  background: #ede9fe6c;
  color: #6d28d9;
}
.commands-modal-content.no-scroll {
  padding: 20px 30px 18px 30px;
  flex: 1;
  background: linear-gradient(120deg,#faf8fe 80%,#f3f0fa 100%);
  min-height: 0;
  border-radius: 0 0 28px 28px;
  overflow-y: visible !important;
}
@media (max-width: 900px) {
  .commands-modal {
    width: 70vw; /* تم تعديل هذا السطر */
    height: 70vh; /* تم تعديل هذا السطر */
    max-width: none;
    max-height: 99vh;
  }
  .commands-modal-content.no-scroll {
    padding: 10px 2vw 7px 2vw;
  }
  .commands-modal-header {
    padding: 13px 10px 8px 10px;
  }
  .commands-modal-tabs {
    padding: 0 4px;
  }
}
.account-actions-vertical {
  display: flex;
  flex-direction: column;
  gap: 7px;
  align-items: center;
  margin: 8px auto 0 auto;
  max-width: 520px;
}
.act-btn {
  display: flex;
  align-items: center;
  gap: 13px;
  font-size: 17px;
  padding: 10px 0 10px 0;
  border-radius: 11px;
  border: 1.2px solid #ebe6fd;
  background: #fff;
  color: #3b3664;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 1.5px 5px #ede9fe19;
  transition: background .13s, color .10s, border-color .13s;
  width: 100%;
  max-width: 340px;
  justify-content: center;
  outline: none;
  font-family: inherit;
}
.act-btn:hover {
  background: #f3f0fa;
  color: #7c3aed;
  border-color: #a78bfa;
}
.act-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 25px;
}
.cmds-glass-card {
  background: #fff;
  border-radius: 11px;
  box-shadow: 0 3px 16px 0 #ede9fe19;
  padding: 20px 3vw 16px 2vw;
  margin: 0 auto;
  max-width: 520px;
  margin-bottom: 10px;
  border: 1px solid #ede9fe;
  position: relative;
}
.nice-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.nice-list li {
  margin-bottom: 10px;
  font-size: 17px;
  background: #f8f7fd;
  border-radius: 10px;
  padding: 7px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 1.5px 6px #ede9fe17;
}
.nice-list b {
  color: #7c3aed;
  min-width: 90px;
  display: inline-block;
  font-weight: bold;
  font-family: Tahoma, Arial, sans-serif;
}
.nice-list span {
  color: #444;
  margin-right: 8px;
}
::-webkit-scrollbar {width:8px;background:#f3f0fa;}
::-webkit-scrollbar-thumb {background:#e9e4fa;border-radius:8px;}
    `;
    document.head.appendChild(style);
  }
 
  setTimeout(() => {
    modal.classList.add('show');
    modal.classList.remove('commands-modal-pre');
    overlay.classList.add('show');
    overlay.classList.remove('commands-modal-pre');
  }, 10);
}
