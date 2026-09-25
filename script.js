// ==========================================
// 1. STATE & GLOBAL VARIABLES
// ==========================================
let appState = {
    userName: localStorage.getItem('todo_user_name') || '',
    theme: localStorage.getItem('todo_theme') || 'dark-theme',
    tasks: JSON.parse(localStorage.getItem('todo_tasks')) || [],
    editingTaskId: null
};

const DOM = {
    body: document.body,
    themeToggle: document.getElementById('theme-toggle'),
    profileContainer: document.getElementById('profile-container'),
    userNameInput: document.getElementById('user-name-input'),
    saveProfileBtn: document.getElementById('save-profile-btn'),
    todoForm: document.getElementById('todo-form'),
    todoText: document.getElementById('todo-text'),
    dateContainer: document.getElementById('date-picker-container'),
    todoDate: document.getElementById('todo-date'),
    todoList: document.getElementById('todo-list'),
    micBtn: document.getElementById('mic-btn'),
    voiceInstruction: document.getElementById('voice-instruction'),
    aiStatus: document.getElementById('ai-status'),
    addBtn: document.getElementById('add-btn')
};

window.hasGreeted = false;

// ==========================================
// 2. MASTER CONTROLLER & RENDER PIPELINE
// ==========================================
function renderApp() {
    // A. Sync State to Storage
    localStorage.setItem('todo_theme', appState.theme);
    localStorage.setItem('todo_tasks', JSON.stringify(appState.tasks));

    // B. Handle Theme Syncing (Fixed: Direct string override handles style updates smoothly)
    DOM.body.className = appState.theme;
    DOM.themeToggle.textContent = appState.theme === 'dark-theme' ? '🌙 Dark Mode' : '☀️ Light Mode';

    // C. Handle Profile Onboarding Visibility
    if (appState.userName) {
        DOM.profileContainer.style.display = 'none';
        DOM.todoForm.style.display = 'block';
        
        // Return Voice Greeting Handler
        if (!window.hasGreeted) {
            window.hasGreeted = true; 
            const greetingPhrase = `Welcome back, ${appState.userName}. How can I assist you with your schedule today?`;
            
            setTimeout(() => {
                speakAI(greetingPhrase);
                if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
                    DOM.voiceInstruction.textContent = "💡 Click anywhere on the screen to unlock AI voice assistant.";
                }
            }, 300);

            const unlockVoiceClick = () => {
                if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
                    speakAI(greetingPhrase);
                }
                DOM.voiceInstruction.textContent = "Click the mic to speak your tasks.";
                document.removeEventListener('click', unlockVoiceClick);
            };
            document.addEventListener('click', unlockVoiceClick);
        }
    } else {
        DOM.profileContainer.style.display = 'block';
        DOM.todoForm.style.display = 'none';
    }

    // D. CHRONOLOGICAL SORTING & DOM LIST DRAWING
    DOM.todoList.innerHTML = ''; 

    appState.tasks.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date) - new Date(b.date);
    });

    appState.tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'task-details';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'task-title';
        titleSpan.textContent = task.text;

        const dateSpan = document.createElement('span');
        dateSpan.className = 'task-date';
        dateSpan.textContent = task.date ? '📅 ' + task.date : '📅 No set date';

        detailsDiv.appendChild(titleSpan);
        detailsDiv.appendChild(dateSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'task-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => handleEditTask(task.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => handleDeleteTask(task.id));

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(detailsDiv);
        li.appendChild(actionsDiv);
        DOM.todoList.appendChild(li);
    });

        // E. INTELLIGENT DAILY TASK REMINDER ENGINE
    if (appState.tasks.length > 0) {
        const todayStr = new Date().toLocaleDateString('sv'); 
        const todaysTasks = appState.tasks.filter(task => task.date === todayStr);
        
        if (todaysTasks.length > 0) {
            // 1. Standard Audio Alert if the page is currently actively open
            if (!window.hasRemindedToday) {
                window.hasRemindedToday = true;
                const taskWord = todaysTasks.length === 1 ? "task" : "tasks";
                const taskNames = todaysTasks.map(t => t.text).join(", and ");
                
                setTimeout(() => {
                    speakAI(`Attention ${appState.userName}, you have ${todaysTasks.length} urgent ${taskWord} scheduled for today: ${taskNames}.`);
                }, 1500);
            }

            // 2. BACKGROUND COMMUNICATION LINK: Passes details to Chrome Service Worker
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'TRIGGER_REMINDER',
                    user: appState.userName,
                    count: todaysTasks.length
                });
            }
        }
    }


}

// ==========================================
// 3. VOICE SYNTHESIS CORE
// ==========================================
function speakAI(textText) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textText);
        utterance.rate = 0.95;
        const voices = window.speechSynthesis.getVoices();
        const premiumVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Natural')) 
                           || voices.find(v => v.lang.startsWith('en-')) || voices;
        if (premiumVoice) utterance.voice = premiumVoice;
        window.speechSynthesis.speak(utterance);
    }
}

// ==========================================
// 4. TASK CORE LOGIC ACTIONS
// ==========================================
DOM.todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const taskText = DOM.todoText.value.trim();
    const taskDate = DOM.todoDate.value;

    if (!taskText) return;

    if (appState.editingTaskId !== null) {
        const taskIndex = appState.tasks.findIndex(t => t.id === appState.editingTaskId);
        if (taskIndex !== -1) {
            appState.tasks[taskIndex].text = taskText;
            appState.tasks[taskIndex].date = taskDate;
            speakAI(`Updated task: ${taskText}`);
        }
        appState.editingTaskId = null;
        DOM.addBtn.textContent = "Add To-Do Task";
    } else {
        const newTask = {
            id: Date.now(),
            text: taskText,
            date: taskDate
        };
        appState.tasks.push(newTask);
        speakAI(`Added task: ${taskText}`);
    }

    DOM.todoForm.reset();
    DOM.dateContainer.style.display = 'none';
    renderApp();
});

