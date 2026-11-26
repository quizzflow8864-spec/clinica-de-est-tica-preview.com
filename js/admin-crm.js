(function () {
  'use strict';

  const SESSION_KEY = 'wl_preview_session';
  const INTERNAL_NAV_KEY = 'wl_internal_nav';
  const THEME_PREF_KEY = 'adm_theme_pref';

  const STATUS_META = {
    novo: { label: 'Novo', next: 'em_contato', nextLabel: 'Iniciar contato' },
    em_contato: { label: 'Em contato', next: 'agendado', nextLabel: 'Confirmar agenda' },
    agendado: { label: 'Agendado', next: 'concluido', nextLabel: 'Concluir' },
    concluido: { label: 'Concluído', next: null, nextLabel: '' },
    cancelado: { label: 'Cancelado', next: 'novo', nextLabel: 'Reabrir' },
  };
  const PIPELINE_STAGES = ['novo', 'em_contato', 'agendado', 'concluido'];
  const MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  const WA_ICON_SVG = `<svg viewBox="0 0 716.7 700" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M83.3,350c0-156.5,126.9-283.3,283.3-283.3s283.3,126.9,283.3,283.3-126.9,283.3-283.3,283.3-107.6-16.1-151.4-43.8c-8.1-5.2-18.1-6.5-27.4-3.8l-96,28.6,36.1-84.6c4.3-10,3.4-21.4-2.3-30.7-26.9-43.3-42.4-94.4-42.4-149.2ZM366.7,0C173.4,0,16.7,156.7,16.7,350s15.8,118.9,43.5,169.1L2.7,653.6c-5.1,11.9-2.8,25.6,5.8,35.3,8.6,9.6,22,13.4,34.4,9.7l150-44.8c51.2,29.4,110.6,46.2,173.8,46.2,193.3,0,350-156.7,350-350S560,0,366.7,0ZM443.1,422.7l-43.8,30.9c-20.5-11.7-43.2-28-66-50.8s-41.2-48.1-54.1-70.5l27.8-23.6c11.9-10.1,15.2-27.2,7.9-41.1l-35.5-66.7c-4.8-9-13.4-15.3-23.4-17.1-10-1.8-20.3,1-28,7.7l-10.5,9.2c-25.3,22.1-40.2,58.3-27.9,95.1,12.9,38.1,40.3,98,96.5,154.2,60.5,60.5,121.9,84.3,157.8,93.5,28.9,7.4,56.3-2.5,75.6-18.3l19.7-16.1c8.4-6.9,13-17.4,12.2-28.3-.8-10.8-6.8-20.6-16.2-26.2l-55.9-33.3c-11.3-6.7-25.5-6.2-36.3,1.4Z"/></svg>`;

  // Auth & workspace state (in-memory only so accessing/reloading Admin always requires login)
  let adminToken = null;
  let adminEmail = null;
  let bookings = [];
  let workspace = {
    settings: {
      clinicName: 'Clínica de Estética',
      whatsapp: '(11) 98489-4031',
      address: '',
      hours: '',
      instagram: '',
      waGreeting: 'Olá {nome}, tudo bem? Aqui é da {clinica}.',
    },
    team: [],
    services: [],
    patients: [],
    transactions: [],
  };

  // UI State
  let activeScreen = 'crm';
  let currentView = 'list';
  let activeStatusFilter = 'all';
  let searchQuery = '';
  let activeBookingId = null;
  let activeWaTemplate = 'confirmar';

  const todayIso = new Date().toISOString().slice(0, 10);
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let selectedDateIso = todayIso;
  let agendaProFilter = 'all';

  let patSearchQuery = '';
  let patFilter = 'all';
  let activePatientId = null; // null means creating new patient

  let srvCatFilter = 'all';
  let finFilter = 'all';

  // =========================================================
  // THEME TOGGLE (Light & Obsidian Plum Dark Mode)
  // =========================================================
  const themeToggleBtns = Array.from(document.querySelectorAll('[data-theme-toggle]'));

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    const isDark = theme === 'dark';
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');

    themeToggleBtns.forEach((btn) => {
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
      btn.setAttribute('title', isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro');
      const lbl = btn.querySelector('.adm-theme-label');
      if (lbl) lbl.textContent = isDark ? 'Claro' : 'Escuro';
    });

    if (persist) {
      try {
        localStorage.setItem(THEME_PREF_KEY, isDark ? 'dark' : 'light');
        if (adminEmail) {
          localStorage.setItem('adm_theme:' + adminEmail.toLowerCase(), isDark ? 'dark' : 'light');
        }
      } catch {}
    }
  }

  function loadUserTheme(email) {
    if (!email) return;
    try {
      const saved = localStorage.getItem('adm_theme:' + email.toLowerCase());
      if (saved === 'dark' || saved === 'light') {
        applyTheme(saved, false);
        localStorage.setItem(THEME_PREF_KEY, saved);
      } else {
        localStorage.setItem('adm_theme:' + email.toLowerCase(), getCurrentTheme());
      }
    } catch {}
  }

  themeToggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark', true);
    });
  });
  applyTheme(getCurrentTheme(), false);

  // =========================================================
  // DOM REFERENCES
  // =========================================================
  const $ = (id) => document.getElementById(id);

  const gateEl = $('adm-gate');
  const appEl = $('adm-app');
  const loginForm = $('adm-login-form');
  const emailInput = $('adm-email');
  const passInput = $('adm-password');
  const togglePassBtn = $('adm-toggle-pass');
  const loginFeedback = $('adm-login-feedback');
  const loginSubmitBtn = $('adm-login-submit');

  const menuToggleBtn = $('adm-menu-toggle');
  const sidebarEl = $('adm-sidebar');
  const sidebarOverlay = $('adm-sidebar-overlay');
  const clinicNameHeader = $('adm-clinic-name-header');
  const ownerEmailEl = $('adm-owner-email');
  const backSiteLink = $('adm-back-site');
  const openConsultaLink = $('adm-open-consulta');
  const emptyConsultaLink = $('adm-empty-consulta');
  const logoutBtn = $('adm-logout-btn');
  const refreshBtn = $('adm-refresh-btn');
  const seedBtn = $('adm-seed-btn');
  const seedTopBtn = $('adm-seed-top-btn');
  const newBookingBtn = $('adm-new-booking-btn');
  const exportCrmCsvBtn = $('adm-export-crm-csv');

  const navBtns = Array.from(document.querySelectorAll('[data-nav-screen]'));
  const screens = Array.from(document.querySelectorAll('[data-screen]'));
  const navBadgeCrm = $('nav-badge-crm');
  const navBadgeAgenda = $('nav-badge-agenda');
  const navBadgePatients = $('nav-badge-patients');
  const navBadgeServices = $('nav-badge-services');

  // Screen 1: CRM
  const kpiTotal = $('kpi-total');
  const kpiTotalSub = $('kpi-total-sub');
  const kpiPending = $('kpi-pending');
  const kpiPendingSub = $('kpi-pending-sub');
  const kpiScheduled = $('kpi-scheduled');
  const kpiScheduledSub = $('kpi-scheduled-sub');
  const kpiRevenue = $('kpi-revenue');
  const kpiRevenueSub = $('kpi-revenue-sub');
  const conversionBadge = $('adm-conversion-badge');
  const areasCountBadge = $('adm-areas-count');
  const funnelBarsEl = $('adm-funnel-bars');
  const areaBarsEl = $('adm-area-bars');
  const searchInput = $('adm-search');
  const viewBtns = Array.from(document.querySelectorAll('[data-view]'));
  const filterBtns = Array.from(document.querySelectorAll('[data-status]'));
  const emptyStateEl = $('adm-empty-state');
  const noResultsEl = $('adm-no-results');
  const clearFiltersBtn = $('adm-clear-filters');
  const listViewEl = $('adm-list-view');
  const tableBodyEl = $('adm-table-body');
  const pipelineViewEl = $('adm-pipeline-view');

  // Screen 2: Agenda
  const agendaProFilterEl = $('agenda-pro-filter');
  const agendaNewOnDayBtn = $('agenda-new-on-day');
  const agendaMonthLabel = $('agenda-month-label');
  const agendaPrevBtn = $('agenda-prev-month');
  const agendaTodayBtn = $('agenda-today-btn');
  const agendaNextBtn = $('agenda-next-month');
  const agendaCalGrid = $('agenda-cal-grid');
  const agendaDayTitle = $('agenda-day-title');
  const agendaDayCount = $('agenda-day-count');
  const agendaDaySlots = $('agenda-day-slots');
  const agendaUpcomingList = $('agenda-upcoming-list');

  // Screen 3: Patients
  const patNewBtn = $('pat-new-btn');
  const patSearchInput = $('pat-search');
  const patFilterBtns = Array.from(document.querySelectorAll('[data-pat-filter]'));
  const patGridEl = $('pat-grid');
  const patEmptyEl = $('pat-empty');

  // Screen 4: Services
  const srvNewBtn = $('srv-new-btn');
  const srvCatBtns = Array.from(document.querySelectorAll('[data-srv-cat]'));
  const srvGridEl = $('srv-grid');

  // Screen 5: Finance
  const finExportCsvBtn = $('fin-export-csv');
  const finNewBtn = $('fin-new-btn');
  const finKpiIn = $('fin-kpi-in');
  const finKpiInSub = $('fin-kpi-in-sub');
  const finKpiPending = $('fin-kpi-pending');
  const finKpiPendingSub = $('fin-kpi-pending-sub');
  const finKpiOut = $('fin-kpi-out');
  const finKpiOutSub = $('fin-kpi-out-sub');
  const finKpiNet = $('fin-kpi-net');
  const finKpiTicket = $('fin-kpi-ticket');
  const finMethodsBadge = $('fin-methods-badge');
  const finMethodBars = $('fin-method-bars');
  const finFilterBtns = Array.from(document.querySelectorAll('[data-fin-filter]'));
  const finEmptyEl = $('fin-empty');
  const finTableWrap = $('fin-table-wrap');
  const finTableBody = $('fin-table-body');

  // Screen 6: Settings & Team
  const setClinicForm = $('set-clinic-form');
  const setClinicName = $('set-clinic-name');
  const setWhatsapp = $('set-whatsapp');
  const setInstagram = $('set-instagram');
  const setAddress = $('set-address');
  const setHours = $('set-hours');
  const setWaGreeting = $('set-wa-greeting');
  const setSaveBtn = $('set-save-btn');
  const setTeamCount = $('set-team-count');
  const setTeamList = $('set-team-list');
  const setTeamForm = $('set-team-form');
  const teamNome = $('team-nome');
  const teamSala = $('team-sala');
  const teamEsp = $('team-esp');
  const teamDias = $('team-dias');

  // CRM Drawer
  const drawerBackdrop = $('adm-drawer-backdrop');
  const drawerEl = $('adm-drawer');
  const drawerCloseBtn = $('adm-drawer-close');
  const drawerMeta = $('adm-drawer-meta');
  const drawerName = $('adm-drawer-name');
  const dOpenProntuarioBtn = $('adm-d-open-prontuario');
  const dLaunchFinanceBtn = $('adm-d-launch-finance');
  const dPhone = $('adm-d-phone');
  const dEmail = $('adm-d-email');
  const dAreas = $('adm-d-areas');
  const dObjetivo = $('adm-d-objetivo');
  const dHistorico = $('adm-d-historico');
  const dObsWrap = $('adm-d-obs-wrap');
  const dObs = $('adm-d-obs');
  const waTplBtns = Array.from(document.querySelectorAll('[data-wa-tpl]'));
  const waMessageInput = $('adm-wa-message');
  const waSendLink = $('adm-wa-send-link');
  const waSendLabel = $('adm-wa-send-label');
  const waCopyBtn = $('adm-wa-copy-btn');
  const drawerForm = $('adm-drawer-form');
  const editStatus = $('adm-edit-status');
  const editValor = $('adm-edit-valor');
  const editProtocolo = $('adm-edit-protocolo');
  const editPro = $('adm-edit-pro');
  const editSala = $('adm-edit-sala');
  const editData = $('adm-edit-data');
  const editPeriodo = $('adm-edit-periodo');
  const editNotas = $('adm-edit-notas');
  const saveBtn = $('adm-save-btn');
  const deleteBtn = $('adm-delete-btn');
  const deleteConfirm = $('adm-delete-confirm');
  const deleteYesBtn = $('adm-delete-yes');
  const deleteNoBtn = $('adm-delete-no');

  // Patient Prontuário Drawer
  const patDrawerBackdrop = $('pat-drawer-backdrop');
  const patDrawerEl = $('pat-drawer');
  const patDrawerTitle = $('pat-drawer-title');
  const patDrawerClose = $('pat-drawer-close');
  const patWaReturnBtn = $('pat-wa-return-btn');
  const patAnamnesisForm = $('pat-anamnesis-form');
  const patFNome = $('pat-f-nome');
  const patFTel = $('pat-f-tel');
  const patFEmail = $('pat-f-email');
  const patFNasc = $('pat-f-nasc');
  const patFRetorno = $('pat-f-retorno');
  const patFPele = $('pat-f-pele');
  const patFFototipo = $('pat-f-fototipo');
  const patFGestante = $('pat-f-gestante');
  const patFAlergias = $('pat-f-alergias');
  const patFMeds = $('pat-f-meds');
  const patDeleteBtn = $('pat-delete-btn');
  const patSaveBtn = $('pat-save-btn');
  const patEvoSection = $('pat-evo-section');
  const patEvoForm = $('pat-evo-form');
  const evoData = $('evo-data');
  const evoProtocolo = $('evo-protocolo');
  const evoPro = $('evo-pro');
  const evoNotas = $('evo-notas');
  const patEvoList = $('pat-evo-list');

  // Modals
  const newModal = $('adm-new-modal');
  const newCloseBtn = $('adm-new-close');
  const newCancelBtn = $('adm-new-cancel');
  const newForm = $('adm-new-form');
  const newNome = $('new-nome');
  const newTelefone = $('new-telefone');
  const newProtocolo = $('new-protocolo');
  const newPro = $('new-pro');
  const newEmail = $('new-email');
  const newValor = $('new-valor');
  const newData = $('new-data');
  const newPeriodo = $('new-periodo');
  const newStatus = $('new-status');
  const newObjetivo = $('new-objetivo');
  const newNotas = $('new-notas');
  const newError = $('adm-new-error');
  const newSubmitBtn = $('adm-new-submit');
  const newAreaChips = Array.from(document.querySelectorAll('#new-areas-group .adm-choice-chip'));

  const srvModal = $('srv-modal');
  const srvModalTitle = $('srv-modal-title');
  const srvModalClose = $('srv-modal-close');
  const srvForm = $('srv-form');
  const srvId = $('srv-id');
  const srvNome = $('srv-nome');
  const srvCat = $('srv-cat');
  const srvPreco = $('srv-preco');
  const srvDuracao = $('srv-duracao');
  const srvRetorno = $('srv-retorno');
  const srvDesc = $('srv-desc');
  const srvError = $('srv-error');
  const srvCancel = $('srv-cancel');
  const srvSubmit = $('srv-submit');

  const finModal = $('fin-modal');
  const finModalClose = $('fin-modal-close');
  const finForm = $('fin-form');
  const finTipo = $('fin-tipo');
  const finValor = $('fin-valor');
  const finData = $('fin-data');
  const finDesc = $('fin-desc');
  const finPaciente = $('fin-paciente');
  const finCat = $('fin-cat');
  const finMetodo = $('fin-metodo');
  const finStatus = $('fin-status');
  const finError = $('fin-error');
  const finCancel = $('fin-cancel');
  const finSubmit = $('fin-submit');

  const toastEl = $('adm-toast');
  let toastTimer = null;

  // =========================================================
  // HELPERS
  // =========================================================
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2900);
  }

  function formatPhoneBR(raw) {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits ? '(' + digits : '';
    if (digits.length <= 6) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
    if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
    return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
  }

  function formatDateBR(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'A combinar';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function formatRelativeDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function formatCurrency(val) {
    const n = Number(val) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }

  function firstName(full) {
    return String(full || 'cliente').trim().split(/\s+/)[0] || 'cliente';
  }

  function getInitials(name) {
    const parts = String(name || 'C').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function normalizePhoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function buildClientWhatsAppNumber(phone) {
    const digits = normalizePhoneDigits(phone);
    if (!digits) return '';
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    return '55' + digits;
  }

  function formatClinicDisplayName(raw) {
    const clean = String(raw || '').trim();
    if (!clean) return 'Clínica de Estética';
    if (/^cl[ií]nica(?:\s|$)/i.test(clean)) return clean.replace(/^cl[ií]nica/i, 'Clínica');
    return 'Clínica ' + clean;
  }

  function getClinicName() {
    const raw = (workspace.settings && workspace.settings.clinicName) || '';
    return formatClinicDisplayName(raw);
  }

  function buildGreetingPrefix(nome) {
    const tpl = (workspace.settings && workspace.settings.waGreeting) || 'Olá {nome}, tudo bem? Aqui é da {clinica}.';
    return tpl.replace(/\{nome\}/gi, firstName(nome)).replace(/\{clinica\}/gi, getClinicName());
  }

  function buildWhatsAppMessage(booking, templateKey) {
    const prefix = buildGreetingPrefix(booking.nome);
    const subject = booking.protocolo || (booking.areas || []).join(', ') || 'Avaliação Estética';
    const dataTxt = booking.data ? formatDateBR(booking.data) : 'uma data de sua preferência';
    const periodoTxt = booking.periodo || 'horário a combinar';

    if (templateKey === 'lembrete') {
      return `${prefix} Passando para lembrar da sua avaliação (${subject}) prevista para ${dataTxt} (${periodoTxt}). Podemos manter confirmado?`;
    }
    if (templateKey === 'pos') {
      return `${prefix} Foi um prazer receber você! Como está se sentindo após o atendimento de ${subject}? Qualquer dúvida, estamos à disposição por aqui.`;
    }
    return `${prefix} Recebemos sua solicitação para ${subject}. Temos disponibilidade em ${dataTxt} no período ${periodoTxt}. Qual horário fica melhor para você?`;
  }

  function buildClientWhatsAppUrl(booking, customMsg) {
    const num = buildClientWhatsAppNumber(booking.telefone);
    const msg = customMsg !== undefined ? customMsg : buildWhatsAppMessage(booking, 'confirmar');
    if (!num) return '#';
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  function downloadCsv(filename, headers, rows) {
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function syncSiteSessionBeforeNavigate() {
    if (!adminEmail || !adminToken) return;
    const clinicName = getClinicName();
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ email: adminEmail, businessName: clinicName, token: adminToken, loggedAt: Date.now() })
      );
      sessionStorage.setItem(INTERNAL_NAV_KEY, String(Date.now()));
      // Also mirror latest clinicName into local user list
      const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]');
      if (Array.isArray(users)) {
        const norm = adminEmail.toLowerCase();
        const idx = users.findIndex((u) => u.email === norm);
        if (idx !== -1 && clinicName) {
          users[idx].businessName = clinicName;
          localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
        }
      }
    } catch {}
  }

  // =========================================================
  // API CLIENT + PER-USER COLD-START RESILIENT MIRROR (VERCEL)
  // =========================================================
  const LOCAL_USERS_KEY = 'wl_preview_users_v1';

  async function hashLocalPass(email, password) {
    const raw = email.trim().toLowerCase() + '::wl_v1::' + password;
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return btoa(unescape(encodeURIComponent(raw)));
  }

  async function verifyLocalAccount(email, password) {
    try {
      const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]');
      const norm = email.trim().toLowerCase();
      const found = Array.isArray(users) && users.find((u) => u.email === norm);
      if (!found) return false;
      if (found.passHash) return (await hashLocalPass(norm, password)) === found.passHash;
      return found.password === password;
    } catch {
      return false;
    }
  }

  function mirrorKeys(email) {
    const norm = String(email || '').trim().toLowerCase();
    return {
      bookings: 'wl_crm_bookings:' + norm,
      workspace: 'wl_crm_workspace:' + norm,
    };
  }

  function readLocalMirror(email) {
    if (!email) return { bookings: [], workspace: null };
    const k = mirrorKeys(email);
    let localBookings = [];
    let localWorkspace = null;
    try {
      const b = JSON.parse(localStorage.getItem(k.bookings) || '[]');
      if (Array.isArray(b)) localBookings = b;
    } catch {}
    try {
      const w = JSON.parse(localStorage.getItem(k.workspace) || 'null');
      if (w && typeof w === 'object') localWorkspace = w;
    } catch {}
    return { bookings: localBookings, workspace: localWorkspace };
  }

  function saveLocalMirror() {
    if (!adminEmail) return;
    const k = mirrorKeys(adminEmail);
    try {
      localStorage.setItem(k.bookings, JSON.stringify(bookings));
      localStorage.setItem(k.workspace, JSON.stringify(workspace));
    } catch {}
  }

  function mergeBookingsLists(serverList, localList) {
    const map = new Map();
    (localList || []).forEach((b) => { if (b && b.id) map.set(b.id, b); });
    (serverList || []).forEach((b) => {
      if (!b || !b.id) return;
      const prev = map.get(b.id);
      if (!prev || new Date(b.updatedAt || b.createdAt || 0) >= new Date(prev.updatedAt || prev.createdAt || 0)) {
        map.set(b.id, b);
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function mergeWorkspaceData(serverWs, localWs) {
    if (!localWs) return serverWs;
    const merged = Object.assign({}, serverWs);
    // Prefer locally customized settings/team/services/patients/transactions if server cold-started empty
    if (localWs.settings && localWs.settings.clinicName && serverWs.settings && serverWs.settings.clinicName === 'Clínica de Estética') {
      merged.settings = Object.assign({}, serverWs.settings, localWs.settings);
    }
    const mergeById = (srvArr, locArr) => {
      const m = new Map();
      (locArr || []).forEach((x) => { if (x && x.id) m.set(x.id, x); });
      (srvArr || []).forEach((x) => { if (x && x.id) m.set(x.id, x); });
      return Array.from(m.values());
    };
    if (Array.isArray(localWs.patients) && localWs.patients.length > (serverWs.patients || []).length) {
      merged.patients = mergeById(serverWs.patients, localWs.patients);
    }
    if (Array.isArray(localWs.transactions) && localWs.transactions.length > (serverWs.transactions || []).length) {
      merged.transactions = mergeById(serverWs.transactions, localWs.transactions);
    }
    if (Array.isArray(localWs.services) && localWs.services.length > 0 && (!serverWs.services || serverWs.services.length === 7)) {
      merged.services = mergeById(serverWs.services, localWs.services);
    }
    if (Array.isArray(localWs.team) && localWs.team.length > 0 && (!serverWs.team || serverWs.team.length === 3)) {
      merged.team = mergeById(serverWs.team, localWs.team);
    }
    return merged;
  }

  async function apiRequest(path, options) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (options && options.headers) || {});
    if (adminToken && !String(adminToken).startsWith('local:')) {
      headers.Authorization = 'Bearer ' + adminToken;
    }
    const resp = await fetch(path, Object.assign({}, options || {}, { headers }));
    let data = {};
    try {
      data = await resp.json();
    } catch {}
    if (resp.status === 401 && path !== '/api/auth/login') {
      handleLogout(true);
      throw new Error('Sessão expirada. Entre novamente.');
    }
    if (!resp.ok) {
      const err = new Error(data.error || 'Erro ao comunicar com o servidor.');
      err.status = resp.status;
      throw err;
    }
    return data;
  }

  async function loadAllData(showNotice) {
    const mirror = readLocalMirror(adminEmail);
    try {
      const [bData, wData] = await Promise.all([
        apiRequest('/api/bookings', { method: 'GET' }),
        apiRequest('/api/workspace', { method: 'GET' }),
      ]);
      const srvBookings = Array.isArray(bData.bookings) ? bData.bookings : [];
      bookings = mergeBookingsLists(srvBookings, mirror.bookings);
      if (wData && wData.workspace) {
        workspace = mergeWorkspaceData(wData.workspace, mirror.workspace);
      }
      saveLocalMirror();
    } catch (err) {
      if (mirror.bookings.length || mirror.workspace) {
        bookings = mirror.bookings;
        if (mirror.workspace) workspace = mirror.workspace;
      } else {
        throw err;
      }
    }
    renderEverything();
    if (showNotice) showToast('Dados da clínica sincronizados.');
  }

  // =========================================================
  // AUTH & NAVIGATION
  // =========================================================
  async function handleLogin(e) {
    e.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const password = passInput.value;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      loginFeedback.classList.remove('is-ok');
      loginFeedback.textContent = 'Informe o Gmail cadastrado no site.';
      emailInput.focus();
      return;
    }
    if (!password) {
      loginFeedback.classList.remove('is-ok');
      loginFeedback.textContent = 'Informe sua senha.';
      passInput.focus();
      return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Validando acesso...';
    loginFeedback.textContent = '';

    try {
      let res;
      try {
        res = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      } catch (loginErr) {
        // Re-hydrate account seamlessly after Vercel ephemeral /tmp cold start if verified locally
        if (loginErr.status === 401 && (await verifyLocalAccount(email, password))) {
          let storedBiz = '';
          try {
            const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]');
            const f = Array.isArray(users) && users.find((u) => u.email === email);
            if (f && f.businessName) storedBiz = f.businessName;
          } catch {}
          res = await apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, businessName: storedBiz }),
          });
        } else {
          throw loginErr;
        }
      }

      adminToken = res.token;
      adminEmail = (res.user && res.user.email) || email;
      if (res.user && res.user.businessName) {
        workspace.settings.clinicName = res.user.businessName;
      }
      syncSiteSessionBeforeNavigate();

      loginFeedback.classList.add('is-ok');
      loginFeedback.textContent = 'Acesso confirmado. Preparando seu painel...';

      await loadAllData(false);
      enterWorkspace();
    } catch (err) {
      loginFeedback.classList.remove('is-ok');
      loginFeedback.textContent = err.message || 'Gmail ou senha incorretos.';
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Acessar Painel da Clínica';
    }
  }

  function enterWorkspace() {
    loadUserTheme(adminEmail);
    ownerEmailEl.textContent = adminEmail;
    ownerEmailEl.title = `Conta isolada: ${adminEmail}`;
    loginForm.reset();
    loginFeedback.textContent = '';

    const reveal = () => {
      gateEl.hidden = true;
      appEl.hidden = false;
      document.body.classList.remove('adm-locked');
      if (window.gsap) {
        window.gsap.fromTo(appEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.34, ease: 'power2.out' });
      }
    };

    if (window.gsap) {
      window.gsap.to(gateEl, { opacity: 0, duration: 0.24, ease: 'power2.in', onComplete: reveal });
    } else {
      reveal();
    }
  }

  function handleLogout(expired) {
    adminToken = null;
    adminEmail = null;
    bookings = [];
    workspace = { settings: { clinicName: 'Clínica de Estética' }, team: [], services: [], patients: [], transactions: [] };
    activeBookingId = null;
    activePatientId = null;
    closeDrawer();
    closePatientDrawer();
    closeAllModals();
    closeMobileSidebar();
    tableBodyEl.innerHTML = '';
    pipelineViewEl.innerHTML = '';

    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(INTERNAL_NAV_KEY);
    } catch {}

    appEl.hidden = true;
    gateEl.hidden = false;
    gateEl.style.opacity = '1';
    document.body.classList.add('adm-locked');

    if (expired) {
      loginFeedback.classList.remove('is-ok');
      loginFeedback.textContent = 'Sua sessão expirou. Entre novamente com seu Gmail e senha.';
    }
    setTimeout(() => emailInput && emailInput.focus(), 60);
  }

  function switchScreen(name) {
    activeScreen = name;
    navBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-nav-screen') === name));
    screens.forEach((sc) => {
      const match = sc.getAttribute('data-screen') === name;
      sc.hidden = !match;
      sc.classList.toggle('is-active', match);
    });
    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openMobileSidebar() {
    sidebarEl.classList.add('is-open');
    sidebarOverlay.hidden = false;
    sidebarOverlay.classList.add('is-open');
    menuToggleBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMobileSidebar() {
    sidebarEl.classList.remove('is-open');
    sidebarOverlay.classList.remove('is-open');
    sidebarOverlay.hidden = true;
    menuToggleBtn.setAttribute('aria-expanded', 'false');
  }

  // =========================================================
  // MASTER RENDER PIPELINE
  // =========================================================
  function renderEverything() {
    saveLocalMirror();
    syncDynamicSelectOptions();
    renderHeaderAndBadges();
    renderCRM();
    renderAgenda();
    renderPatients();
    renderServices();
    renderFinance();
    renderSettings();
  }

  function syncDynamicSelectOptions() {
    const activeTeam = (workspace.team || []).filter((m) => m.ativo !== false);
    const activeServices = (workspace.services || []).filter((s) => s.ativo !== false);

    // Populate protocol dropdowns (CRM drawer & New Booking modal)
    const protoOpts =
      `<option value="">Selecionar protocolo do catálogo...</option>` +
      activeServices
        .map((s) => `<option value="${escapeHtml(s.nome)}" data-price="${s.preco}">${escapeHtml(s.nome)} · ${formatCurrency(s.preco)}</option>`)
        .join('');
    if (editProtocolo) editProtocolo.innerHTML = protoOpts;
    if (newProtocolo) newProtocolo.innerHTML = protoOpts;

    // Populate specialist dropdowns
    const proOpts =
      `<option value="">A definir</option>` +
      activeTeam
        .map((m) => `<option value="${escapeHtml(m.nome)}" data-sala="${escapeHtml(m.sala)}">${escapeHtml(m.nome)} (${escapeHtml(m.sala)})</option>`)
        .join('');
    if (editPro) editPro.innerHTML = proOpts;
    if (newPro) newPro.innerHTML = proOpts;
    if (evoPro) evoPro.innerHTML = proOpts;

    if (agendaProFilterEl) {
      const prev = agendaProFilterEl.value;
      agendaProFilterEl.innerHTML =
        `<option value="all">Todas as especialistas</option>` +
        (workspace.team || []).map((m) => `<option value="${escapeHtml(m.nome)}">${escapeHtml(m.nome)}</option>`).join('');
      agendaProFilterEl.value = prev || 'all';
    }
  }

  const ADM_DROP_SVG = `<svg viewBox="0 0 54 52" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M46.46,6.71v2h3.5v20.55c0,11.33-9.22,20.56-20.56,20.56s-20.55-9.22-20.55-20.55S18.08,8.71,29.41,8.71h12.34v-2h-12.34c-12.44,0-22.55,10.12-22.55,22.56s10.12,22.55,22.55,22.55,22.56-10.12,22.56-22.56V6.71h-5.5Z"/><path d="M6.34,35.14c-2.71-3.48-4.34-7.84-4.34-12.59C2,11.22,11.22,2,22.56,2h20.55v20.55c0,11.33-9.22,20.56-20.56,20.56-2.88,0-5.62-.6-8.12-1.68.96,1.17,2.05,2.22,3.26,3.14,1.57.35,3.19.53,4.86.53,12.44,0,22.56-10.12,22.56-22.56V0h-22.55C10.12,0,0,10.12,0,22.56c0,6.94,3.15,13.15,8.09,17.29-.74-1.49-1.33-3.06-1.75-4.7Z"/></svg>`;

  function renderHeaderAndBadges() {
    const clinicName = getClinicName();
    clinicNameHeader.textContent = clinicName.toUpperCase();
    document.title = `Painel Admin & CRM — ${clinicName}`;

    // Render custom white-label brand lockup in Admin header
    const headerBrand = document.querySelector('.adm-header-brand');
    if (headerBrand) {
      const origLogo = headerBrand.querySelector('.adm-header-logo');
      if (origLogo) origLogo.style.display = 'none';
      let lockup = headerBrand.querySelector('.adm-brand-lockup');
      if (!lockup) {
        lockup = document.createElement('span');
        lockup.className = 'adm-brand-lockup';
        headerBrand.insertBefore(lockup, origLogo || headerBrand.firstChild);
      }
      lockup.innerHTML = `${ADM_DROP_SVG}<span>${escapeHtml(clinicName)}</span>`;
    }
    syncSiteSessionBeforeNavigate();

    const pendingCount = bookings.filter((b) => b.status === 'novo' || b.status === 'em_contato').length;
    const scheduledCount = bookings.filter((b) => b.status === 'agendado').length;
    const mergedPatients = getMergedPatients();

    if (navBadgeCrm) navBadgeCrm.textContent = String(pendingCount);
    if (navBadgeAgenda) navBadgeAgenda.textContent = String(scheduledCount);
    if (navBadgePatients) navBadgePatients.textContent = String(mergedPatients.length);
    if (navBadgeServices) navBadgeServices.textContent = String((workspace.services || []).filter((s) => s.ativo !== false).length);
  }

  // =========================================================
  // SCREEN 1: VISÃO GERAL & CRM
  // =========================================================
  function getFilteredBookings() {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter((b) => {
      if (activeStatusFilter !== 'all' && b.status !== activeStatusFilter) return false;
      if (!q) return true;
      const haystack = [
        b.nome, b.telefone, b.email, b.protocolo, b.profissional, b.sala,
        (b.areas || []).join(' '), b.objetivo, b.observacoes, b.notasInternas,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  function renderCRM() {
    const total = bookings.length;
    const novoCount = bookings.filter((b) => b.status === 'novo').length;
    const contatoCount = bookings.filter((b) => b.status === 'em_contato').length;
    const agendadoList = bookings.filter((b) => b.status === 'agendado');
    const concluidoCount = bookings.filter((b) => b.status === 'concluido').length;
    const totalRevenue = bookings
      .filter((b) => b.status !== 'cancelado')
      .reduce((sum, b) => sum + (Number(b.valorEstimado) || 0), 0);

    kpiTotal.textContent = String(total);
    kpiTotalSub.textContent =
      total === 0
        ? 'Nenhum agendamento recebido ainda'
        : `${novoCount} novo${novoCount === 1 ? '' : 's'} · ${concluidoCount} concluído${concluidoCount === 1 ? '' : 's'}`;

    const pending = novoCount + contatoCount;
    kpiPending.textContent = String(pending);
    kpiPendingSub.textContent =
      pending === 0 ? 'Todos os leads já foram respondidos' : `${novoCount} sem resposta · ${contatoCount} em negociação`;

    kpiScheduled.textContent = String(agendadoList.length);
    const dated = agendadoList
      .filter((b) => b.data && /^\d{4}-\d{2}-\d{2}$/.test(b.data))
      .sort((a, b) => a.data.localeCompare(b.data));
    kpiScheduledSub.textContent = dated.length
      ? `Próxima avaliação em ${formatDateBR(dated[0].data)}`
      : 'Avaliações confirmadas na agenda';

    kpiRevenue.textContent = formatCurrency(totalRevenue);
    kpiRevenueSub.textContent = totalRevenue > 0 ? 'Soma estimada dos protocolos ativos' : 'Defina valores na ficha do cliente';

    // Funnel & Areas
    const activeNonCancelled = bookings.filter((b) => b.status !== 'cancelado').length;
    const converted = bookings.filter((b) => b.status === 'agendado' || b.status === 'concluido').length;
    const convPct = activeNonCancelled > 0 ? Math.round((converted / activeNonCancelled) * 100) : 0;
    conversionBadge.textContent = `${convPct}% agendados/concluídos`;

    const stageCounts = PIPELINE_STAGES.map((st) => ({
      key: st,
      label: STATUS_META[st].label,
      count: bookings.filter((b) => b.status === st).length,
    }));
    const maxStage = Math.max(1, ...stageCounts.map((s) => s.count));
    funnelBarsEl.innerHTML = stageCounts
      .map((s) => {
        const pct = total > 0 ? Math.round((s.count / maxStage) * 100) : 0;
        const share = total > 0 ? Math.round((s.count / total) * 100) : 0;
        return `
          <div class="adm-bar-row">
            <div class="adm-bar-meta"><span>${escapeHtml(s.label)}</span><span>${s.count} (${share}%)</span></div>
            <div class="adm-bar-track"><div class="adm-bar-fill adm-bar-fill--${s.key}" style="width: ${pct}%"></div></div>
          </div>`;
      })
      .join('');

    const areaMap = {};
    let totalMentions = 0;
    bookings.forEach((b) => {
      (b.areas || []).forEach((a) => {
        areaMap[a] = (areaMap[a] || 0) + 1;
        totalMentions += 1;
      });
    });
    areasCountBadge.textContent = `${totalMentions} interesse${totalMentions === 1 ? '' : 's'}`;
    const topAreas = Object.entries(areaMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

    if (!topAreas.length) {
      areaBarsEl.innerHTML = `<div class="adm-bars-empty">As áreas de interesse aparecerão aqui assim que houver solicitações.</div>`;
    } else {
      const maxArea = Math.max(1, topAreas[0][1]);
      areaBarsEl.innerHTML = topAreas
        .map(([name, count]) => `
          <div class="adm-bar-row">
            <div class="adm-bar-meta"><span>${escapeHtml(name)}</span><span>${count} solicitaç${count === 1 ? 'ão' : 'ões'}</span></div>
            <div class="adm-bar-track"><div class="adm-bar-fill" style="width: ${Math.round((count / maxArea) * 100)}%"></div></div>
          </div>`)
        .join('');
    }

    // Filter counts
    const counts = { all: bookings.length, novo: 0, em_contato: 0, agendado: 0, concluido: 0, cancelado: 0 };
    bookings.forEach((b) => {
      if (counts[b.status] !== undefined) counts[b.status] += 1;
    });
    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = String(counts[el.getAttribute('data-count')] || 0);
    });

    // Views
    const filtered = getFilteredBookings();
    if (bookings.length === 0) {
      emptyStateEl.hidden = false;
      noResultsEl.hidden = true;
      listViewEl.hidden = true;
      pipelineViewEl.hidden = true;
      return;
    }
    emptyStateEl.hidden = true;
    if (filtered.length === 0) {
      noResultsEl.hidden = false;
      listViewEl.hidden = true;
      pipelineViewEl.hidden = true;
      return;
    }
    noResultsEl.hidden = true;
    if (currentView === 'list') {
      listViewEl.hidden = false;
      pipelineViewEl.hidden = true;
      renderCrmTable(filtered);
    } else {
      listViewEl.hidden = true;
      pipelineViewEl.hidden = false;
      renderCrmPipeline(filtered);
    }
  }

  function renderCrmTable(list) {
    tableBodyEl.innerHTML = list
      .map((b) => {
        const waUrl = buildClientWhatsAppUrl(b);
        const areaTags = (b.areas || []).slice(0, 2).map((a) => `<span class="adm-area-tag">${escapeHtml(a)}</span>`).join('');
        const extraAreas = (b.areas || []).length > 2 ? `<span class="adm-area-tag">+${b.areas.length - 2}</span>` : '';
        const statusOptions = Object.keys(STATUS_META)
          .map((key) => `<option value="${key}" ${b.status === key ? 'selected' : ''}>${STATUS_META[key].label}</option>`)
          .join('');
        const subMeta = [b.profissional, b.sala].filter(Boolean).join(' · ') || (b.periodo || 'Flexível');

        return `
          <tr data-open-id="${escapeHtml(b.id)}">
            <td>
              <div class="adm-client-name">${escapeHtml(b.nome)}</div>
              <div class="adm-client-sub">${escapeHtml(b.telefone)}${b.email ? ' · ' + escapeHtml(b.email) : ''}</div>
            </td>
            <td>
              <div class="adm-area-tags">${areaTags}${extraAreas}</div>
              <div class="adm-goal-text" title="${escapeHtml(b.protocolo || b.objetivo)}">${escapeHtml(b.protocolo || b.objetivo || 'Avaliação estética')}</div>
            </td>
            <td>
              <div class="adm-pref-date">${escapeHtml(formatDateBR(b.data))}</div>
              <div class="adm-pref-period">${escapeHtml(subMeta)}</div>
            </td>
            <td data-stop-row>
              <select class="adm-status-select status-${escapeHtml(b.status)}" data-quick-status="${escapeHtml(b.id)}" aria-label="Alterar etapa de ${escapeHtml(b.nome)}">
                ${statusOptions}
              </select>
            </td>
            <td class="adm-value-cell">${b.valorEstimado > 0 ? escapeHtml(formatCurrency(b.valorEstimado)) : '—'}</td>
            <td data-stop-row>
              <div class="adm-row-actions">
                <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="adm-wa-mini" title="Abrir conversa no WhatsApp com ${escapeHtml(b.nome)}">
                  ${WA_ICON_SVG}<span>WhatsApp</span>
                </a>
                <button type="button" class="adm-detail-btn" data-open-btn="${escapeHtml(b.id)}">Ficha</button>
              </div>
            </td>
          </tr>`;
      })
      .join('');
  }

  function renderCrmPipeline(list) {
    pipelineViewEl.innerHTML = PIPELINE_STAGES.map((stage) => {
      const items = list.filter((b) => b.status === stage);
      const cardsHtml = items.length
        ? items
            .map((b) => {
              const waUrl = buildClientWhatsAppUrl(b);
              const meta = STATUS_META[b.status] || {};
              const areaTags = (b.areas || []).slice(0, 2).map((a) => `<span class="adm-area-tag">${escapeHtml(a)}</span>`).join('');
              return `
                <article class="adm-pipe-card" data-open-id="${escapeHtml(b.id)}">
                  <div class="adm-pipe-top">
                    <div class="adm-pipe-name">${escapeHtml(b.nome)}</div>
                    <div class="adm-pipe-val">${b.valorEstimado > 0 ? escapeHtml(formatCurrency(b.valorEstimado)) : ''}</div>
                  </div>
                  <div class="adm-pipe-meta">${escapeHtml(b.telefone)} · ${escapeHtml(formatDateBR(b.data))}</div>
                  ${b.profissional ? `<div class="adm-pipe-meta">${escapeHtml(b.profissional)}</div>` : ''}
                  <div class="adm-area-tags">${areaTags}</div>
                  <div class="adm-pipe-actions" data-stop-row>
                    <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="adm-wa-mini">${WA_ICON_SVG}<span>WhatsApp</span></a>
                    ${
                      meta.next
                        ? `<button type="button" class="adm-pipe-next" data-advance-id="${escapeHtml(b.id)}" data-advance-to="${meta.next}">${escapeHtml(meta.nextLabel)} →</button>`
                        : `<span class="adm-pipe-meta">Finalizado</span>`
                    }
                  </div>
                </article>`;
            })
            .join('')
        : `<div class="adm-col-empty">Sem agendamentos nesta etapa</div>`;

      return `
        <div class="adm-col">
          <div class="adm-col-head">
            <div class="adm-col-title"><span class="adm-col-dot adm-col-dot--${stage}"></span><span>${STATUS_META[stage].label}</span></div>
            <span class="adm-col-count">${items.length}</span>
          </div>
          ${cardsHtml}
        </div>`;
    }).join('');
  }

  // =========================================================
  // SCREEN 2: AGENDA DA CLÍNICA
  // =========================================================
  function renderAgenda() {
    agendaMonthLabel.textContent = `${MONTHS_PT[calMonth]} ${calYear}`;

    const filteredBookings = bookings.filter((b) => {
      if (b.status === 'cancelado') return false;
      if (agendaProFilter !== 'all' && (b.profissional || '') !== agendaProFilter) return false;
      return Boolean(b.data && /^\d{4}-\d{2}-\d{2}$/.test(b.data));
    });

    const byDate = {};
    filteredBookings.forEach((b) => {
      if (!byDate[b.data]) byDate[b.data] = [];
      byDate[b.data].push(b);
    });

    const firstDay = new Date(calYear, calMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

    const cells = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(calYear, calMonth - 1, prevMonthDays - i);
      cells.push({ iso: d.toISOString().slice(0, 10), num: prevMonthDays - i, outside: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ iso, num: day, outside: false });
    }
    while (cells.length % 7 !== 0) {
      const nextDay = cells.length - (startWeekday + daysInMonth) + 1;
      const d = new Date(calYear, calMonth + 1, nextDay);
      cells.push({ iso: d.toISOString().slice(0, 10), num: nextDay, outside: true });
    }

    agendaCalGrid.innerHTML = cells
      .map((c) => {
        const items = byDate[c.iso] || [];
        const dots = items
          .slice(0, 4)
          .map((it) => `<i class="adm-dot adm-dot--${escapeHtml(it.status)}"></i>`)
          .join('');
        const cls = [
          'adm-cal-day',
          c.outside ? 'is-outside' : '',
          c.iso === todayIso ? 'is-today' : '',
          c.iso === selectedDateIso ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return `
          <button type="button" class="${cls}" data-cal-date="${c.iso}">
            <span class="adm-cal-num">${c.num}</span>
            <span class="adm-cal-dots">${dots}</span>
          </button>`;
      })
      .join('');

    // Selected Day Panel
    const dayItems = byDate[selectedDateIso] || [];
    agendaDayTitle.textContent = formatDateBR(selectedDateIso);
    agendaDayCount.textContent = `${dayItems.length} atendimento${dayItems.length === 1 ? '' : 's'}`;

    if (!dayItems.length) {
      agendaDaySlots.innerHTML = `<div class="adm-bars-empty">Nenhum atendimento marcado para ${formatDateBR(selectedDateIso)}. Clique em "+ Agendar neste dia" para reservar um horário.</div>`;
    } else {
      agendaDaySlots.innerHTML = dayItems
        .map((b) => {
          const waUrl = buildClientWhatsAppUrl(b);
          const meta = [b.protocolo || (b.areas || [])[0] || 'Avaliação', b.profissional, b.sala].filter(Boolean).join(' · ');
          return `
            <div class="adm-slot-card" data-open-id="${escapeHtml(b.id)}">
              <div>
                <div class="adm-slot-time">${escapeHtml(b.periodo || 'Horário flexível')} · ${escapeHtml((STATUS_META[b.status] || {}).label || b.status)}</div>
                <div class="adm-slot-name">${escapeHtml(b.nome)}</div>
                <div class="adm-slot-meta">${escapeHtml(meta)}</div>
              </div>
              <div class="adm-slot-right" data-stop-row>
                <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="adm-wa-mini">${WA_ICON_SVG}<span>WhatsApp</span></a>
              </div>
            </div>`;
        })
        .join('');
    }

    // Upcoming List
    const upcoming = filteredBookings
      .filter((b) => b.data >= todayIso)
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 5);

    if (!upcoming.length) {
      agendaUpcomingList.innerHTML = `<div class="adm-bars-empty">Sem atendimentos futuros cadastrados.</div>`;
    } else {
      agendaUpcomingList.innerHTML = upcoming
        .map((b) => `
          <div class="adm-upcoming-row" data-open-id="${escapeHtml(b.id)}">
            <div><strong>${escapeHtml(b.nome)}</strong> · ${escapeHtml(b.protocolo || (b.areas || [])[0] || 'Avaliação')}</div>
            <span class="adm-pref-period">${escapeHtml(formatDateBR(b.data))}</span>
          </div>`)
        .join('');
    }
  }

  // =========================================================
  // SCREEN 3: PACIENTES & PRONTUÁRIO ESTÉTICO
  // =========================================================
  function getMergedPatients() {
    const map = new Map();
    (workspace.patients || []).forEach((p) => {
      const key = normalizePhoneDigits(p.telefone) || p.nome.toLowerCase();
      map.set(key, Object.assign({ isSaved: true, visits: 0, ltv: 0, lastVisit: '' }, p));
    });

    bookings.forEach((b) => {
      const key = normalizePhoneDigits(b.telefone) || b.nome.toLowerCase();
      let rec = map.get(key);
      if (!rec) {
        rec = {
          id: null,
          isSaved: false,
          nome: b.nome,
          telefone: b.telefone,
          email: b.email || '',
          nascimento: '',
          tipoPele: 'Avaliação pendente',
          fototipo: '',
          alergias: '',
          medicamentos: '',
          gestante: 'Não',
          proximoRetorno: '',
          evolucoes: [],
          visits: 0,
          ltv: 0,
          lastVisit: '',
        };
        map.set(key, rec);
      }
      if (b.status !== 'cancelado') {
        rec.visits += 1;
        rec.ltv += Number(b.valorEstimado) || 0;
        if (b.data && (!rec.lastVisit || b.data > rec.lastVisit)) rec.lastVisit = b.data;
      }
    });

    return Array.from(map.values()).sort((a, b) => (b.isSaved ? 1 : 0) - (a.isSaved ? 1 : 0) || a.nome.localeCompare(b.nome));
  }

  function hasAllergyAlert(p) {
    const txt = String(p.alergias || '').trim().toLowerCase();
    return Boolean(txt && !txt.includes('nenhuma') && !txt.includes('sem restri') && txt !== 'não');
  }

  function renderPatients() {
    const merged = getMergedPatients();
    const q = patSearchQuery.trim().toLowerCase();

    const filtered = merged.filter((p) => {
      if (patFilter === 'retornos' && !p.proximoRetorno) return false;
      if (patFilter === 'alertas' && !hasAllergyAlert(p) && p.gestante === 'Não') return false;
      if (!q) return true;
      return [p.nome, p.telefone, p.email, p.tipoPele, p.alergias].join(' ').toLowerCase().includes(q);
    });

    if (!filtered.length) {
      patGridEl.innerHTML = '';
      patEmptyEl.hidden = false;
      return;
    }

    patEmptyEl.hidden = true;
    patGridEl.innerHTML = filtered
      .map((p, idx) => {
        const waMsg = `${buildGreetingPrefix(p.nome)} Como você está? Passando para acompanhar seus cuidados estéticos${p.proximoRetorno ? ' e lembrar do retorno previsto para ' + formatDateBR(p.proximoRetorno) : ''}.`;
        const waUrl = buildClientWhatsAppUrl(p, waMsg);
        const alertText = hasAllergyAlert(p)
          ? `Atenção: ${p.alergias}`
          : p.gestante && p.gestante !== 'Não'
          ? `Condição especial: ${p.gestante}`
          : '';

        return `
          <article class="adm-entity-card">
            <div class="adm-pat-head">
              <div class="adm-avatar">${escapeHtml(getInitials(p.nome))}</div>
              <div>
                <h3 class="adm-entity-title">${escapeHtml(p.nome)}</h3>
                <div class="adm-entity-sub">${escapeHtml(p.telefone || 'Sem telefone')}${p.email ? ' · ' + escapeHtml(p.email) : ''}</div>
              </div>
            </div>

            <div class="adm-area-tags">
              <span class="adm-area-tag">Pele: ${escapeHtml(p.tipoPele || 'A avaliar')}</span>
              ${p.fototipo ? `<span class="adm-area-tag">Fototipo ${escapeHtml(p.fototipo.split(' ')[0])}</span>` : ''}
              ${!p.isSaved ? `<span class="adm-area-tag">Lead CRM</span>` : ''}
            </div>

            ${alertText ? `<div class="adm-alert-tag">${escapeHtml(alertText)}</div>` : ''}

            <div class="adm-entity-stats">
              <div><div class="adm-stat-k">Sessões</div><div class="adm-stat-v">${p.visits + (p.evolucoes || []).length}</div></div>
              <div><div class="adm-stat-k">Investimento</div><div class="adm-stat-v">${p.ltv > 0 ? escapeHtml(formatCurrency(p.ltv)) : '—'}</div></div>
              <div><div class="adm-stat-k">Retorno</div><div class="adm-stat-v">${p.proximoRetorno ? escapeHtml(formatDateBR(p.proximoRetorno)) : '—'}</div></div>
            </div>

            <div class="adm-entity-foot">
              <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="adm-wa-mini">${WA_ICON_SVG}<span>WhatsApp</span></a>
              <button type="button" class="adm-detail-btn" data-open-patient="${idx}" data-pat-id="${escapeHtml(p.id || '')}" data-pat-name="${escapeHtml(p.nome)}">Abrir Prontuário</button>
            </div>
          </article>`;
      })
      .join('');
  }

  function openPatientDrawer(patientObj) {
    activePatientId = patientObj && patientObj.id ? patientObj.id : null;
    patDrawerTitle.textContent = (patientObj && patientObj.nome) || 'Nova ficha clínica';

    patFNome.value = (patientObj && patientObj.nome) || '';
    patFTel.value = (patientObj && patientObj.telefone) || '';
    patFEmail.value = (patientObj && patientObj.email) || '';
    patFNasc.value = (patientObj && patientObj.nascimento) || '';
    patFRetorno.value = (patientObj && patientObj.proximoRetorno) || '';
    patFPele.value = (patientObj && patientObj.tipoPele && ['Normal', 'Mista', 'Oleosa', 'Seca / Sensível', 'Madura'].includes(patientObj.tipoPele)) ? patientObj.tipoPele : 'Normal';
    patFFototipo.value = (patientObj && patientObj.fototipo) || 'III — Morena clara';
    patFGestante.value = (patientObj && patientObj.gestante) || 'Não';
    patFAlergias.value = (patientObj && patientObj.alergias) || '';
    patFMeds.value = (patientObj && patientObj.medicamentos) || '';

    patDeleteBtn.hidden = !activePatientId;
    patEvoSection.hidden = !activePatientId;

    const waMsg = `${buildGreetingPrefix(patFNome.value || 'paciente')} Lembrando do seu acompanhamento estético${patFRetorno.value ? ' previsto para ' + formatDateBR(patFRetorno.value) : ''}. Deseja reservar um horário?`;
    patWaReturnBtn.href = buildClientWhatsAppUrl({ telefone: patFTel.value, nome: patFNome.value }, waMsg);
    patWaReturnBtn.hidden = !normalizePhoneDigits(patFTel.value);

    evoData.value = todayIso;
    evoProtocolo.value = '';
    evoNotas.value = '';

    renderPatientEvolutions(patientObj);

    patDrawerBackdrop.classList.add('is-open');
    patDrawerBackdrop.setAttribute('aria-hidden', 'false');
    if (window.gsap) {
      window.gsap.fromTo(patDrawerEl, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.28, ease: 'power3.out' });
    }
  }

  function renderPatientEvolutions(patientObj) {
    const list = (patientObj && patientObj.evolucoes) || [];
    if (!list.length) {
      patEvoList.innerHTML = `<div class="adm-bars-empty">Nenhuma sessão registrada no prontuário ainda.</div>`;
      return;
    }
    patEvoList.innerHTML = list
      .map((ev) => `
        <div class="adm-evo-item">
          <div class="adm-evo-head">
            <span class="adm-evo-title">${escapeHtml(ev.protocolo)}</span>
            <span class="adm-evo-date">${escapeHtml(formatDateBR(ev.data))}${ev.profissional ? ' · ' + escapeHtml(ev.profissional) : ''}</span>
          </div>
          ${ev.notas ? `<p class="adm-evo-notes">${escapeHtml(ev.notas)}</p>` : ''}
        </div>`)
      .join('');
  }

  function closePatientDrawer() {
    patDrawerBackdrop.classList.remove('is-open');
    patDrawerBackdrop.setAttribute('aria-hidden', 'true');
    activePatientId = null;
  }

  // =========================================================
  // SCREEN 4: PROTOCOLOS & SERVIÇOS
  // =========================================================
  function renderServices() {
    const list = (workspace.services || []).filter((s) => srvCatFilter === 'all' || s.categoria === srvCatFilter);
    if (!list.length) {
      srvGridEl.innerHTML = `<div class="adm-bars-empty">Nenhum protocolo cadastrado nesta categoria.</div>`;
      return;
    }

    srvGridEl.innerHTML = list
      .map((s) => `
        <article class="adm-entity-card ${s.ativo === false ? 'is-paused' : ''}">
          <div class="adm-srv-head">
            <span class="adm-area-tag">${escapeHtml(s.categoria)}</span>
            <span class="adm-badge-status ${s.ativo === false ? 'is-off' : 'is-on'}">${s.ativo === false ? 'Pausado' : 'Ativo'}</span>
          </div>
          <h3 class="adm-entity-title">${escapeHtml(s.nome)}</h3>
          <p class="adm-srv-desc">${escapeHtml(s.descricao || 'Protocolo estético personalizado da clínica.')}</p>
          <div class="adm-entity-stats">
            <div><div class="adm-stat-k">Duração</div><div class="adm-stat-v">${s.duracaoMin} min</div></div>
            <div><div class="adm-stat-k">Retorno</div><div class="adm-stat-v">${s.retornoDias ? s.retornoDias + ' dias' : 'Único'}</div></div>
            <div><div class="adm-stat-k">Valor</div><div class="adm-stat-v">${escapeHtml(formatCurrency(s.preco))}</div></div>
          </div>
          <div class="adm-entity-foot">
            <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-srv-toggle="${escapeHtml(s.id)}">${s.ativo === false ? 'Ativar' : 'Pausar'}</button>
            <div style="display:flex;gap:6px;">
              <button type="button" class="adm-detail-btn" data-srv-edit="${escapeHtml(s.id)}">Editar</button>
              <button type="button" class="adm-btn-danger-text" data-srv-del="${escapeHtml(s.id)}">Excluir</button>
            </div>
          </div>
        </article>`)
      .join('');
  }

  function openServiceModal(serviceObj) {
    srvError.textContent = '';
    if (serviceObj) {
      srvModalTitle.textContent = 'Editar protocolo';
      srvId.value = serviceObj.id;
      srvNome.value = serviceObj.nome;
      srvCat.value = serviceObj.categoria;
      srvPreco.value = serviceObj.preco;
      srvDuracao.value = serviceObj.duracaoMin;
      srvRetorno.value = serviceObj.retornoDias;
      srvDesc.value = serviceObj.descricao || '';
    } else {
      srvForm.reset();
      srvModalTitle.textContent = 'Novo protocolo';
      srvId.value = '';
      srvDuracao.value = '60';
      srvRetorno.value = '30';
    }
    srvModal.classList.add('is-open');
    srvModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => srvNome.focus(), 50);
  }

  // =========================================================
  // SCREEN 5: FINANCEIRO & CAIXA
  // =========================================================
  function renderFinance() {
    const txs = workspace.transactions || [];
    const paidIn = txs.filter((t) => t.tipo === 'receita' && t.status === 'pago');
    const pendingIn = txs.filter((t) => t.tipo === 'receita' && t.status === 'pendente');
    const paidOut = txs.filter((t) => t.tipo === 'despesa');

    const sumIn = paidIn.reduce((s, t) => s + (Number(t.valor) || 0), 0);
    const sumPending = pendingIn.reduce((s, t) => s + (Number(t.valor) || 0), 0);
    const sumOut = paidOut.reduce((s, t) => s + (Number(t.valor) || 0), 0);
    const net = sumIn - sumOut;
    const avgTicket = paidIn.length ? Math.round(sumIn / paidIn.length) : 0;

    finKpiIn.textContent = formatCurrency(sumIn);
    finKpiInSub.textContent = `${paidIn.length} recebimento${paidIn.length === 1 ? '' : 's'} confirmado${paidIn.length === 1 ? '' : 's'}`;
    finKpiPending.textContent = formatCurrency(sumPending);
    finKpiPendingSub.textContent = `${pendingIn.length} parcela${pendingIn.length === 1 ? '' : 's'} em aberto`;
    finKpiOut.textContent = formatCurrency(sumOut);
    finKpiOutSub.textContent = `${paidOut.length} despesa${paidOut.length === 1 ? '' : 's'} registrada${paidOut.length === 1 ? '' : 's'}`;
    finKpiNet.textContent = formatCurrency(net);
    finKpiTicket.textContent = `Ticket médio: ${formatCurrency(avgTicket)}`;

    // Payment method distribution (for receitas)
    const methodTotals = {};
    const allReceitas = txs.filter((t) => t.tipo === 'receita');
    allReceitas.forEach((t) => {
      const m = t.formaPagamento || 'PIX';
      methodTotals[m] = (methodTotals[m] || 0) + (Number(t.valor) || 0);
    });
    finMethodsBadge.textContent = `${allReceitas.length} receita${allReceitas.length === 1 ? '' : 's'}`;
    const sortedMethods = Object.entries(methodTotals).sort((a, b) => b[1] - a[1]);

    if (!sortedMethods.length) {
      finMethodBars.innerHTML = `<div class="adm-bars-empty">A distribuição por PIX, cartão e transferências aparecerá conforme registrar receitas.</div>`;
    } else {
      const maxVal = Math.max(1, sortedMethods[0][1]);
      finMethodBars.innerHTML = sortedMethods
        .map(([m, v]) => `
          <div class="adm-bar-row">
            <div class="adm-bar-meta"><span>${escapeHtml(m)}</span><span>${escapeHtml(formatCurrency(v))}</span></div>
            <div class="adm-bar-track"><div class="adm-bar-fill adm-bar-fill--agendado" style="width: ${Math.round((v / maxVal) * 100)}%"></div></div>
          </div>`)
        .join('');
    }

    // Filtered Ledger Table
    const filtered = txs
      .filter((t) => {
        if (finFilter === 'receita') return t.tipo === 'receita';
        if (finFilter === 'despesa') return t.tipo === 'despesa';
        if (finFilter === 'pendente') return t.status === 'pendente';
        return true;
      })
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    if (!filtered.length) {
      finEmptyEl.hidden = false;
      finTableWrap.hidden = true;
      return;
    }

    finEmptyEl.hidden = true;
    finTableWrap.hidden = false;
    finTableBody.innerHTML = filtered
      .map((t) => `
        <tr>
          <td class="adm-pref-date">${escapeHtml(formatDateBR(t.data))}</td>
          <td>
            <div class="adm-client-name">${escapeHtml(t.descricao)}</div>
            <div class="adm-client-sub">${escapeHtml([t.paciente, t.categoria].filter(Boolean).join(' · '))}</div>
          </td>
          <td><span class="adm-area-tag">${escapeHtml(t.formaPagamento)}</span></td>
          <td>
            <button type="button" class="adm-pill-toggle ${t.status === 'pago' ? 'is-paid' : 'is-pending'}" data-tx-toggle="${escapeHtml(t.id)}" title="Clique para alternar Pago / Pendente">
              ${t.status === 'pago' ? 'Pago' : 'Pendente'}
            </button>
          </td>
          <td class="${t.tipo === 'receita' ? 'adm-amount-in' : 'adm-amount-out'}">
            ${t.tipo === 'receita' ? '+' : '−'} ${escapeHtml(formatCurrency(t.valor))}
          </td>
          <td class="adm-th-actions">
            <button type="button" class="adm-btn-danger-text" data-tx-del="${escapeHtml(t.id)}">Excluir</button>
          </td>
        </tr>`)
      .join('');
  }

  function openFinanceModal(prefill) {
    finForm.reset();
    finError.textContent = '';
    finData.value = todayIso;
    if (prefill) {
      finTipo.value = prefill.tipo || 'receita';
      finDesc.value = prefill.descricao || '';
      finPaciente.value = prefill.paciente || '';
      finCat.value = prefill.categoria || '';
      if (prefill.valor) finValor.value = prefill.valor;
      finStatus.value = prefill.status || 'pago';
    }
    finModal.classList.add('is-open');
    finModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => finDesc.focus(), 50);
  }

  // =========================================================
  // SCREEN 6: EQUIPE & CONFIGURAÇÕES WHITE-LABEL
  // =========================================================
  function renderSettings() {
    const s = workspace.settings || {};
    setClinicName.value = s.clinicName || 'Clínica de Estética';
    setWhatsapp.value = s.whatsapp || '';
    setInstagram.value = s.instagram || '';
    setAddress.value = s.address || '';
    setHours.value = s.hours || '';
    setWaGreeting.value = s.waGreeting || '';

    const team = workspace.team || [];
    const activeCount = team.filter((m) => m.ativo !== false).length;
    setTeamCount.textContent = `${activeCount} ativa${activeCount === 1 ? '' : 's'}`;

    if (!team.length) {
      setTeamList.innerHTML = `<div class="adm-bars-empty">Adicione as especialistas que atendem nas cabines da clínica.</div>`;
      return;
    }

    setTeamList.innerHTML = team
      .map((m) => `
        <div class="adm-team-row ${m.ativo === false ? 'is-paused' : ''}">
          <div>
            <div class="adm-slot-name">${escapeHtml(m.nome)}</div>
            <div class="adm-slot-meta">${escapeHtml(m.especialidade)} · ${escapeHtml(m.sala)} · ${escapeHtml(m.dias)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-team-toggle="${escapeHtml(m.id)}">${m.ativo === false ? 'Ativar' : 'Pausar'}</button>
            <button type="button" class="adm-btn-danger-text" data-team-del="${escapeHtml(m.id)}">Remover</button>
          </div>
        </div>`)
      .join('');
  }

  // =========================================================
  // CRM BOOKING DRAWER
  // =========================================================
  async function updateBooking(id, patch, silent) {
    let updatedBooking = null;
    try {
      const res = await apiRequest(`/api/bookings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      updatedBooking = res.booking;
    } catch (err) {
      // If Vercel serverless cold-started ephemeral /tmp, update isolated client mirror cleanly
      if (err.status !== 404) throw err;
    }
    const idx = bookings.findIndex((b) => b.id === id);
    if (idx !== -1) {
      bookings[idx] = updatedBooking || Object.assign({}, bookings[idx], patch, { updatedAt: new Date().toISOString() });
    }
    renderEverything();
    if (!silent) showToast('Alterações salvas no CRM.');
    return idx !== -1 ? bookings[idx] : updatedBooking;
  }

  function openDrawer(id) {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    activeBookingId = id;
    activeWaTemplate = 'confirmar';

    drawerMeta.textContent = `${(booking.origem || 'Site').toUpperCase()} · ${formatRelativeDate(booking.createdAt)}`;
    drawerName.textContent = booking.nome;
    dPhone.textContent = booking.telefone || '—';
    dEmail.textContent = booking.email || 'Não informado';
    dAreas.innerHTML = (booking.areas || []).map((a) => `<span class="adm-area-tag">${escapeHtml(a)}</span>`).join('');
    dObjetivo.textContent = booking.objetivo || 'Avaliação estética personalizada';
    dHistorico.textContent = booking.historico || 'Primeira vez';

    if (booking.observacoes) {
      dObsWrap.hidden = false;
      dObs.textContent = booking.observacoes;
    } else {
      dObsWrap.hidden = true;
    }

    editStatus.value = booking.status || 'novo';
    editValor.value = booking.valorEstimado ? String(booking.valorEstimado) : '';
    editProtocolo.value = booking.protocolo || '';
    editPro.value = booking.profissional || '';
    editSala.value = booking.sala || '';
    editData.value = booking.data || '';
    editPeriodo.value = booking.periodo || 'Flexível';
    editNotas.value = booking.notasInternas || '';

    deleteBtn.hidden = false;
    deleteConfirm.hidden = true;

    waTplBtns.forEach((btn) => btn.classList.toggle('is-active', btn.getAttribute('data-wa-tpl') === activeWaTemplate));
    const defaultMsg = buildWhatsAppMessage(booking, activeWaTemplate);
    waMessageInput.value = defaultMsg;
    waSendLabel.textContent = `Abrir WhatsApp de ${firstName(booking.nome)}`;
    waSendLink.href = buildClientWhatsAppUrl(booking, defaultMsg);

    drawerBackdrop.classList.add('is-open');
    drawerBackdrop.setAttribute('aria-hidden', 'false');
    if (window.gsap) {
      window.gsap.killTweensOf([drawerBackdrop, drawerEl]);
      window.gsap.fromTo(drawerBackdrop, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      window.gsap.fromTo(drawerEl, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.28, ease: 'power3.out' });
    }
  }

  function closeDrawer() {
    if (!drawerBackdrop.classList.contains('is-open')) return;
    activeBookingId = null;
    drawerBackdrop.classList.remove('is-open');
    drawerBackdrop.setAttribute('aria-hidden', 'true');
  }

  function openNewBookingModal(prefillDate) {
    newForm.reset();
    newError.textContent = '';
    newAreaChips.forEach((c, idx) => c.classList.toggle('is-selected', idx === 0));
    if (prefillDate) newData.value = prefillDate;
    newModal.classList.add('is-open');
    newModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => newNome && newNome.focus(), 50);
  }

  function closeAllModals() {
    [newModal, srvModal, finModal].forEach((m) => {
      if (!m) return;
      m.classList.remove('is-open');
      m.setAttribute('aria-hidden', 'true');
    });
  }

  // =========================================================
  // EVENT LISTENERS
  // =========================================================
  loginForm.addEventListener('submit', handleLogin);
  togglePassBtn.addEventListener('click', () => {
    passInput.type = passInput.type === 'text' ? 'password' : 'text';
  });
  [emailInput, passInput].forEach((inp) => inp.addEventListener('input', () => {
    loginFeedback.textContent = '';
    loginFeedback.classList.remove('is-ok');
  }));

  menuToggleBtn.addEventListener('click', () => {
    if (sidebarEl.classList.contains('is-open')) closeMobileSidebar();
    else openMobileSidebar();
  });
  sidebarOverlay.addEventListener('click', closeMobileSidebar);

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchScreen(btn.getAttribute('data-nav-screen')));
  });

  [backSiteLink, openConsultaLink, emptyConsultaLink].forEach((lnk) => {
    if (lnk) lnk.addEventListener('click', syncSiteSessionBeforeNavigate);
  });

  logoutBtn.addEventListener('click', () => handleLogout(false));

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    try {
      await loadAllData(true);
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar.');
    } finally {
      refreshBtn.disabled = false;
    }
  });

  async function runDemoSeed(triggerBtn) {
    const prev = triggerBtn.textContent;
    triggerBtn.disabled = true;
    triggerBtn.textContent = 'Carregando...';
    try {
      const res = await apiRequest('/api/bookings/seed', { method: 'POST', body: '{}' });
      if (Array.isArray(res.bookings)) bookings = res.bookings;
      if (res.workspace) workspace = res.workspace;
      renderEverything();
      showToast('Dados demonstrativos (CRM, Agenda, Prontuários e Caixa) carregados!');
    } catch (err) {
      showToast(err.message || 'Não foi possível carregar exemplos.');
    } finally {
      triggerBtn.disabled = false;
      triggerBtn.textContent = prev;
    }
  }

  if (seedBtn) seedBtn.addEventListener('click', () => runDemoSeed(seedBtn));
  if (seedTopBtn) seedTopBtn.addEventListener('click', () => runDemoSeed(seedTopBtn));

  // CSV Exports
  exportCrmCsvBtn.addEventListener('click', () => {
    if (!bookings.length) {
      showToast('Não há agendamentos para exportar.');
      return;
    }
    const headers = ['Nome', 'WhatsApp', 'E-mail', 'Protocolo', 'Áreas', 'Especialista', 'Sala', 'Data', 'Período', 'Etapa', 'Valor Estimado'];
    const rows = bookings.map((b) => [
      b.nome, b.telefone, b.email, b.protocolo || '', (b.areas || []).join(', '),
      b.profissional || '', b.sala || '', formatDateBR(b.data), b.periodo || '',
      (STATUS_META[b.status] || {}).label || b.status, b.valorEstimado || 0,
    ]);
    downloadCsv(`crm-clinica-${todayIso}.csv`, headers, rows);
    showToast('Planilha CRM exportada em CSV.');
  });

  finExportCsvBtn.addEventListener('click', () => {
    const txs = workspace.transactions || [];
    if (!txs.length) {
      showToast('Não há lançamentos financeiros para exportar.');
      return;
    }
    const headers = ['Data', 'Tipo', 'Descrição', 'Paciente/Fornecedor', 'Categoria', 'Forma', 'Situação', 'Valor'];
    const rows = txs.map((t) => [
      formatDateBR(t.data), t.tipo, t.descricao, t.paciente || '', t.categoria || '',
      t.formaPagamento || '', t.status, t.tipo === 'despesa' ? -t.valor : t.valor,
    ]);
    downloadCsv(`financeiro-clinica-${todayIso}.csv`, headers, rows);
    showToast('Extrato financeiro exportado em CSV.');
  });

  // CRM filters & view switch
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderCRM();
  });

  viewBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentView = btn.getAttribute('data-view') || 'list';
      if (currentView === 'pipeline' && activeStatusFilter !== 'all') {
        activeStatusFilter = 'all';
        filterBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-status') === 'all'));
      }
      viewBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      renderCRM();
    });
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeStatusFilter = btn.getAttribute('data-status') || 'all';
      if (activeStatusFilter === 'cancelado' && currentView === 'pipeline') {
        currentView = 'list';
        viewBtns.forEach((b) => {
          const active = b.getAttribute('data-view') === 'list';
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      }
      filterBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      renderCRM();
    });
  });

  clearFiltersBtn.addEventListener('click', () => {
    searchQuery = '';
    searchInput.value = '';
    activeStatusFilter = 'all';
    filterBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-status') === 'all'));
    renderCRM();
  });

  tableBodyEl.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-quick-status]');
    if (!sel) return;
    try {
      await updateBooking(sel.getAttribute('data-quick-status'), { status: sel.value });
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar etapa.');
      renderEverything();
    }
  });

  tableBodyEl.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-btn]');
    if (openBtn) {
      openDrawer(openBtn.getAttribute('data-open-btn'));
      return;
    }
    if (e.target.closest('[data-stop-row]')) return;
    const row = e.target.closest('tr[data-open-id]');
    if (row) openDrawer(row.getAttribute('data-open-id'));
  });

  pipelineViewEl.addEventListener('click', async (e) => {
    const advBtn = e.target.closest('[data-advance-id]');
    if (advBtn) {
      e.stopPropagation();
      try {
        await updateBooking(advBtn.getAttribute('data-advance-id'), { status: advBtn.getAttribute('data-advance-to') });
      } catch (err) {
        showToast(err.message || 'Erro ao mover cartão.');
      }
      return;
    }
    if (e.target.closest('[data-stop-row]')) return;
    const card = e.target.closest('[data-open-id]');
    if (card) openDrawer(card.getAttribute('data-open-id'));
  });

  // Agenda interactions
  agendaPrevBtn.addEventListener('click', () => {
    calMonth -= 1;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    renderAgenda();
  });
  agendaNextBtn.addEventListener('click', () => {
    calMonth += 1;
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
    renderAgenda();
  });
  agendaTodayBtn.addEventListener('click', () => {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    selectedDateIso = todayIso;
    renderAgenda();
  });
  agendaProFilterEl.addEventListener('change', () => {
    agendaProFilter = agendaProFilterEl.value;
    renderAgenda();
  });
  agendaNewOnDayBtn.addEventListener('click', () => openNewBookingModal(selectedDateIso));

  agendaCalGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cal-date]');
    if (!btn) return;
    selectedDateIso = btn.getAttribute('data-cal-date');
    const [y, m] = selectedDateIso.split('-').map(Number);
    calYear = y;
    calMonth = m - 1;
    renderAgenda();
  });

  [agendaDaySlots, agendaUpcomingList].forEach((container) => {
    container.addEventListener('click', (e) => {
      if (e.target.closest('[data-stop-row]')) return;
      const el = e.target.closest('[data-open-id]');
      if (el) openDrawer(el.getAttribute('data-open-id'));
    });
  });

  // CRM Drawer listeners
  drawerCloseBtn.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', (e) => { if (e.target === drawerBackdrop) closeDrawer(); });

  editProtocolo.addEventListener('change', () => {
    const opt = editProtocolo.options[editProtocolo.selectedIndex];
    const price = opt ? Number(opt.getAttribute('data-price')) : 0;
    if (price > 0 && !editValor.value) editValor.value = String(price);
  });

  editPro.addEventListener('change', () => {
    const opt = editPro.options[editPro.selectedIndex];
    const sala = opt ? opt.getAttribute('data-sala') : '';
    if (sala) editSala.value = sala;
  });

  dOpenProntuarioBtn.addEventListener('click', () => {
    const booking = bookings.find((b) => b.id === activeBookingId);
    if (!booking) return;
    const merged = getMergedPatients();
    const key = normalizePhoneDigits(booking.telefone) || booking.nome.toLowerCase();
    const found = merged.find((p) => (normalizePhoneDigits(p.telefone) || p.nome.toLowerCase()) === key) || {
      nome: booking.nome, telefone: booking.telefone, email: booking.email,
    };
    closeDrawer();
    openPatientDrawer(found);
  });

  dLaunchFinanceBtn.addEventListener('click', () => {
    const booking = bookings.find((b) => b.id === activeBookingId);
    if (!booking) return;
    closeDrawer();
    openFinanceModal({
      tipo: 'receita',
      descricao: booking.protocolo || (booking.areas || []).join(', ') || 'Avaliação Estética',
      paciente: booking.nome,
      categoria: (booking.areas || [])[0] || 'Procedimento',
      valor: booking.valorEstimado || '',
      status: booking.status === 'concluido' ? 'pago' : 'pendente',
    });
  });

  waTplBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const booking = bookings.find((b) => b.id === activeBookingId);
      if (!booking) return;
      activeWaTemplate = btn.getAttribute('data-wa-tpl') || 'confirmar';
      waTplBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      const msg = buildWhatsAppMessage(booking, activeWaTemplate);
      waMessageInput.value = msg;
      waSendLink.href = buildClientWhatsAppUrl(booking, msg);
    });
  });

  waMessageInput.addEventListener('input', () => {
    const booking = bookings.find((b) => b.id === activeBookingId);
    if (booking) waSendLink.href = buildClientWhatsAppUrl(booking, waMessageInput.value);
  });

  waCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(waMessageInput.value);
      showToast('Mensagem copiada.');
    } catch {
      waMessageInput.select();
      document.execCommand('copy');
      showToast('Mensagem copiada.');
    }
  });

  drawerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeBookingId) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';
    try {
      await updateBooking(activeBookingId, {
        status: editStatus.value,
        valorEstimado: editValor.value === '' ? 0 : Number(editValor.value),
        protocolo: editProtocolo.value,
        profissional: editPro.value,
        sala: editSala.value.trim(),
        data: editData.value,
        periodo: editPeriodo.value,
        notasInternas: editNotas.value.trim(),
      });
    } catch (err) {
      showToast(err.message || 'Não foi possível salvar.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar alterações';
    }
  });

  deleteBtn.addEventListener('click', () => { deleteBtn.hidden = true; deleteConfirm.hidden = false; });
  deleteNoBtn.addEventListener('click', () => { deleteConfirm.hidden = true; deleteBtn.hidden = false; });
  deleteYesBtn.addEventListener('click', async () => {
    if (!activeBookingId) return;
    deleteYesBtn.disabled = true;
    try {
      try {
        await apiRequest(`/api/bookings/${encodeURIComponent(activeBookingId)}`, { method: 'DELETE' });
      } catch (err) {
        if (err.status !== 404) throw err;
      }
      bookings = bookings.filter((b) => b.id !== activeBookingId);
      closeDrawer();
      renderEverything();
      showToast('Agendamento removido.');
    } catch (err) {
      showToast(err.message || 'Erro ao excluir.');
    } finally {
      deleteYesBtn.disabled = false;
    }
  });

  // Patients Screen & Prontuário Drawer listeners
  patNewBtn.addEventListener('click', () => openPatientDrawer(null));
  patSearchInput.addEventListener('input', () => {
    patSearchQuery = patSearchInput.value;
    renderPatients();
  });
  patFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      patFilter = btn.getAttribute('data-pat-filter') || 'all';
      patFilterBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      renderPatients();
    });
  });

  patGridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-patient]');
    if (!btn) return;
    const pid = btn.getAttribute('data-pat-id');
    const pname = btn.getAttribute('data-pat-name');
    const merged = getMergedPatients();
    const target = merged.find((p) => (pid && p.id === pid) || (!pid && p.nome === pname));
    if (target) openPatientDrawer(target);
  });

  patDrawerClose.addEventListener('click', closePatientDrawer);
  patDrawerBackdrop.addEventListener('click', (e) => { if (e.target === patDrawerBackdrop) closePatientDrawer(); });
  patFTel.addEventListener('input', function () { this.value = formatPhoneBR(this.value); });

  patAnamnesisForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nome: patFNome.value.trim(),
      telefone: patFTel.value.trim(),
      email: patFEmail.value.trim(),
      nascimento: patFNasc.value,
      proximoRetorno: patFRetorno.value,
      tipoPele: patFPele.value,
      fototipo: patFFototipo.value,
      gestante: patFGestante.value,
      alergias: patFAlergias.value.trim(),
      medicamentos: patFMeds.value.trim(),
    };
    if (payload.nome.length < 2) {
      showToast('Informe o nome completo da paciente.');
      return;
    }
    patSaveBtn.disabled = true;
    try {
      let savedPatient;
      if (activePatientId) {
        const res = await apiRequest(`/api/workspace/patients/${encodeURIComponent(activePatientId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        savedPatient = res.patient;
        const idx = workspace.patients.findIndex((p) => p.id === activePatientId);
        if (idx !== -1) workspace.patients[idx] = savedPatient;
      } else {
        const res = await apiRequest('/api/workspace/patients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        savedPatient = res.patient;
        workspace.patients.unshift(savedPatient);
        activePatientId = savedPatient.id;
        patDeleteBtn.hidden = false;
        patEvoSection.hidden = false;
      }
      patDrawerTitle.textContent = savedPatient.nome;
      renderEverything();
      showToast('Prontuário salvo com segurança.');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar prontuário.');
    } finally {
      patSaveBtn.disabled = false;
    }
  });

  patEvoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activePatientId) return;
    if (!evoProtocolo.value.trim() && !evoNotas.value.trim()) {
      showToast('Informe o procedimento ou registro da sessão.');
      return;
    }
    try {
      const res = await apiRequest(`/api/workspace/patients/${encodeURIComponent(activePatientId)}/evolutions`, {
        method: 'POST',
        body: JSON.stringify({
          data: evoData.value || todayIso,
          protocolo: evoProtocolo.value.trim(),
          profissional: evoPro.value,
          notas: evoNotas.value.trim(),
        }),
      });
      const idx = workspace.patients.findIndex((p) => p.id === activePatientId);
      if (idx !== -1 && res.patient) workspace.patients[idx] = res.patient;
      evoProtocolo.value = '';
      evoNotas.value = '';
      renderPatientEvolutions(res.patient);
      renderEverything();
      showToast('Sessão registrada no histórico clínico.');
    } catch (err) {
      showToast(err.message || 'Erro ao registrar evolução.');
    }
  });

  patDeleteBtn.addEventListener('click', async () => {
    if (!activePatientId) return;
    try {
      await apiRequest(`/api/workspace/patients/${encodeURIComponent(activePatientId)}`, { method: 'DELETE' });
      workspace.patients = workspace.patients.filter((p) => p.id !== activePatientId);
      closePatientDrawer();
      renderEverything();
      showToast('Ficha clínica removida.');
    } catch (err) {
      showToast(err.message || 'Erro ao excluir ficha.');
    }
  });

  // Services Screen & Modal listeners
  srvNewBtn.addEventListener('click', () => openServiceModal(null));
  srvCatBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      srvCatFilter = btn.getAttribute('data-srv-cat') || 'all';
      srvCatBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      renderServices();
    });
  });

  srvGridEl.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-srv-edit]');
    if (editBtn) {
      const item = workspace.services.find((s) => s.id === editBtn.getAttribute('data-srv-edit'));
      if (item) openServiceModal(item);
      return;
    }
    const togBtn = e.target.closest('[data-srv-toggle]');
    if (togBtn) {
      const id = togBtn.getAttribute('data-srv-toggle');
      const item = workspace.services.find((s) => s.id === id);
      if (!item) return;
      try {
        const res = await apiRequest(`/api/workspace/services/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ ativo: item.ativo === false }),
        });
        Object.assign(item, res.service);
        renderEverything();
        showToast(item.ativo ? 'Protocolo ativado.' : 'Protocolo pausado.');
      } catch (err) {
        showToast(err.message || 'Erro ao atualizar protocolo.');
      }
      return;
    }
    const delBtn = e.target.closest('[data-srv-del]');
    if (delBtn) {
      const id = delBtn.getAttribute('data-srv-del');
      try {
        await apiRequest(`/api/workspace/services/${encodeURIComponent(id)}`, { method: 'DELETE' });
        workspace.services = workspace.services.filter((s) => s.id !== id);
        renderEverything();
        showToast('Protocolo removido do catálogo.');
      } catch (err) {
        showToast(err.message || 'Erro ao excluir protocolo.');
      }
    }
  });

  srvModalClose.addEventListener('click', closeAllModals);
  srvCancel.addEventListener('click', closeAllModals);
  srvModal.addEventListener('click', (e) => { if (e.target === srvModal) closeAllModals(); });

  srvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = srvNome.value.trim();
    if (nome.length < 2) {
      srvError.textContent = 'Informe o nome do protocolo.';
      return;
    }
    srvError.textContent = '';
    srvSubmit.disabled = true;
    const payload = {
      nome,
      categoria: srvCat.value,
      preco: Number(srvPreco.value) || 0,
      duracaoMin: Number(srvDuracao.value) || 60,
      retornoDias: Number(srvRetorno.value) || 0,
      descricao: srvDesc.value.trim(),
    };
    try {
      const id = srvId.value;
      if (id) {
        const res = await apiRequest(`/api/workspace/services/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const idx = workspace.services.findIndex((s) => s.id === id);
        if (idx !== -1) workspace.services[idx] = res.service;
      } else {
        const res = await apiRequest('/api/workspace/services', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        workspace.services.unshift(res.service);
      }
      closeAllModals();
      renderEverything();
      showToast('Protocolo salvo no catálogo.');
    } catch (err) {
      srvError.textContent = err.message || 'Erro ao salvar protocolo.';
    } finally {
      srvSubmit.disabled = false;
    }
  });

  // Finance Screen & Modal listeners
  finNewBtn.addEventListener('click', () => openFinanceModal(null));
  finFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      finFilter = btn.getAttribute('data-fin-filter') || 'all';
      finFilterBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      renderFinance();
    });
  });

  finTableBody.addEventListener('click', async (e) => {
    const tog = e.target.closest('[data-tx-toggle]');
    if (tog) {
      const id = tog.getAttribute('data-tx-toggle');
      const tx = workspace.transactions.find((t) => t.id === id);
      if (!tx) return;
      const nextStatus = tx.status === 'pago' ? 'pendente' : 'pago';
      try {
        const res = await apiRequest(`/api/workspace/transactions/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
        Object.assign(tx, res.transaction);
        renderFinance();
        showToast(nextStatus === 'pago' ? 'Lançamento marcado como pago.' : 'Lançamento marcado como pendente.');
      } catch (err) {
        showToast(err.message || 'Erro ao atualizar lançamento.');
      }
      return;
    }
    const del = e.target.closest('[data-tx-del]');
    if (del) {
      const id = del.getAttribute('data-tx-del');
      try {
        await apiRequest(`/api/workspace/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
        workspace.transactions = workspace.transactions.filter((t) => t.id !== id);
        renderFinance();
        showToast('Lançamento excluído.');
      } catch (err) {
        showToast(err.message || 'Erro ao excluir lançamento.');
      }
    }
  });

  finModalClose.addEventListener('click', closeAllModals);
  finCancel.addEventListener('click', closeAllModals);
  finModal.addEventListener('click', (e) => { if (e.target === finModal) closeAllModals(); });

  finForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const descricao = finDesc.value.trim();
    const valor = Number(finValor.value);
    if (descricao.length < 2 || !valor || valor <= 0) {
      finError.textContent = 'Informe a descrição e um valor maior que zero.';
      return;
    }
    finError.textContent = '';
    finSubmit.disabled = true;
    try {
      const res = await apiRequest('/api/workspace/transactions', {
        method: 'POST',
        body: JSON.stringify({
          tipo: finTipo.value,
          descricao,
          valor,
          data: finData.value || todayIso,
          paciente: finPaciente.value.trim(),
          categoria: finCat.value.trim() || 'Procedimento',
          formaPagamento: finMetodo.value,
          status: finStatus.value,
        }),
      });
      workspace.transactions.unshift(res.transaction);
      closeAllModals();
      renderFinance();
      showToast('Lançamento registrado no caixa.');
    } catch (err) {
      finError.textContent = err.message || 'Erro ao registrar lançamento.';
    } finally {
      finSubmit.disabled = false;
    }
  });

  // Settings & Team listeners
  setWhatsapp.addEventListener('input', function () { this.value = formatPhoneBR(this.value); });
  setClinicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setSaveBtn.disabled = true;
    try {
      const res = await apiRequest('/api/workspace/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          clinicName: setClinicName.value.trim(),
          whatsapp: setWhatsapp.value.trim(),
          instagram: setInstagram.value.trim(),
          address: setAddress.value.trim(),
          hours: setHours.value.trim(),
          waGreeting: setWaGreeting.value.trim(),
        }),
      });
      workspace.settings = res.settings;
      renderEverything();
      showToast('Identidade da clínica atualizada!');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSaveBtn.disabled = false;
    }
  });

  setTeamForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = teamNome.value.trim();
    if (nome.length < 2) {
      showToast('Informe o nome da especialista.');
      return;
    }
    try {
      const res = await apiRequest('/api/workspace/team', {
        method: 'POST',
        body: JSON.stringify({
          nome,
          sala: teamSala.value.trim() || 'Sala 401',
          especialidade: teamEsp.value.trim() || 'Estética Avançada',
          dias: teamDias.value.trim() || 'Seg a Sex',
        }),
      });
      workspace.team.push(res.member);
      setTeamForm.reset();
      renderEverything();
      showToast('Especialista adicionada à equipe.');
    } catch (err) {
      showToast(err.message || 'Erro ao adicionar especialista.');
    }
  });

  setTeamList.addEventListener('click', async (e) => {
    const tog = e.target.closest('[data-team-toggle]');
    if (tog) {
      const id = tog.getAttribute('data-team-toggle');
      const member = workspace.team.find((m) => m.id === id);
      if (!member) return;
      try {
        const res = await apiRequest(`/api/workspace/team/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ ativo: member.ativo === false }),
        });
        Object.assign(member, res.member);
        renderEverything();
      } catch (err) {
        showToast(err.message || 'Erro ao atualizar especialista.');
      }
      return;
    }
    const del = e.target.closest('[data-team-del]');
    if (del) {
      const id = del.getAttribute('data-team-del');
      try {
        await apiRequest(`/api/workspace/team/${encodeURIComponent(id)}`, { method: 'DELETE' });
        workspace.team = workspace.team.filter((m) => m.id !== id);
        renderEverything();
        showToast('Especialista removida.');
      } catch (err) {
        showToast(err.message || 'Erro ao remover.');
      }
    }
  });

  // New Booking Modal listeners
  newBookingBtn.addEventListener('click', () => openNewBookingModal(''));
  newCloseBtn.addEventListener('click', closeAllModals);
  newCancelBtn.addEventListener('click', closeAllModals);
  newModal.addEventListener('click', (e) => { if (e.target === newModal) closeAllModals(); });
  newTelefone.addEventListener('input', function () { this.value = formatPhoneBR(this.value); });

  newProtocolo.addEventListener('change', () => {
    const opt = newProtocolo.options[newProtocolo.selectedIndex];
    const price = opt ? Number(opt.getAttribute('data-price')) : 0;
    if (price > 0) newValor.value = String(price);
  });

  newAreaChips.forEach((chip) => {
    chip.addEventListener('click', () => chip.classList.toggle('is-selected'));
  });

  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = newNome.value.trim();
    const telefone = newTelefone.value.trim();
    const areas = newAreaChips.filter((c) => c.classList.contains('is-selected')).map((c) => c.getAttribute('data-area'));

    if (nome.length < 2) {
      newError.textContent = 'Informe o nome completo do cliente.';
      newNome.focus();
      return;
    }
    if (telefone.replace(/\D/g, '').length < 10) {
      newError.textContent = 'Informe um WhatsApp/telefone válido com DDD.';
      newTelefone.focus();
      return;
    }

    const proOpt = newPro.options[newPro.selectedIndex];
    const sala = proOpt ? proOpt.getAttribute('data-sala') || '' : '';

    newError.textContent = '';
    newSubmitBtn.disabled = true;
    newSubmitBtn.textContent = 'Salvando...';

    try {
      const res = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          nome,
          telefone,
          email: newEmail.value.trim(),
          protocolo: newProtocolo.value,
          profissional: newPro.value,
          sala,
          valorEstimado: newValor.value ? Number(newValor.value) : 0,
          areas: areas.length ? areas : ['Avaliação Estética'],
          data: newData.value,
          periodo: newPeriodo.value,
          status: newStatus.value,
          objetivo: newObjetivo.value,
          notasInternas: newNotas.value.trim(),
          origem: 'Cadastro Manual',
        }),
      });
      if (res.booking) bookings.unshift(res.booking);
      closeAllModals();
      renderEverything();
      showToast('Agendamento salvo no CRM.');
    } catch (err) {
      newError.textContent = err.message || 'Erro ao salvar agendamento.';
    } finally {
      newSubmitBtn.disabled = false;
      newSubmitBtn.textContent = 'Salvar no CRM';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
      closeDrawer();
      closePatientDrawer();
      closeMobileSidebar();
    }
  });

  setTimeout(() => {
    if (!gateEl.hidden && emailInput) emailInput.focus();
  }, 60);
})();
