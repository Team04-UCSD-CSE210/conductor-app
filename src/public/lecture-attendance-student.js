(function() {
  function initHamburger() {
    const hamburger = document.querySelector('.hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    if (!hamburger || !sidebar) return;

    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!isOpen));
      sidebar.classList.toggle('open');
      body.classList.toggle('menu-open');
    });

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 &&
          sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !hamburger.contains(e.target)) {
        hamburger.setAttribute('aria-expanded', 'false');
        sidebar.classList.remove('open');
        body.classList.remove('menu-open');
      }
    });
  }

  function initContactButtons() {
    const contactTA = document.getElementById('contact-ta');
    const contactProfessor = document.getElementById('contact-professor');

    if (contactTA) {
      contactTA.addEventListener('click', () => {
        console.log('Contact TA clicked');
      });
    }

    if (contactProfessor) {
      contactProfessor.addEventListener('click', () => {
        console.log('Contact Professor clicked');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initHamburger();
      initContactButtons();
    });
  } else {
    initHamburger();
    initContactButtons();
  }
})();

