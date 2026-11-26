/**
 * Mobile-First High-FPS Animation & Media Engine (Consulta Page)
 * Dependencies: GSAP, ScrollTrigger, SplitText, DrawSVGPlugin (+ Lenis on desktop only)
 */

(function () {
  'use strict';

  const isTouchOrMobile = window.matchMedia('(max-width: 991px), (pointer: coarse)').matches;
  const isSmallMobile = window.matchMedia('(max-width: 768px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveDataMode = Boolean(navigator.connection && navigator.connection.saveData);

  if (window.ScrollTrigger) {
    ScrollTrigger.config({
      ignoreMobileResize: true,
      limitCallbacks: true,
    });
  }

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

  gsap.set('.is--hidden', { opacity: 1, visibility: 'visible' });

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
      try { v.pause(); } catch {}
    });

    if (saveDataMode || prefersReducedMotion) return;

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
              try { v.pause(); } catch {}
            }
          });
        },
        { rootMargin: isSmallMobile ? '60px 0px' : '160px 0px', threshold: 0.01 }
      );
      videos.forEach((v) => io.observe(v));
    } else {
      videos.slice(0, 1).forEach(tryPlay);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        videos.forEach((v) => { try { v.pause(); } catch {} });
      } else {
        visibleVideos.forEach(tryPlay);
      }
    });

    const lockObs = new MutationObserver(() => {
      if (!document.documentElement.classList.contains('wl-locked')) {
        visibleVideos.forEach(tryPlay);
      }
    });
    lockObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

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

  if (document.querySelector('.whatsapp') && document.querySelector('.hero_section')) {
    gsap.to('.whatsapp', {
      x: 0,
      opacity: 1,
      duration: 0.55,
      ease: 'power3.out',
      force3D: true,
      scrollTrigger: { trigger: '.hero_section', start: 'bottom top', toggleActions: 'play none none reverse' },
    });
  }

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
          scrollTrigger: { trigger: sectionTitle, start: 'top 90%', once: true },
        });
      } else if (window.SplitText) {
        const split = SplitText.create(sectionTitle, { types: 'words' });
        gsap.from(split.words, {
          opacity: 0,
          yPercent: 80,
          rotation: 3,
          duration: 0.75,
          stagger: 0.06,
          ease: 'power2.out',
          force3D: true,
          scrollTrigger: { trigger: sectionTitle, start: 'top bottom-=160px', once: true },
        });
      }
    });
  }

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
        duration: isSmallMobile ? 0.6 : 1.3,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: '.contato, .contato_principal', start: 'top 80%', once: true },
      });
    }

    if (document.querySelector('.contato_main.maps')) {
      gsap.from('.contato_main.maps', {
        x: isSmallMobile ? 32 : '40vw',
        opacity: 0,
        duration: isSmallMobile ? 0.6 : 1.1,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: '.contato, .contato_principal', start: 'top 80%', once: true },
      });
    }
  }

  function initHeaderAnimations() {
    if (prefersReducedMotion) return;
    if (document.querySelector('.drop_secondary')) {
      gsap.to('.drop_secondary', { x: -12, y: -12, duration: isSmallMobile ? 0.8 : 1.5, ease: 'power2.out', force3D: true });
    }

    const dropPath = document.querySelector('.drop_line path');
    if (dropPath && window.DrawSVGPlugin) {
      gsap.set(dropPath, { drawSVG: '0%' });
      gsap.to(dropPath, {
        drawSVG: '100%',
        duration: isSmallMobile ? 1.0 : 1.8,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.contato_principal', start: 'top 82%', once: true },
      });
    }
  }

  function initConsultaPage() {
    if (prefersReducedMotion) return;

    const heroH1 = document.querySelector('.heading-secondary');
    const heroP = document.querySelector('.hero_paragraph-secondary');
    if (heroH1) gsap.from(heroH1, { y: 22, opacity: 0, duration: 0.6, ease: 'power2.out', force3D: true });
    if (heroP) gsap.from(heroP, { y: 16, opacity: 0, duration: 0.6, delay: 0.08, ease: 'power2.out', force3D: true });

    if (document.querySelector('.video_container_secondary')) {
      gsap.from('.video_container_secondary', { opacity: 0, y: 16, duration: 0.7, ease: 'power2.out', force3D: true });
    }

    if (document.querySelector('.clinica_hero_back_img')) {
      gsap.from('.clinica_hero_back_img', { opacity: 0, y: 16, duration: 0.7, ease: 'power2.out', force3D: true });
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
        scrollTrigger: { trigger: '.clinica-galeria-foto', start: 'top 85%', once: true },
      });
    }

    gsap.utils.toArray('.trat_sec_card').forEach((card) => {
      gsap.from(card, {
        opacity: 0,
        y: 26,
        duration: 0.55,
        ease: 'power2.out',
        force3D: true,
        scrollTrigger: { trigger: card, start: 'top 88%', once: true },
      });
    });
  }

  function init() {
    initSmartVideos();
    initMegaMenu();
    initDropdownAnimation();
    initNavbarScroll();
    initSectionTitles();
    initContactAnimations();
    initHeaderAnimations();
    initConsultaPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
