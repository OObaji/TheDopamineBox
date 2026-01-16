// ============================================
// 🔌 SUPABASE CONFIGURATION
// ============================================
const supabaseUrl = 'https://tfinyxgxnkpsilbtrrjk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmaW55eGd4bmtwc2lsYnRycmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MTg2NTgsImV4cCI6MjA4NDA5NDY1OH0.MP0oIxNktekmIsBm-zxR7x31aJSTWujFpHkjlU6Qs2c';

// Initialize Client with Safety Check
// We use 'supabaseClient' instead of 'supabase' to avoid conflicts with the global CDN variable
let supabaseClient = null;

if (window.supabase) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
} else {
    console.error("🚨 Supabase Library not found! Check index.html");
    window.addEventListener('DOMContentLoaded', () => {
        const errorBanner = document.createElement('div');
        errorBanner.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%;
            background: #ef4444; color: white; padding: 1rem;
            text-align: center; z-index: 9999; font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        errorBanner.innerHTML = `⚠️ Database Error: Supabase script missing. Check console.`;
        document.body.appendChild(errorBanner);
    });
}

// --- MODULE: State Management ---
const State = {
    tasks: [],
    brainDump: [],
    activeTaskId: null,
    priorityInput: 'medium',
    currentUser: null,

    async init() {
        if (!supabaseClient) return; // Stop if DB didn't load

        // 1. Check for active Supabase session on load
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session?.user) {
            this.setUser(session.user);
            await this.loadData();
            window.App.showDashboard();
        }

        // 2. Listen for auth changes (Login, Logout, Auto-refresh)
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.setUser(session.user);
                window.App.showDashboard();
                this.loadData();
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.tasks = [];
                this.brainDump = [];
                window.App.showLogin();
            }
        });
    },

    setUser(user) {
        this.currentUser = {
            email: user.email,
            id: user.id,
            name: user.email.split('@')[0] // Derive display name from email
        };
    },

    async loadData() {
        if (!this.currentUser || !supabaseClient) return;
        window.App.toggleLoading(true);

        try {
            // Fetch Tasks
            const { data: tasks, error: taskError } = await supabaseClient
                .from('tasks')
                .select('*')
                .eq('user_email', this.currentUser.email)
                .order('created_at', { ascending: true });

            if (taskError) throw taskError;
            this.tasks = tasks || [];

            // Fetch Brain Dump
            const { data: dumps, error: dumpError } = await supabaseClient
                .from('brain_dump')
                .select('*')
                .eq('user_email', this.currentUser.email)
                .order('created_at', { ascending: false });

            if (dumpError) throw dumpError;
            this.brainDump = dumps || [];

        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            window.App.toggleLoading(false);
        }
    },

    save() {
        // Optional local save logic
    }
};

// --- MODULE: Auth Logic ---
const Auth = {
    switchTab(tab) {
        const loginForm = document.getElementById('form-login');
        const regForm = document.getElementById('form-register');
        const loginTab = document.getElementById('tab-login');
        const regTab = document.getElementById('tab-register');

        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            loginForm.classList.add('block');
            regForm.classList.add('hidden');
            regForm.classList.remove('block');
            
            loginTab.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
            loginTab.classList.remove('text-slate-400');
            regTab.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
            regTab.classList.add('text-slate-400');
        } else {
            loginForm.classList.add('hidden');
            loginForm.classList.remove('block');
            regForm.classList.remove('hidden');
            regForm.classList.add('block');

            regTab.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
            regTab.classList.remove('text-slate-400');
            loginTab.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
            loginTab.classList.add('text-slate-400');
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        if (!supabaseClient) return;

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        
        window.App.toggleLoading(true);
        
        // Real Supabase Login
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        window.App.toggleLoading(false);
        
        if (error) {
            alert("Login failed: " + error.message);
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        if (!supabaseClient) return;

        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value.trim();
        const confirm = document.getElementById('reg-confirm').value.trim();

        if (password !== confirm) {
            alert("Passwords do not match.");
            return;
        }

        window.App.toggleLoading(true);

        // Real Supabase Registration
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });

        window.App.toggleLoading(false);

        if (error) {
            alert("Registration failed: " + error.message);
        } else {
            if (data?.user && !data.session) {
                alert("Registration successful! Please check your email to verify your account.");
            }
        }
    },

    handleGoogleLogin() {
        alert("To enable Google Auth, configure Google Provider in your Supabase Dashboard.");
    },

    async logout() {
        if (!supabaseClient) return;
        window.App.toggleLoading(true);
        await supabaseClient.auth.signOut();
        window.App.toggleLoading(false);
    },

    togglePassword(fieldId) {
        const input = document.getElementById(fieldId);
        if (input.type === "password") {
            input.type = "text";
        } else {
            input.type = "password";
        }
    }
};

