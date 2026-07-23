// constants.js
export const RANK_ORDER = [
  "المالك",
  "اونر اداري",
  "اونر",
  "سوبر اداري",
  "مشرف",
  "سوبر ادمن",
  "ادمن",
  "بريميوم",
  "بلاتينيوم",
  "ملكي",
  "ذهبي",
  "برونزي",
  "عضو",
  "زائر"
];

export const RANK_IMAGE_MAP = {
  "المالك": "rank_images/owner.png",
  "اونر اداري": "rank_images/owner_admin.png",
  "اونر": "rank_images/owner2.png",
  "سوبر اداري": "rank_images/super_admin.png",
  "مشرف": "rank_images/supervisor.png",
  "سوبر ادمن": "rank_images/super_admn.png",
  "ادمن": "rank_images/admin.png",
  "بريميوم": "rank_images/premium.png",
  "بلاتينيوم": "rank_images/platinum.png",
  "ملكي": "rank_images/royal.png",
  "ذهبي": "rank_images/gold.png",
  "برونزي": "rank_images/bronze.png",
  "عضو": "rank_images/member.png",
  "زائر": "rank_images/guest.png",
};

export const RANK_PERMISSIONS = {
    "المالك": {
        canSeeReportButton: true,
        canSeePrivateChatButton: true,
        canClearRoom: true
    },
    "اونر اداري": {
        canSeeReportButton: true,
        canSeePrivateChatButton: true,
        canClearRoom: true
    },
    "اونر": {
        canSeeReportButton: true,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "سوبر اداري": {
        canSeeReportButton: true,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "مشرف": {
        canSeeReportButton: true,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "سوبر ادمن": {
        canSeeReportButton: true,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "ادمن": {
        canSeeReportButton: true,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "بريميوم": {
        canSeeReportButton: false,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "بلاتينيوم": {
        canSeeReportButton: false,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "ملكي": {
        canSeeReportButton: false,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "ذهبي": {
        canSeeReportButton: false,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "برونزي": {
        canSeeReportButton: false,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "عضو": {
        canSeeReportButton: false,
        canSeePrivateChatButton: true,
        canClearRoom: false
    },
    "زائر": {
        canSeeReportButton: false,
        canSeePrivateChatButton: false,
        canClearRoom: false
    }
};