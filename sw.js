// ==========================================
// MOBILE CHROME BACKGROUND MANAGEMENT ENGINE
// ==========================================
const CACHE_NAME = 'ai-todo-v1';
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './style.css'
];

// Install cache assets for absolute offline operation capability
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Intercept background requests
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});

// Background Check Event (Triggers an alarm push notification on the device)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'TRIGGER_REMINDER') {
        const userName = event.data.user;
        const taskCount = event.data.count;

        self.registration.showNotification(`AI Agenda Alert!`, {
            body: `Hello ${userName}, you have ${taskCount} urgent tasks scheduled for today. Tap to open and hear your agenda.`,
            icon: 'icon.png', // Optional icon anchor placeholder
            vibrate: [200, 100, 200], // Mobile phone physical hardware vibration pattern alert
            requireInteraction: true // Keeps notification visible on lock screen until swiped/tapped
        });
    }
});