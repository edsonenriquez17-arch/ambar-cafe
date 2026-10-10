(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = matchMedia('(min-width: 901px)');
  const IMG = id => `https://images.unsplash.com/${id}?w=700&q=80&auto=format&fit=crop`;

  // Newsletter (sin backend: confirmación local)
  $('#newsletter').addEventListener('submit', e => {
    e.preventDefault();
    $('#nlOk').hidden = false;
    e.target.reset();
  });

  // Split del manifiesto en palabras
  $$('.split-words').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
  });

  // Sin GSAP o con movimiento reducido: mostrar todo estático
  if (!window.gsap || reduced) {
    $('#loader').remove();
    $$('.line > span').forEach(s => (s.style.transform = 'none'));
    $$('.manifesto__text .w').forEach(w => (w.style.opacity = 1));
    $('.hero__media img').style.transform = 'none';
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  document.body.classList.add('is-loading');

  // Smooth scroll
  let lenis;
  if (window.Lenis) {
    lenis = new Lenis({ duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(id, { offset: 0 }) : $(id).scrollIntoView({ behavior: 'smooth' });
  }));

  // ---------- Loader → Hero intro ----------
  gsap.set('.reveal-up', { y: 30, opacity: 0 });
  const counter = { v: 0 };
  gsap.timeline()
    .to('.loader__word span', { y: 0, duration: 1, stagger: .07, ease: 'expo.out' })
    .to(counter, { v: 100, duration: 1.6, ease: 'power2.inOut', onUpdate: () => ($('#count').textContent = Math.round(counter.v)) }, 0)
    .to('.loader__word span', { y: '-110%', duration: .7, stagger: .05, ease: 'expo.in' })
    .to('#loader', { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '-=.3')
    .add(() => { $('#loader').remove(); document.body.classList.remove('is-loading'); lenis && lenis.start(); })
    .to('.hero__media img', { scale: 1, duration: 2.2, ease: 'expo.out' }, '-=.9')
    .to('.hero__title .line > span', { y: 0, duration: 1.4, stagger: .12, ease: 'expo.out' }, '<.1')
    .to('.reveal-up', { y: 0, opacity: 1, duration: 1, stagger: .1, ease: 'power3.out' }, '<.4');

  // Hero parallax de salida
  gsap.to('.hero__media img', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__title', { yPercent: -30, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // ---------- Nav ----------
  let lastY = 0;
  ScrollTrigger.create({
    onUpdate: self => {
      const y = self.scroll();
      $('#nav').classList.toggle('is-solid', y > 80);
      $('#nav').classList.toggle('is-hidden', y > lastY && y > 400);
      lastY = y;
    }
  });

  // ---------- Manifiesto palabra por palabra ----------
  gsap.to('.manifesto__text .w', {
    opacity: 1, stagger: .1, ease: 'none',
    scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'bottom 60%', scrub: true }
  });

  // ---------- Recorrido horizontal (solo desktop) ----------
  ScrollTrigger.matchMedia({
    '(min-width: 901px)': () => {
      const track = $('.journey__track');
      const dist = () => track.scrollWidth - innerWidth;
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '.journey', pin: true, scrub: 1, end: () => '+=' + dist(), invalidateOnRefresh: true }
      });
      $$('.panel__img img').forEach(img => gsap.fromTo(img, { xPercent: -8 }, {
        xPercent: 8, ease: 'none',
        scrollTrigger: { trigger: img.closest('.panel'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
      }));
    }
  });

  // ---------- Títulos de sección ----------
  $$('.h2, .visit__title').forEach(h => gsap.from(h, {
    y: 80, opacity: 0, duration: 1.4, ease: 'expo.out',
    scrollTrigger: { trigger: h, start: 'top 85%' }
  }));
  gsap.from('.menu__item', { y: 40, opacity: 0, duration: 1, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '.menu__list', start: 'top 80%' } });
  gsap.from('.bean', { y: 100, opacity: 0, duration: 1.4, stagger: .15, ease: 'expo.out', scrollTrigger: { trigger: '.beans__grid', start: 'top 80%' } });
  gsap.from('.visit__cols > div, .visit .btn', { y: 30, opacity: 0, duration: 1, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '.visit__cols', start: 'top 85%' } });

  // Parallax galería + fondo visita
  $$('[data-speed]').forEach(img => gsap.to(img, {
    yPercent: +img.dataset.speed, ease: 'none',
    scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
  }));
  gsap.fromTo('.visit__bg img', { scale: 1.2 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.visit', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  gsap.from('.footer__big', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  // ---------- Cursor ----------
  const cursor = $('#cursor');
  const cx = gsap.quickTo(cursor, 'x', { duration: .25, ease: 'power3' });
  const cy = gsap.quickTo(cursor, 'y', { duration: .25, ease: 'power3' });
  const float = $('#menuFloat');
  const fx = gsap.quickTo(float, 'x', { duration: .6, ease: 'power3' });
  const fy = gsap.quickTo(float, 'y', { duration: .6, ease: 'power3' });
  addEventListener('mousemove', e => { cx(e.clientX); cy(e.clientY); fx(e.clientX); fy(e.clientY); });
  $$('.bean, .panel').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('is-big'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('is-big'));
  });

  // ---------- Carta: imagen flotante ----------
  $$('.menu__item').forEach(item => {
    const pre = new Image(); pre.src = IMG(item.dataset.img);
    item.addEventListener('mouseenter', () => {
      float.src = IMG(item.dataset.img);
      gsap.to(float, { opacity: 1, scale: 1, rotate: gsap.utils.random(-6, 6), duration: .5, ease: 'power3.out' });
    });
    item.addEventListener('mouseleave', () => gsap.to(float, { opacity: 0, scale: .8, duration: .4, ease: 'power3.out' }));
  });

  // ---------- Botones magnéticos ----------
  $$('.magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * .35, y: (e.clientY - r.top - r.height / 2) * .35, duration: .4, ease: 'power3.out' });
    });
    btn.addEventListener('mouseleave', () => gsap.to(btn, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1, .4)' }));
  });

  addEventListener('load', () => ScrollTrigger.refresh());
  desktop.addEventListener('change', () => ScrollTrigger.refresh());
})();
