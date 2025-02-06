document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      // Redirect to the Discord OAuth route
      window.location.href = '/auth/discord';
    });
  }
});
