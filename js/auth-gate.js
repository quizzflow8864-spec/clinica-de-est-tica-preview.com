(function () {
  'use strict';

  const SESSION_KEY = 'wl_preview_session';
  const INTERNAL_NAV_KEY = 'wl_internal_nav';
  const FALLBACK_USERS_KEY = 'wl_preview_users_v1';

  const isConsultaPage = decodeURIComponent(window.location.pathname).toLowerCase().includes('página de consulta');
  const assetPrefix = isConsultaPage ? '../' : '';
  const homeUrl = isConsultaPage ? '../index.html' : './index.html';
  const consultaUrl = isConsultaPage ? './index.html' : './p%C3%A1gina%20de%20consulta/index.html';
  const adminUrl = isConsultaPage ? '../admin.html' : './admin.html';

  const DOUBLE_DROP_SVG = `<svg class="wl-brand-icon" viewBox="0 0 54 52" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M46.46,6.71v2h3.5v20.55c0,11.33-9.22,20.56-20.56,20.56s-20.55-9.22-20.55-20.55S18.08,8.71,29.41,8.71h12.34v-2h-12.34c-12.44,0-22.55,10.12-22.55,22.56s10.12,22.55,22.55,22.55,22.56-10.12,22.56-22.56V6.71h-5.5Z"/>
    <path d="M6.34,35.14c-2.71-3.48-4.34-7.84-4.34-12.59C2,11.22,11.22,2,22.56,2h20.55v20.55c0,11.33-9.22,20.56-20.56,20.56-2.88,0-5.62-.6-8.12-1.68.96,1.17,2.05,2.22,3.26,3.14,1.57.35,3.19.53,4.86.53,12.44,0,22.56-10.12,22.56-22.56V0h-22.55C10.12,0,0,10.12,0,22.56c0,6.94,3.15,13.15,8.09,17.29-.74-1.49-1.33-3.06-1.75-4.7Z"/>
  </svg>`;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatClinicDisplayName(raw) {
    const clean = String(raw || '').trim();
    if (!clean) return 'Clínica';
    if (/^cl[ií]nica(?:\s|$)/i.test(clean)) {
      return clean.replace(/^cl[ií]nica/i, 'Clínica');
    }
    return 'Clínica ' + clean;
  }

  function sizeClassForName(name) {
    const len = String(name || '').trim().length;
    if (len > 22) return 'is-long';
    if (len > 14) return 'is-medium';
    return '';
  }

  function buildBrandLockupHtml(name, variantClass) {
    const clean = formatClinicDisplayName(name);
    const sizeCls = sizeClassForName(clean);
    return `<span class="wl-brand-lockup ${variantClass || ''} ${sizeCls}" data-wl-brand-lockup>${DOUBLE_DROP_SVG}<span class="wl-brand-wordmark">${escapeHtml(clean)}</span></span>`;
  }

  function getStoredBusinessNameForEmail(email) {
    if (!email) return '';
    const norm = email.trim().toLowerCase();
    // Prefer latest clinicName if edited inside Admin White-Label settings
    try {
      const ws = JSON.parse(localStorage.getItem('wl_crm_workspace:' + norm) || 'null');
      if (ws && ws.settings && ws.settings.clinicName && ws.settings.clinicName !== 'Clínica de Estética') {
        return ws.settings.clinicName;
      }
    } catch {}
    const found = readLocalUsers().find((u) => u.email === norm);
    return (found && found.businessName) || '';
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.email ? parsed : null;
    } catch {
      return null;
    }
  }

  function setSession(email, token, businessName) {
    const resolvedName = String(businessName || '').trim() || getStoredBusinessNameForEmail(email) || 'Clínica';
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ email, businessName: resolvedName, token: token || '', loggedAt: Date.now() })
    );
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(INTERNAL_NAV_KEY);
  }

  function markInternalNavigation() {
    try {
      sessionStorage.setItem(INTERNAL_NAV_KEY, String(Date.now()));
    } catch {}
  }

  function getNavType() {
    try {
      const entry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (entry && entry.type) return entry.type;
    } catch {}
    if (performance.navigation && performance.navigation.type === 1) return 'reload';
    if (performance.navigation && performance.navigation.type === 2) return 'back_forward';
    return 'navigate';
  }

  function shouldStayUnlockedOnLoad() {
    const type = getNavType();
    if (type === 'reload') return false;
    if (!getSession()) return false;
    if (type === 'back_forward') return true;
    let sameOriginRef = false;
    try {
      sameOriginRef = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    } catch {}
    const recentClick = Date.now() - Number(sessionStorage.getItem(INTERNAL_NAV_KEY) || 0) < 15000;
    return sameOriginRef || recentClick;
  }

  // Client-side per-user account mirror (handles Vercel ephemeral /tmp cold starts seamlessly)
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

  function readLocalUsers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FALLBACK_USERS_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function saveLocalUser(email, password, businessName) {
    const norm = email.trim().toLowerCase();
    const passHash = await hashLocalPass(norm, password);
    const prev = readLocalUsers().find((u) => u.email === norm);
    const resolvedName = String(businessName || '').trim() || (prev && prev.businessName) || 'Clínica';
    const users = readLocalUsers().filter((u) => u.email !== norm);
    users.push({ email: norm, businessName: resolvedName, passHash, createdAt: (prev && prev.createdAt) || new Date().toISOString() });
    try {
      localStorage.setItem(FALLBACK_USERS_KEY, JSON.stringify(users));
    } catch {}
    return resolvedName;
  }

  async function verifyLocalUser(email, password) {
    const norm = email.trim().toLowerCase();
    const found = readLocalUsers().find((u) => u.email === norm);
    if (!found) return false;
    if (found.passHash) {
      return (await hashLocalPass(norm, password)) === found.passHash;
    }
    return found.password === password;
  }

  async function localAuth(mode, email, password, businessName) {
    const norm = email.trim().toLowerCase();
    const existing = readLocalUsers().find((u) => u.email === norm);
    if (mode === 'register') {
      if (existing) return { ok: false, error: 'Este Gmail já está cadastrado. Use a aba Entrar.' };
      const savedName = await saveLocalUser(norm, password, businessName);
      return { ok: true, user: { email: norm, businessName: savedName }, token: 'local:' + norm };
    }
    if (!existing || !(await verifyLocalUser(norm, password))) {
      return { ok: false, error: 'Gmail ou senha incorretos.' };
    }
    const resolved = getStoredBusinessNameForEmail(norm) || existing.businessName || 'Clínica';
    return { ok: true, user: { email: norm, businessName: resolved }, token: 'local:' + norm };
  }

  async function submitAuth(mode, email, password, businessName) {
    const norm = email.trim().toLowerCase();
    const cleanBiz = String(businessName || '').trim();
    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = mode === 'register' ? { email: norm, password, businessName: cleanBiz } : { email: norm, password };
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (resp.ok) {
        const returnedName = (data.user && data.user.businessName) || cleanBiz;
        const finalName = await saveLocalUser(norm, password, returnedName);
        if (data.user) data.user.businessName = getStoredBusinessNameForEmail(norm) || finalName;
        return data;
      }
      // If Vercel serverless cold-started ephemeral /tmp storage, re-hydrate verified account seamlessly
      if (mode === 'login' && resp.status === 401 && (await verifyLocalUser(norm, password))) {
        const storedBiz = getStoredBusinessNameForEmail(norm) || 'Clínica';
        const reReg = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: norm, password, businessName: storedBiz }),
        });
        const reData = await reReg.json().catch(() => ({}));
        if (reReg.ok && reData.token) return reData;
        return { ok: true, user: { email: norm, businessName: storedBiz }, token: 'local:' + norm };
      }
      return { ok: false, error: data.error || 'Não foi possível concluir o acesso.' };
    } catch {
      return localAuth(mode, norm, password, cleanBiz);
    }
  }

  // =========================================================
  // APPLY DYNAMIC WHITE-LABEL BUSINESS NAME ACROSS THE SITE
  // =========================================================
  function applySiteBranding(businessName) {
    const rawName = String(businessName || '').trim();
    const displayName = formatClinicDisplayName(rawName);
    const isCustom = Boolean(rawName) && displayName.toLowerCase() !== 'clínica' && displayName.toLowerCase() !== 'clínica de estética';

    // 1. Document title
    document.title = isConsultaPage
      ? `${displayName} | Estética Avançada e Agendamento`
      : `${displayName} — Estética Avançada e Bem-Estar`;

    // 2. Navbar logos (desktop + mobile)
    document.querySelectorAll('a.brand').forEach((brandLink) => {
      let existing = brandLink.querySelector('[data-wl-brand-lockup]');
      const img = brandLink.querySelector('img[src*="logo_salvato_mono"]');
      if (img) img.style.display = 'none';
      if (existing) existing.remove();
      const wrap = document.createElement('span');
      wrap.innerHTML = buildBrandLockupHtml(displayName, 'wl-brand-lockup--nav');
      brandLink.appendChild(wrap.firstElementChild);
    });

    // 3. Footer logo
    document.querySelectorAll('.footer_logo').forEach((fLogo) => {
      fLogo.classList.add('wl-has-custom-brand');
      fLogo.innerHTML = buildBrandLockupHtml(displayName, 'wl-brand-lockup--footer');
    });

    // 4. Booking modal logo (página de consulta)
    const modalAsideTop = document.querySelector('.ag-aside-top');
    if (modalAsideTop) {
      const modalImg = modalAsideTop.querySelector('.ag-brand-mark');
      if (modalImg) modalImg.style.display = 'none';
      const oldModalBrand = modalAsideTop.querySelector('[data-wl-brand-lockup]');
      if (oldModalBrand) oldModalBrand.remove();
      const wrap = document.createElement('div');
      wrap.innerHTML = buildBrandLockupHtml(displayName, 'wl-brand-lockup--modal');
      modalAsideTop.insertBefore(wrap.firstElementChild, modalAsideTop.firstChild);
    }

    // 5. Footer clinic title & copyright
    document.querySelectorAll('.footer_text_column.right a.footer_link strong').forEach((el) => {
      if (!el.dataset.wlOrigText) el.dataset.wlOrigText = el.textContent;
      if (el.dataset.wlOrigText.toLowerCase().includes('clínica')) {
        el.textContent = isCustom ? displayName : el.dataset.wlOrigText;
      }
    });

    document.querySelectorAll('.credito a.link').forEach((el) => {
      if (!el.dataset.wlOrigText) el.dataset.wlOrigText = el.textContent;
      el.textContent = isCustom ? displayName : el.dataset.wlOrigText;
    });

    // 6. Hero secondary intro paragraph on consultation page
    const heroParSec = document.getElementById('heroparsec');
    if (heroParSec) {
      if (!heroParSec.dataset.wlOrigText) heroParSec.dataset.wlOrigText = heroParSec.textContent;
      heroParSec.textContent = isCustom
        ? heroParSec.dataset.wlOrigText.replace('Na nossa Clínica de Estética,', `Na ${displayName},`)
        : heroParSec.dataset.wlOrigText;
    }
  }

  function buildGateMarkup() {
    const photoSrc = assetPrefix + 'images/woman-face-and-moisturizer-cream-for-skincare-bea-2025-04-05-18-06-03-utc.jpg';

    return `
      <div id="wl-auth-gate" class="wl-gate" role="dialog" aria-modal="true" aria-labelledby="wl-form-title" data-lenis-prevent>
        <div class="wl-card" data-lenis-prevent>
          <section class="wl-showcase">
            <svg class="wl-drop-accent" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2 110C2 50.3532 50.3532 2 110 2H206C212.627 2 218 7.37258 218 14V109.5C218 169.423 169.423 218 109.5 218V218C50.1294 218 2 169.871 2 110V110Z" stroke="url(#wl_accent_grad)" stroke-width="2"/>
              <defs>
                <linearGradient id="wl_accent_grad" x1="110" y1="2" x2="110" y2="218" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#FED653"/>
                  <stop offset="1" stop-color="#E0539E"/>
                </linearGradient>
              </defs>
            </svg>

            <div class="wl-showcase-top">
              <div id="wl-gate-brand-slot">${buildBrandLockupHtml('Clínica', 'wl-brand-lockup--gate')}</div>
              <div class="wl-eyebrow">PREVIEW WHITE-LABEL</div>
              <h1 class="wl-headline">Explore a experiência com o nome da sua marca.</h1>
              <p class="wl-lead">Crie sua conta, informe o nome do seu negócio e veja o site inteiro, o agendamento e o painel CRM personalizados instantaneamente para a sua clínica.</p>
            </div>

            <div class="wl-visual-frame">
              <img src="${photoSrc}" alt="Preview estético da clínica">
              <span class="wl-visual-caption">Ambiente demonstrativo</span>
            </div>
          </section>

          <section class="wl-auth">
            <div class="wl-tabs" role="tablist" aria-label="Modo de acesso">
              <button type="button" class="wl-tab is-active" role="tab" aria-selected="true" data-wl-mode="login">Entrar</button>
              <button type="button" class="wl-tab" role="tab" aria-selected="false" data-wl-mode="register">Criar conta</button>
            </div>

            <h2 id="wl-form-title" class="wl-form-title">Acesse o preview</h2>
            <p id="wl-form-sub" class="wl-form-sub">Entre com o seu Gmail e a senha escolhida para continuar a exploração.</p>

            <form id="wl-auth-form" class="wl-form" novalidate>
              <div id="wl-business-field" class="wl-field" hidden>
                <label for="wl-business" class="wl-label">Nome do seu negócio / clínica</label>
                <div class="wl-input-wrap">
                  <input id="wl-business" name="businessName" type="text" maxlength="40" class="wl-input" placeholder="Ex: Lumière Estética, Atelier Vita..." autocomplete="organization">
                </div>
              </div>

              <div class="wl-field">
                <label for="wl-email" class="wl-label">Gmail</label>
                <div class="wl-input-wrap">
                  <input id="wl-email" name="email" type="email" class="wl-input" placeholder="seunome@gmail.com" autocomplete="email" required>
                </div>
              </div>

              <div class="wl-field">
                <label for="wl-password" class="wl-label">Senha</label>
                <div class="wl-input-wrap">
                  <input id="wl-password" name="password" type="password" class="wl-input" placeholder="Digite sua senha" autocomplete="current-password" required>
                  <button type="button" class="wl-eye" id="wl-toggle-pass" aria-label="Mostrar ou ocultar senha">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div id="wl-feedback" class="wl-feedback" role="alert" aria-live="polite"></div>

              <div class="wl-submit-wrap">
                <div class="wl-submit-aura" aria-hidden="true"></div>
                <button type="submit" id="wl-submit-btn" class="wl-submit">Entrar no preview</button>
              </div>
            </form>

            <div class="wl-switch-hint">
              <span id="wl-switch-text">Ainda não tem acesso?</span>
              <button type="button" id="wl-switch-action" class="wl-switch-btn">Criar conta</button>
            </div>
          </section>
        </div>
      </div>

      <div id="wl-preview-bar" class="wl-bar" aria-label="Navegação do preview">
        <span class="wl-bar-dot" aria-hidden="true"></span>
        <span id="wl-bar-user" class="wl-bar-user"></span>
        <span class="wl-bar-sep" aria-hidden="true"></span>
        <nav class="wl-bar-nav">
          <a href="${homeUrl}" class="wl-bar-link ${isConsultaPage ? '' : 'is-current'}">Início</a>
          <a href="${consultaUrl}" class="wl-bar-link ${isConsultaPage ? 'is-current' : ''}">Consulta</a>
          <a href="${adminUrl}" class="wl-bar-link wl-bar-admin" title="Acessar Painel Admin e CRM">
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
            <span>Admin</span>
          </a>
        </nav>
        <button type="button" id="wl-logout-btn" class="wl-bar-logout">Sair</button>
      </div>
    `;
  }

  function initAuthGate() {
    // Track every internal same-origin link click so navigation between pages stays unlocked
    document.addEventListener(
      'click',
      (e) => {
        const link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!link) return;
        const href = link.getAttribute('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
          return;
        }
        try {
          const targetUrl = new URL(link.href, window.location.href);
          if (targetUrl.origin === window.location.origin) {
            markInternalNavigation();
          }
        } catch {}
      },
      true
    );

    // Mount UI once
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildGateMarkup();
    while (wrapper.firstElementChild) {
      document.body.appendChild(wrapper.firstElementChild);
    }

    const gate = document.getElementById('wl-auth-gate');
    const card = gate.querySelector('.wl-card');
    const gateBrandSlot = document.getElementById('wl-gate-brand-slot');
    const bar = document.getElementById('wl-preview-bar');
    const barUser = document.getElementById('wl-bar-user');
    const logoutBtn = document.getElementById('wl-logout-btn');

    const tabs = Array.from(gate.querySelectorAll('[data-wl-mode]'));
    const form = document.getElementById('wl-auth-form');
    const formTitle = document.getElementById('wl-form-title');
    const formSub = document.getElementById('wl-form-sub');
    const businessField = document.getElementById('wl-business-field');
    const businessInput = document.getElementById('wl-business');
    const emailInput = document.getElementById('wl-email');
    const passInput = document.getElementById('wl-password');
    const togglePassBtn = document.getElementById('wl-toggle-pass');
    const feedback = document.getElementById('wl-feedback');
    const submitBtn = document.getElementById('wl-submit-btn');
    const switchText = document.getElementById('wl-switch-text');
    const switchAction = document.getElementById('wl-switch-action');

    let mode = 'login';

    function updateGateBrandPreview(val) {
      if (!gateBrandSlot) return;
      gateBrandSlot.innerHTML = buildBrandLockupHtml(String(val || '').trim() || 'Clínica', 'wl-brand-lockup--gate');
    }

    function setMode(nextMode) {
      mode = nextMode;
      feedback.textContent = '';
      feedback.classList.remove('is-ok');

      tabs.forEach((t) => {
        const active = t.getAttribute('data-wl-mode') === mode;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      if (mode === 'register') {
        businessField.hidden = false;
        formTitle.textContent = 'Crie sua conta';
        formSub.textContent = 'Informe o nome do seu negócio, seu Gmail e uma senha para personalizar o preview.';
        passInput.placeholder = 'Escolha uma senha (mín. 6 caracteres)';
        passInput.setAttribute('autocomplete', 'new-password');
        submitBtn.textContent = 'Criar conta e explorar';
        switchText.textContent = 'Já possui uma conta?';
        switchAction.textContent = 'Entrar agora';
        updateGateBrandPreview(businessInput.value);
        businessInput.focus();
      } else {
        businessField.hidden = true;
        formTitle.textContent = 'Acesse o preview';
        formSub.textContent = 'Entre com o seu Gmail e a senha escolhida para continuar a exploração.';
        passInput.placeholder = 'Digite sua senha';
        passInput.setAttribute('autocomplete', 'current-password');
        submitBtn.textContent = 'Entrar no preview';
        switchText.textContent = 'Ainda não tem acesso?';
        switchAction.textContent = 'Criar conta';
        updateGateBrandPreview('Clínica');
        emailInput.focus();
      }
    }

    function showGate(animate) {
      document.documentElement.classList.add('wl-locked');
      gate.classList.add('is-visible');
      bar.classList.remove('is-visible');
      applySiteBranding('Clínica');
      updateGateBrandPreview(mode === 'register' ? businessInput.value : 'Clínica');
      if (animate && window.gsap) {
        window.gsap.killTweensOf([gate, card]);
        window.gsap.fromTo(gate, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
        window.gsap.fromTo(card, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.38, ease: 'power3.out' });
      } else {
        gate.style.opacity = '1';
        card.style.opacity = '1';
      }
      setTimeout(() => {
        if (document.documentElement.classList.contains('wl-locked')) {
          (mode === 'register' ? businessInput : emailInput).focus();
        }
      }, 60);
    }

    function unlockSite(email, businessName, animate) {
      const resolvedBiz = formatClinicDisplayName(String(businessName || '').trim() || getStoredBusinessNameForEmail(email));
      applySiteBranding(resolvedBiz);

      barUser.textContent = resolvedBiz !== 'Clínica' ? resolvedBiz : email;
      barUser.title = `${resolvedBiz} · ${email}`;

      const finishUnlock = () => {
        document.documentElement.classList.remove('wl-locked');
        gate.classList.remove('is-visible');
        bar.classList.add('is-visible');
        if (window.ScrollTrigger) {
          setTimeout(() => window.ScrollTrigger.refresh(), 80);
        }
      };

      if (animate && window.gsap) {
        window.gsap.killTweensOf([gate, card]);
        window.gsap.to(card, { y: -12, opacity: 0, duration: 0.25, ease: 'power2.in' });
        window.gsap.to(gate, {
          opacity: 0,
          duration: 0.32,
          ease: 'power2.inOut',
          onComplete: finishUnlock,
        });
      } else {
        finishUnlock();
      }
    }

    // Wire UI interactions
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => setMode(tab.getAttribute('data-wl-mode')));
    });

    switchAction.addEventListener('click', () => {
      setMode(mode === 'login' ? 'register' : 'login');
    });

    togglePassBtn.addEventListener('click', () => {
      const showing = passInput.type === 'text';
      passInput.type = showing ? 'password' : 'text';
      togglePassBtn.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
    });

    businessInput.addEventListener('input', () => {
      feedback.textContent = '';
      feedback.classList.remove('is-ok');
      updateGateBrandPreview(businessInput.value);
    });

    [emailInput, passInput].forEach((inp) => {
      inp.addEventListener('input', () => {
        feedback.textContent = '';
        feedback.classList.remove('is-ok');
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const businessName = businessInput.value.trim();
      const email = emailInput.value.trim().toLowerCase();
      const password = passInput.value;

      if (mode === 'register' && businessName.length < 2) {
        feedback.textContent = 'Informe o nome do seu negócio ou clínica (mín. 2 caracteres).';
        businessInput.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        feedback.textContent = 'Informe um endereço de Gmail válido (ex: seunome@gmail.com).';
        emailInput.focus();
        return;
      }
      if (password.length < 6) {
        feedback.textContent = 'A senha deve conter pelo menos 6 caracteres.';
        passInput.focus();
        return;
      }

      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = mode === 'register' ? 'Personalizando site...' : 'Verificando...';

      const res = await submitAuth(mode, email, password, businessName);

      submitBtn.disabled = false;
      submitBtn.textContent = originalText;

      if (!res.ok) {
        feedback.classList.remove('is-ok');
        feedback.textContent = res.error || 'Não foi possível autenticar.';
        return;
      }

      const signedEmail = (res.user && res.user.email) || email;
      const signedBiz = formatClinicDisplayName((res.user && res.user.businessName) || businessName || getStoredBusinessNameForEmail(signedEmail));
      setSession(signedEmail, res.token || '', signedBiz);
      markInternalNavigation();
      feedback.classList.add('is-ok');
      feedback.textContent = mode === 'register' ? `Bem-vindo(a)! Abrindo o site da ${signedBiz}...` : 'Acesso liberado!';

      setTimeout(() => {
        form.reset();
        unlockSite(signedEmail, signedBiz, true);
      }, 260);
    });

    logoutBtn.addEventListener('click', () => {
      clearSession();
      setMode('login');
      showGate(true);
    });

    // Initial page state check (use synchronous head decision when available)
    const initialUnlocked =
      typeof window.__wlInitialUnlocked === 'boolean'
        ? window.__wlInitialUnlocked && Boolean(getSession())
        : shouldStayUnlockedOnLoad();
    try {
      sessionStorage.removeItem(INTERNAL_NAV_KEY);
    } catch {}

    if (initialUnlocked) {
      const sess = getSession();
      unlockSite(sess.email, sess.businessName, false);
    } else {
      clearSession();
      showGate(false);
    }

    // Handle bfcache (browser Back/Forward restoring cached page)
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      const sess = getSession();
      if (sess) {
        unlockSite(sess.email, sess.businessName, false);
      } else {
        showGate(false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthGate);
  } else {
    initAuthGate();
  }
})();