function handleDeleteTask(taskId) {
    appState.tasks = appState.tasks.filter(task => task.id !== taskId);
    renderApp();
}

function handleEditTask(taskId) {
    const targetTask = appState.tasks.find(task => task.id === taskId);
    if (targetTask) {
        DOM.todoText.value = targetTask.text;
        DOM.todoDate.value = targetTask.date;
        DOM.dateContainer.style.display = 'block';
        
        appState.editingTaskId = taskId;
        DOM.addBtn.textContent = "Update Task Info";
        DOM.todoText.focus();
    }
}

DOM.todoText.addEventListener('input', () => {
    const hasText = DOM.todoText.value.trim().length > 0;
    DOM.dateContainer.style.display = hasText ? 'block' : 'none';
    if (hasText && !DOM.todoDate.value) {
        DOM.todoDate.value = new Date().toISOString().split('T')[0];
    }
});

DOM.saveProfileBtn.addEventListener('click', () => {
    const enteredName = DOM.userNameInput.value.trim();
    if (enteredName) {
        appState.userName = enteredName;
        localStorage.setItem('todo_user_name', enteredName);
        speakAI(`Welcome, ${appState.userName}. I am your intelligent task assistant. Let's start organizing your day.`);
        window.hasGreeted = true;
        renderApp();
    }
});

// Theme Switcher Toggle Hook
DOM.themeToggle.addEventListener('click', () => {
    appState.theme = appState.theme === 'dark-theme' ? 'light-theme' : 'dark-theme';
    renderApp();
});

// ==========================================
// 5. VOICE AGENT MIC RECOGNITION INTERFACE
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    let isListening = false;

    DOM.micBtn.addEventListener('click', () => {
        if (!isListening) {
            recognition.start();
        } else {
            recognition.stop();
        }
    });

    recognition.onstart = () => {
        isListening = true;
        DOM.aiStatus.textContent = "AI Listening...";
        DOM.voiceInstruction.textContent = "🎙️ I'm listening. Speak your task name now...";
    };

    recognition.onend = () => {
        isListening = false;
        DOM.aiStatus.textContent = "AI Ready";
        DOM.voiceInstruction.textContent = "Click the mic to speak your tasks.";
    };

    recognition.onresult = (event) => {
        let spokenText = event.results[0][0].transcript; // Fixed: Accurately fetches the transcript item index
        console.log("AI Agent Heard: ", spokenText);

        let taskText = spokenText;
        let taskDate = new Date();
        const lowerSpoken = spokenText.toLowerCase();

        // Smart voice-to-calendar calculation mapping
        if (lowerSpoken.includes('tomorrow')) {
            taskDate.setDate(taskDate.getDate() + 1);
            taskText = lowerSpoken.replace('tomorrow', '').trim();
        } else if (lowerSpoken.includes('next week')) {
            taskDate.setDate(taskDate.getDate() + 7);
            taskText = lowerSpoken.replace('next week', '').trim();
        } else if (lowerSpoken.includes('today')) {
            taskText = lowerSpoken.replace('today', '').trim();
        }

        // Clean out filler commands
        taskText = taskText.replace(/^add\s+/i, '')
                           .replace(/^remind\s+me\s+to\s+/i, '')
                           .replace(/\s+on\$/, '')
                           .trim();

        // Fixed: Extract the exact YYYY-MM-DD string value instead of storing an array loop object
        const formattedStringDate = taskDate.toISOString().split('T')[0];

        const newVoiceTask = {
            id: Date.now(),
            text: taskText.charAt(0).toUpperCase() + taskText.slice(1),
            date: formattedStringDate // Assigned as pure string format
        };

        appState.tasks.push(newVoiceTask);
        speakAI(`Added task: ${newVoiceTask.text}`);
        renderApp();
    };

    recognition.onerror = (err) => {
        console.error("Speech Recognition Error:", err.error);
        if(err.error === 'not-allowed') {
            DOM.voiceInstruction.textContent = "⚠️ Mic Access Blocked! Enable browser permissions.";
        } else {
            DOM.voiceInstruction.textContent = "⚠️ Listening failed. Please try again.";
        }
    };
}

// ==========================================
// 6. INITIALIZATION CORE LIFECYCLE
// ==========================================
let isInitialized = false;
function initApp() {
    if (isInitialized) return;
    isInitialized = true;
    renderApp();
}

if ('speechSynthesis' in window) {
    if (window.speechSynthesis.getVoices().length > 0) {
        initApp();
    } else {
        window.speechSynthesis.onvoiceschanged = initApp;
    }
} else {
    initApp();
}


// ==========================================
// 7. BACKGROUND PROCESS SERVICE WORKER HOOK
// ==========================================
// Registers the PWA service pipeline to allow deep Chrome device storage mapping
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Background Service Worker Active!', reg.scope))
            .catch(err => console.warn('Service Worker initialization failed:', err));
    });

    // Request permissions for background notifications immediately upon name onboarding
    if ('Notification' in window && Notification.permission === 'default') {
        DOM.saveProfileBtn.addEventListener('click', () => {
            setTimeout(() => {
                Notification.requestPermission();
            }, 2000);
        });
    }
}