// --- MODULE: Timer Logic ---
const Timer = {
    timeLeft: 1500,
    totalTime: 1500,
    interval: null,
    isRunning: false,

    reset(minutes = 25) {
        this.stop();
        this.totalTime = minutes * 60;
        this.timeLeft = this.totalTime;
        this.updateDisplay();
        this.updateRing();
    },

    toggle() {
        if (this.isRunning) this.stop();
        else this.start();
    },

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.updateButtonIcon(true);
        
        this.interval = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            this.updateRing();

            if (this.timeLeft <= 0) {
                this.stop();
                alert("Time's up! Take a break.");
            }
        }, 1000);
    },

    stop() {
        this.isRunning = false;
        clearInterval(this.interval);
        this.updateButtonIcon(false);
    },

    addTime(seconds) {
        this.timeLeft += seconds;
        this.totalTime = Math.max(this.totalTime, this.timeLeft);
        this.updateDisplay();
        this.updateRing();
    },

    updateDisplay() {
        const display = document.getElementById('timer-display');
        if (!display) return;
        
        const mins = Math.floor(this.timeLeft / 60);
        const secs = this.timeLeft % 60;
        display.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    },

    updateRing() {
        const circle = document.getElementById('timer-ring');
        if (!circle) return;
        
        const radius = 50;
        const circumference = 2 * Math.PI * radius;
        const progress = this.timeLeft / this.totalTime;
        const dashoffset = circumference * (1 - progress);
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = dashoffset;
    },

    updateButtonIcon(isPlaying) {
        const btn = document.getElementById('timer-toggle-btn');
        if (!btn) return;

        if (isPlaying) {
            btn.innerHTML = `<i data-lucide="pause" class="w-5 h-5"></i>`;
            btn.classList.replace('bg-indigo-600', 'bg-amber-100');
            btn.classList.replace('text-white', 'text-amber-600');
            btn.classList.replace('hover:bg-indigo-700', 'hover:bg-amber-200');
        } else {
            btn.innerHTML = `<i data-lucide="play" class="w-5 h-5 ml-1"></i>`;
            btn.classList.replace('bg-amber-100', 'bg-indigo-600');
            btn.classList.replace('text-amber-600', 'text-white');
            btn.classList.replace('hover:bg-amber-200', 'hover:bg-indigo-700');
        }
        if (window.lucide) window.lucide.createIcons();
    }
};

