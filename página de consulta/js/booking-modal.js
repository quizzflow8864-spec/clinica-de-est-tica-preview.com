(function () {
  'use strict';

  const WHATSAPP_NUMBER = '5511984894031';

  function formatPhoneBR(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
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

  function initBookingModal() {
    const overlay = document.getElementById('ag-booking-overlay');
    if (!overlay) return;

    const dialog = overlay.querySelector('.ag-dialog');
    const closeBtn = overlay.querySelector('[data-close-booking]');
    const form = document.getElementById('ag-booking-form');
    const successView = document.getElementById('ag-booking-success');
    const errorBox = document.getElementById('ag-form-error');

    const nameInput = document.getElementById('ag-nome');
    const phoneInput = document.getElementById('ag-telefone');
    const emailInput = document.getElementById('ag-email');
    const goalSelect = document.getElementById('ag-objetivo');
    const dateInput = document.getElementById('ag-data');
    const notesInput = document.getElementById('ag-observacoes');

    const chips = Array.from(overlay.querySelectorAll('.ag-chip'));
    const periodBtns = Array.from(overlay.querySelectorAll('[data-period]'));
    const historyBtns = Array.from(overlay.querySelectorAll('[data-history]'));
    const waTriggers = Array.from(overlay.querySelectorAll('[data-open-whatsapp]'));
    const resetCloseBtn = overlay.querySelector('[data-finish-booking]');

    let selectedPeriod = 'Manhã (09h–12h)';
    let selectedHistory = 'Primeira vez';
    let isOpen = false;
    let lastFocused = null;

    // Set minimum date to today
    if (dateInput) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateInput.min = `${yyyy}-${mm}-${dd}`;
    }

    // Phone input mask
    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        this.value = formatPhoneBR(this.value);
      });
    }

    // Multi-select area chips
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('is-selected');
        chip.setAttribute('aria-pressed', chip.classList.contains('is-selected') ? 'true' : 'false');
        const field = chip.closest('.ag-field');
        if (field) field.classList.remove('has-error');
        if (errorBox) errorBox.textContent = '';
      });
    });

    // Period segmented buttons
    periodBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        periodBtns.forEach((b) => {
          b.classList.remove('is-selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
        selectedPeriod = btn.getAttribute('data-period') || 'Manhã (09h–12h)';
      });
    });

    // Aesthetic history segmented buttons
    historyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        historyBtns.forEach((b) => {
          b.classList.remove('is-selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
        selectedHistory = btn.getAttribute('data-history') || 'Primeira vez';
      });
    });

    // Clear field errors on input
    [nameInput, phoneInput, emailInput, goalSelect].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', () => {
        const f = el.closest('.ag-field');
        if (f) f.classList.remove('has-error');
        if (errorBox) errorBox.textContent = '';
      });
    });

    function collectData() {
      const areas = chips
        .filter((c) => c.classList.contains('is-selected'))
        .map((c) => c.getAttribute('data-area'));

      return {
        nome: (nameInput ? nameInput.value : '').trim(),
        telefone: (phoneInput ? phoneInput.value : '').trim(),
        email: (emailInput ? emailInput.value : '').trim(),
        areas,
        objetivo: goalSelect ? goalSelect.value : '',
        data: dateInput ? dateInput.value : '',
        periodo: selectedPeriod,
        historico: selectedHistory,
        observacoes: (notesInput ? notesInput.value : '').trim(),
      };
    }

    function buildWhatsAppUrl(data) {
      const lines = ['Olá! Gostaria de agendar uma avaliação na Clínica de Estética.'];
      if (data.nome) lines.push(`• Nome: ${data.nome}`);
      if (data.telefone) lines.push(`• WhatsApp: ${data.telefone}`);
      if (data.areas && data.areas.length) lines.push(`• Interesse: ${data.areas.join(', ')}`);
      if (data.objetivo) lines.push(`• Objetivo: ${data.objetivo}`);
      if (data.data) lines.push(`• Data preferida: ${formatDateBR(data.data)} (${data.periodo})`);
      else if (data.nome || (data.areas && data.areas.length)) lines.push(`• Período preferido: ${data.periodo}`);
      if (data.nome || (data.areas && data.areas.length)) lines.push(`• Histórico estético: ${data.historico}`);
      if (data.observacoes) lines.push(`• Observações: ${data.observacoes}`);
      const text = encodeURIComponent(lines.join('\n'));
      return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
    }

    function openModal(e) {
      if (e) e.preventDefault();
      if (isOpen) return;
      isOpen = true;
      lastFocused = document.activeElement;

      // Reset to form view if previously submitted
      if (form) form.style.display = '';
      if (successView) successView.classList.remove('is-visible');

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');

      if (window.gsap) {
        window.gsap.killTweensOf([overlay, dialog]);
        window.gsap.set(overlay, { autoAlpha: 0 });
        window.gsap.set(dialog, { y: 24, scale: 0.975, opacity: 0 });
        window.gsap.to(overlay, { autoAlpha: 1, duration: 0.32, ease: 'power2.out' });
        window.gsap.to(dialog, {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.42,
          ease: 'power3.out',
          onComplete: () => {
            if (nameInput) nameInput.focus();
          },
        });
      } else {
        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';
        if (nameInput) nameInput.focus();
      }
    }

    function closeModal() {
      if (!isOpen) return;
      isOpen = false;
      overlay.setAttribute('aria-hidden', 'true');

      const finish = () => {
        overlay.classList.remove('is-open');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        if (lastFocused && typeof lastFocused.focus === 'function') {
          lastFocused.focus();
        }
      };

      if (window.gsap) {
        window.gsap.killTweensOf([overlay, dialog]);
        window.gsap.to(dialog, { y: 16, scale: 0.98, opacity: 0, duration: 0.22, ease: 'power2.in' });
        window.gsap.to(overlay, { autoAlpha: 0, duration: 0.26, ease: 'power2.in', onComplete: finish });
      } else {
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        finish();
      }
    }

    // Attach triggers on all consultation booking buttons
    document.querySelectorAll('[data-open-booking]').forEach((trigger) => {
      trigger.addEventListener('click', openModal);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (resetCloseBtn) {
      resetCloseBtn.addEventListener('click', () => {
        if (form) form.reset();
        chips.forEach((c) => {
          c.classList.remove('is-selected');
          c.setAttribute('aria-pressed', 'false');
        });
        closeModal();
      });
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeModal();
    });

    // Direct WhatsApp buttons (prefill with whatever the user already entered)
    waTriggers.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = buildWhatsAppUrl(collectData());
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    });

    // Form submit with clean validation, per-user CRM persistence & confirmation summary
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = collectData();
        let valid = true;

        if (!data.nome || data.nome.length < 2) {
          nameInput.closest('.ag-field').classList.add('has-error');
          valid = false;
        }
        if (data.telefone.replace(/\D/g, '').length < 10) {
          phoneInput.closest('.ag-field').classList.add('has-error');
          valid = false;
        }
        if (data.areas.length === 0) {
          chips[0].closest('.ag-field').classList.add('has-error');
          valid = false;
        }

        if (!valid) {
          if (errorBox) {
            errorBox.textContent = 'Preencha seu nome, WhatsApp com DDD e selecione ao menos uma área de interesse.';
          }
          return;
        }

        if (errorBox) errorBox.textContent = '';

        // Persist booking strictly to the currently logged-in preview user's isolated CRM
        const submitBtn = form.querySelector('.ag-submit');
        const prevBtnText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Salvando...';
        }

        try {
          const rawSess = sessionStorage.getItem('wl_preview_session');
          const sess = rawSess ? JSON.parse(rawSess) : null;
          let savedBooking = null;

          if (sess && sess.token && !String(sess.token).startsWith('local:')) {
            const resp = await fetch('/api/bookings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + sess.token,
              },
              body: JSON.stringify({
                ...data,
                origem: 'Página de Consulta',
              }),
            });
            const json = await resp.json().catch(() => ({}));
            if (resp.ok && json.booking) savedBooking = json.booking;
          }

          // Mirror strictly to this logged-in user's isolated browser key (resilient to Vercel /tmp cold starts)
          if (sess && sess.email) {
            const ownerKey = 'wl_crm_bookings:' + String(sess.email).trim().toLowerCase();
            const nowIso = new Date().toISOString();
            const localEntry = savedBooking || {
              id: 'ag_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              ...data,
              areas: data.areas.length ? data.areas : ['Avaliação Estética'],
              objetivo: data.objetivo || 'Avaliação estética personalizada',
              protocolo: '',
              profissional: '',
              sala: '',
              status: 'novo',
              valorEstimado: 0,
              notasInternas: '',
              origem: 'Página de Consulta',
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            let existing = [];
            try {
              const parsed = JSON.parse(localStorage.getItem(ownerKey) || '[]');
              if (Array.isArray(parsed)) existing = parsed;
            } catch {}
            existing = [localEntry, ...existing.filter((x) => x.id !== localEntry.id)];
            localStorage.setItem(ownerKey, JSON.stringify(existing));
          }
        } catch {}

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = prevBtnText;
        }

        // Populate summary card
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val;
        };
        setVal('ag-sum-nome', data.nome);
        setVal('ag-sum-contato', data.telefone + (data.email ? ` · ${data.email}` : ''));
        setVal('ag-sum-areas', data.areas.join(', '));
        setVal('ag-sum-data', `${formatDateBR(data.data)} · ${data.periodo}`);
        setVal('ag-sum-objetivo', data.objetivo || 'Avaliação estética personalizada');

        form.style.display = 'none';
        if (successView) {
          successView.classList.add('is-visible');
          if (window.gsap) {
            window.gsap.fromTo(
              successView,
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.36, ease: 'power2.out' }
            );
          }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingModal);
  } else {
    initBookingModal();
  }
})();
