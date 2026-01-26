
// Create animated particles
const particlesContainer = document.getElementById('particles');
for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 15 + 's';
    particle.style.animationDuration = (15 + Math.random() * 10) + 's';
    particlesContainer.appendChild(particle);
}

// DOM Elements
const video = document.getElementById('videoFeed');
const canvas = document.getElementById('canvas');
const baseURL = document.getElementById('baseURL');
const instructionText = document.getElementById('instructionText');
const responseText = document.getElementById('responseText');
const intervalSelect = document.getElementById('intervalSelect');
const startButton = document.getElementById('startButton');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const loadingIndicator = document.getElementById('loadingIndicator');
const requestCount = document.getElementById('requestCount');
const avgResponse = document.getElementById('avgResponse');
const uptimeDisplay = document.getElementById('uptime');

// Set default instruction
instructionText.value = "What do you see?";

// State variables
let stream;
let intervalId;
let isProcessing = false;
let requests = 0;
let totalResponseTime = 0;
let startTime;
let uptimeInterval;

/**
 * Update the status badge with current state
 */
function updateStatus(status, text) {
    statusDot.className = 'status-dot ' + status;
    statusText.textContent = text;
}

/**
 * Update statistics display
 */
function updateStats(responseTime) {
    requests++;
    totalResponseTime += responseTime;
    requestCount.textContent = requests;
    avgResponse.textContent = Math.round(totalResponseTime / requests) + 'ms';
}

/**
 * Update uptime counter
 */
function updateUptime() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    uptimeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Send chat completion request to API
 */
async function sendChatCompletionRequest(instruction, imageBase64URL) {
    const startRequestTime = Date.now();
    
    const response = await fetch(`${baseURL.value}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            max_tokens: 100,
            messages: [
                { 
                    role: 'user', 
                    content: [
                        { type: 'text', text: instruction },
                        { 
                            type: 'image_url', 
                            image_url: {
                                url: imageBase64URL,
                            } 
                        }
                    ] 
                },
            ]
        })
    });
    
    const responseTime = Date.now() - startRequestTime;
    
    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorData}`);
    }
    
    const data = await response.json();
    updateStats(responseTime);
    return data.choices[0].message.content;
}

/**
 * Initialize camera on page load
 */
async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        updateStatus('', 'Ready');
        responseText.value = "Camera access granted. Ready to start processing.";
    } catch (err) {
        console.error("Error accessing camera:", err);
        updateStatus('inactive', 'Camera Error');
        responseText.value = `Error accessing camera: ${err.name} - ${err.message}. Please ensure permissions are granted and you are on HTTPS or localhost.`;
        alert(`Error accessing camera: ${err.name}. Make sure you've granted permission and are on HTTPS or localhost.`);
    }
}

/**
 * Capture current video frame as base64 image
 */
function captureImage() {
    if (!stream || !video.videoWidth) {
        console.warn("Video stream not ready for capture.");
        return null;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Send captured image and instruction to API
 */
async function sendData() {
    if (!isProcessing) return;

    const instruction = instructionText.value;
    const imageBase64URL = captureImage();

    if (!imageBase64URL) {
        responseText.value = "Failed to capture image. Stream might not be active.";
        return;
    }

    loadingIndicator.classList.add('active');

    try {
        const response = await sendChatCompletionRequest(instruction, imageBase64URL);
        responseText.value = response;
        updateStatus('processing', 'Processing');
    } catch (error) {
        console.error('Error sending data:', error);
        responseText.value = `Error: ${error.message}`;
        updateStatus('inactive', 'Error');
    } finally {
        loadingIndicator.classList.remove('active');
    }
}

/**
 * Start processing loop
 */
function handleStart() {
    if (!stream) {
        responseText.value = "Camera not available. Cannot start.";
        alert("Camera not available. Please grant permission first.");
        return;
    }
    
    isProcessing = true;
    startButton.innerHTML = '<span>Stop Processing</span>';
    startButton.classList.remove('start');
    startButton.classList.add('stop');

    instructionText.disabled = true;
    intervalSelect.disabled = true;
    baseURL.disabled = true;

    updateStatus('processing', 'Active');
    responseText.value = "Processing started...";

    startTime = Date.now();
    uptimeInterval = setInterval(updateUptime, 1000);

    const intervalMs = parseInt(intervalSelect.value, 10);
    sendData();
    intervalId = setInterval(sendData, intervalMs);
}

/**
 * Stop processing loop
 */
function handleStop() {
    isProcessing = false;
    
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
    }
    
    startButton.innerHTML = '<span>Start Processing</span>';
    startButton.classList.remove('stop');
    startButton.classList.add('start');

    instructionText.disabled = false;
    intervalSelect.disabled = false;
    baseURL.disabled = false;
    
    updateStatus('', 'Ready');
    
    if (responseText.value.startsWith("Processing started...")) {
        responseText.value = "Processing stopped.";
    }
}

// Event Listeners
startButton.addEventListener('click', () => {
    if (isProcessing) {
        handleStop();
    } else {
        handleStart();
    }
});

window.addEventListener('DOMContentLoaded', initCamera);

window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (intervalId) {
        clearInterval(intervalId);
    }
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
    }
});
