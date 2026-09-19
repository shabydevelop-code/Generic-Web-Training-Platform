// Shared Mobile Back Button & Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
  // Splash Screen Dismissal to prevent FOUC
  const splash = document.getElementById('splash-screen');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hidden');
    }, 250);
  }

  // Mobile Hardware Back-Button Logic
  window.addEventListener('popstate', (e) => {
    console.log('[PeopleSoft CRM] Back button detected:', window.location.pathname);
  });

  // Touch / Swipe Navigation Gesture (Right swipe goes to previous page in menu)
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      // Horizontal swipe threshold
      if (Math.abs(deltaX) > 100 && Math.abs(deltaY) < 60) {
        const pages = ['site.html', 'ticket.html', 'leads.html', 'customer360.html'];
        const currentPath = window.location.pathname.split('/').pop();
        const currentIndex = pages.indexOf(currentPath);
        if (currentIndex !== -1) {
          if (deltaX > 0 && currentIndex > 0) {
            // Swipe right in RTL -> Next or Prev
            window.location.href = pages[currentIndex - 1];
          } else if (deltaX < 0 && currentIndex < pages.length - 1) {
            window.location.href = pages[currentIndex + 1];
          }
        }
      }
    }
  }, { passive: true });
});
