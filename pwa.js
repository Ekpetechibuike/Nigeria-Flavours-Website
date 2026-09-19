let deferredPrompt = null;
const installButton = document.getElementById('installAppBtn');

if (installButton) {
  installButton.classList.remove('hidden');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;

  if (installButton) {
    installButton.classList.remove('hidden');
    installButton.textContent = 'Install App';
  }
});

window.addEventListener('appinstalled', () => {
  if (installButton) {
    installButton.classList.add('hidden');
  }
  deferredPrompt = null;
});

if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
      installButton.textContent = 'Install available in supported browsers';
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Install prompt outcome:', outcome);
    deferredPrompt = null;
    installButton.classList.add('hidden');
  });
}

if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
  if (installButton) {
    installButton.classList.add('hidden');
  }
}
