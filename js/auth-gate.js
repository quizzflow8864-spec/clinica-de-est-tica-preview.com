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

  function setSession(email, token) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email, token: token || '', loggedAt: Date.now() }));
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

  // Fallback localStorage auth (only if API is unreachable, e.g. opened from file://)
  function localAuth(mode, email, password) {
    let users = [];
    try {
      users = JSON.parse(localStorage.getItem(FALLBACK_USERS_KEY) || '[]');
      if (!Array.isArray(users)) users = [];
    } catch {
      users = [];
    }
    const norm = email.trim().toLowerCase();
    const existing = users.find((u) => u.email === norm);
    if (mode === 'register') {
      if (existing) return { ok: false, error: 'Este Gmail já está cadastrado. Use a aba Entrar.' };
      users.push({ email: norm, password, createdAt: new Date().toISOString() });
      localStorage.setItem(FALLBACK_USERS_KEY, JSON.stringify(users));
      return { ok: true, user: { email: norm } };
    }
    if (!existing || existing.password !== password) {
      return { ok: false, error: 'Gmail ou senha incorretos.' };
    }
    return { ok: true, user: { email: norm } };
  }

  async function submitAuth(mode, email, password) {
    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { ok: false, error: data.error || 'Não foi possível concluir o acesso.' };
      }
      return data;
    } catch {
      return localAuth(mode, email, password);
    }
  }

  function buildGateMarkup() {
    const logoSrc = assetPrefix + 'images/logo_salvato_mono.svg';
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
              <img src="${logoSrc}" alt="Clínica de Estética" class="wl-brand-logo">
              <div class="wl-eyebrow">PREVIEW WHITE-LABEL</div>
              <h1 class="wl-headline">Explore a experiência completa da clínica.</h1>
              <p class="wl-lead">Crie sua conta ou faça login para navegar pelas páginas, animações e fluxo de agendamento deste modelo pronto para receber a sua marca.</p>
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
    const bar = document.getElementById('wl-preview-bar');
    const barUser = document.getElementById('wl-bar-user');
    const logoutBtn = document.getElementById('wl-logout-btn');

    const tabs = Array.from(gate.querySelectorAll('[data-wl-mode]'));
    const form = document.getElementById('wl-auth-form');
    const formTitle = document.getElementById('wl-form-title');
    const formSub = document.getElementById('wl-form-sub');
    const emailInput = document.getElementById('wl-email');
    const passInput = document.getElementById('wl-password');
    const togglePassBtn = document.getElementById('wl-toggle-pass');
    const feedback = document.getElementById('wl-feedback');
    const submitBtn = document.getElementById('wl-submit-btn');
    const switchText = document.getElementById('wl-switch-text');
    const switchAction = document.getElementById('wl-switch-action');

    let mode = 'login';

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
        formTitle.textContent = 'Crie sua conta';
        formSub.textContent = 'Escolha um Gmail e uma senha para iniciar sua exploração do modelo.';
        passInput.placeholder = 'Escolha uma senha (mín. 6 caracteres)';
        passInput.setAttribute('autocomplete', 'new-password');
        submitBtn.textContent = 'Criar conta e explorar';
        switchText.textContent = 'Já possui uma conta?';
        switchAction.textContent = 'Entrar agora';
      } else {
        formTitle.textContent = 'Acesse o preview';
        formSub.textContent = 'Entre com o seu Gmail e a senha escolhida para continuar a exploração.';
        passInput.placeholder = 'Digite sua senha';
        passInput.setAttribute('autocomplete', 'current-password');
        submitBtn.textContent = 'Entrar no preview';
        switchText.textContent = 'Ainda não tem acesso?';
        switchAction.textContent = 'Criar conta';
      }
      emailInput.focus();
    }

    function showGate(animate) {
      document.documentElement.classList.add('wl-locked');
      gate.classList.add('is-visible');
      bar.classList.remove('is-visible');
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
          emailInput.focus();
        }
      }, 60);
    }

    function unlockSite(email, animate) {
      barUser.textContent = email;
      barUser.title = email;

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

    [emailInput, passInput].forEach((inp) => {
      inp.addEventListener('input', () => {
        feedback.textContent = '';
        feedback.classList.remove('is-ok');
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      const password = passInput.value;

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
      submitBtn.textContent = mode === 'register' ? 'Criando conta...' : 'Verificando...';

      const res = await submitAuth(mode, email, password);

      submitBtn.disabled = false;
      submitBtn.textContent = originalText;

      if (!res.ok) {
        feedback.classList.remove('is-ok');
        feedback.textContent = res.error || 'Não foi possível autenticar.';
        return;
      }

      const signedEmail = (res.user && res.user.email) || email;
      setSession(signedEmail, res.token || '');
      markInternalNavigation();
      feedback.classList.add('is-ok');
      feedback.textContent = mode === 'register' ? 'Conta criada! Abrindo o preview...' : 'Acesso liberado!';

      setTimeout(() => {
        form.reset();
        unlockSite(signedEmail, true);
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
      unlockSite(sess.email, false);
    } else {
      clearSession();
      showGate(false);
    }

    // Handle bfcache (browser Back/Forward restoring cached page)
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      const sess = getSession();
      if (sess) {
        unlockSite(sess.email, false);
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
