/**
 * Mobile-First High-FPS Animation & Media Engine
 * Dependencies: GSAP, ScrollTrigger, SplitText, DrawSVGPlugin (+ Lenis on desktop only)
 */

(function () {
  'use strict';

  const isTouchOrMobile = window.matchMedia('(max-width: 991px), (pointer: coarse)').matches;
  const isSmallMobile = window.matchMedia('(max-width: 768px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveDataMode = Boolean(navigator.connection && navigator.connection.saveData);

  // Prevent iOS/Android address-bar resize from causing scroll stutters
  if (window.ScrollTrigger) {
    ScrollTrigger.config({
      ignoreMobileResize: true,
      limitCallbacks: true,
    });
  }

  // ===================
  // SMOOTH SCROLL (Desktop only — Mobile uses native 60/120Hz hardware scrolling)
  // ===================
  let lenis = null;
  if (!isTouchOrMobile && !prefersReducedMotion && typeof window.Lenis === 'function') {
    lenis = new Lenis({
      autoRaf: false,
      wheelMultiplier: 0.78,
      smoothWheel: true,
      syncTouch: false,
    });

    if (window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
    }

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  // Reveal hidden elements immediately
  gsap.set('.is--hidden', { opacity: 1, visibility: 'visible' });

  // ===================
  // SMART VIDEO VIEWPORT MANAGER (Huge Mobile FPS & Data Win)
  // Only decodes/plays videos currently visible in the viewport
  // ===================
  function initSmartVideos() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return;

    videos.forEach((v) => {
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      if (!v.getAttribute('preload')) {
        v.setAttribute('preload', isSmallMobile ? 'none' : 'metadata');
      }
      // Pause initially until IntersectionObserver confirms visibility
      try {
        v.pause();
      } catch {}
    });

    if (saveDataMode || prefersReducedMotion) {
      return; // Keep lightweight poster images on Data Saver / Reduced Motion
    }

    const visibleVideos = new Set();

    const tryPlay = (v) => {
      if (document.hidden || document.documentElement.classList.contains('wl-locked')) return;
      if (v.preload === 'none') v.preload = 'metadata';
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const v = entry.target;
            if (entry.isIntersecting) {
              visibleVideos.add(v);
              tryPlay(v);
            } else {
              visibleVideos.delete(v);
              try {
                v.pause();
              } catch {}
            }
          });
        },
        { rootMargin: isSmallMobile ? '60px 0px' : '160px 0px', threshold: 0.01 }
      );

      videos.forEach((v) => io.observe(v));
    } else {
      videos.slice(0, 1).forEach(tryPlay);
    }

    // Pause all videos when tab is hidden; resume only visible ones when returning
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        videos.forEach((v) => {
          try { v.pause(); } catch {}
        });
      } else {
        visibleVideos.forEach(tryPlay);
      }
    });

    // Resume visible videos as soon as White-Label login gate unlocks
    const lockObs = new MutationObserver(() => {
      if (!document.documentElement.classList.contains('wl-locked')) {
        visibleVideos.forEach(tryPlay);
      }
    });
    lockObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  // ===================
  // MEGA MENU (Desktop hover only)
  // ===================
  function initMegaMenu() {
    if (isTouchOrMobile) return;
    const menuLinks = document.querySelectorAll('.mega_link');
    const menuCards = document.querySelectorAll('.mega_card');
    if (menuLinks.length === 0 || menuCards.length === 0) return;

    gsap.set(menuCards, { opacity: 0 });
    gsap.set(menuCards[0], { opacity: 1 });
    menuLinks[0].classList.add('active');

    menuLinks.forEach((link, index) => {
      link.addEventListener('mouseenter', function () {
        const targetCard = menuCards[index];
        if (targetCard && gsap.getProperty(targetCard, 'opacity') !== 1) {
          gsap.killTweensOf(menuCards);
          gsap.set(menuCards, { opacity: 0 });
          gsap.to(targetCard, { opacity: 1, duration: 0.25, ease: 'power2.out' });
        }
        menuLinks.forEach((l) => l.classList.remove('active'));
        this.classList.add('active');
      });
    });

    const megaMenu = document.querySelector('.mega_container');
    if (megaMenu) {
      megaMenu.addEventListener('mouseleave', function () {
        gsap.to(menuCards, { opacity: 0, duration: 0.18, ease: 'power2.out' });
        gsap.to(menuCards[0], { opacity: 1, duration: 0.24, delay: 0.08, ease: 'power2.out' });
        menuLinks.forEach((l) => l.classList.remove('active'));
        if (menuLinks[0]) menuLinks[0].classList.add('active');
      });
    }
  }

  // ===================
  // DROPDOWN ANIMATION (Desktop only)
  // ===================
  function initDropdownAnimation() {
    if (isTouchOrMobile) return;
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const dropdown = navbar.querySelector('.w-dropdown');
    const dropdownTrigger = dropdown ? dropdown.querySelector('.w-dropdown-toggle') : null;
    const dropdownList = dropdown ? dropdown.querySelector('.w-dropdown-list') : null;
    if (!dropdownTrigger || !dropdownList) return;

    gsap.set(dropdownList, { height: 1, opacity: 0, transformOrigin: 'top center', overflow: 'hidden' });
    let hideTimeout;

    dropdownTrigger.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
      gsap.to(dropdownList, { height: 216, opacity: 1, duration: 0.32, ease: 'power2.out', clearProps: 'x,y,transform' });
    });

    dropdownTrigger.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => {
        gsap.to(dropdownList, { height: 1, opacity: 0, duration: 0.18, ease: 'power2.in', clearProps: 'x,y,transform' });
      }, 100);
    });

    dropdownList.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    dropdownList.addEventListener('mouseleave', () => {
      clearTimeout(hideTimeout);
      gsap.to(dropdownList, { height: 1, opacity: 0, duration: 0.18, ease: 'power2.in', clearProps: 'x,y,transform' });
    });
  }

  // ===================
  // NAVBAR SCROLL BEHAVIOR (Passive + State Guarded -> Zero Tween Spam)
  // ===================
  function initNavbarScroll() {
    const nav = document.querySelector('.nav_container');
    if (!nav) return;

    let lastScrollY = window.scrollY;
    let navHidden = false;
    let ticking = false;

    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          const currentScrollY = window.scrollY;
          const delta = currentScrollY - lastScrollY;

          if (currentScrollY <= 140) {
            if (navHidden) {
              navHidden = false;
              gsap.to(nav, { y: 0, duration: 0.45, ease: 'power2.out', overwrite: true, force3D: true });
            }
            lastScrollY = currentScrollY;
            return;
          }

          if (Math.abs(delta) < 12) return;

          if (delta > 0 && !navHidden) {
            navHidden = true;
            gsap.to(nav, { y: -120, duration: 0.35, ease: 'power2.out', overwrite: true, force3D: true });
          } else if (delta < 0 && navHidden) {
            navHidden = false;
            gsap.to(nav, { y: 0, duration: 0.45, ease: 'power2.out', overwrite: true, force3D: true });
          }

          lastScrollY = currentScrollY;
        });
      },
      { passive: true }
    );
  }

  // ===================
  // WHATSAPP FLOATING REVEAL
  // ===================
  if (document.querySelector('.whatsapp') && document.querySelector('.hero_section')) {
    gsap.to('.whatsapp', {
      x: 0,
      opacity: 1,
      duration: 0.55,
      ease: 'power3.out',
      force3D: true,
      scrollTrigger: {
        trigger: '.hero_section',
        start: 'bottom top',
        toggleActions: 'play none none reverse',
      },
    });
  }

  // ===================
  // SECTION TITLES ANIMATION (Fast & GPU-composited on mobile)
  // ===================
  function initSectionTitles() {
    if (prefersReducedMotion) return;
    gsap.utils.toArray('.section_title').forEach((sectionTitle) => {
      if (isSmallMobile) {
        gsap.from(sectionTitle, {
          opacity: 0,
          y: 22,
          duration: 0.55,
          ease: 'power2.out',
          force3D: true,
          scrollTrigger: {
            trigger: sectionTitle,
            start: 'top 90%',
            once: true,
          },
        });
        return;
      }

      if (window.SplitText) {
        const split = SplitText.create(sectionTitle, { types: 'words' });
        gsap.from(split.words, {
          opacity: 0,
          yPercent: 80,
          rotation: 3,
          duration: 0.75,
          stagger: 0.06,
          ease: 'power2.out',
          force3D: true,
          scrollTrigger: {
            trigger: sectionTitle,
            start: 'top bottom-=160px',
            once: true,
          },
        });
      }
    });
  }

  // ===================
  // TECNOLOGIAS ANIMATIONS (Zero layout reflow on mobile)
  // ===================
  function initTecnologiasAnimations() {
    if (prefersReducedMotion) return;
    const mm = gsap.matchMedia();

    mm.add('(min-width: 769px)', () => {
      if (document.querySelector('.tecnologias_video_gota, .tecnologias_video_gota.ind')) {
        gsap.to('.tecnologias_video_gota, .tecnologias_video_gota.ind', {
          x: -48,
          y: 48,
          duration: 1,
          force3D: true,
          scrollTrigger: {
            trigger: '.tecnologias, .tecnologias_ind',
            start: 'top center',
            end: 'center center',
            toggleActions: 'play none none reverse',
            scrub: true,
          },
          ease: 'power1.out',
        });
      }

      if (document.querySelector('.tecnologias_video_container, .tecnologias_video_container.ind')) {
        gsap.to('.tecnologias_video_container, .tecnologias_video_container.ind', {
          height: 400,
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '120px',
          borderBottomRightRadius: '20px',
          borderBottomLeftRadius: '120px',
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.tecnologias, .tecnologias_ind',
            start: 'top center-=187px',
            end: 'top top',
            toggleActions: 'play none none reverse',
            scrub: true,
          },
        });
      }
    });

    // Mobile: GPU-only transform + opacity fade (no scrubbed height/borderRadius reflow!)
    mm.add('(max-width: 768px)', () => {
      if (document.querySelector('.tecnologias_video_container, .tecnologias_video_container.ind')) {
        gsap.from('.tecnologias_video_container, .tecnologias_video_container.ind', {
          opacity: 0,
          y: 20,
          duration: 0.6,
          ease: 'power2.out',
          force3D: true,
          scrollTrigger: {
            trigger: '.tecnologias, .tecnologias_ind',
            start: 'top 85%',
            once: true,
          },
        });
      }
    });
  }

  // ===================
  // CONTACT SECTION ANIMATIONS
  // ===================
  function initContactAnimations() {
    gsap.set(
      ['.contato_back', '.section_title.just--left.main--contact', '.contato_main.maps', '.drop_line'],
      { opacity: 1, visibility: 'visible' }
    );

    if (prefersReducedMotion) return;

    if (document.querySelector('.contato_back')) {
      gsap.from('.contato_back', {
        opacity: 0,
        y: isSmallMobile ? 20 : 0,
        duration: isSmallMobile ? 0.6 : 1.4,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: {
          trigger: '.contato, .contato_principal',
          start: 'top 80%',
          once: true,
        },
      });
    }

    if (document.querySelector('.contato_main.maps')) {
      gsap.from('.contato_main.maps', {
        x: isSmallMobile ? 32 : '40vw',
        opacity: 0,
        duration: isSmallMobile ? 0.6 : 1.2,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: {
          trigger: '.contato, .contato_principal',
          start: 'top 80%',
          once: true,
        },
      });
    }
  }

  // ===================
  // HEADER & DROP LINE ANIMATIONS
  // ===================
  function initHeaderAnimations() {
    if (prefersReducedMotion) return;
    if (document.querySelector('.drop_secondary')) {
      gsap.to('.drop_secondary', {
        x: -12,
        y: -12,
        duration: isSmallMobile ? 0.8 : 1.6,
        ease: 'power2.out',
        force3D: true,
      });
    }

    const dropPath = document.querySelector('.drop_line path');
    if (dropPath && window.DrawSVGPlugin) {
      gsap.set(dropPath, { drawSVG: '0%' });
      gsap.to(dropPath, {
        drawSVG: '100%',
        duration: isSmallMobile ? 1.0 : 1.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.contato_principal',
          start: 'top 82%',
          once: true,
        },
      });
    }
  }

  // ===================
  // SCROLL MARQUEE UTILITY (Testimonials)
  // ===================
  function initScrollMarquee(container, direction) {
    if (prefersReducedMotion) return;
    const innerContainers = container.querySelectorAll('.marquee-inner');
    const firstInner = innerContainers[0];
    if (!firstInner) return;

    const totalWidth = firstInner.offsetWidth;
    const moveDistance = direction === 'left' ? `-=${totalWidth / 2}` : `+=${totalWidth / 2}`;

    gsap.to(innerContainers, {
      x: moveDistance,
      force3D: true,
      scrollTrigger: {
        trigger: '.testimonials',
        start: 'top bottom',
        end: 'bottom top',
        scrub: isSmallMobile ? 0.4 : true,
      },
      ease: 'none',
    });
  }

  // ===================
  // HOME PAGE ANIMATIONS (Viewport-Paused Marquees + Mobile-First Choreography)
  // ===================
  function initHomeAnimations() {
    const heroTitle = document.querySelector('#herotitle');
    const heroH2 = document.querySelector('#heroh2');
    const clinicaTitle = document.querySelector('.clinica_title');

    if (heroTitle && heroH2) {
      gsap.set('.hero_wrapper_right', { opacity: 1, visibility: 'visible' });

      if (!prefersReducedMotion) {
        if (isSmallMobile) {
          gsap
            .timeline()
            .from([heroTitle, heroH2, '.cta_hero_wrapper'], {
              opacity: 0,
              y: 22,
              duration: 0.65,
              stagger: 0.1,
              ease: 'power2.out',
              force3D: true,
            });
        } else {
          const text1 = SplitText.create('#herotitle', { types: 'words' });
          const text2 = SplitText.create('#heroh2', { types: 'lines' });

          gsap
            .timeline()
            .from(
              text1.words,
              {
                opacity: 0,
                yPercent: 90,
                rotation: 4,
                duration: 0.85,
                stagger: 0.08,
                ease: 'power2.out',
                force3D: true,
              },
              0.15
            )
            .from(
              text2.lines,
              {
                opacity: 0,
                yPercent: 80,
                duration: 1.0,
                stagger: 0.08,
                ease: 'power2.out',
                force3D: true,
              },
              0.45
            )
            .from(
              '.cta_hero_wrapper',
              {
                opacity: 0,
                yPercent: 40,
                duration: 1.1,
                ease: 'power2.out',
                force3D: true,
              },
              0.6
            );
        }
      }
    }

    // Desktop-only heavy pinned drop morph (skip layout-thrashing pin/resize on mobile)
    const mm = gsap.matchMedia();
    mm.add('(min-width: 769px)', () => {
      if (document.querySelector('.drop_image_container')) {
        gsap.fromTo(
          '.drop_image_container',
          { x: '100vw' },
          {
            x: 0,
            ease: 'power2.out',
            force3D: true,
            scrollTrigger: { trigger: '.full_session_social_proof', start: 'top 70%', end: 'top top', scrub: true },
          }
        );

        ScrollTrigger.create({
          trigger: '.full_session_social_proof',
          start: 'top top',
          endTrigger: '.tratamentos_principais',
          end: 'bottom top',
          pin: '.drop_image_container',
          pinSpacing: false,
        });

        gsap.fromTo(
          '.drop_image_container',
          { x: 0 },
          {
            x: '-260px',
            ease: 'power2.out',
            force3D: true,
            scrollTrigger: { trigger: '.tratamentos_principais', start: 'top bottom', end: 'top top', scrub: true },
          }
        );

        gsap.to('.drop_image_container', {
          width: '424px',
          height: '328px',
          borderTopLeftRadius: '60px',
          borderTopRightRadius: '20px',
          borderBottomRightRadius: '60px',
          borderBottomLeftRadius: '20px',
          ease: 'power2.out',
          scrollTrigger: { trigger: '.tratamentos_principais', start: 'top bottom', end: 'top top', scrub: true },
        });

        gsap.to('.drop_image_container', {
          autoAlpha: 0,
          duration: 0.01,
          ease: 'none',
          scrollTrigger: { trigger: '.cards-trigger', start: 'top center-=218px', toggleActions: 'play none none reverse' },
        });
      }

      if (document.querySelector('.card_tratamento.facial')) {
        gsap.set('.card_tratamento.facial', { autoAlpha: 0 });
        gsap.to('.card_tratamento.facial', {
          autoAlpha: 1,
          duration: 0.01,
          ease: 'none',
          scrollTrigger: { trigger: '.cards-trigger', start: 'top center-=218px', toggleActions: 'play none none reverse' },
        });
      }
    });

    if (!prefersReducedMotion) {
      const cardTitleEl = document.querySelector('.card_title');
      if (cardTitleEl) {
        if (isSmallMobile) {
          gsap.from('.card_title', {
            opacity: 0,
            y: 18,
            duration: 0.55,
            ease: 'power2.out',
            force3D: true,
            scrollTrigger: { trigger: '.cards-trigger', start: 'top 82%', once: true },
          });
        } else {
          const cardTitle = SplitText.create('.card_title', { types: 'words' });
          gsap.from(cardTitle.words, {
            opacity: 0,
            yPercent: 90,
            rotation: 4,
            duration: 0.9,
            stagger: 0.06,
            ease: 'power2.out',
            force3D: true,
            scrollTrigger: { trigger: '.cards-trigger', start: 'top 35%', once: true },
          });
        }
      }

      if (!isSmallMobile && document.querySelector('.card_tratamento_border')) {
        gsap.from('.card_tratamento_border', {
          width: '100%',
          height: '100%',
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: { trigger: '.cards-trigger', start: 'top 25%', once: true },
        });
      }

      if (document.querySelector('.card_tratamento.cabelo')) {
        gsap.from('.card_tratamento.cabelo', {
          x: isSmallMobile ? 28 : 216,
          autoAlpha: 0,
          scale: isSmallMobile ? 0.96 : 0.85,
          rotation: isSmallMobile ? 0 : -6,
          duration: isSmallMobile ? 0.6 : 1.4,
          ease: 'power3.out',
          force3D: true,
          scrollTrigger: { trigger: '.cards-trigger', start: isSmallMobile ? 'top 80%' : 'top center-=192px', once: true },
        });
      }

      if (document.querySelector('.card_tratamento.corpo')) {
        gsap.from('.card_tratamento.corpo', {
          x: isSmallMobile ? -28 : -216,
          autoAlpha: 0,
          scale: isSmallMobile ? 0.96 : 0.85,
          rotation: isSmallMobile ? 0 : 6,
          duration: isSmallMobile ? 0.6 : 1.4,
          ease: 'power3.out',
          force3D: true,
          scrollTrigger: { trigger: '.cards-trigger', start: isSmallMobile ? 'top 80%' : 'top center-=192px', once: true },
        });
      }

      if (clinicaTitle) {
        gsap.from(clinicaTitle, {
          opacity: 0,
          y: 22,
          duration: 0.6,
          ease: 'power2.out',
          force3D: true,
          scrollTrigger: { trigger: '.clinica_info', start: 'top 82%', once: true },
        });
      }
    }

    // Marquee Tracks — automatically PAUSED whenever off-screen to preserve 60fps on mobile!
    if (document.querySelector('.marquee_track')) {
      const marqueeTweens = [];
      document.querySelectorAll('.marquee_track').forEach((track) => {
        const isReverse = track.classList.contains('right');
        const originalRow = track.querySelector('.marquee_row');
        if (!originalRow) return;

        const oneRowWidth = originalRow.scrollWidth;
        if (!oneRowWidth) return;
        const totalNeeded = Math.min(4, Math.ceil((window.innerWidth + oneRowWidth) / oneRowWidth) + 1);

        track.innerHTML = '';
        for (let i = 0; i < totalNeeded; i++) {
          track.appendChild(originalRow.cloneNode(true));
        }

        gsap.set(track, { force3D: true, x: isReverse ? -oneRowWidth : 0 });

        const tw = gsap.to(track, {
          x: isReverse ? 0 : -oneRowWidth,
          duration: isSmallMobile ? 34 : 40,
          ease: 'none',
          repeat: -1,
          force3D: true,
          paused: prefersReducedMotion,
          modifiers: {
            x: gsap.utils.unitize((x) => {
              const value = parseFloat(x);
              if (isReverse) return value >= 0 ? -oneRowWidth : value;
              return value <= -oneRowWidth ? 0 : value;
            }),
          },
        });
        marqueeTweens.push({ el: track, tween: tw });
      });

      if (!prefersReducedMotion && 'IntersectionObserver' in window && marqueeTweens.length) {
        const marqueeHost = document.querySelector('.tratamentos_marquee_wrapper') || marqueeTweens[0].el.parentElement;
        if (marqueeHost) {
          const mObserver = new IntersectionObserver(
            (entries) => {
              const visible = entries[0] && entries[0].isIntersecting;
              marqueeTweens.forEach((m) => (visible ? m.tween.play() : m.tween.pause()));
            },
            { rootMargin: '120px 0px' }
          );
          mObserver.observe(marqueeHost);
        }
      }
    }

    // Colageno scroll scene (desktop scrub, lighter transform on mobile)
    if (!prefersReducedMotion && document.querySelector('.info_colageno')) {
      if (isSmallMobile) {
        gsap.from('.sticky_img_bottom', {
          opacity: 0,
          y: 36,
          duration: 0.65,
          ease: 'power2.out',
          force3D: true,
          scrollTrigger: { trigger: '.info_colageno', start: 'top 85%', once: true },
        });
      } else {
        const imageScrollTL = gsap.timeline({
          scrollTrigger: { trigger: '.info_colageno', start: 'top bottom', end: 'top top', scrub: true },
        });
        imageScrollTL.from('.sticky_img_bottom', { y: 560, ease: 'none', force3D: true }, 0);
        imageScrollTL.to('.gota_grad .grad_stop_1', { stopColor: '#673593', ease: 'none' }, 0);
        imageScrollTL.to('.gota_grad .grad_stop_2', { stopColor: '#8CD1C7', ease: 'none' }, 0);
        imageScrollTL
          .to('.ball_grad_01', { opacity: 0, ease: 'none' }, 0)
          .to('.ball_grad_02', { opacity: 0.8, ease: 'none' }, 0);
      }
    }

    if (!prefersReducedMotion && document.querySelector('.back_rafaela')) {
      gsap.from('.back_rafaela', {
        opacity: 0,
        y: 16,
        duration: isSmallMobile ? 0.6 : 1.4,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: '.salvato_section', start: 'top 80%', once: true },
      });
    }

    if (!prefersReducedMotion && document.querySelector('.statement_span')) {
      gsap.from('.statement_span', {
        opacity: 0,
        yPercent: isSmallMobile ? 35 : 90,
        rotation: isSmallMobile ? 0 : 6,
        duration: isSmallMobile ? 0.55 : 0.85,
        stagger: isSmallMobile ? 0.08 : 0.14,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: '.statement', start: 'top 82%', once: true },
      });
    }

    if (!prefersReducedMotion && document.querySelector('.statement_icon')) {
      gsap.from('.statement_icon', {
        opacity: 0,
        xPercent: isSmallMobile ? -25 : -80,
        duration: isSmallMobile ? 0.55 : 1.1,
        stagger: 0.12,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: '.statement', start: 'top 82%', once: true },
      });
    }

    if (document.querySelector('.to-left')) {
      initScrollMarquee(document.querySelector('.to-left'), 'left');
    }
    if (document.querySelector('.to-right')) {
      initScrollMarquee(document.querySelector('.to-right'), 'right');
    }
  }

  // ===================
  // GALLERY & SECONDARY CARD ANIMATIONS
  // ===================
  function initNewPageAnimations() {
    if (prefersReducedMotion) return;

    if (document.querySelector('.clinica_hero_back_img')) {
      gsap.from('.clinica_hero_back_img', {
        opacity: 0,
        y: 16,
        duration: isSmallMobile ? 0.6 : 1.2,
        ease: 'power2.out',
        force3D: true,
      });
    }

    if (document.querySelector('.clinica-galeria-foto')) {
      gsap.from('.clinica-galeria-foto', {
        scale: 0.96,
        opacity: 0,
        y: 20,
        ease: 'power2.out',
        stagger: 0.08,
        duration: 0.55,
        force3D: true,
        scrollTrigger: {
          trigger: '.clinica-galeria-foto',
          start: 'top 85%',
          once: true,
        },
      });
    }

    const TecBlockTitle = document.querySelector('.sec_tec_card_title');
    if (TecBlockTitle) {
      gsap.from(['.sec_tec_card_title', '.sec_tec_card_par', '.sec_tec_card_ico'], {
        opacity: 0,
        y: 20,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: '.tecnologias_secondary_title', start: 'top 82%', once: true },
      });
    }

    gsap.utils.toArray('.trat_sec_card').forEach((card) => {
      gsap.from(card, {
        opacity: 0,
        y: 28,
        duration: 0.55,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: card, start: 'top 88%', once: true },
      });
    });
  }

  // ===================
  // CONSULTA / SECONDARY PAGE ANIMATIONS
  // ===================
  function initTecnologiasPage() {
    if (prefersReducedMotion) return;

    const heroH1 = document.querySelector('.heading-secondary');
    const heroP = document.querySelector('.hero_paragraph-secondary');

    if (heroH1) {
      gsap.from(heroH1, { y: 24, opacity: 0, duration: 0.65, ease: 'power2.out', force3D: true });
    }
    if (heroP) {
      gsap.from(heroP, { y: 18, opacity: 0, duration: 0.65, delay: 0.1, ease: 'power2.out', force3D: true });
    }

    if (document.querySelector('.video_container_secondary')) {
      gsap.from('.video_container_secondary', {
        opacity: 0,
        y: 16,
        duration: isSmallMobile ? 0.6 : 1.1,
        ease: 'power2.out',
        force3D: true,
      });
    }

    if (document.querySelector('.cta_grad')) {
      gsap.from('.cta_grad', { opacity: 0, duration: 0.8, ease: 'power2.out' });
    }

    if (!isSmallMobile) {
      const tratamentoCards = document.querySelectorAll('.tratamento_card_single, .tratamento_individual_card_single');
      if (tratamentoCards.length > 0) {
        gsap.utils.toArray('.tratamento_card_single, .tratamento_individual_card_single').forEach((card, i, cards) => {
          if (i === cards.length - 1) return;
          gsap.to(card, {
            scale: 0.92,
            y: 80,
            opacity: 0,
            ease: 'none',
            force3D: true,
            scrollTrigger: { trigger: cards[i + 1], start: 'top center', end: 'top top', scrub: true },
          });
        });
      }
    }

    if (document.querySelector('.veja_tambem_card')) {
      gsap.from('.veja_tambem_card', {
        opacity: 0,
        y: 22,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: '.veja_tambem', start: 'top 82%', once: true },
      });
    }

    if (document.querySelector('.todos_tratamentos_chip')) {
      gsap.from('.todos_tratamentos_chip', {
        opacity: 0,
        y: 14,
        duration: 0.5,
        stagger: 0.05,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: '.todos_os_tratamentos', start: 'top 82%', once: true },
      });
    }
  }

  function init() {
    initSmartVideos();
    initMegaMenu();
    initDropdownAnimation();
    initNavbarScroll();
    initSectionTitles();
    initTecnologiasAnimations();
    initContactAnimations();
    initHeaderAnimations();
    initHomeAnimations();
    initTecnologiasPage();
    initNewPageAnimations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
