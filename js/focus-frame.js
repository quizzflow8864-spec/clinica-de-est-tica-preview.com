(function () {
  'use strict';

  // External quiz destination URL for "QUERO MEU PROJETO COMPLETO" CTAs
  const QUIZ_EXTERNAL_URL = 'https://quizz-clinica-de-est-ticacom.vercel.app/';
  const POPUP_DELAY_MS = 60000; // 1 minute (60 seconds)
  const WHATSAPP_NUMBER = '5511984894031';

  const CHAT_LOG_KEY = 'ff_feedback_chat_v1';
  const SESSION_KEY = 'wl_preview_session';

  function getPreviewSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function isPageLocked() {
    return (
      document.documentElement.classList.contains('wl-locked') ||
      document.body.classList.contains('adm-locked')
    );
  }

  function formatTimeNow() {
    const d = new Date();
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatPhoneBR(raw) {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits ? '(' + digits : '';
    if (digits.length <= 6) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
    if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
    return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildMarkup() {
    return `
      <!-- Eye-catching persistent CTA button -->
      <div id="ff-cta-dock" class="ff-cta-dock" data-lenis-prevent>
        <button type="button" id="ff-cta-float-btn" class="ff-cta-float-btn" aria-label="Quero meu projeto completo">
          <span class="ff-cta-pulse" aria-hidden="true"></span>
          <span>Quero meu projeto completo</span>
          <span class="ff-cta-arrow" aria-hidden="true">
            <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9h11M10 4.5L14.5 9L10 13.5"/></svg>
          </span>
        </button>
      </div>

      <!-- Floating Feedback Chat Launcher -->
      <button type="button" id="ff-chat-launcher" class="ff-chat-launcher" aria-expanded="false" aria-controls="ff-chat-window" data-lenis-prevent>
        <span class="ff-chat-launcher-dot" aria-hidden="true"></span>
        <span class="ff-chat-launcher-icon" aria-hidden="true">
          <svg viewBox="0 0 22 22" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h9A2.5 2.5 0 0 1 18 5.5v7A2.5 2.5 0 0 1 15.5 15H9l-4.5 3.5V15A2.5 2.5 0 0 1 4 12.5v-7Z"/>
            <path d="M8 8.5h6M8 11.5h4"/>
          </svg>
        </span>
        <span>Avaliar &amp; Melhorar</span>
      </button>

      <!-- Floating Feedback Chat Pop-up -->
      <section id="ff-chat-window" class="ff-chat-window" role="dialog" aria-label="Chat de avaliação e melhorias" aria-hidden="true" data-lenis-prevent>
        <div class="ff-chat-head">
          <div class="ff-chat-head-left">
            <div class="ff-chat-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="7"/>
                <path d="M12 5v3M12 16v3M5 12h3M16 12h3"/>
              </svg>
            </div>
            <div>
              <div class="ff-chat-title">Chat Focus Frame</div>
              <div class="ff-chat-status">Conte o que achou e o que quer melhorar</div>
            </div>
          </div>
          <button type="button" id="ff-chat-close" class="ff-chat-close" aria-label="Fechar chat">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>

        <div class="ff-chat-rating">
          <span>Nota da experiência:</span>
          <div id="ff-stars" class="ff-stars" role="group" aria-label="Avalie de 1 a 5 estrelas">
            <button type="button" class="ff-star-btn" data-star="1" aria-label="1 estrela">★</button>
            <button type="button" class="ff-star-btn" data-star="2" aria-label="2 estrelas">★</button>
            <button type="button" class="ff-star-btn" data-star="3" aria-label="3 estrelas">★</button>
            <button type="button" class="ff-star-btn" data-star="4" aria-label="4 estrelas">★</button>
            <button type="button" class="ff-star-btn" data-star="5" aria-label="5 estrelas">★</button>
          </div>
        </div>

        <div id="ff-chat-messages" class="ff-chat-messages" data-lenis-prevent></div>

        <div id="ff-chat-quick" class="ff-chat-quick">
          <button type="button" class="ff-chat-chip" data-quick-msg="Amei o visual e o painel CRM, mas gostaria de adaptar para as cores da minha marca.">Trocar cores e marca</button>
          <button type="button" class="ff-chat-chip" data-quick-msg="Quero melhorar o layout de algumas seções e deixar um design ainda mais exclusivo.">Melhorar seções</button>
          <button type="button" class="ff-chat-chip" data-quick-msg="Gostei muito da experiência! Quero adicionar novas funcionalidades no meu projeto.">Adicionar funções</button>
        </div>

        <form id="ff-chat-form" class="ff-chat-form">
          <input id="ff-chat-input" type="text" class="ff-chat-input" placeholder="O que achou e o que quer melhorar?" autocomplete="off" required>
          <button type="submit" class="ff-chat-send" aria-label="Enviar mensagem">
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9h11M10 4.5L14.5 9L10 13.5"/></svg>
          </button>
        </form>

        <div class="ff-chat-promo">
          <button type="button" id="ff-chat-open-project" class="ff-chat-promo-btn">Quero meu projeto completo →</button>
        </div>
      </section>

      <!-- Focus Frame Square Pop-up Modal (appears after 1 minute) -->
      <div id="ff-overlay" class="ff-overlay" role="dialog" aria-modal="true" aria-labelledby="ff-badge-label" aria-hidden="true" data-lenis-prevent>
        <div class="ff-card" data-lenis-prevent>
          <!-- 4 glowing emerald corner brackets -->
          <span class="ff-corner ff-corner--tl" aria-hidden="true"></span>
          <span class="ff-corner ff-corner--tr" aria-hidden="true"></span>
          <span class="ff-corner ff-corner--bl" aria-hidden="true"></span>
          <span class="ff-corner ff-corner--br" aria-hidden="true"></span>

          <!-- Close button -->
          <button type="button" id="ff-close" class="ff-close" aria-label="Fechar janela">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>

          <!-- VIEW 1: Exact Focus Frame Splash (matching reference image) -->
          <div id="ff-view-intro" class="ff-view">
            <div class="ff-target-circle" aria-hidden="true">
              <svg viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <circle cx="14" cy="14" r="9"/>
                <path d="M14 5v3.5M14 19.5V23M5 14h3.5M19.5 14H23"/>
              </svg>
            </div>

            <div id="ff-badge-label" class="ff-badge">Focus Frame</div>

            <p class="ff-copy">Gostou da experiência? Quer melhorias? Um design totalmente novo, personalizado e melhorado? Clique no botão abaixo, responda o quiz necessário que não dura nada e ganhe um presente no final por responder!</p>

            <div class="ff-cta-row">
              <button type="button" id="ff-sparkles-btn" class="ff-side-icon-btn" title="Sugerir melhorias no chat" aria-label="Abrir chat de melhorias">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/>
                  <path d="M19 16v3M17.5 17.5h3M5 5v2.5M3.75 6.25h2.5"/>
                </svg>
              </button>

              <button type="button" id="ff-start-quiz" class="ff-main-cta">
                <span class="ff-main-cta-text">
                  <span>QUERO MEU PROJETO</span>
                  <span>COMPLETO</span>
                </span>
                <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 10h12M11 5l5 5-5 5"/>
                </svg>
              </button>

              <button type="button" id="ff-gift-btn" class="ff-side-icon-btn" title="Sobre o presente exclusivo" aria-label="Ver detalhe do presente">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3.5" y="8.5" width="17" height="4" rx="1"/>
                  <path d="M12 8.5v12M5.5 12.5v7a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7"/>
                  <path d="M12 8.5H8.6a2.1 2.1 0 1 1 0-4.2C10.9 4.3 12 8.5 12 8.5Zm0 0h3.4a2.1 2.1 0 1 0 0-4.2C13.1 4.3 12 8.5 12 8.5Z"/>
                </svg>
              </button>
            </div>

            <div id="ff-gift-hint" class="ff-gift-hint">Responda o quiz rápido e desbloqueie seu presente exclusivo no final!</div>
          </div>

          <!-- VIEW 2: Fast Project Quiz -->
          <div id="ff-view-quiz" class="ff-view" hidden>
            <div class="ff-badge">Quiz Rápido · Focus Frame</div>
            <h3 class="ff-quiz-title">Personalize seu projeto completo</h3>
            <p class="ff-quiz-sub">Leva menos de 30 segundos e libera seu presente exclusivo ao finalizar.</p>

            <form id="ff-quiz-form" class="ff-quiz-form" novalidate>
              <div>
                <span class="ff-quiz-label">1. O que você deseja incluir ou melhorar?</span>
                <div id="ff-quiz-chips" class="ff-quiz-chips">
                  <button type="button" class="ff-quiz-chip is-selected" data-qchip="Design totalmente personalizado">Design exclusivo</button>
                  <button type="button" class="ff-quiz-chip" data-qchip="Identidade e cores da minha marca">Minha marca</button>
                  <button type="button" class="ff-quiz-chip" data-qchip="Painel Admin & CRM completo">Painel &amp; CRM</button>
                  <button type="button" class="ff-quiz-chip" data-qchip="Agendamento + WhatsApp">Agendamento</button>
                  <button type="button" class="ff-quiz-chip" data-qchip="Mais páginas e seções">Mais seções</button>
                </div>
              </div>

              <div>
                <label for="ff-q-notes" class="ff-quiz-label">2. O que achou do site e o que gostaria de mudar?</label>
                <textarea id="ff-q-notes" class="ff-input" rows="2" placeholder="Conte sua ideia, estilo visual ou melhoria desejada..."></textarea>
              </div>

              <div class="ff-quiz-row">
                <div>
                  <label for="ff-q-nome" class="ff-quiz-label">3. Seu nome *</label>
                  <input id="ff-q-nome" type="text" class="ff-input" placeholder="Como podemos te chamar?" required>
                </div>
                <div>
                  <label for="ff-q-wa" class="ff-quiz-label">WhatsApp *</label>
                  <input id="ff-q-wa" type="tel" class="ff-input" placeholder="(11) 99999-9999" required>
                </div>
              </div>

              <div id="ff-quiz-err" class="ff-quiz-err" role="alert"></div>

              <div class="ff-quiz-actions">
                <button type="button" id="ff-quiz-back" class="ff-ghost-btn">Voltar</button>
                <button type="submit" id="ff-quiz-submit" class="ff-submit-btn">Finalizar e liberar presente →</button>
              </div>
            </form>
          </div>

          <!-- VIEW 3: Gift Unlocked -->
          <div id="ff-view-gift" class="ff-view" hidden>
            <div class="ff-target-circle" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3.5" y="8.5" width="17" height="4" rx="1"/>
                <path d="M12 8.5v12M5.5 12.5v7a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7"/>
                <path d="M12 8.5H8.6a2.1 2.1 0 1 1 0-4.2C10.9 4.3 12 8.5 12 8.5Zm0 0h3.4a2.1 2.1 0 1 0 0-4.2C13.1 4.3 12 8.5 12 8.5Z"/>
              </svg>
            </div>
            <div class="ff-badge">Presente Desbloqueado</div>
            <h3 class="ff-quiz-title">Obrigado por responder!</h3>

            <div class="ff-gift-box">
              <div class="ff-gift-kicker">SEU BÔNUS FOCUS FRAME</div>
              <p class="ff-gift-desc">Você garantiu um <strong>Diagnóstico Personalizado + Adaptação Inicial da sua Identidade Visual</strong> na contratação do seu projeto completo.</p>
            </div>

            <div class="ff-quiz-actions" style="width:100%;">
              <button type="button" id="ff-gift-close" class="ff-ghost-btn">Continuar explorando</button>
              <a id="ff-gift-wa-btn" href="#" target="_blank" rel="noopener noreferrer" class="ff-submit-btn" style="text-align:center;text-decoration:none;">Resgatar no WhatsApp →</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function initFocusFrame() {
    if (document.getElementById('ff-overlay')) return;

    const mount = document.createElement('div');
    mount.innerHTML = buildMarkup();
    while (mount.firstElementChild) {
      document.body.appendChild(mount.firstElementChild);
    }

    const overlay = document.getElementById('ff-overlay');
    const closeBtn = document.getElementById('ff-close');
    const ctaDock = document.getElementById('ff-cta-dock');
    const floatCtaBtn = document.getElementById('ff-cta-float-btn');
    const startQuizBtn = document.getElementById('ff-start-quiz');
    const sparklesBtn = document.getElementById('ff-sparkles-btn');
    const giftBtn = document.getElementById('ff-gift-btn');
    const giftHint = document.getElementById('ff-gift-hint');

    const viewIntro = document.getElementById('ff-view-intro');
    const viewQuiz = document.getElementById('ff-view-quiz');
    const viewGift = document.getElementById('ff-view-gift');

    const quizForm = document.getElementById('ff-quiz-form');
    const quizChips = Array.from(document.querySelectorAll('#ff-quiz-chips .ff-quiz-chip'));
    const qNotes = document.getElementById('ff-q-notes');
    const qNome = document.getElementById('ff-q-nome');
    const qWa = document.getElementById('ff-q-wa');
    const qErr = document.getElementById('ff-quiz-err');
    const qBackBtn = document.getElementById('ff-quiz-back');
    const qSubmitBtn = document.getElementById('ff-quiz-submit');
    const giftCloseBtn = document.getElementById('ff-gift-close');
    const giftWaBtn = document.getElementById('ff-gift-wa-btn');

    // Chat elements
    const chatLauncher = document.getElementById('ff-chat-launcher');
    const chatWindow = document.getElementById('ff-chat-window');
    const chatClose = document.getElementById('ff-chat-close');
    const chatMessages = document.getElementById('ff-chat-messages');
    const chatQuick = document.getElementById('ff-chat-quick');
    const chatForm = document.getElementById('ff-chat-form');
    const chatInput = document.getElementById('ff-chat-input');
    const chatOpenProjectBtn = document.getElementById('ff-chat-open-project');
    const starBtns = Array.from(document.querySelectorAll('#ff-stars .ff-star-btn'));

    let selectedRating = 0;
    let popupTimer = null;
    let timerRunning = false;
    let revealedOnThisPage = false;

    // =========================================================
    // POP-UP OPEN / CLOSE / VIEWS
    // =========================================================
    function showModalView(viewName) {
      viewIntro.hidden = viewName !== 'intro';
      viewQuiz.hidden = viewName !== 'quiz';
      viewGift.hidden = viewName !== 'gift';
    }

    function openPopup(initialView) {
      showModalView(initialView || 'intro');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }

    function closePopup() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }

    // =========================================================
    // PER-PAGE 1-MINUTE TIMER (Home, Página de Consulta & Painel Admin)
    // Always waits 1 full minute after entering/unlocking or reloading this page,
    // then reveals both floating buttons and opens the Focus Frame pop-up.
    // =========================================================
    function hideFloatingControls() {
      if (ctaDock) ctaDock.classList.remove('is-revealed');
      if (chatLauncher) chatLauncher.classList.remove('is-revealed');
      closeChat();
      closePopup();
    }

    function revealFloatingButtons() {
      if (ctaDock) ctaDock.classList.add('is-revealed');
      if (chatLauncher) chatLauncher.classList.add('is-revealed');
    }

    function cancelCountdown() {
      if (popupTimer) {
        clearTimeout(popupTimer);
        popupTimer = null;
      }
      timerRunning = false;
    }

    function startOneMinuteCountdown() {
      if (timerRunning || revealedOnThisPage || isPageLocked()) return;
      timerRunning = true;

      popupTimer = setTimeout(() => {
        popupTimer = null;
        timerRunning = false;
        if (isPageLocked()) return;
        revealedOnThisPage = true;
        revealFloatingButtons();
        if (!overlay.classList.contains('is-open')) {
          openPopup('intro');
        }
      }, POPUP_DELAY_MS);
    }

    function syncLockState() {
      if (isPageLocked()) {
        cancelCountdown();
        revealedOnThisPage = false;
        hideFloatingControls();
      } else {
        startOneMinuteCountdown();
      }
    }

    // Observe lock/unlock transitions on both site (html.wl-locked) and admin (body.adm-locked)
    const lockObserver = new MutationObserver(syncLockState);
    lockObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    lockObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Start immediately if already unlocked, or wait until login unlocks the page
    syncLockState();

    // Handle bfcache navigation cleanly
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        cancelCountdown();
        revealedOnThisPage = false;
        hideFloatingControls();
        syncLockState();
      }
    });

    // =========================================================
    // FOCUS FRAME POP-UP EVENTS
    // =========================================================
    function redirectToProjectQuiz() {
      if (QUIZ_EXTERNAL_URL) {
        window.location.href = QUIZ_EXTERNAL_URL;
        return true;
      }
      return false;
    }

    floatCtaBtn.addEventListener('click', () => {
      if (redirectToProjectQuiz()) return;
      closeChat();
      openPopup('intro');
    });

    closeBtn.addEventListener('click', closePopup);
    giftCloseBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePopup();
    });

    sparklesBtn.addEventListener('click', () => {
      closePopup();
      openChat();
    });

    giftBtn.addEventListener('click', () => {
      giftHint.classList.add('is-visible');
      setTimeout(() => giftHint.classList.remove('is-visible'), 3600);
    });

    startQuizBtn.addEventListener('click', () => {
      if (redirectToProjectQuiz()) return;
      showModalView('quiz');
      setTimeout(() => qNotes && qNotes.focus(), 50);
    });

    qBackBtn.addEventListener('click', () => showModalView('intro'));

    quizChips.forEach((chip) => {
      chip.addEventListener('click', () => chip.classList.toggle('is-selected'));
    });

    qWa.addEventListener('input', function () {
      this.value = formatPhoneBR(this.value);
    });

    async function sendFeedbackApi(payload) {
      const sess = getPreviewSession();
      const headers = { 'Content-Type': 'application/json' };
      if (sess && sess.token) headers.Authorization = 'Bearer ' + sess.token;
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers,
          body: JSON.stringify(
            Object.assign(
              {
                email: (sess && sess.email) || '',
                page: window.location.pathname,
              },
              payload
            )
          ),
        });
      } catch {}
    }

    quizForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = qNome.value.trim();
      const whatsapp = qWa.value.trim();
      const interests = quizChips
        .filter((c) => c.classList.contains('is-selected'))
        .map((c) => c.getAttribute('data-qchip'));
      const notes = qNotes.value.trim();

      if (nome.length < 2) {
        qErr.textContent = 'Informe seu nome para liberarmos o presente.';
        qNome.focus();
        return;
      }
      if (whatsapp.replace(/\D/g, '').length < 10) {
        qErr.textContent = 'Informe um WhatsApp válido com DDD.';
        qWa.focus();
        return;
      }

      qErr.textContent = '';
      qSubmitBtn.disabled = true;
      qSubmitBtn.textContent = 'Liberando presente...';

      await sendFeedbackApi({
        kind: 'quiz',
        nome,
        whatsapp,
        interests,
        message: notes || 'Respondeu o quiz Focus Frame.',
        rating: selectedRating || null,
      });

      const waLines = [
        `Olá! Respondi o quiz da Focus Frame e quero meu projeto completo.`,
        `• Nome: ${nome}`,
        `• WhatsApp: ${whatsapp}`,
      ];
      if (interests.length) waLines.push(`• O que busco: ${interests.join(', ')}`);
      if (notes) waLines.push(`• Melhorias / ideias: ${notes}`);
      giftWaBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waLines.join('\n'))}`;

      qSubmitBtn.disabled = false;
      qSubmitBtn.textContent = 'Finalizar e liberar presente →';
      showModalView('gift');
    });

    // =========================================================
    // FLOATING FEEDBACK CHAT
    // =========================================================
    function loadChatHistory() {
      try {
        const raw = sessionStorage.getItem(CHAT_LOG_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) return parsed;
        }
      } catch {}
      return [
        {
          from: 'bot',
          text: 'Olá! Me conte o que você achou do site até agora e o que gostaria de melhorar, personalizar ou adicionar para o seu projeto.',
          time: formatTimeNow(),
        },
      ];
    }

    let chatHistory = loadChatHistory();

    function saveChatHistory() {
      try {
        sessionStorage.setItem(CHAT_LOG_KEY, JSON.stringify(chatHistory.slice(-30)));
      } catch {}
    }

    function renderChatMessages() {
      chatMessages.innerHTML = chatHistory
        .map(
          (m) => `
          <div class="ff-msg ff-msg--${m.from === 'user' ? 'user' : 'bot'}">
            ${escapeHtml(m.text)}
            <span class="ff-msg-time">${escapeHtml(m.time || '')}</span>
          </div>`
        )
        .join('');
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function openChat() {
      chatWindow.classList.add('is-open');
      chatWindow.setAttribute('aria-hidden', 'false');
      chatLauncher.setAttribute('aria-expanded', 'true');
      renderChatMessages();
      setTimeout(() => chatInput && chatInput.focus(), 60);
    }

    function closeChat() {
      chatWindow.classList.remove('is-open');
      chatWindow.setAttribute('aria-hidden', 'true');
      chatLauncher.setAttribute('aria-expanded', 'false');
    }

    chatLauncher.addEventListener('click', () => {
      if (chatWindow.classList.contains('is-open')) closeChat();
      else openChat();
    });

    chatClose.addEventListener('click', closeChat);

    chatOpenProjectBtn.addEventListener('click', () => {
      if (redirectToProjectQuiz()) return;
      closeChat();
      openPopup('intro');
    });

    starBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRating = Number(btn.getAttribute('data-star')) || 0;
        starBtns.forEach((s) => s.classList.toggle('is-active', Number(s.getAttribute('data-star')) <= selectedRating));
      });
    });

    async function handleSendChatMessage(text) {
      const clean = String(text || '').trim();
      if (!clean) return;

      chatHistory.push({ from: 'user', text: clean, time: formatTimeNow() });
      saveChatHistory();
      renderChatMessages();

      await sendFeedbackApi({
        kind: 'chat',
        message: clean,
        rating: selectedRating || null,
      });

      setTimeout(() => {
        const userCount = chatHistory.filter((m) => m.from === 'user').length;
        const reply =
          userCount === 1
            ? 'Perfeito, anotei sua opinião e sugestão de melhoria! Quer descrever mais algum detalhe (como cores, textos ou novas telas)? Se preferir, clique abaixo em "Quero meu projeto completo".'
            : 'Excelente, registrei esse complemento também! Tudo ficará salvo para montarmos seu projeto sob medida.';
        chatHistory.push({ from: 'bot', text: reply, time: formatTimeNow() });
        saveChatHistory();
        renderChatMessages();
      }, 360);
    }

    chatQuick.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-quick-msg]');
      if (!chip) return;
      handleSendChatMessage(chip.getAttribute('data-quick-msg'));
    });

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = chatInput.value.trim();
      if (!val) return;
      chatInput.value = '';
      handleSendChatMessage(val);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (overlay.classList.contains('is-open')) closePopup();
        else if (chatWindow.classList.contains('is-open')) closeChat();
      }
    });

    renderChatMessages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFocusFrame);
  } else {
    initFocusFrame();
  }
})();