// --- MODULE: App Logic (Controller) ---
window.App = {
    async init() {
        // --- 1. CONNECT DATABASE SAFE CHECK ---
        if (window.supabase) {
            // Re-assign if necessary, or just use the global
            if (!supabaseClient) supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        } else {
            console.error("🚨 Supabase Library not found! Check index.html");
            const errorBanner = document.createElement('div');
            errorBanner.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%;
                background: #ef4444; color: white; padding: 1rem;
                text-align: center; z-index: 9999; font-weight: bold;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            `;
            errorBanner.innerHTML = `⚠️ Database Error: Supabase script missing. Check console.`;
            document.body.appendChild(errorBanner);
            return;
        }

        // --- 2. INITIALIZE STATE ---
        await State.init();
        
        if (State.currentUser) {
            this.showDashboard();
        } else {
            this.showLogin();
        }
        
        if (window.lucide) window.lucide.createIcons();
        console.log("✅ Dopamine Box Initialized");
    },

    toggleLoading(show) {
        const loader = document.getElementById('loading-overlay');
        if (!loader) return;
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    },

    showLogin() {
        const authView = document.getElementById('auth-view');
        const dashView = document.getElementById('dashboard-view');
        const focusView = document.getElementById('focus-view');
        
        if(authView) authView.classList.remove('hidden');
        if(dashView) dashView.classList.add('hidden');
        if(focusView) focusView.classList.add('hidden');
    },

    showDashboard() {
        const authView = document.getElementById('auth-view');
        const dashView = document.getElementById('dashboard-view');
        const focusView = document.getElementById('focus-view');
        
        if(authView) authView.classList.add('hidden');
        if(dashView) dashView.classList.remove('hidden');
        if(focusView) focusView.classList.add('hidden');
        
        const greeting = document.getElementById('user-greeting');
        if (greeting && State.currentUser) greeting.textContent = State.currentUser.name;
        
        this.renderTasks();
        this.renderBrainDump();
        if (window.lucide) window.lucide.createIcons();
    },

    setPriority(prio) {
        State.priorityInput = prio;
        document.querySelectorAll('.priority-btn').forEach(btn => {
            const isSelected = btn.dataset.priority === prio;
            const icon = btn.querySelector('i') || btn.querySelector('svg');
            
            if (isSelected) {
                btn.className = `priority-btn p-2 rounded-lg bg-white shadow-sm ${
                    prio === 'high' ? 'text-rose-500' : 
                    prio === 'medium' ? 'text-amber-500' : 'text-slate-700'
                }`;
                if(icon) {
                    if(prio === 'medium') icon.classList.add('fill-amber-500');
                    if(prio === 'high') icon.classList.add('fill-rose-500');
                    if(prio === 'low') icon.classList.add('fill-slate-300');
                }
            } else {
                btn.className = `priority-btn p-2 rounded-lg text-slate-400 hover:text-slate-600`;
                if(icon) {
                    icon.classList.remove('fill-amber-500', 'fill-rose-500', 'fill-slate-300');
                }
            }
        });
    },

    async handleAddTask(e) {
        e.preventDefault();
        const input = document.getElementById('new-task-input');
        if (!input || !input.value.trim()) return;

        const title = input.value.trim();
        const newTask = {
            user_email: State.currentUser.email,
            title: title,
            priority: State.priorityInput,
            completed: false,
            subtasks: []
        };

        this.toggleLoading(true);
        try {
            const { data, error } = await supabaseClient
                .from('tasks')
                .insert([newTask])
                .select();
            
            if (error) throw error;
            if (data) State.tasks.push(data[0]);
            
            input.value = '';
            this.setPriority('medium');
            this.renderTasks();
        } catch (err) {
            console.error(err);
            alert("Error adding task. Is the database connected?");
        } finally {
            this.toggleLoading(false);
        }
    },

    async toggleTask(id) {
        const task = State.tasks.find(t => t.id === id);
        if (!task) return;
        
        const newStatus = !task.completed;
        if (newStatus) this.fireConfetti();

        task.completed = newStatus;
        this.renderTasks();

        try {
            await supabaseClient.from('tasks').update({ completed: newStatus }).eq('id', id);
        } catch (err) {
            console.error(err);
            task.completed = !newStatus; // Revert
            this.renderTasks();
        }
    },

    async deleteTask(id) {
        if (!confirm("Are you sure you want to delete this task?")) return;
        
        const originalTasks = [...State.tasks];
        State.tasks = State.tasks.filter(t => t.id !== id);
        this.renderTasks();

        try {
            await supabaseClient.from('tasks').delete().eq('id', id);
        } catch (err) {
            console.error(err);
            State.tasks = originalTasks; // Revert
            this.renderTasks();
        }
    },

    renderTasks() {
        const list = document.getElementById('task-list');
        const emptyState = document.getElementById('empty-state');
        
        if (!list || !emptyState) return;

        const incompleteTasks = State.tasks.filter(t => !t.completed)
            .sort((a, b) => {
                const pVal = { high: 3, medium: 2, low: 1 };
                return pVal[b.priority] - pVal[a.priority];
            });

        list.innerHTML = '';

        if (State.tasks.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            
            incompleteTasks.forEach(task => {
                const subtasks = task.subtasks || [];
                const progress = subtasks.length > 0 
                    ? Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100) 
                    : 0;
                
                const prioColor = task.priority === 'high' ? 'bg-rose-50/90 border-rose-200/60' : 'bg-white/90 border-white/60';
                const barColor = task.priority === 'high' ? 'bg-rose-500' : 'bg-indigo-500';
                
                const html = `
                    <div class="glass-card rounded-3xl p-5 flex items-center gap-5 group hover:-translate-y-1 transition-transform ${prioColor} ${task.priority === 'high' ? 'glow-urgent' : ''}">
                        <button onclick="App.toggleTask(${task.id})" class="flex-none w-7 h-7 rounded-full border-2 border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all"></button>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                ${task.priority === 'high' ? `<span class="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"><i data-lucide="flame" class="w-3 h-3 fill-rose-500"></i> Urgent</span>` : ''}
                                ${task.priority === 'medium' ? `<span class="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Priority</span>` : ''}
                            </div>
                            <h3 class="font-bold text-slate-800 text-lg truncate">${task.title}</h3>
                            ${subtasks.length > 0 ? `
                                <div class="flex items-center gap-2 mt-2">
                                    <div class="h-1.5 flex-1 max-w-[100px] bg-slate-200 rounded-full overflow-hidden">
                                        <div class="h-full rounded-full ${barColor}" style="width: ${progress}%"></div>
                                    </div>
                                    <span class="text-xs font-bold text-slate-500">${progress}%</span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="App.startFocus(${task.id})" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 shadow-md flex items-center gap-1">
                                <i data-lucide="zap" class="w-3 h-3 fill-white"></i> Focus
                            </button>
                            <button onclick="App.deleteTask(${task.id})" class="p-2 text-slate-400 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                `;
                list.insertAdjacentHTML('beforeend', html);
            });

            const completed = State.tasks.filter(t => t.completed);
            if (completed.length > 0) {
                list.insertAdjacentHTML('beforeend', `<div class="mt-8 pt-8 border-t border-slate-200/60"><h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Completed</h4></div>`);
                completed.forEach(task => {
                    list.insertAdjacentHTML('beforeend', `
                        <div class="flex items-center gap-3 p-4 bg-white/40 border border-white/50 rounded-2xl opacity-60 hover:opacity-100 transition-opacity">
                            <i data-lucide="check-circle" class="w-5 h-5 text-emerald-500 fill-emerald-100"></i>
                            <span class="line-through text-slate-500 font-medium">${task.title}</span>
                            <button onclick="App.deleteTask(${task.id})" class="ml-auto text-slate-400 hover:text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button>
                        </div>
                    `);
                });
            }
        }
        if (window.lucide) window.lucide.createIcons();
    },

    startFocus(id) {
        State.activeTaskId = id;
        const dashboard = document.getElementById('dashboard-view');
        const focusView = document.getElementById('focus-view');
        
        if (dashboard && focusView) {
            dashboard.classList.add('hidden');
            focusView.classList.remove('hidden');
            this.renderFocusView();
            Timer.reset(25);
        }
    },

    exitFocusMode() {
        State.activeTaskId = null;
        Timer.stop();
        
        const dashboard = document.getElementById('dashboard-view');
        const focusView = document.getElementById('focus-view');
        
        if (dashboard && focusView) {
            focusView.classList.add('hidden');
            dashboard.classList.remove('hidden');
            this.renderTasks();
        }
    },

    renderFocusView() {
        const task = State.tasks.find(t => t.id === State.activeTaskId);
        if (!task) return;

        const titleEl = document.getElementById('focus-title');
        if (titleEl) titleEl.textContent = task.title;
        
        const badges = document.getElementById('focus-badges');
        if (badges) {
            badges.innerHTML = `
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                    <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> Current Focus
                </div>
                ${task.priority === 'high' ? `<div class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold uppercase tracking-wider"><i data-lucide="flame" class="w-3 h-3 fill-rose-500"></i> High Priority</div>` : ''}
            `;
        }

        this.renderSubtasks();
        this.updateProgressBar();
        if (window.lucide) window.lucide.createIcons();
    },

    renderSubtasks() {
        const task = State.tasks.find(t => t.id === State.activeTaskId);
        const list = document.getElementById('subtask-list');
        if (!list) return;
        
        list.innerHTML = '';
        const subtasks = task.subtasks || [];

        subtasks.forEach(sub => {
            const html = `
                <div class="group flex items-center gap-2 w-full">
                    <button onclick="App.toggleSubtask(${sub.id})" class="flex-grow text-left p-5 rounded-2xl border transition-all flex items-center gap-5 ${sub.completed ? 'border-transparent bg-slate-100/50' : 'border-white/60 bg-white/60 hover:bg-white hover:shadow-lg hover:border-indigo-100'}">
                        <div class="flex-none w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${sub.completed ? 'bg-indigo-500 border-indigo-500 scale-110' : 'border-slate-300 group-hover:border-indigo-400 bg-white'}">
                            ${sub.completed ? `<i data-lucide="check" class="w-4 h-4 text-white"></i>` : ''}
                        </div>
                        <span class="text-xl font-medium transition-colors ${sub.completed ? 'line-through text-slate-400' : 'text-slate-800'}">${sub.title}</span>
                    </button>
                    <button onclick="App.deleteSubtask(${sub.id})" class="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100" title="Delete Step">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', html);
        });
        if (window.lucide) window.lucide.createIcons();
    },

    async handleAddSubtask(e) {
        e.preventDefault();
        const input = document.getElementById('new-subtask-input');
        if (!input || !input.value.trim()) return;

        const task = State.tasks.find(t => t.id === State.activeTaskId);
        const newSubtask = { id: Date.now(), title: input.value, completed: false };
        
        if (!task.subtasks) task.subtasks = [];
        task.subtasks.push(newSubtask);
        
        this.renderSubtasks();
        this.updateProgressBar();
        input.value = '';

        try {
            await supabaseClient.from('tasks').update({ subtasks: task.subtasks }).eq('id', task.id);
        } catch (err) {
            console.error(err);
        }
    },

    async toggleSubtask(subId) {
        const task = State.tasks.find(t => t.id === State.activeTaskId);
        const sub = task.subtasks.find(s => s.id === subId);
        sub.completed = !sub.completed;
        
        this.renderSubtasks();
        this.updateProgressBar();

        try {
            await supabaseClient.from('tasks').update({ subtasks: task.subtasks }).eq('id', task.id);
        } catch (err) {
            console.error(err);
        }
    },

    async deleteSubtask(subId) {
        const task = State.tasks.find(t => t.id === State.activeTaskId);
        if (task) {
            task.subtasks = task.subtasks.filter(s => s.id !== subId);
            this.renderSubtasks();
            this.updateProgressBar();

            try {
                await supabaseClient.from('tasks').update({ subtasks: task.subtasks }).eq('id', task.id);
            } catch (err) {
                console.error(err);
            }
        }
    },

    updateProgressBar() {
        const task = State.tasks.find(t => t.id === State.activeTaskId);
        const subtasks = task.subtasks || [];
        const progress = subtasks.length > 0 
            ? (subtasks.filter(s => s.completed).length / subtasks.length) * 100 
            : 0;
        
        const bar = document.getElementById('progress-bar');
        if (bar) {
            bar.style.width = `${progress}%`;
            bar.className = `h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)] ${task.priority === 'high' ? 'bg-rose-500' : 'bg-indigo-500'}`;
        }
    },

    completeActiveTask() {
        this.toggleTask(State.activeTaskId);
        this.exitFocusMode();
    },

    // --- Stuck Mode Logic ---
    toggleStuckMode(show) {
        const container = document.getElementById('stuck-container');
        const options = document.getElementById('stuck-options');
        if (container && options) {
            if (show) {
                container.classList.add('hidden');
                options.classList.remove('hidden');
            } else {
                container.classList.remove('hidden');
                options.classList.add('hidden');
            }
        }
    },

    applyStrategy(type) {
        this.toggleStuckMode(false);
        if (type === '5min') {
            Timer.reset(5);
            Timer.start();
        } else if (type === 'micro') {
            const task = State.tasks.find(t => t.id === State.activeTaskId);
            if (!task.subtasks) task.subtasks = [];
            
            if (task.subtasks.length === 0) {
                const sub1 = { id: Date.now(), title: "Open the file", completed: false };
                const sub2 = { id: Date.now() + 1, title: "Read the first line", completed: false };
                task.subtasks.push(sub1, sub2);
                
                this.renderSubtasks();
                this.updateProgressBar();
                
                // Persist
                supabaseClient.from('tasks').update({ subtasks: task.subtasks }).eq('id', task.id);
            }
        }
    },

    // --- Brain Dump Logic ---
    toggleBrainDump() {
        const sidebar = document.getElementById('brain-dump-sidebar');
        const overlay = document.getElementById('brain-dump-overlay');
        
        if (sidebar && overlay) {
            if (sidebar.classList.contains('sidebar-closed')) {
                sidebar.classList.remove('sidebar-closed');
                sidebar.classList.add('sidebar-open');
                overlay.classList.remove('hidden');
            } else {
                sidebar.classList.add('sidebar-closed');
                sidebar.classList.remove('sidebar-open');
                overlay.classList.add('hidden');
            }
        }
    },

    async handleBrainDumpAdd(e) {
        e.preventDefault();
        const input = document.getElementById('brain-dump-input');
        if (!input || !input.value.trim()) return;

        const text = input.value.trim();
        const newItem = {
            user_email: State.currentUser.email,
            text: text
        };

        try {
            const { data, error } = await supabaseClient
                .from('brain_dump')
                .insert([newItem])
                .select();
            
            if (error) throw error;
            if (data) State.brainDump.unshift(data[0]);
            
            input.value = '';
            this.renderBrainDump();
        } catch (err) {
            console.error(err);
        }
    },

    async handleBrainDumpDelete(id) {
        const originalDumps = [...State.brainDump];
        State.brainDump = State.brainDump.filter(b => b.id !== id);
        this.renderBrainDump();

        try {
            await supabaseClient.from('brain_dump').delete().eq('id', id);
        } catch (err) {
            console.error(err);
            State.brainDump = originalDumps;
            this.renderBrainDump();
        }
    },

    async handleBrainDumpMove(id) {
        const item = State.brainDump.find(b => b.id === id);
        if (item) {
            // Add as task
            const newTask = {
                user_email: State.currentUser.email,
                title: item.text,
                priority: 'medium',
                completed: false,
                subtasks: []
            };

            // Remove from dump
            this.handleBrainDumpDelete(id);

            // Save new task
            try {
                const { data } = await supabaseClient.from('tasks').insert([newTask]).select();
                if (data) State.tasks.push(data[0]);
                this.renderTasks();
            } catch (err) {
                console.error(err);
            }
        }
    },

    renderBrainDump() {
        const list = document.getElementById('brain-dump-list');
        const badge = document.getElementById('brain-dump-badge');
        
        if (!list || !badge) return;

        list.innerHTML = '';
        badge.textContent = State.brainDump.length;
        badge.classList.toggle('hidden', State.brainDump.length === 0);

        if (State.brainDump.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-400 py-10 italic">No random thoughts yet. <br/> Amazing focus!</div>`;
            return;
        }

        State.brainDump.forEach(item => {
            list.insertAdjacentHTML('beforeend', `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group hover:shadow-md transition-all">
                    <p class="text-slate-800 font-medium mb-3">${item.text}</p>
                    <div class="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onclick="App.handleBrainDumpDelete(${item.id})" class="p-2 text-slate-400 hover:text-red-600 rounded-xl transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        <button onclick="App.handleBrainDumpMove(${item.id})" class="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl flex items-center gap-2 text-xs font-bold transition-colors"><i data-lucide="arrow-right" class="w-3 h-3"></i> Do later</button>
                    </div>
                </div>
            `);
        });
        if (window.lucide) window.lucide.createIcons();
    },

    // --- Utility ---
    fireConfetti() {
        const colors = ['#6366f1', '#a855f7', '#ec4899', '#fbbf24'];
        for (let i = 0; i < 50; i++) {
            const spark = document.createElement('div');
            spark.classList.add('confetti');
            spark.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            spark.style.left = '50%';
            spark.style.top = '50%';
            document.body.appendChild(spark);

            const angle = Math.random() * Math.PI * 2;
            const velocity = 5 + Math.random() * 10;
            const tx = Math.cos(angle) * velocity * 20;
            const ty = Math.sin(angle) * velocity * 20;

            const animation = spark.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
            ], {
                duration: 800 + Math.random() * 400,
                easing: 'cubic-bezier(0, .9, .57, 1)',
            });

            animation.onfinish = () => spark.remove();
        }
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    window.App.init();
});