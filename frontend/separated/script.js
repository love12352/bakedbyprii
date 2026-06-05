/* =========================================================
   Sugar & Crumb — Home Bakery  ·  script.js
   Loaded at the end of <body>, so the DOM is ready.
   Wrapped in an IIFE to keep variables off the global scope.
   ========================================================= */
(function () {
  'use strict';

  /* -------------------------------------------------------
     DATA — edit prices / items / photos here
     ------------------------------------------------------- */
  var IMG = 'https://images.unsplash.com/';
  var Q = '?auto=format&fit=crop&w=600&q=80';
  var PRODUCTS = [
    { cat:'cookies', emoji:'🍪', img:IMG+'photo-1499636136210-6f4ee915583e'+Q, name:'Classic Choc-Chip', desc:'Brown-butter cookies loaded with dark chocolate.', price:180, unit:'/ box of 6', tag:'Bestseller', tagClass:'' },
    { cat:'cookies', emoji:'🍫', img:IMG+'photo-1558961363-fa8fdf82db35'+Q, name:'Double Chocolate', desc:'Fudgy cocoa cookies with melty chunks.', price:200, unit:'/ box of 6', tag:'', tagClass:'' },
    { cat:'cookies', emoji:'🥜', img:IMG+'photo-1490567674331-72de84996ff1'+Q, name:'Peanut Butter', desc:'Soft, nutty &amp; lightly salted.', price:190, unit:'/ box of 6', tag:'Veg', tagClass:'veg' },
    { cat:'cakes', emoji:'🎂', img:IMG+'photo-1535141192574-5d4897c12636'+Q, name:'Classic Vanilla', desc:'Soft vanilla sponge with silky buttercream.', price:650, unit:'/ 500g', tag:'', tagClass:'' },
    { cat:'cakes', emoji:'🍰', img:IMG+'photo-1606890658317-7d14490b76fd'+Q, name:'Chocolate Truffle', desc:'Rich chocolate layers &amp; ganache drip.', price:750, unit:'/ 500g', tag:'Bestseller', tagClass:'' },
    { cat:'cakes', emoji:'🍓', img:IMG+'photo-1586788680434-30d324b2d46f'+Q, name:'Red Velvet', desc:'Velvety cocoa cake with cream cheese frosting.', price:800, unit:'/ 500g', tag:'New', tagClass:'new' },
    { cat:'cupcakes', emoji:'🧁', img:IMG+'photo-1614707267537-b85aaf00c4b7'+Q, name:'Vanilla Swirl', desc:'Fluffy sponge, classic buttercream swirl.', price:240, unit:'/ set of 6', tag:'', tagClass:'' },
    { cat:'cupcakes', emoji:'🍫', img:IMG+'photo-1599785209707-a456fc1337bb'+Q, name:'Choco Overload', desc:'Chocolate cupcake topped with ganache.', price:280, unit:'/ set of 6', tag:'Bestseller', tagClass:'' },
    { cat:'cupcakes', emoji:'🍒', img:IMG+'photo-1563729784474-d77dbb933a9e'+Q, name:'Berry Bliss', desc:'Berry-kissed sponge &amp; whipped frosting.', price:300, unit:'/ set of 6', tag:'New', tagClass:'new' }
  ];

  // Live menu — starts as the offline fallback above, replaced by the API if reachable.
  var products = PRODUCTS;

  // The API sends `tag` but not `tagClass`; derive the CSS modifier from the tag text.
  function tagClassFor(tag) {
    tag = (tag || '').toLowerCase();
    return tag === 'veg' ? 'veg' : tag === 'new' ? 'new' : '';
  }

  /* IntersectionObserver — declared up top so the early render() call
     to observeReveals() never hits the temporal-dead-zone error. */
  var io;
  var grid = document.getElementById('menuGrid');

  /* -------------------------------------------------------
     Render products
     ------------------------------------------------------- */
  function render(filter) {
    filter = filter || 'all';
    grid.innerHTML = products
      .filter(function (p) { return filter === 'all' || p.cat === filter; })
      .map(function (p, i) {
        return ''
          + '<article class="product" data-reveal data-delay="' + ((i % 3) + 1) + '" data-cat="' + p.cat + '">'
          +   '<div class="thumb">'
          +     (p.tag ? '<span class="tag ' + tagClassFor(p.tag) + '">' + p.tag + '</span>' : '')
          +     '<span class="fallback"><span>' + p.emoji + '</span></span>'
          +     '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy" />'
          +   '</div>'
          +   '<h4>' + p.name + '</h4>'
          +   '<p class="desc">' + p.desc + '</p>'
          +   '<div class="row">'
          +     '<div class="price">₹' + p.price + ' <small>' + p.unit + '</small></div>'
          +     '<button class="add" aria-label="Add ' + p.name + '" data-name="' + p.name + '">+</button>'
          +   '</div>'
          + '</article>';
      })
      .join('');
    observeReveals();
    tiltInit();
    bindImages();
  }

  /* -------------------------------------------------------
     Image loading: fade in on load, fall back to emoji on error
     ------------------------------------------------------- */
  function bindImages(scope) {
    (scope || document).querySelectorAll('img:not([data-bound])').forEach(function (img) {
      img.dataset.bound = '1';
      var done = function () { img.classList.add('loaded'); };
      var fail = function () { img.style.display = 'none'; }; // reveals emoji / gradient fallback behind it
      if (img.complete && img.naturalWidth > 0) { done(); }
      else if (img.complete && img.naturalWidth === 0) { fail(); }
      img.addEventListener('load', done);
      img.addEventListener('error', fail);
    });
  }

  /* -------------------------------------------------------
     Scroll reveal (IntersectionObserver + safety net)
     ------------------------------------------------------- */
  function observeReveals() {
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.15 });
    }
    document.querySelectorAll('[data-reveal]:not(.in)').forEach(function (el) { io.observe(el); });
  }

  // Fallback: if IntersectionObserver never fires (headless/old browsers),
  // reveal anything in or above the viewport so content is never stuck hidden.
  function revealFallback() {
    document.querySelectorAll('[data-reveal]:not(.in)').forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight + 120) el.classList.add('in');
    });
  }

  /* -------------------------------------------------------
     3D tilt on product cards
     ------------------------------------------------------- */
  function tiltInit() {
    document.querySelectorAll('.product').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(700px) rotateX(' + (-y * 8) + 'deg) rotateY(' + (x * 10) + 'deg) translateY(-6px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* -------------------------------------------------------
     Toast
     ------------------------------------------------------- */
  var toast = document.getElementById('toast');
  var toastT;
  function showToast(msg) {
    toast.querySelector('span').textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove('show'); }, 3200);
  }

  /* =======================================================
     WIRE EVERYTHING UP
     ======================================================= */
  render();          // builds the menu from the PRODUCTS array above
  bindImages();
  observeReveals();

  // reveal fallbacks
  window.addEventListener('scroll', revealFallback, { passive: true });
  window.addEventListener('load', function () { setTimeout(revealFallback, 600); });
  setTimeout(revealFallback, 1500);

  // Filters
  document.getElementById('filters').addEventListener('click', function (e) {
    var btn = e.target.closest('.filter');
    if (!btn) return;
    document.querySelectorAll('.filter').forEach(function (f) { f.classList.remove('active'); });
    btn.classList.add('active');
    render(btn.dataset.filter);
  });

  // Add-to-order feedback
  grid.addEventListener('click', function (e) {
    var add = e.target.closest('.add');
    if (!add) return;
    showToast('🧺 ' + add.dataset.name + ' added — finish in the order form!');
    document.getElementById('item').focus({ preventScroll: true });
  });

  // Navbar + progress bar + plate parallax
  var nav = document.getElementById('nav');
  var progress = document.getElementById('progress');
  var plate = document.getElementById('plate');
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    nav.classList.toggle('scrolled', y > 30);
    var h = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (y / h * 100) + '%';
    if (plate) plate.style.transform = 'translateY(' + (y * 0.06) + 'px) rotate(' + (y * 0.02) + 'deg)';
  }, { passive: true });

  // Mobile menu
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  burger.addEventListener('click', function () {
    burger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      burger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });

  // Counters
  var counters = document.querySelectorAll('[data-count]');
  var cObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target, target = +el.dataset.count, suffix = el.dataset.suffix || '';
      var n = 0, step = Math.max(1, target / 45);
      var tick = function () {
        n += step;
        if (n >= target) { el.textContent = target + suffix; }
        else { el.textContent = Math.floor(n) + suffix; requestAnimationFrame(tick); }
      };
      tick();
      cObs.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach(function (c) { cObs.observe(c); });
  // counter fallback if IO doesn't fire
  setTimeout(function () {
    counters.forEach(function (el) {
      if (el.textContent === '0') el.textContent = el.dataset.count + (el.dataset.suffix || '');
    });
  }, 1600);

  // Custom cursor
  var dot = document.getElementById('cDot'), ring = document.getElementById('cRing');
  var mx = 0, my = 0, rx = 0, ry = 0;
  window.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  });
  (function loop() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    requestAnimationFrame(loop);
  })();
  document.querySelectorAll('a,button,.cat-card,.product').forEach(function (el) {
    el.addEventListener('mouseenter', function () { ring.classList.add('hovering'); });
    el.addEventListener('mouseleave', function () { ring.classList.remove('hovering'); });
  });

  // Order form (front-end only — shows a confirmation; no server needed)
  var form = document.getElementById('orderForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    showToast('🎉 Order received! We\'ll be in touch very soon.');
    form.reset();
  });

  // Footer year + min order date = today
  document.getElementById('year').textContent = new Date().getFullYear();
  var dateInput = document.getElementById('date');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

})();
