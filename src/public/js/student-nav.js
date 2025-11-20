/**
 * Student Navigation Helper
 * Sets active navigation link based on current URL
 * Include this script on all student pages
 */

(function() {
  'use strict';
  
  function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.sidebar nav a');
    
    navLinks.forEach(link => {
      link.classList.remove('active');
      const linkPath = new URL(link.href, window.location.origin).pathname;
      
      // Set active if current path matches link path
      // Handle lecture-attendance-student and student-lecture-response both highlighting "Lectures"
      if (currentPath === linkPath || 
          (linkPath === '/lecture-attendance-student' && 
           (currentPath.startsWith('/lecture-attendance-student') || 
            currentPath.startsWith('/student-lecture-response')))) {
        link.classList.add('active');
      }
    });
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setActiveNavLink);
  } else {
    setActiveNavLink();
  }
})();

