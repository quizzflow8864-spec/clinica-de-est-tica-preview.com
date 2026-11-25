/**
 * Combined JavaScript for all pages
 * Dependencies: Lenis, GSAP, ScrollTrigger, SplitText, DrawSVG
 * * NOTE: The code has been consolidated into the main IIFE structure. 
 * Redundant code and the broken secondary RAF loop from the loose block have been removed.
 * The new features (Gallery, Secondary Cards, etc.) have been moved into new functions 
 * and called in the init() function below.
 */

(function() {
  'use strict';

  // ===================
  // INITIALIZE LENIS SMOOTH SCROLL
  // ===================
  
  const lenis = new Lenis({
    autoRaf: false,
    wheelMultiplier: 0.7,
  });

  lenis.on('scroll', (e) => {
    console.log(e);
  });

  // ===================
  // GLOBAL SETUP
  // ===================
  
  gsap.set(".is--hidden", { opacity: 1, visibility: "visible" });

  // ===================
  // MEGA MENU FUNCTIONALITY
  // ===================
  
  function initMegaMenu() {
    const menuLinks = document.querySelectorAll('.mega_link');
    const menuCards = document.querySelectorAll('.mega_card');

    if (menuLinks.length === 0 || menuCards.length === 0) return;

    gsap.set(menuCards, { opacity: 0 });
    gsap.set(menuCards[0], { opacity: 1 });
    menuLinks[0].classList.add('active');

    menuLinks.forEach((link, index) => {
      link.addEventListener('mouseenter', function () {
        const targetCard = menuCards[index];

        if (targetCard && gsap.getProperty(targetCard, "opacity") !== 1) {
          gsap.killTweensOf(menuCards);
          gsap.set(menuCards, { opacity: 0 });
          gsap.to(targetCard, {
            opacity: 1,
            duration: 0.3,
            ease: "power2.out"
          });
        }

        menuLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
      });
    });

    const megaMenu = document.querySelector('.mega_container');
    if (megaMenu) {
      megaMenu.addEventListener('mouseleave', function () {
        gsap.to(menuCards, {
          opacity: 0,
          duration: 0.2,
          ease: "power2.out"
        });

        gsap.to(menuCards[0], {
          opacity: 1,
          duration: 0.3,
          delay: 0.1,
          ease: "power2.out"
        });

        menuLinks.forEach(l => l.classList.remove('active'));
        if (menuLinks[0]) {
          menuLinks[0].classList.add('active');
        }
      });
    }
  }

  // ===================
  // DROPDOWN ANIMATION
  // ===================
  
  function initDropdownAnimation() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const dropdown = navbar.querySelector('.w-dropdown');
    const dropdownTrigger = dropdown ? dropdown.querySelector('.w-dropdown-toggle') : null;
    const dropdownList = dropdown ? dropdown.querySelector('.w-dropdown-list') : null;

    if (!dropdownTrigger || !dropdownList) return;

    gsap.set(dropdownList, {
      height: 1,
      opacity: 0,
      transformOrigin: "top center",
      overflow: "hidden"
    });

    let hideTimeout;

    dropdownTrigger.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
      gsap.to(dropdownList, {
        height: 216,
        opacity: 1,
        duration: 0.4,
        ease: "power2.out",
        clearProps: "x,y,transform"
      });
    });

    dropdownTrigger.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => {
        gsap.to(dropdownList, {
          height: 1,
          opacity: 0,
          duration: 0.2,
          ease: "power2.in",
          clearProps: "x,y,transform"
        });
      }, 100);
    });

    dropdownList.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
    });

    dropdownList.addEventListener('mouseleave', () => {
      clearTimeout(hideTimeout);
      gsap.to(dropdownList, {
        height: 1,
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
        clearProps: "x,y,transform"
      });
    });
  }

  // ===================
  // NAVBAR SCROLL BEHAVIOR
  // ===================
  
  function initNavbarScroll() {
    let lastScrollY = window.scrollY;
    const nav = document.querySelector(".nav_container");
    const hero = document.querySelector(".hero_section");
    let isScrollActive = false;

    if (!nav) return;

    if (hero) {
      ScrollTrigger.create({
        trigger: hero,
        start: "top+=160px top",
        onEnter: () => {
          isScrollActive = true;
        },
        onLeaveBack: () => {
          isScrollActive = false;
          gsap.to(nav, { y: "0%", duration: 1.6, ease: "power1.out" });
        },
      });
    }

    window.addEventListener("scroll", function () {
      if (!isScrollActive) return;

      let currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY) {
        gsap.to(nav, { y: "-120px", duration: 0.8, ease: "power1.out" });
      } else {
        gsap.to(nav, { y: "0%", duration: 1.6, ease: "back.out(0.5)" });
      }

      lastScrollY = currentScrollY;
    });
  }


  // ===================
  // WHATSAPP ANIMATION
  // ===================

    gsap.to(".whatsapp", {
      x: 0,
      opacity: 1,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".hero_section",
        start: "bottom top",
        toggleActions: "play none none reverse"
      }
    });




  // ===================
  // SECTION TITLES ANIMATION
  // ===================
  
  function initSectionTitles() {
    gsap.utils.toArray(".section_title").forEach(sectionTitle => {
      const split = SplitText.create(sectionTitle, { types: "words" });

      gsap.from(split.words, {
        opacity: 0,
        yPercent: 100,
        rotation: 5,
        duration: 1,
        stagger: 0.1,
        ease: "power1.out",
        scrollTrigger: {
          trigger: sectionTitle,
          start: "top bottom-=200px",
        }
      });
    });
  }

  // ===================
  // TECNOLOGIAS ANIMATIONS
  // ===================
  
  function initTecnologiasAnimations() {
    let mm = gsap.matchMedia();

    mm.add("(min-width: 769px)", () => {
      // NOTE: This targets both standard and individual (ind) elements
      gsap.to(".tecnologias_video_gota, .tecnologias_video_gota.ind", {
        x: -48,
        y: 48,
        duration: 1,
        scrollTrigger: {
          trigger: ".tecnologias, .tecnologias_ind",
          start: "top center",
          end: "center center",
          toggleActions: "play none none reverse",
          scrub: true,
        },
        ease: "power1.out",
      });

      // NOTE: This targets both standard and individual (ind) containers
      gsap.to(".tecnologias_video_container, .tecnologias_video_container.ind", {
        height: 400,
        borderTopLeftRadius: "20px",
        borderTopRightRadius: "120px",
        borderBottomRightRadius: "20px",
        borderBottomLeftRadius: "120px",
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".tecnologias, .tecnologias_ind",
          start: "top center-=187px",
          end: "top top",
          toggleActions: "play none none reverse",
          scrub: true,
        }
      });
    });

    mm.add("(max-width: 768px)", () => {
      gsap.to(".tecnologias_video_gota, .tecnologias_video_gota.ind", {
        x: -24,
        y: 0,
        duration: 1,
        scrollTrigger: {
          trigger: ".tecnologias, .tecnologias_ind",
          start: "top center",
          end: "center center",
          toggleActions: "play none none reverse",
          scrub: true,
        },
        ease: "power1.out",
      });

      gsap.to(".tecnologias_video_container, .tecnologias_video_container.ind", {
        height: 340,
        borderTopLeftRadius: "15px",
        borderTopRightRadius: "80px",
        borderBottomRightRadius: "15px",
        borderBottomLeftRadius: "80px",
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".tecnologias, .tecnologias_ind",
          start: "top center-=100px",
          end: "top top",
          toggleActions: "play none none reverse",
          scrub: true,
        }
      });
    });
  }

  // ===================
  // CONTACT SECTION ANIMATIONS
  // ===================
  
  function initContactAnimations() {
    gsap.set([
      ".contato_back",
      ".section_title.just--left.main--contact",
      ".contato_main.maps",
      ".drop_line"
    ], { opacity: 1, visibility: "visible" });

    gsap.from(".contato_back", {
      opacity: 0,
      height: 384,
      duration: 3,
      ease: "power2.out",
      scrollTrigger: {
        trigger: ".contato, .contato_principal",
        start: "top center",
        toggleActions: "play none none reverse",
      }
    });

    gsap.from(".contato_main.maps", {
      x: "100vw",
      duration: 2,
     // delay: 1,
      ease: "power2.out",
      scrollTrigger: {
        trigger: ".contato, .contato_principal",
        start: "top center",
        toggleActions: "play none none reverse",
      }
    });
  }

  // ===================
  // HEADER MOBILE & DROP LINE ANIMATIONS
  // ===================
  
  function initHeaderAnimations() {
    gsap.to(".drop_secondary", {
      x: -12,
      y: -12,
      duration: 2,
      ease: "power2.out",
    });

    const dropPath = document.querySelector('.drop_line path');
    if (dropPath) {
      gsap.set(dropPath, { drawSVG: "0%" });
      
      gsap.timeline({
          scrollTrigger: {
            trigger: ".contato_principal",
            start: "top 80%",
            toggleActions: "play none none reverse"
          }
        })
        .to(dropPath, {
          drawSVG: "100%",
          duration: 2,
          ease: "power2.out"
        });
    }
  }
  
  // ===================
  // MARQUEE UTILITY (Moved up for clarity)
  // ===================
  
  function initScrollMarquee(container, direction) {
    const innerContainers = container.querySelectorAll('.marquee-inner');
    const firstInner = innerContainers[0];
    if (!firstInner) return;
    
    const totalWidth = firstInner.offsetWidth;
    const moveDistance = direction === 'left' ? `-=${totalWidth / 2}` : `+=${totalWidth / 2}`;

    gsap.to(innerContainers, {
      x: moveDistance,
      scrollTrigger: {
        trigger: ".testimonials",
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
      ease: "none",
    });
  }

  // ===================
  // HOME PAGE ANIMATIONS
  // ===================
  
  function initHomeAnimations() {
    const heroTitle = document.querySelector('#herotitle');
    const heroH2 = document.querySelector('#heroh2');
    const clinicaTitle = document.querySelector('.clinica_title');
    
    if (heroTitle && heroH2) {
      const text1 = SplitText.create('#herotitle', { types: 'words' });
      const text2 = SplitText.create('#heroh2', { types: 'lines' });

      const heroTextTL = gsap.timeline();

      heroTextTL
        .set(".hero_wrapper_right", { opacity: 1, visibility: "visible" })
        .from(text1.words, {
          opacity: 0,
          yPercent: 100,
          rotation: 5,
          duration: 1,
          stagger: 0.1,
          ease: "power1.out",
          force3D: true,
        }, "=0.2")
        .to({}, { duration: 0.1 })
        .from(text2.lines, {
          opacity: 0,
          yPercent: 100,
          duration: 1.5,
          stagger: 0.1,
          ease: "back.out(1)",
          force3D: true,
        }, ">-=1")
        .from(".cta_hero_wrapper", {
          opacity: 0,
          yPercent: 50,
          duration: 2.5,
          ease: "back.out(1)",
          force3D: true,
        }, "<");
    }

    if (document.querySelector(".drop_image_container")) {
      gsap.fromTo(".drop_image_container", { x: "100vw" }, {
        x: 0,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".full_session_social_proof",
          start: "top 70%",
          end: "top top",
          scrub: true
        }
      });

      ScrollTrigger.create({
        trigger: ".full_session_social_proof",
        start: "top top",
        endTrigger: ".tratamentos_principais",
        end: "bottom top",
        pin: ".drop_image_container",
        pinSpacing: false
      });

      gsap.fromTo(".drop_image_container", { x: 0 }, {
        x: "-260px",
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".tratamentos_principais",
          start: "top bottom",
          end: "top top",
          scrub: true
        }
      });

      gsap.to(".drop_image_container", {
        width: "424px",
        height: "328px",
        borderTopLeftRadius: "60px",
        borderTopRightRadius: "20px",
        borderBottomRightRadius: "60px",
        borderBottomLeftRadius: "20px",
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".tratamentos_principais",
          start: "top bottom",
          end: "top top",
          scrub: true
        }
      });

      gsap.to(".drop_image_container", {
        autoAlpha: 0,
        duration: 0.01,
        ease: "none",
        scrollTrigger: {
          trigger: ".cards-trigger",
          start: "top center-=218px",
          toggleActions: "play none none reverse",
        }
      });
    }

    let mm = gsap.matchMedia();

    mm.add("(min-width: 769px)", () => {
      if (document.querySelector(".card_tratamento.facial")) {
        gsap.set(".card_tratamento.facial", { autoAlpha: 0 });
        gsap.to(".card_tratamento.facial", {
          autoAlpha: 1,
          duration: 0.01,
          ease: "none",
          scrollTrigger: {
            trigger: ".cards-trigger",
            start: "top center-=218px",
            toggleActions: "play none none reverse"
          }
        });
      }
    });

    const cardTitleEl = document.querySelector('.card_title');
    if (cardTitleEl) {
      const cardTitle = SplitText.create('.card_title', { types: 'words, chars' });

      const cardTL = gsap.timeline({
        scrollTrigger: {
          trigger: ".cards-trigger",
          start: "top 30%",
          toggleActions: "play none none reverse",
        }
      });

      cardTL.from(cardTitle.chars, {
        opacity: 0,
        yPercent: 100,
        rotation: 5,
        duration: 1.5,
        stagger: 0.05,
        ease: "power1.out"
      });
    }

    if (document.querySelector(".card_tratamento_border")) {
      gsap.from(".card_tratamento_border", {
        width: "100%",
        height: "100%",
        duration: 1.5,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".cards-trigger",
          start: "top 20%",
          toggleActions: "play reverse play reverse"
        }
      });
    }

    if (document.querySelector(".card_tratamento.cabelo")) {
      gsap.from(".card_tratamento.cabelo", {
        x: 216,
        autoAlpha: 0,
        scale: 0.8,
        rotation: -8,
        duration: 2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".cards-trigger",
          start: "top center-=192px",
          toggleActions: "play none none reverse"
        }
      });
    }

    if (document.querySelector(".card_tratamento.corpo")) {
      gsap.from(".card_tratamento.corpo", {
        x: -216,
        autoAlpha: 0,
        scale: 0.8,
        rotation: 8,
        duration: 2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".cards-trigger",
          start: "top center-=192px",
          toggleActions: "play none none reverse"
        }
      });
    }

    if (clinicaTitle) {
      const clinicaTitleSplit = SplitText.create('.clinica_title', { types: 'words' });
      
      gsap.from(clinicaTitleSplit.words, {
        opacity: 0,
        yPercent: 100,
        rotation: 5,
        duration: 0.5,
        stagger: 0.1,
        scrollTrigger: {
          trigger: ".clinica_info",
          start: "top center",
          end: "bottom bottom",
          toggleActions: "play none none reverse",
        },
        ease: "power1.out",
      });
    }

    if (document.querySelector('.marquee_track')) {
      document.querySelectorAll('.marquee_track').forEach(track => {
        const isReverse = track.classList.contains('right');
        const originalRow = track.querySelector('.marquee_row');
        if (!originalRow) return;
        
        const oneRowWidth = originalRow.scrollWidth;
        const totalNeeded = Math.ceil((window.innerWidth + oneRowWidth) / oneRowWidth) + 1;

        track.innerHTML = '';

        for (let i = 0; i < totalNeeded; i++) {
          const clone = originalRow.cloneNode(true);
          track.appendChild(clone);
        }

        gsap.set(track, { force3D: true });

        if (isReverse) {
          gsap.set(track, { x: -oneRowWidth });
        }

        gsap.to(track, {
          x: isReverse ? 0 : -oneRowWidth,
          duration: 40,
          ease: "none",
          repeat: -1,
          force3D: true,
          modifiers: {
            x: gsap.utils.unitize(x => {
              const value = parseFloat(x);
              if (isReverse) {
                return value >= 0 ? -oneRowWidth : value;
              } else {
                return value <= -oneRowWidth ? 0 : value;
              }
            })
          }
        });
      });
    }

    if (document.querySelector(".info_colageno")) {
      let imageScrollTL = gsap.timeline({
        scrollTrigger: {
          trigger: ".info_colageno",
          start: "top bottom",
          end: "top top",
          scrub: true,
        }
      });

      imageScrollTL.from(".sticky_img_bottom", {
        y: 560,
        ease: "none"
      }, 0);

      imageScrollTL.to(".gota_grad .grad_stop_1", {
        stopColor: "#673593",
        ease: "none"
      }, 0);

      imageScrollTL.to(".gota_grad .grad_stop_2", {
        stopColor: "#8CD1C7",
        ease: "none"
      }, 0);

      imageScrollTL
        .to(".ball_grad_01", {
          opacity: 0,
          ease: "none"
        }, 0)
        .to(".ball_grad_02", {
          opacity: 0.8,
          ease: "none"
        }, 0);
    }

    if (document.querySelector(".back_rafaela")) {
      gsap.from(".back_rafaela", {
        height: 384,
        y: 12,
        duration: 3,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".salvato_section",
          start: "top center",
          toggleActions: "play none none reverse",
        }
      });
    }

    if (document.querySelector(".statement_span")) {
      gsap.from(".statement_span", {
        opacity: 0,
        yPercent: 100,
        rotation: 10,
        duration: 1,
        stagger: 0.2,
        scrollTrigger: {
          trigger: ".statement",
          start: "top 70%",
          end: "bottom center",
          toggleActions: "play none none reverse",
        },
        ease: "power1.out",
      });
    }

    if (document.querySelector(".statement_icon")) {
      gsap.from(".statement_icon", {
        opacity: 0,
        xPercent: -100,
        rotation: 10,
        duration: 2,
        stagger: 0.2,
        scrollTrigger: {
          trigger: ".statement",
          start: "top 70%",
          end: "bottom center",
          toggleActions: "play none none reverse",
        },
        ease: "power1.out",
      });
    }

    if (document.querySelector('.to-left')) {
      const marqueeLeft = document.querySelector('.to-left');
      initScrollMarquee(marqueeLeft, 'left');
    }

    if (document.querySelector('.to-right')) {
      const marqueeRight = document.querySelector('.to-right');
      initScrollMarquee(marqueeRight, 'right');
    }
  }

  // ===================
  // CLINICA/GALLERY/SECONDARY CARD ANIMATIONS (NEW FEATURES)
  // ===================
  
  function initNewPageAnimations() {
    // 1. HERO CLINICA - ANIMATION FOR 'clinica_hero_back_img'
    gsap.from(".clinica_hero_back_img", {
      height: 384,
      y: 12,
      duration: 3,
      ease: "power2.out",
    });

    // 2. GALERIA - ANIMATION FOR 'clinica-galeria-foto'
    gsap.set(".clinica-galeria-foto", {
      scale: 0.95,
      rotation: 1,
    });
    gsap.to(".clinica-galeria-foto", {
      scale: 1,
      rotation: 0,
      ease: "power2.out",
      stagger: 0.15,
      duration: 2,
      scrollTrigger: {
        trigger: ".clinica-galeria-foto",
        start: "top center",
        scrub: true
      }
    });

    // 3. TECNOLOGIAS BLOCKS - SplitText Animations
    const TecBlockTitle = document.querySelector('.sec_tec_card_title');
    if (TecBlockTitle) {
      const titleSplit = SplitText.create('.sec_tec_card_title', { types: 'words' });
      const parSplit = SplitText.create('.sec_tec_card_par', { types: 'lines' });

      const TecBlocksTL = gsap.timeline({
        scrollTrigger: {
          trigger: ".tecnologias_secondary_title",
          start: "top center",
        }
      });

      TecBlocksTL
        .from(titleSplit.words, {
          opacity: 0,
          yPercent: 100,
          rotation: 5,
          duration: 1,
          stagger: 0.1,
          ease: "power1.out"
        }, 0)
        .from(parSplit.lines, {
          opacity: 0,
          yPercent: 100,
          duration: 1,
          stagger: 0.1,
          ease: "back.out(1)"
        }, 0)
        .from(".sec_tec_card_ico", {
          opacity: 0,
          yPercent: 100,
          rotation: 5,
          duration: 1,
          stagger: 0.1,
          ease: "power2.out"
        }, 0);
    }

    // 4. CARDS SECOND LEVEL - 'trat_sec_card' Fade-in
    gsap.utils.toArray(".trat_sec_card").forEach((card) => {
      gsap.from(card, {
        opacity: 0,
        y: 50,
        rotation: 3,
        duration: 1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: card,
          start: "top 80%",
          toggleActions: "play none none none",
          once: true,
        }
      });
    });
  }

  // ===================
  // TECNOLOGIAS PAGE ANIMATIONS
  // ===================
  
  function initTecnologiasPage() {
    const heroH1 = document.querySelector('.heading-secondary');
    const heroP = document.querySelector('.hero_paragraph-secondary');
    
    if (heroH1) {
      const heroH1Split = SplitText.create('.heading-secondary', { types: 'words' });
      
      gsap.from(heroH1Split.words, {
        y: 50,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: "power2.out"
      });
    }

    if (heroP) {
      const heroPSplit = SplitText.create('.hero_paragraph-secondary', { types: 'lines' });
      
      gsap.from(heroPSplit.lines, {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: "power2.out"
      });
    }

    if (document.querySelector(".video_container_secondary")) {
      gsap.from(".video_container_secondary", {
        height: 384,
        y: 12,
        duration: 3,
        ease: "power2.out",
      });
    }

    if (document.querySelector(".cta_grad")) {
      gsap.from(".cta_grad", {
        opacity: 0,
        duration: 1.5,
        rotationZ: -8,
        ease: "back.out(1)"
      });
    }

    const tratamentoCards = document.querySelectorAll(".tratamento_card_single, .tratamento_individual_card_single");
    if (tratamentoCards.length > 0) {
      gsap.utils.toArray(".tratamento_card_single, .tratamento_individual_card_single").forEach((card, i, cards) => {
        if (i === cards.length - 1) return;

        let nextCard = cards[i + 1];

        gsap.timeline({
          scrollTrigger: {
            trigger: nextCard,
            start: "top center",
            end: "top top",
            scrub: true,
          }
        })
        .to(card, {
          scale: 0.9,
          rotationZ: 3,
          y: 100,
          opacity: 0,
          ease: "none"
        });
      });
    }

    if (document.querySelector(".veja_tambem_card")) {
      gsap.set(".veja_tambem_card", {
        height: 192,
      });

      gsap.to(".veja_tambem_card", {
        height: 286,
        duration: 1,
        stagger: 0.2,
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: ".veja_tambem",
          start: "top 70%",
          toggleActions: "play none none none",
          once: true,
        }
      });
    }

    if (document.querySelector(".todos_tratamentos_chip")) {
      gsap.set(".todos_tratamentos_chip", {
        width: 86,
      });

      gsap.to(".todos_tratamentos_chip", {
        width: 200,
        duration: 1,
        stagger: 0.1,
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: ".todos_os_tratamentos",
          start: "top 70%",
          toggleActions: "play none none none",
          once: true,
        }
      });
    }
  }

  // ===================
  // LENIS RAF LOOP
  // ===================
  
  function initRAF() {
    function raf(time) {
      lenis.raf(time);
      // NOTE: ScrollTrigger.update() is essential for GSAP ScrollTrigger to work with Lenis
      ScrollTrigger.update(); 
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // ===================
  // INITIALIZE ALL FUNCTIONS
  // ===================
  
  function init() {
    initMegaMenu();
    initDropdownAnimation();
    initNavbarScroll();
    initSectionTitles();
    initTecnologiasAnimations();
    initContactAnimations();
    initHeaderAnimations();
    initHomeAnimations();
    initTecnologiasPage();
    // NEW FUNCTION CALL ADDED HERE 👇
    initNewPageAnimations(); 
    initRAF();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
// NOTE: ALL CODE BELOW THIS LINE HAS BEEN REMOVED TO PREVENT CONFLICTS AND REDUNDANCY. 
// The functionalities have been safely moved into the structure above.