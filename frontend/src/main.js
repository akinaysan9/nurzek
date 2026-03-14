// ═══ NurZeka - Main Application ═══

const API_URL = '/api';

// Custom Debug Logger Removed

// ═══ State ═══
let state = {
    user: null,
    token: null,
    currentView: 'chat',
    sidebarOpen: window.innerWidth > 1024,
    chatHistory: [],
    analysisHistory: JSON.parse(localStorage.getItem('nurzeka_history') || '[]'),
    selectedText: '',
    notes: [],
    currentBook: null,
    currentChapter: null,
    chapters: [],
    // Multi-Tab State
    tabs: [],
    activeTabId: null,
    nextTabId: 1,
    bookmarks: JSON.parse(localStorage.getItem('nurzeka_bookmarks') || '[]'),
    currentConvId: null,
    conversations: [],
    messages: [],
    _convExcerpts: JSON.parse(localStorage.getItem('nurzeka_conv_excerpts') || '{}'),
    _convCats: JSON.parse(localStorage.getItem('nurzeka_conv_cats') || '{}'),
    _convOrder: JSON.parse(localStorage.getItem('nurzeka_conv_order') || '[]'),
    _cats: JSON.parse(localStorage.getItem('nurzeka_cats') || '[]'),
    _catMap: JSON.parse(localStorage.getItem('nurzeka_catmap') || '{}'),
    _gecmisSearch: '',
    _gecmisSort: 'date-desc',
    _dragConvId: null
};

// ─── UUID Sorunu Çözümü ───
function generateUUID() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
}

// ... (existing code) ...

// ═══ Insight / AI Dictionary ═══
async function analyzeConcept(text) {
    if (!text) return;

    const panel = document.getElementById('insight-panel');
    const content = document.getElementById('insight-content');

    // Make sure panel is open
    panel.classList.remove('hidden');
    if (panel.classList.contains('hidden')) togglePanel('insight-panel');

    // Switch to Analysis tab
    switchWorkspaceTab('analysis');

    content.innerHTML = `
        <div class="insight-loading">
            <div class="spinner"></div>
            <p>"${text}" inceleniyor...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_URL}/analyze/concept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                context: state.lastSelectionContext || ''
            })
        });

        if (!response.ok) throw new Error('Analiz başarısız oldu.');

        const data = await response.json();
        const resultText = data.result || "Analiz sonucu alınamadı.";

        content.innerHTML = `<div class="insight-result">` + formatMarkdown(resultText) + `</div>`;

    } catch (error) {
        content.innerHTML = `<div class="form-error">❌ ${error.message}</div>`;
    }
}

// ═══ History System ═══
function addToHistory(item) {
    // Avoid duplicates (move to top)
    state.analysisHistory = state.analysisHistory.filter(h => h.term !== item.term);
    state.analysisHistory.unshift(item);

    // Limit to 50 items
    if (state.analysisHistory.length > 50) state.analysisHistory.pop();

    saveHistory();
    renderHistory();
}

function saveHistory() {
    localStorage.setItem('nurzeka_history', JSON.stringify(state.analysisHistory));
}

function renderHistory() {
    const list = document.getElementById('workspace-concepts-list');
    if (!list) return;

    if (state.analysisHistory.length === 0) {
        list.innerHTML = '<div class="empty-state-sm">Henüz geçmiş yok.</div>';
        return;
    }

    list.innerHTML = state.analysisHistory.map(item => `
        <div class="history-card" onclick="viewHistoryItem('${item.id}')">
            <div class="history-term">${item.term}</div>
            <div class="history-date">${new Date(item.date).toLocaleDateString('tr-TR')}</div>
        </div>
    `).join('');
}

function viewHistoryItem(id) {
    const item = state.analysisHistory.find(i => i.id === id);
    if (!item) return;

    // Reuse Note View Modal for simplicity, or we could create a specialized one.
    // Let's use Note View Modal but adapt titles
    const modal = document.getElementById('note-view-modal');
    document.getElementById('view-note-title').textContent = item.term;
    document.getElementById('view-note-date').textContent = new Date(item.date).toLocaleString('tr-TR');

    // Hide standard note sections, show custom content
    document.getElementById('view-note-content').innerHTML = formatMarkdown(item.definition);
    document.getElementById('view-note-content').parentElement.querySelector('label').textContent = '📝 Analiz Sonucu';

    document.getElementById('view-note-ai-section').classList.add('hidden');
    document.getElementById('view-note-source-section').classList.add('hidden');
    document.getElementById('go-to-source-btn').classList.add('hidden');

    openModal('note-view-modal');
}

// Expose globally
window.viewHistoryItem = viewHistoryItem;
window.renderHistory = renderHistory;


// ═══ Resizer System ═══
function initResizer() {
    const handle = document.querySelector('.resize-handle');
    const panel = document.getElementById('insight-panel');
    let isResizing = false;

    if (!handle || !panel) return;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        handle.classList.add('active');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const width = window.innerWidth - e.clientX;

        // Limits
        if (width > 260 && width < 900) {
            document.documentElement.style.setProperty('--insight-width', `${width}px`);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            handle.classList.remove('active');
        }
    });
}

// Initialize Tabs
function initTabs() {
    // Check local storage for saved tabs
    const savedTabs = localStorage.getItem('nurzeka_tabs');
    if (savedTabs) {
        try {
            const parsed = JSON.parse(savedTabs);
            if (parsed.tabs && parsed.tabs.length > 0) {
                state.tabs = parsed.tabs;
                state.activeTabId = parsed.activeTabId;
                state.nextTabId = parsed.nextTabId || (state.tabs.length + 1);
                renderTabs();
                // Load the active tab's content
                const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                if (activeTab && activeTab.book && activeTab.chapter) {
                    // loadChapter will handle rendering and scrolling
                    loadChapter(activeTab.book, activeTab.chapter, false).then(() => {
                        // Optional: restore scroll position if needed after load
                        const contentEl = document.getElementById('reader-content');
                        if (contentEl && activeTab.scrollTop) {
                            contentEl.scrollTop = activeTab.scrollTop;
                        }
                    });
                }
                return;
            }
        } catch (e) {
            console.error('Failed to load tabs', e);
        }
    }

    // Default Tab
    addNewTab();
}

function saveTabsState() {
    localStorage.setItem('nurzeka_tabs', JSON.stringify({
        tabs: state.tabs.map(t => ({ ...t, content: null })), // Don't save full content to LS, too heavy
        activeTabId: state.activeTabId,
        nextTabId: state.nextTabId
    }));
}

// ═══ Auth ═══
function loadAuth() {
    const token = localStorage.getItem('nurzeka_token');
    const user = localStorage.getItem('nurzeka_user');
    if (token && user) {
        state.token = token;
        state.user = JSON.parse(user);
        if (typeof syncUserData === 'function') syncUserData(); // 🟢 Sayfa açılışında notları arka planda yükle
    }
    updateAuthUI();

    // Initialize Google Sign In
    if (window.google) {
        initGoogleAuth();
    } else {
        // Retry if script not loaded yet
        setTimeout(initGoogleAuth, 1000);
    }
}

function initGoogleAuth() {
    if (!window.google) return;

    // Check if container exists (it might not if modal is closed, but usually it's in DOM)
    // Actually the modal is in DOM always, just hidden.

    try {
        window.google.accounts.id.initialize({
            client_id: "789355542444-4qkghgv6ocvalfjm8qs7hishiahf7dr0.apps.googleusercontent.com", // Todo: Replace with env or config
            callback: handleGoogleCredentialResponse
        });

        const googleBtn = document.getElementById('google-btn-container');
        if (googleBtn) {
            window.google.accounts.id.renderButton(
                googleBtn,
                { theme: "outline", size: "large", width: "100%" }  // customization attributes
            );
        }
    } catch (e) {
        console.error("Google Auth Init Error:", e);
    }
}

async function handleGoogleCredentialResponse(response) {
    try {
        const res = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Google girişi başarısız');
            return;
        }

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('nurzeka_token', data.token);
        localStorage.setItem('nurzeka_user', JSON.stringify(data.user));

        updateAuthUI();
        closeModal('auth-modal');

    } catch (error) {
        console.error('Google Auth Handler Error:', error);
        alert('Bağlantı hatası');
    }
}

async function loadUserData() {
    if (!state.user) return;

    // START LOADER
    const notesList = document.getElementById('workspace-notes-list');
    if (notesList) if(notesList) notesList.innerHTML = '<div class="loader-sm"></div> Yükleniyor...';

    try {
        // 1. Load Bookmarks
        await loadBookmarks();

        // 2. Load User Data (Notes + Highlights merged)
        await syncUserData();

        // 3. Load Conversation History
        await loadConversations();

        console.log('All user data loaded.');
    } catch (e) {
        console.error('Data load sequence failed:', e);
    }
}

function updateAuthUI() {
    const authBtn = document.getElementById('auth-btn');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');

    if (state.user) {
        authBtn.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userName.textContent = state.user.display_name || state.user.email;

        // Load All User Data Sequentially
        loadUserData();
    } else {
        authBtn.classList.remove('hidden');
        userInfo.classList.add('hidden');

        // Clear sensitive data
        state.notes = [];
        state.bookmarks = [];
        const notesList = document.getElementById('workspace-notes-list');
        if (notesList) if(notesList) notesList.innerHTML = '<div class="empty-state-sm">Giriş yapmalısınız.</div>';
        const bookmarksList = document.getElementById('workspace-bookmarks-list');
        if (bookmarksList) bookmarksList.innerHTML = '<div class="empty-state-sm">Giriş yapmalısınız.</div>';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.error;
            errorEl.classList.remove('hidden');
            return;
        }

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('nurzeka_token', data.token);
        localStorage.setItem('nurzeka_user', JSON.stringify(data.user));
        updateAuthUI();
        closeModal('auth-modal');
    } catch (err) {
        errorEl.textContent = 'Bağlantı hatası';
        errorEl.classList.remove('hidden');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const displayName = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const errorEl = document.getElementById('register-error');

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.error;
            errorEl.classList.remove('hidden');
            return;
        }

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('nurzeka_token', data.token);
        localStorage.setItem('nurzeka_user', JSON.stringify(data.user));
        updateAuthUI();
        closeModal('auth-modal');
    } catch (err) {
        errorEl.textContent = 'Bağlantı hatası';
        errorEl.classList.remove('hidden');
    }
}

function handleLogout() {
    state.user = null;
    state.token = null;
    localStorage.removeItem('nurzeka_token');
    localStorage.removeItem('nurzeka_user');
    localStorage.removeItem('nurzeka_notes');
    localStorage.removeItem('nurzeka_bookmarks');
    updateAuthUI();
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

// ═══ Navigation ═══

function switchView(view) {
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const target = document.getElementById(`view-${view}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
        state.currentView = view;
    }

    const nav = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (nav) nav.classList.add('active');

    // Mobile: handle sidebar & panels
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const insightPanel = document.getElementById('insight-panel');
        const notesPanel = document.getElementById('notes-panel');

        if (view === 'reader' && !state.currentBook) {
            // Only show sidebar when user explicitly clicks Külliyat AND no book is loaded yet
            sidebar.classList.add('open');
            state.sidebarOpen = true;
        } else {
            // Close sidebar for Soru Sor, Ara, or when a book is already open
            sidebar.classList.remove('open');
            state.sidebarOpen = false;
        }

        // Always close Aux panels when switching views on mobile
        // Do NOT auto-open insight panel here.
        if (insightPanel) {
            insightPanel.classList.add('hidden');
            document.body.classList.remove('insight-panel-open');
            // Show mobile tab (opening button)
            const mobileTab = document.getElementById('mobile-insight-toggle');
            if (mobileTab) mobileTab.classList.remove('hidden');
        }
        if (notesPanel) {
            notesPanel.classList.add('hidden');
        }
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
    state.sidebarOpen = !state.sidebarOpen;
}

// Close sidebar on mobile when a chapter is selected
function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            state.sidebarOpen = false;
        }
    }
}

// Inject mobile sidebar close button
function initMobileSidebar() {
    if (window.innerWidth > 768) return;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || sidebar.querySelector('.mobile-sidebar-close')) return;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'mobile-sidebar-close';
    closeBtn.innerHTML = '✕';
    closeBtn.setAttribute('aria-label', 'Kapat');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.remove('open');
        state.sidebarOpen = false;
    });
    sidebar.insertBefore(closeBtn, sidebar.firstChild);

    // Also ensure sidebar starts closed on mobile
    sidebar.classList.remove('open');
    state.sidebarOpen = false;
}


// ═══ Modal ═══
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ESC ile açık modalı kapat
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
});

// ═══ Panel ═══
// togglePanel consolidated at L2395

function toggleSources() {
    document.getElementById('sources-panel').classList.toggle('hidden');
}

function buildSourceHref(source) {
    const bookSlug = source.book_slug || source.bookSlug || '';
    const chapterSlug = source.chapter_slug || source.chapterSlug || '';
    if (!bookSlug || !chapterSlug) return '';
    return `/kulliyat/${encodeURIComponent(bookSlug)}/${encodeURIComponent(chapterSlug)}`;
}

if (!window._sourceRegistry) window._sourceRegistry = {};

function registerSource(source) {
    const sourceId = 'src_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    window._sourceRegistry[sourceId] = source;
    return sourceId;
}

function getSourceScrollText(source) {
    const text = (source.pasaj || source.excerpt || '').replace(/\.\.\.$/, '').trim();
    return text.length >= 20 ? text : '';
}

function sanitizeSourceSection(value, fallbackSlug = '') {
    const normalized = String(value || '').trim();
    const lower = normalized.toLowerCase();
    if (!normalized || ['unknown', 'none', 'null', 'n/a', 'belirtilmemiş'].includes(lower)) {
        if (fallbackSlug) {
            return fallbackSlug
                .replace(/^\d+[-_]/, '')
                .replace(/[-_]+/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
                .trim() || 'Belirtilmemiş';
        }
        return 'Belirtilmemiş';
    }
    return normalized;
}

function deriveSlug(value = '') {
    return String(value)
        .toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function openSourceInReader(sourceId) {
    const source = window._sourceRegistry[sourceId];
    if (!source) return;

    const bookSlug = source.book_slug || source.bookSlug || deriveSlug(source.kitap || source.book || '');
    const chapterSlug = source.chapter_slug || source.chapterSlug || deriveSlug(source.bolum_adi || source.section || '');
    const scrollText = getSourceScrollText(source);

    if (!bookSlug || !chapterSlug) {
        if (source.book && source.section) {
            goToReference(source.book, source.section, scrollText);
        }
        return;
    }

    if (typeof switchView === 'function') switchView('reader');

    try {
        await loadChapter(bookSlug, chapterSlug, true, scrollText || null);

        const readerContent = document.getElementById('reader-content');
        if (readerContent && typeof findAndScrollToText === 'function' && scrollText) {
            findAndScrollToText(readerContent, scrollText);
        }

        if (source.chunk_id) {
            if (readerContent && typeof findAndScrollToText === 'function') {
                findAndScrollToText(readerContent, String(source.chunk_id));
            }
        }
    } catch (err) {
        console.error('Source navigation error:', err);
    }
}

window.openSourceInReader = openSourceInReader;

function renderSourceCard(source, extraClass = '') {
    const book = escapeHtml(source.kitap || source.book || 'Bilinmiyor');
    const chapterSlug = source.chapter_slug || source.chapterSlug || '';
    const section = escapeHtml(sanitizeSourceSection(source.bolum_adi || source.section, chapterSlug));
    const excerpt = escapeHtml(source.pasaj || source.excerpt || '');
    const href = buildSourceHref(source);
    const className = `source-card ${extraClass}`.trim();
    const sourceId = registerSource(source);

    return `
        <button type="button" class="${className}" onclick="openSourceInReader('${sourceId}')" ${href ? `data-href="${href}"` : ''}>
            <div class="source-meta">📖 ${book}</div>
            <div class="source-section">${section}</div>
            ${excerpt ? `<div class="source-excerpt">${excerpt}</div>` : ''}
        </button>
    `;
}

function renderInlineSources(sources) {
    if (!sources || sources.length === 0) return '';

    return `
        <div class="message-inline-sources">
            ${sources.map(source => renderSourceCard(source, 'source-card-inline')).join('')}
        </div>
    `;
}

// ═══ Insight / AI Dictionary (Moved to top) ═══
// (analyzeConcept function is now defined at the top of the file)

// ═══ Chat ═══
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const question = input.value.trim();
    if (!question) return;

    // Hide welcome
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.classList.add('hidden');

    // Add user message
    addMessage('user', question);
    input.value = '';
    autoResize(input);

    // Show typing indicator
    const typingId = addTyping();

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

        const body = {
            question,
            conversationId: state.currentConvId || undefined,
            selectedText: state.selectedText || undefined,
            context: state.currentBook ? `Kullanıcı şu an "${state.currentBook}" kitabının "${state.currentChapter || 'Genel'}" bölümünü okuyor.` : undefined,
            book_hint: state.currentBook || undefined,
            chapter_hint: state.currentChapter || undefined,
            conversationHistory: state.chatHistory.slice(-6)
        };

        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        removeTyping(typingId);

        if (!res.ok) {
            const err = await res.json();
            addMessage('assistant', `❌ Hata: ${err.error || 'Bilinmeyen hata'}`);
            return;
        }

        const data = await res.json();
        console.log('Chat response sources count:', Array.isArray(data.sources) ? data.sources.length : 'no-sources-field');

        // Add AI response
        addMessage('assistant', data.answer, data.sources, question);

        // Update conversation history (Local memory)
        state.chatHistory.push(
            { role: 'user', content: question },
            { role: 'assistant', content: data.answer }
        );

        // Show sources if available
        if (data.sources && data.sources.length > 0) {
            showSources(data.sources);
        }

        // Clear selected text
        state.selectedText = '';

    } catch (err) {
        removeTyping(typingId);
        addMessage('assistant', `❌ Bağlantı hatası: ${err.message}`);
    }
}

// Registry: inline onclick'te string kaçırma sorununu önler
if (!window._msgRegistry) window._msgRegistry = {};

function addMessage(role, content, sources = [], userQuestion = '') {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    const avatar = role === 'user' ? '👤' : '🕌';
    let formattedContent = formatMarkdown(content);
    if (role === 'assistant') formattedContent = parseCitationLinks(formattedContent);

    // Kopyala butonu için güvenli data attribute
    const copyId = 'copy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    window._msgRegistry[copyId] = content;

    let saveBtn = '';
    let saveBtnId = '';
    if (role === 'assistant' && userQuestion) {
        saveBtnId = 'save_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        window._msgRegistry[saveBtnId] = { q: userQuestion, a: content };
        saveBtn = `<button class="btn-save-single" data-save-id="${saveBtnId}" title="Bu konuşmayı kaydet">+ Bu konuşmayı kaydet</button>`;
    }

    msg.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-body">
      ${formattedContent}
            ${role === 'assistant' ? renderInlineSources(sources) : ''}
      ${role === 'assistant' ? `
        <div class="message-actions">
          <button data-copy-id="${copyId}">📋 Kopyala</button>
          ${saveBtn}
          ${sources.length > 0 ? '<button class="btn-sources" onclick="toggleSources()">📑 Kaynaklar</button>' : ''}
        </div>
      ` : ''}
    </div>
  `;

    // Event listener'ları güvenli şekilde bağla
    const copyBtnEl = msg.querySelector(`[data-copy-id]`);
    if (copyBtnEl) copyBtnEl.addEventListener('click', () => copyText(window._msgRegistry[copyBtnEl.dataset.copyId]));

    if (saveBtnId) {
        const saveBtnEl = msg.querySelector(`[data-save-id]`);
        if (saveBtnEl) saveBtnEl.addEventListener('click', () => {
            const d = window._msgRegistry[saveBtnEl.dataset.saveId];
            if (d) saveSingleExchange(d.q, d.a);
        });
    }

    container.appendChild(msg);
    container.parentElement.scrollTop = container.parentElement.scrollHeight;
}

function addTyping() {
    const container = document.getElementById('chat-messages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'message assistant';
    div.innerHTML = `
    <div class="message-avatar">🕌</div>
    <div class="message-body">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>
  `;
    container.appendChild(div);
    container.parentElement.scrollTop = container.parentElement.scrollHeight;
    return id;
}

function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function showSources(sources) {
    const panel = document.getElementById('sources-panel');
    const list = document.getElementById('sources-list');

    list.innerHTML = sources.map(s => renderSourceCard(s)).join('');

    panel.classList.remove('hidden');
}

const SUGGESTION_POOL = [
    'İman nedir ve kaç rüknü vardır?',
    'Birinci Söz\'ün ana mesajı nedir?',
    'Haşir meselesi nasıl ispat edilir?',
    'Kader ile cüz\'i irade nasıl telif edilir?',
    'Tabiat Risalesi\'nin özeti nedir?',
    'İhlas Risalesi\'nin dört düsturu nelerdir?',
    'Besmele\'nin manası Risale-i Nur\'da nasıl açıklanır?',
    'Tevhid nedir, kaç türlüdür?',
    'Risale-i Nur\'da nefis terbiyesi nasıl anlatılır?',
    'Ölüm ve ahiret Risale-i Nur\'da nasıl ele alınır?',
    'Üstad Said Nursî kimdir?',
    'Otuzuncu Söz\'ün konusu nedir?',
    'Kur\'an\'ın i\'cazı nasıl ispat edilir?',
    'Ayet\'el-Kübrâ Risalesi\'nin ana teması nedir?',
    'İkinci Şua\'da Allah\'ın varlığına deliller nelerdir?',
    'Münacaat Risalesi\'nde ne anlatılır?',
    'Risale-i Nur\'da sabır kavramı nasıl açıklanır?',
    'Dua\'nın önemi Risale-i Nur\'da nasıl anlatılır?',
    'Mesnevi-i Nuriye\'nin konusu nedir?',
    'Enaniyet ve kibir Risale-i Nur\'da nasıl ele alınır?',
    'Tevekkül nedir, Risale-i Nur\'a göre sınırı nedir?',
    'Kalp ile aklın iman meselesindeki rolleri nedir?',
    'Risale-i Nur\'da ibadet anlayışı nasıl işlenir?',
    'Sekizinci Söz\'de hangi temsil anlatılır?',
    'On Dördüncü Lem\'a\'nın konusu nedir?',
    'Yirmi Dördüncü Mektup\'ta ne anlatılır?',
    'Ene ve zerre nedir, Risale-i Nur\'da nasıl açıklanır?',
    'İnsan ruhunun özellikleri Risale-i Nur\'a göre nelerdir?',
    'Risale-i Nur\'da israf ve iktisat nasıl anlatılır?',
    'Modern ateizme Risale-i Nur nasıl cevap verir?',
];

function renderSuggestions() {
    const el = document.getElementById('suggestion-chips');
    if (!el) return;
    const shuffled = [...SUGGESTION_POOL].sort(() => Math.random() - 0.5).slice(0, 6);
    el.innerHTML = shuffled.map(q =>
        `<button class="chip" onclick="askSuggestion(this)">${q}</button>`
    ).join('');
}

function askSuggestion(el) {
    document.getElementById('chat-input').value = el.textContent;
    sendMessage();
}

function handleChatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ═══ Markdown Formatting ═══
function formatMarkdown(text) {
    if (!text) return '';
    if (typeof text !== 'string') {
        console.warn('formatMarkdown: Expected string, got', typeof text);
        text = String(text);
    }

    // 1. Extract Footnotes for Interactivity
    // Parsing "## Haşiyeler" section (flexible matching)
    const hasiyeMatch = text.match(/#+\s*Haşiyeler([\s\S]*)$/i);
    const footnoteMap = {};
    if (hasiyeMatch) {
        const footnoteBlock = hasiyeMatch[1];
        // Regex to find "1 : content" or "1: content"
        const noteRegex = /(\d+)\s*:\s*(.+)/g;
        let match;
        while ((match = noteRegex.exec(footnoteBlock)) !== null) {
            footnoteMap[match[1]] = match[2].trim();
        }
    }

    // Split body and footer using flexible regex
    // This allows splitting even if it's "# Haşiyeler" or "## Haşiyeler" or "   ## Haşiyeler"
    const splitRegex = /#+\s*Haşiyeler/i;
    const parts = text.split(splitRegex);
    let body = parts[0];

    // We recreate the footer header as H2 standard
    const footer = parts[1] ? '<h2>Haşiyeler</h2>' + parts[1] : '';

    // 2. Process Body: Link Footnotes
    if (Object.keys(footnoteMap).length > 0) {
        Object.keys(footnoteMap).forEach(id => {
            // Look for standalone numbers that act as references
            // Matches: " 1 ", " 1.", " 1\n", " [1] "
            // We match standalone digits, ensuring they are not part of a year or math
            // Regex: Space/Start, ID, Space/Dot/Comma/End
            const re = new RegExp(`(\\s|^|\\[)(${id})(?=\\]|\\s|\\.|,|$)`, 'g');

            // Escape content for attribute
            const noteContent = escapeHtml(footnoteMap[id]);

            body = body.replace(re, (match, prefix, num) => {
                // If prefix is [, keep it? No, replace [1] with superscript
                if (prefix === '[') return `<sup class="hasiye-link" data-id="${id}" data-content="${noteContent}">[${id}]</sup>`;
                return `${prefix}<sup class="hasiye-link" data-id="${id}" data-content="${noteContent}">[${id}]</sup>`;
            });
        });
    }

    // 3. Process Body: Wrap Arabic Text
    // Regex for Arabic Unicode lines/blocks
    // Expanded range and ensuring full capture to avoid "black text" remainders
    const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:\s+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*)/g;

    body = body.replace(arabicRegex, '<span class="arabic-text">$1</span>');

    // 4. Clean Markdown Processing
    let processed = body;

    processed = processed
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')

        // Flexible Headers: Handle leading spaces " # Header"
        .replace(/^\s*###\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^\s*##\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^\s*#\s+(.+)$/gm, '<h1>$1</h1>')

        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Lists
        .replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>')
        .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
        // Legacy Haşiye replacement
        .replace(/(HAŞİYE-\d+|Dipnot-\d+)/gi, '<span class="hasiye-link">$1</span>')
        // Paragraphs: Handle line breaks better
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/([^\n])\n([^\n])/g, '$1<br>$2') // Single newline -> br, but ignore existing tags partially
        // Wrap all in p (if not starting with tag)
        .replace(/^/, '<p>').replace(/$/, '</p>')
        // Cleanup empty p
        .replace(/<p><\/p>/g, '')
        // Fix Headers/Lists inside P
        .replace(/<p>(<h[123]>)/g, '$1').replace(/(<\/h[123]>)<\/p>/g, '$1')
        .replace(/<p>(<ul>)/g, '$1').replace(/(<\/ul>)<\/p>/g, '$1')
        .replace(/<p>(<pre>)/g, '$1').replace(/(<\/pre>)<\/p>/g, '$1')
        .replace(/<p>(<blockquote>)/g, '$1').replace(/(<\/blockquote>)<\/p>/g, '$1');

    // Append footer
    if (footer) {
        processed += '<div class="footnotes-section">' + footer.replace(/\n{2,}/g, '<br>').replace(/\n/g, '<br>') + '</div>';
    }

    return processed;
}

/* ═══ AI Citation System ═══ */
const bookSlugMap = {
    'Sözler': 'sozler',
    'Mektubat': 'mektubat',
    'Lem\'alar': 'lemalar',
    'Şuâlar': 'sualar',
    'Tarihçe-i Hayat': 'tarihce-i-hayat',
    'Mesnevî-i Nuriye': 'mesnevi-i-nuriye',
    'İşaratü\'l-İ\'caz': 'isaratul-icaz',
    'Sikke-i Tasdik-i Gaybî': 'sikke-i-tasdik-i-gaybi',
    'Barla Lâhikası': 'barla-lahikasi',
    'Kastamonu Lâhikası': 'kastamonu-lahikasi',
    'Emirdağ Lâhikası I': 'emirdag-lahikasi-i',
    'Emirdağ Lâhikası II': 'emirdag-lahikasi-ii',
    'Asâ-yı Musa': 'asa-yi-musa',
    'Muhakemat': 'muhakemat',
    'Hutbe-i Şâmiye': 'hutbe-i-samiye',
    'Münâzarat': 'munazarat'
};

function parseCitationLinks(text) {
    if (!text) return text;
    // Match [[Book: Section]] with flexible whitespace
    const regex = /\[\[\s*(.*?)\s*:\s*(.*?)\s*\]\]/g;
    return text.replace(regex, (match, book, section) => {
        const fullCitation = `${book.trim()}: ${section.trim()}`;
        return `<button class="citation-link" onclick="handleCitationLink('${fullCitation.replace(/'/g, "\\'")}')">${fullCitation}</button>`;
    });
}

async function handleCitationLink(citationText) {
    console.log('🔗 Citation clicked:', citationText);
    const parts = citationText.split(':');
    if (parts.length < 2) return;

    const bookName = parts[0].trim();
    const sectionName = parts[1].trim();

    // 1. Find Book Slug
    let bookSlug = bookSlugMap[bookName] || bookName.toLowerCase().replace(/\s+/g, '-');

    // 2. Try to find chapter slug
    try {
        const res = await fetch(`${API_URL}/knowledge/kulliyat/${bookSlug}`);
        if (!res.ok) {
            alert(`Kitap bulunamadı: ${bookName}`);
            throw new Error(`Book not found: ${bookSlug}`);
        }
        const data = await res.json();

        if (data.chapters) {
            // Find best matching chapter slug
            const searchTitle = sectionName.toLowerCase().replace(/[^\wığüşöçİĞÜŞÖÇ]/g, '');
            const chapter = data.chapters.find(c => {
                const chapterTitle = c.title.toLowerCase().replace(/[^\wığüşöçİĞÜŞÖÇ]/g, '');
                return chapterTitle === searchTitle || chapterTitle.includes(searchTitle) || searchTitle.includes(chapterTitle);
            });

            if (chapter) {
                console.log(`✅ Found matching chapter: ${chapter.slug}. Opening in new tab.`);
                // Open in NEW tab as requested
                addNewTab();
                loadChapter(bookSlug, chapter.slug, true);
            } else {
                console.warn(`❌ Chapter not found for title "${sectionName}" in book ${bookSlug}.`);
                alert(`Bölüm bulunamadı: ${sectionName} (${bookName} içinde)`);
                // Fallback: try simple slugify and open in NEW tab
                const fallbackSlug = sectionName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                console.log(`⚠️ Falling back to URL-guess: ${fallbackSlug}`);
                addNewTab();
                loadChapter(bookSlug, fallbackSlug, true);
            }
        }
    } catch (err) {
        console.error('🛑 Citation navigation error:', err);
        alert(`Atıf yükleme hatası: ${err.message}`);
    }
}

window.handleCitationLink = handleCitationLink;

function escapeHtml(text) {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ═══ Text Selection → Ask AI & Auto Analysis ═══
document.addEventListener('mouseup', (e) => {
    // Ignore clicks inside the popups themselves to prevent repositioning/closing
    if (e.target.closest('.text-select-popup') || e.target.closest('.definition-popup')) return;

    // Optional: Only trigger if inside reader content or specific areas if we don't want global selection
    if (!e.target.closest('.reader-content')) {
        document.getElementById('text-select-popup').classList.add('hidden');
        return;
    }

    const selection = window.getSelection();
    const text = selection.toString().trim();
    const popup = document.getElementById('text-select-popup');

    if (text.length > 0) {
        state.selectedText = text;

        // Capture context (parent paragraph or div)
        const parent = selection.anchorNode?.parentElement?.closest('p, div, li');
        state.lastSelectionContext = parent ? parent.textContent.trim() : '';

        // Auto-trigger analysis disabled as per user request. 
        // Analysis must be triggered manually via a button.

        if (text.length > 2) {
            // Calculate Position
            let rect = null;
            try {
                if (selection.rangeCount > 0) {
                    rect = selection.getRangeAt(0).getBoundingClientRect();
                }
            } catch (err) { /* ignore */ }

            state.selectionRect = rect; // Cache for other functions

            // Positioning Logic (Fixed Position)
            let top, left;

            // Use Selection Rect if valid (Viewport Coordinates)
            if (rect && rect.width > 0 && rect.top !== 0) {
                top = rect.top - 50; // Place above selection
                left = rect.left + rect.width / 2 - 100; // Center horizontally
            }
            // Fallback: Use Mouse Coordinates (Viewport Coordinates)
            else {
                top = e.clientY - 60;
                left = e.clientX - 100;
            }

            // Boundary Checks (Keep on screen)
            if (top < 10) top = rect ? rect.bottom + 10 : e.clientY + 20; // Flip to bottom if top is clipped
            if (left < 10) left = 10;
            if (left + 200 > window.innerWidth) left = window.innerWidth - 220;

            popup.style.top = top + 'px';
            popup.style.left = left + 'px';
            popup.classList.remove('hidden');
        } else {
            popup.classList.add('hidden');
        }
    } else {
        // Hide if clicking elsewhere and not selecting text
        popup.classList.add('hidden');
    }
});

// Mobile: Touch End for Selection
document.addEventListener('touchend', (e) => {
    // Small delay to let selection settle
    setTimeout(() => {
        if (!e.target.closest('.reader-content')) {
            document.getElementById('text-select-popup').classList.add('hidden');
            return;
        }

        const selection = window.getSelection();
        const text = selection.toString().trim();
        const popup = document.getElementById('text-select-popup');

        if (text.length > 0) {
            state.selectedText = text;

            // Auto-Trigger Analysis Panel for Short Selections (Words/Concepts)
            if (text.length > 2 && text.length < 50 && !text.includes(' ')) {
                const panel = document.getElementById('insight-panel');
                if (panel.classList.contains('hidden')) {
                    togglePanel('insight-panel');
                }
                if (typeof analyzeConcept === 'function') analyzeConcept(text);
            }

            let top, left;
            const isMobile = window.innerWidth <= 768;

            // Calculate Position via Selection Rect
            let rect = null;
            try {
                if (selection.rangeCount > 0) {
                    rect = selection.getRangeAt(0).getBoundingClientRect();
                }
            } catch (err) { /* ignore */ }

            if (rect && rect.width > 0 && rect.top !== 0) {
                if (isMobile) {
                    // Mobile: Place BELOW the text to avoid native Android menu (which is on top)
                    top = rect.bottom + 15;
                } else {
                    // Desktop: Place ABOVE the text
                    top = rect.top - 60;
                }
                left = rect.left + rect.width / 2 - 100; // Center
            } else {
                // Fallback to touch coordinates
                const touch = e.changedTouches ? e.changedTouches[0] : { clientY: 100, clientX: 100 };
                top = touch.clientY + (isMobile ? 20 : -60);
                left = touch.clientX - 100;
            }

            // Boundary Checks
            if (top < 10) top = 20;

            if (top + 50 > window.innerHeight) {
                top = window.innerHeight - 60;
            }

            if (left < 10) left = 10;
            if (left + 200 > window.innerWidth) left = window.innerWidth - 220;

            popup.style.top = top + 'px';
            popup.style.left = left + 'px';
            popup.classList.remove('hidden');
        } else {
            // Only hide if we aren't tapping inside the popup OR the selection itself
            if (!e.target.closest('.text-select-popup')) {
                popup.classList.add('hidden');
            }
        }
    }, 100);
});

// Selection Change (Universal Backup)
document.addEventListener('selectionchange', () => {
    // Only for Mobile where mouseup might not fire reliably for selection
    if (window.innerWidth > 768) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length === 0) {
        document.getElementById('text-select-popup').classList.add('hidden');
    }
});

function askSelection() {
    const text = state.selectedText;
    if (!text) return;

    document.getElementById('text-select-popup').classList.add('hidden');
    switchView('chat');
    document.getElementById('chat-input').value = `Bu metni açıkla: "${text}"`;
    sendMessage();
}

function saveSelectionAsNote() {
    console.log('saveSelectionAsNote called');

    // 1. Try State
    let text = state.selectedText;

    // 2. Try Window Selection (Fallback)
    if (!text) {
        text = window.getSelection().toString().trim();
    }

    console.log('Selected text:', text);

    if (!text) {
        alert('Lütfen önce bir metin seçin.');
        return;
    }

    // Hide popup immediately
    const popup = document.getElementById('text-select-popup');
    if (popup) popup.classList.add('hidden');

    if (!state.user) {
        openModal('auth-modal');
        return;
    }

    // Prepare Modal (Safe)
    const idInput = document.getElementById('note-id');
    if (idInput) idInput.value = '';

    const titleInput = document.getElementById('note-title');
    if (titleInput) titleInput.value = 'Yeni Not';

    const contentInput = document.getElementById('note-content');
    if (contentInput) contentInput.value = '';

    // Inject Quote Display
    let quoteDisplay = document.getElementById('note-quote-display');
    if (!quoteDisplay) {
        quoteDisplay = document.createElement('div');
        quoteDisplay.id = 'note-quote-display';
        quoteDisplay.style.background = 'var(--bg-secondary)';
        quoteDisplay.style.padding = '10px';
        quoteDisplay.style.borderLeft = '4px solid var(--amber)';
        quoteDisplay.style.marginBottom = '10px';
        quoteDisplay.style.fontStyle = 'italic';
        quoteDisplay.style.fontSize = '0.9em';
        quoteDisplay.style.color = 'var(--text-primary)';

        const form = document.querySelector('#note-modal form');
        if (form && contentInput) {
            form.insertBefore(quoteDisplay, contentInput.parentElement);
        }
    }

    if (quoteDisplay) {
        quoteDisplay.innerHTML = `<strong>Alıntı:</strong> "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"`;
        quoteDisplay.classList.remove('hidden');
    }

    // Update Label
    const contentLabel = document.querySelector('#note-modal label[for="note-content"]');
    if (contentLabel) contentLabel.textContent = 'Düşünceleriniz:';

    state.tempNoteSource = text;
    // 🟢 FIX: Explicitly set hidden input to ensure handleSaveNote finds it
    const sourceInput = document.getElementById('note-source-text');
    if (sourceInput) sourceInput.value = text;

    openModal('note-modal');
}

function copySelection() {
    navigator.clipboard.writeText(state.selectedText);
    document.getElementById('text-select-popup').classList.add('hidden');
}

// Make globally available
window.askSelection = askSelection;
window.saveSelectionAsNote = saveSelectionAsNote;
window.copySelection = copySelection;
window.analyzeSelection = analyzeSelection; // Ensure this is also exposed

// ═══ Quick Definition ═══
async function getWordMeaning(event) {
    const text = state.selectedText;
    if (!text) return;

    const popupMenu = document.getElementById('text-select-popup');
    popupMenu.classList.add('hidden'); // Hide selection menu

    // Determine Anchor Point
    let rect = null;

    // 1. Try to anchor to the Text Selection (Best context)
    if (state.selectionRect && state.selectionRect.width > 0 && state.selectionRect.top > 0) {
        rect = state.selectionRect;
        console.log('Using Selection Rect:', rect);
    }

    // 2. Fallback: Anchor to the Clicked Button
    if ((!rect || rect.width === 0) && event && event.target) {
        const btnRect = event.target.getBoundingClientRect();
        if (btnRect.width > 0 && btnRect.top > 0) {
            rect = btnRect;
            console.log('Using Button Rect:', rect);
        }
    }

    // 3. Fallback: Center Screen (Safe Default)
    if (!rect || rect.width === 0 || (rect.top === 0 && rect.left === 0)) {
        console.warn('Invalid Anchor Rect, defaulting to Center Screen');
        const width = 320;
        const height = 200;
        rect = {
            top: (window.innerHeight - height) / 2,
            left: (window.innerWidth - width) / 2,
            bottom: (window.innerHeight - height) / 2, // approximate for placement logic
            width: width,
            height: height
        };
    }

    // Show loading
    showDefinitionPopup(rect, text, 'Yükleniyor...');

    try {
        const res = await fetch(`${API_URL}/analyze/definition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                context: state.lastSelectionContext || ''
            })
        });

        if (res.ok) {
            const data = await res.json();
            updateDefinitionContent(text, data.definition);
        } else {
            if (res.status === 404) {
                updateDefinitionContent(text, '⚠️ Sunucu güncellenmedi. Lütfen uygulamayı kapatıp açın.');
            } else {
                updateDefinitionContent(text, '⚠️ Tanım bulunamadı.');
            }
        }
    } catch (e) {
        console.error('Definition error:', e);
        updateDefinitionContent(text, 'Bağlantı hatası.');
    }
}

let definitionPopup = null;

function showDefinitionPopup(rect, term, content) {
    if (definitionPopup) definitionPopup.remove();

    definitionPopup = document.createElement('div');
    definitionPopup.className = 'definition-popup';
    definitionPopup.innerHTML = getDefinitionHTML(term, content);
    document.body.appendChild(definitionPopup);

    // Position (Fixed)
    // Place below the anchor rect
    let top = rect.bottom + 10;
    let left = rect.left;

    // Boundary checks
    // Updated for wider popup (max 500px)
    if (left + 500 > window.innerWidth) left = window.innerWidth - 520; // Keep in bounds right
    if (left < 10) left = 10; // Keep in bounds left
    if (top + 300 > window.innerHeight) top = rect.top - 310; // Flip to top if no space below

    definitionPopup.style.top = top + 'px';
    definitionPopup.style.left = left + 'px';

    // Drag Logic
    const header = definitionPopup.querySelector('.def-header');
    if (header) {
        header.style.cursor = 'move';
        header.onmousedown = function (e) {
            e.preventDefault(); // Prevent text selection

            let startX = e.clientX;
            let startY = e.clientY;
            let startLeft = definitionPopup.offsetLeft;
            let startTop = definitionPopup.offsetTop;

            function onMouseMove(e) {
                let dx = e.clientX - startX;
                let dy = e.clientY - startY;
                definitionPopup.style.left = (startLeft + dx) + 'px';
                definitionPopup.style.top = (startTop + dy) + 'px';
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    }

    // Click outside to close (Optional - might conflict with drag if not careful, but drag stops before click)
    // We keep it but ensure it doesn't close on drag release if not moved? 
    // Actually, let's remove the auto-close on click outside if we want it "persistable/moveable" 
    // or just keep it simple. User said "tutup taşınabilir yapabilir miyiz", implying they want to keep it open.
    // So maybe we REMOVE the click-outside-to-close behavior? 
    // "tutup taşınabilir" -> hold and move. 
    // If I keep click-outside-close, they can lose it easily. Let's remove it for now or make it smarter.
    // I'll remove the click listener for now to make it "sticky" until X is clicked.
}

function updateDefinitionContent(term, content) {
    if (definitionPopup) {
        definitionPopup.innerHTML = getDefinitionHTML(term, content);
        // Re-attach drag listener if innerHTML killed it?
        // Yes, innerHTML replaces elements. So we need to re-attach.
        // Better: Don't replace the whole innerHTML, just the content div.
        const contentDiv = definitionPopup.querySelector('.def-content');
        if (contentDiv) contentDiv.innerHTML = content;

        // Update save button onclick to include new content?
        // The save button calls saveSelectionAsNote which reads state.selectedText.
        // But for the ANALYSIS content, we need to pass it.
        // Let's update the save button.
        const header = definitionPopup.querySelector('.def-header');
        // We need to re-bind the save button or `getDefinitionHTML` should use consistent params.
        // Actually `state.selectedText` is the term.
        // We need to pass the *content* (explanation) to the save function.
        // Let's attach it to the button dynamically.
        const saveBtn = definitionPopup.querySelector('.btn-def-save');
        if (saveBtn) {
            saveBtn.onclick = () => saveAnalysisAsNote(term, content);
        }
    }
}

function getDefinitionHTML(term, content) {
    // Escaping content for attribute might be tricky if it's HTML. 
    // We'll handle the click in JS, so just markup here.
    return `
        <div class="def-header">
            <button class="btn-def-save" title="Not Olarak Kaydet" style="margin-right:auto; background:none; border:none; cursor:pointer; font-size:1.2em;">💾</button>
            <span style="flex:1"></span>
            <button onclick="this.closest('.definition-popup').remove()" style="background:none; border:none; cursor:pointer; font-size:1.2em;">✕</button>
        </div>
        <div class="def-content">${content}</div>
    `;
}

// Global function for the new save button
window.saveAnalysisAsNote = function (term, explanation) {
    // 1. Open Note Modal
    // Reuse saveSelectionAsNote logic but prefill content
    if (!state.user) {
        openModal('auth-modal');
        return;
    }

    // Close definition popup
    if (definitionPopup) definitionPopup.remove();

    // Prepare Modal
    document.getElementById('note-id').value = '';
    document.getElementById('note-title').value = term || 'Analiz Notu'; // Title = Term

    // Content = Explanation
    // We might want to convert HTML explanation back to text or keep it if possible? 
    // Note content is plain text/markdown usually. 
    // The explanation usually comes as markdown or plain text.
    // If it has HTML tags, we might want to strip them or keep them. 
    // `innerText` is safe.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = explanation;
    const plainExplanation = tempDiv.innerText;

    document.getElementById('note-content').value = plainExplanation;

    // Quote = Original Text (Term is the selected text usually)
    let quoteDisplay = document.getElementById('note-quote-display');
    if (!quoteDisplay) {
        quoteDisplay = document.createElement('div');
        quoteDisplay.id = 'note-quote-display';
        quoteDisplay.className = 'note-quote-display'; // Use class from ui-overrides
        const form = document.querySelector('#note-modal form');
        const contentInput = document.getElementById('note-content');
        if (form && contentInput) {
            form.insertBefore(quoteDisplay, contentInput.parentElement);
        }
    }

    quoteDisplay.innerHTML = `<strong>Alıntı:</strong> "${term}"`;
    quoteDisplay.classList.remove('hidden');

    // Hidden fields
    document.getElementById('note-source-text').value = term;
    document.getElementById('note-ai-response').value = plainExplanation;

    openModal('note-modal');
};

// ═══ Ottoman Tooltip ═══
const OTTOMAN_DICT_CACHE = {};

async function loadOttomanDict() {
    try {
        const res = await fetch(`${API_URL}/chat/dictionary/search?q=`);
        if (res.ok) {
            const data = await res.json();
            data.results.forEach(r => { OTTOMAN_DICT_CACHE[r.term.toLowerCase()] = r.meaning; });
        }
    } catch (e) { /* silent */ }
}

function initOttomanTooltips(container) {
    if (!container) return;

    const text = container.textContent;
    const tooltip = document.getElementById('ottoman-tooltip');

    container.addEventListener('mouseover', async (e) => {
        const word = getWordAtCursor(e);
        if (!word || word.length < 3) return;

        const lowerWord = word.toLowerCase();
        let meaning = OTTOMAN_DICT_CACHE[lowerWord];

        if (!meaning) {
            try {
                const res = await fetch(`${API_URL}/chat/dictionary/meaning/${encodeURIComponent(word)}`);
                if (res.ok) {
                    const data = await res.json();
                    meaning = data.meaning;
                    OTTOMAN_DICT_CACHE[lowerWord] = meaning;
                }
            } catch (e) { return; }
        }

        if (meaning) {
            tooltip.querySelector('.tooltip-term').textContent = word;
            tooltip.querySelector('.tooltip-meaning').textContent = meaning;
            tooltip.style.top = (e.clientY - 50) + 'px';
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.classList.remove('hidden');
        }
    });

    container.addEventListener('mouseout', () => {
        tooltip.classList.add('hidden');
    });
}

function getWordAtCursor(e) {
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range || !range.startContainer.textContent) return null;

    const text = range.startContainer.textContent;
    const offset = range.startOffset;

    let start = offset, end = offset;
    while (start > 0 && /[\wığüşöçİĞÜŞÖÇâîûêôÂÎÛÊÔ''-]/.test(text[start - 1])) start--;
    while (end < text.length && /[\wığüşöçİĞÜŞÖÇâîûêôÂÎÛÊÔ''-]/.test(text[end])) end++;

    return text.substring(start, end).trim();
}

// ═══ Notes ═══
// ═══ Notes ═══
// loadNotes consolidated at L1932

function renderNotes() {
    const list = document.getElementById('notes-list');
    if (!state.notes || state.notes.length === 0) {
        list.innerHTML = '<div class="empty-state">Henüz not yok</div>';
        return;
    }

    const grouped = {};
    state.notes.forEach(note => {
        const book = note.source_book || 'Genel Kitap';
        const section = note.source_section || 'Genel Bölüm';
        if (!grouped[book]) grouped[book] = {};
        if (!grouped[book][section]) grouped[book][section] = [];
        grouped[book][section].push(note);
    });

    let html = '';
    for (const [book, sections] of Object.entries(grouped)) {
        const bookId = 'book-' + book.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        let totalBookNotes = 0;
        let sectionsHtml = '';

        for (const [section, notes] of Object.entries(sections)) {
            totalBookNotes += notes.length;
            const secId = bookId + '-sec-' + section.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

            sectionsHtml += `
            <div class="note-category section-group" style="margin-left: 10px;" ondragover="window.handleCategoryDragOver(event, this)" ondragleave="window.handleCategoryDragLeave(event, this)" ondrop="window.handleCategoryDrop(event, '${book}', '${section}')">
                <div class="note-category-header" onclick="window.toggleCategory('${secId}', event)" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.85em; font-weight: 600; color: var(--text-secondary); margin: 8px 0 5px 5px; padding-bottom: 3px; border-bottom: 1px dashed var(--border-color); user-select: none;">
                    <span>${section} (${notes.length})</span>
                    <span id="icon-${secId}" style="transition: transform 0.2s;">▶</span>
                </div>
                <div id="${secId}" style="display: none; padding-left: 10px; border-left: 2px solid var(--border-color);">
                    ${notes.map(note => `
                    <div class="note-card" style="position:relative;" draggable="true" ondragstart="window.handleNoteDragStart(event, '${note.id}')">
                      <div style="position:absolute; right:5px; top:5px; display:flex; gap:5px; z-index:2">
                          <button onclick="event.stopPropagation(); window.editNote('${note.id}')" class="btn-icon-sm" title="Düzenle" style="background:rgba(255,255,255,0.8); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer">✏️</button>
                          <button onclick="event.stopPropagation(); viewNote('${note.id}')" class="btn-icon-sm" title="Detay" style="background:rgba(255,255,255,0.8); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer">👁️</button>
                          <span title="Sürükle" style="cursor:grab; background:rgba(255,255,255,0.8); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center;">↕️</span>
                      </div>
                      <div class="note-card-header" style="padding-right:85px" onclick="viewNote('${note.id}')">
                        <h4>${note.title || (note.type === 'highlight' ? 'Vurgulama' : 'Not')}</h4>
                        <span class="note-date">${new Date(note.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>
                      <p class="note-preview" onclick="viewNote('${note.id}')">${(note.content || note.source_text || note.aiResponse || '').substring(0, 120)}...</p>
                    </div>
                    `).join('')}
                </div>
            </div>`;
        }

        html += `
        <div class="note-category book-group">
            <div class="note-category-header" onclick="window.toggleCategory('${bookId}', event)" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.95em; font-weight: bold; color: var(--primary); margin: 15px 0 5px 0; padding-bottom: 5px; border-bottom: 2px solid var(--primary); user-select: none;">
                <span>${book} (${totalBookNotes})</span>
                <span id="icon-${bookId}" style="transition: transform 0.2s;">▶</span>
            </div>
            <div id="${bookId}" style="display: none;">
                ${sectionsHtml}
            </div>
        </div>`;
    }

    list.innerHTML = html;
}

// Global category toggle function for Notes
window.toggleCategory = function (catId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const content = document.getElementById(catId);
    const icon = document.getElementById('icon-' + catId);
    if (!content || !icon) return;

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(90deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
};

function viewNote(id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    document.getElementById('note-id').value = note.id;
    document.getElementById('note-title').value = note.title || '';
    document.getElementById('note-content').value = note.content || '';
    document.getElementById('note-tags').value = (note.tags || []).join(', ');

    // Set color radio
    const colorRadio = document.querySelector(`input[name="note-color"][value="${note.color}"]`);
    if (colorRadio) colorRadio.checked = true;

    // Set source text if exists (read-only or hidden field)
    document.getElementById('note-source-text').value = note.source_text || '';

    // Set AI Response to read-only display
    const aiDisplayContainer = document.getElementById('note-ai-response-container');
    const aiDisplay = document.getElementById('note-ai-response-display');
    if (aiDisplayContainer && aiDisplay) {
        if (note.aiResponse) {
            aiDisplay.innerHTML = note.aiResponse;
            aiDisplayContainer.classList.remove('hidden');
        } else {
            aiDisplay.innerHTML = '';
            aiDisplayContainer.classList.add('hidden');
        }
    }

    openModal('note-modal');
}
window.viewNote = viewNote;

async function handleSaveNote(e) {
    try {
        e.preventDefault();
        console.log('--- handleSaveNote TRIGGERED ---');
        console.log('Raw Content Value:', document.getElementById('note-content').value);
        if (!state.user) { openModal('auth-modal'); return; }

        const title = document.getElementById('note-title').value || 'Başlıksız Not';
        // 🟢 FIX: Ensure we read the value explicitly and trim it
        const contentRaw = document.getElementById('note-content').value;
        const content = contentRaw ? contentRaw.trim() : '';
        const id = document.getElementById('note-id').value;

        // Retrieve source text from state if it's a new note from selection
        // Priority: 1. State Temp (most recent explicit save act) -> 2. DOM Hidden Input -> 3. Current Selection (fallback)
        let sourceText = state.tempNoteSource || document.getElementById('note-source-text').value;

        // Fallback: If still empty, check global selected text
        if (!sourceText && state.selectedText) {
            sourceText = state.selectedText;
            console.log('Recovered source text from state.selectedText');
        }

        // VALIDATION: Relaxed
        // If content is empty, just save it as "Empty Note" if needed or allow empty string
        // The user specifically asked: "açıklama yapmasam da kayıt olmalı"

        // Critical Logic: If we have sourceText, it's a valid Highlight, even if content is empty.
        // If we have NO sourceText, we MUST have content or title.
        if (!content.trim() && !sourceText && !title.trim()) {
            console.error('Validation Warning: Empty content and no source text.');
            alert('Kaydetmek için bir içerik girmeli veya metin seçmelisiniz.');
            return;
        }

        // Logic to ensure non-null for backend if needed
        const finalContent = content || '';

        // ...

        // Bookmark Toggle Logic (Simplified & Robust)
        async function toggleBookmark() {
            if (!state.user) {
                alert('Ayraç eklemek için giriş yapmalısınız.');
                openModal('auth-modal');
                return;
            }

            // Check if already bookmarked
            const existing = state.bookmarks.find(b =>
                (b.book === state.currentBook || b.book_slug === state.currentBook) &&
                (b.chapter === state.currentChapter || b.chapter_slug === state.currentChapter)
            );

            const btn = document.getElementById('bookmark-toggle');
            if (btn) btn.classList.toggle('active'); // Immediate UI feedback

            if (existing) {
                // Optimistic Remove
                const originalBookmarks = [...state.bookmarks];
                state.bookmarks = state.bookmarks.filter(b => b.id !== existing.id);
                renderWorkspaceBookmarks();
                updateBookmarkButtonUI(); // Ensure consistent state

                try {
                    await fetch(`${API_URL}/user-data/bookmarks/${existing.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${state.token}` }
                    });
                    // Success - do nothing more
                } catch (e) {
                    console.error('Remove bookmark failed:', e);
                    // Rollback
                    state.bookmarks = originalBookmarks;
                    renderWorkspaceBookmarks();
                    updateBookmarkButtonUI();
                    alert('Ayraç silinemedi.');
                }
            } else {
                // Optimistic Add
                const tempId = 'temp-' + Date.now();
                const titleEl = document.getElementById('sticky-chapter-title');
                const label = titleEl && titleEl.textContent ? titleEl.textContent : state.currentChapter;

                const newBookmark = {
                    id: tempId,
                    book_slug: state.currentBook,
                    chapter_slug: state.currentChapter,
                    label: label,
                    created_at: new Date().toISOString()
                };

                state.bookmarks.push(newBookmark);
                renderWorkspaceBookmarks();
                updateBookmarkButtonUI();

                try {
                    const res = await fetch(`${API_URL}/user-data/bookmarks`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${state.token}`
                        },
                        body: JSON.stringify({
                            book_slug: state.currentBook,
                            chapter_slug: state.currentChapter,
                            label: label
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        // Update temp ID with real ID
                        const item = state.bookmarks.find(b => b.id === tempId);
                        if (item && data.bookmark) {
                            item.id = data.bookmark.id;
                            localStorage.setItem('nurzeka_bookmarks', JSON.stringify(state.bookmarks));
                        }
                    } else {
                        throw new Error('Save failed');
                    }
                } catch (e) {
                    console.error('Add bookmark failed:', e);
                    // Rollback
                    state.bookmarks = state.bookmarks.filter(b => b.id !== tempId);
                    renderWorkspaceBookmarks();
                    updateBookmarkButtonUI();
                    alert('Ayraç kaydedilemedi.');
                }
            }
        }

        // Legacy fields
        const tags = document.getElementById('note-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        const aiResponse = document.getElementById('note-ai-response').value;
        const colorInput = document.querySelector('input[name="note-color"]:checked');
        const color = colorInput ? colorInput.value : 'yellow';

        console.log('Constructing note object...');
        const note = {
            id: id || Date.now().toString(),
            title,
            content,
            source_book: state.currentBook,
            source_section: state.currentChapter,
            source_text: sourceText,
            type: (sourceText && !content) ? 'highlight' : 'note', // Distinguish type
            color: color,
            created_at: new Date().toISOString(),
            tags, aiResponse
        };
        console.log('Note object:', note);

        // 🟢 FIX: Save locally IMMEDIATELY before doing anything else
        saveNotesLocally();

        // 🟢 FIX: Optimize Rollback by capturing old note
        const oldNote = id ? state.notes.find(n => n.id === id) : null;

        // Optimistic Update
        if (id) {
            state.notes = state.notes.map(n => n.id === id ? note : n);
        } else {
            state.notes.unshift(note); // 🟢 FIX: Add to top
        }

        // Render immediately
        refreshNotesSidebar();
        if (document.getElementById('ws-notes')) {
            renderWorkspaceNotes(state.notes);
            // Auto-open the category for the newly added note
            const bookId = 'ws-book-' + (note.source_book || 'Genel Kitap').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const secId = bookId + '-sec-' + (note.source_section || 'Genel Bölüm').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const catDiv = document.getElementById(secId);
            const icon = document.getElementById('icon-' + secId);
            if (catDiv && catDiv.style.display === 'none') {
                catDiv.style.display = 'block';
                if (icon) icon.style.transform = 'rotate(90deg)';
            }
        }

        // 🟢 FIX: Apply highlight visual immediately
        if (note.source_text) {
            applyHighlightsFromNotes([note]);
        }

        closeModal('note-modal');

        // Backend Sync - SEPARATED LOGIC
        // If content is empty and we have source text, it is a Highlight.
        // If content exists, it is a Note.
        // 🟢 FIX: Use 'content' directly. 'finalContent' was undefined/removed, causing all notes to be treated as highlights.
        if (!content && sourceText) {
            console.log('Sending as Highlight to /api/user-data/highlights');
            saveHighlightToBackend(note, oldNote);
        } else {
            console.log('Sending as Note to /api/notes');
            saveNoteToBackend(note, !oldNote);
        }
    } catch (err) {
        console.error('Save note error:', err);
        alert('Not kaydedilirken hata oluştu.');
    }
}

async function saveHighlightToBackend(note, oldNote = null) {
    if (!state.user) return;
    try {
        const payload = {
            book_slug: note.source_book,
            chapter_slug: note.source_section,
            text: note.source_text,
            range_start: null, // We don't track ranges yet
            range_end: null,
            color: note.color
        };

        const url = `${API_URL}/user-data/highlights`; // Highlights are always POST for now (or DELETE)
        // If we extracted ID, we might need it, but usually highlights are new inserts.
        // If editing a highlight (changing color), we might need PUT, but user_data.js only has POST/DELETE.
        // For now, treat as new or if ID exists handle logic? 
        // user_data.js doesn't have PUT for highlights. It has POST (Create).
        // If updating, we might need to delete old and create new?
        // Or just POST.

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            console.log('✅ Highlight saved to backend.');
        } else {
            console.error('❌ Failed to save highlight:', await res.text());
        }
    } catch (e) {
        console.error('Save highlight network error:', e);
    }
}

function refreshNotesSidebar() {
    const container = document.getElementById('workspace-notes-list');
    if (container) {
        // Global visibility for all notes as requested
        renderWorkspaceNotes(state.notes);
    }
}

function saveAsNote(btn) {
    if (!state.user) { openModal('auth-modal'); return; }
    const content = btn.dataset.content;
    document.getElementById('note-content').value = ''; // Let user write own thoughts

    // Set AI Response to read-only display
    const aiDisplayContainer = document.getElementById('note-ai-response-container');
    const aiDisplay = document.getElementById('note-ai-response-display');
    if (aiDisplayContainer && aiDisplay) {
        aiDisplay.innerHTML = content;
        aiDisplayContainer.classList.remove('hidden');
    }
    document.getElementById('note-ai-response').value = content;

    openModal('note-modal');
}

window.saveChatAsFavorite = function (btn) {
    if (!state.user) {
        alert('Favorilere eklemek için giriş yapmalısınız.');
        openModal('auth-modal');
        return;
    }
    const content = btn.dataset.content;
    const tempId = uuidv4 ? uuidv4() : Date.now().toString();
    const note = {
        id: tempId,
        title: 'Yapay Zeka Cevabı',
        content: '', // Start empty
        aiResponse: content,
        source_book: state.currentBook || 'Sohbet',
        source_section: state.currentChapter || 'Soru-Cevap',
        tags: ['favori'],
        color: 'red',
        created_at: new Date().toISOString()
    };

    state.notes.unshift(note); // 🟢 FIX: Add to top of list
    saveNotesLocally();
    refreshNotesSidebar();
    if (typeof renderWorkspaceFavorites === 'function') {
        renderWorkspaceFavorites(state.notes.filter(n => (n.tags || []).includes('favori')));
    }

    showToast('Favorilere eklendi ✓');

    // Attempt async backend save
    saveNoteToBackend(note);
};

window.showToast = function (message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

function copyText(text) {
    navigator.clipboard.writeText(text);
}

// ═══ Tab Management ═══

function addNewTab() {
    const id = 'tab-' + state.nextTabId++;
    const newTab = {
        id: id,
        title: 'Yeni Risale',
        book: null,
        chapter: null,
        scrollTop: 0,
        content: '', // Cache content in memory
        breadcrumbs: ''
    };

    state.tabs.push(newTab);
    activateTab(id);
}

function closeTab(id, e) {
    if (e) e.stopPropagation();

    // Don't close if it's the last one, just reset it
    if (state.tabs.length === 1) {
        const tab = state.tabs[0];
        tab.title = 'Yeni Risale';
        tab.book = null;
        tab.chapter = null;
        tab.content = '';
        renderTabs();
        document.getElementById('reader-content').innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">📚</div>
              <p>Okumak istediğiniz kitabı sol menüden seçin</p>
            </div>
        `;
        document.getElementById('reader-breadcrumbs').innerHTML = '';
        saveTabsState();
        return;
    }

    const index = state.tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    // If closing active tab, switch to another
    if (id === state.activeTabId) {
        const newActive = state.tabs[index - 1] || state.tabs[index + 1];
        activateTab(newActive.id);
    }

    state.tabs = state.tabs.filter(t => t.id !== id);
    renderTabs();
    saveTabsState();
}

function activateTab(id) {
    // Save scroll position of current active tab before switching
    if (state.activeTabId) {
        const currentActiveTab = state.tabs.find(t => t.id === state.activeTabId);
        const contentEl = document.getElementById('reader-content');
        if (currentActiveTab && contentEl) {
            currentActiveTab.scrollTop = contentEl.scrollTop || 0;
            saveTabsState();
        }
    }

    state.activeTabId = id;
    renderTabs();

    const tab = state.tabs.find(t => t.id === id);
    if (!tab) return;

    // Restore User State
    state.currentBook = tab.book;
    state.currentChapter = tab.chapter;
    updateBookmarkButtonUI();

    // Restore UI
    const content = document.getElementById('reader-content');

    // Robust Restoration Check
    const hasMetadata = tab.book && tab.chapter;
    const isContentEmpty = !tab.content || tab.content.trim() === '';

    if (hasMetadata && isContentEmpty) {
        console.log(`♻️ Restoration: Reloading tab for ${tab.book}/${tab.chapter}`);
        loadChapter(tab.book, tab.chapter, true, null, tab.scrollTop || 0);
        return;
    }

    if (tab.content) {
        content.innerHTML = `
            <div class="reader-body">
                ${formatMarkdown(tab.content)}
            </div>
            <div class="reader-nav reader-nav-bottom">
                <button class="nav-prev btn btn-ghost" onclick="navigateChapter(-1)">← Önceki</button>
                <div class="reader-nav-info"></div>
                <button class="nav-next btn btn-ghost" onclick="navigateChapter(1)">Sonraki →</button>
            </div>
        `;
        content.scrollTop = tab.scrollTop || 0;
        initOttomanTooltips(content);

        // Restore Breadcrumbs
        const breadcrumbs = document.getElementById('reader-breadcrumbs');
        if (breadcrumbs) {
            breadcrumbs.innerHTML = tab.breadcrumbs || '';
        }

        // Update Sticky Nav Title
        const stickyTitle = document.getElementById('sticky-chapter-title');
        if (stickyTitle) {
            const currentC = state.chapters?.find(c => c.slug === tab.chapter);
            stickyTitle.textContent = currentC ? currentC.title : (tab.title || '');
        }

        updateNavButtons();
    } else {
        // Truly Empty Tab
        content.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">📚</div>
              <p>Okumak istediğiniz kitabı sol menüden seçin</p>
            </div>
        `;
        const breadcrumbs = document.getElementById('reader-breadcrumbs');
        if (breadcrumbs) {
            breadcrumbs.innerHTML = '';
        }

        const stickyTitle = document.getElementById('sticky-chapter-title');
        if (stickyTitle) {
            stickyTitle.textContent = '';
        }
    }

    saveTabsState();
}

function renderTabs() {
    const container = document.getElementById('reader-tabs');
    if (!container) return;

    container.innerHTML = state.tabs.map(tab => `
        <div class="reader-tab ${tab.id === state.activeTabId ? 'active' : ''}" onclick="activateTab('${tab.id}')">
            <span class="tab-icon">📖</span>
            <span class="tab-title">${tab.title}</span>
            <button class="close-tab" onclick="closeTab('${tab.id}', event)">✕</button>
        </div>
    `).join('');

    // Add New Tab Button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-tab-btn';
    addBtn.textContent = '+';
    addBtn.onclick = addNewTab;
    addBtn.title = "Yeni Risale Sekmesi Aç";
    container.appendChild(addBtn);
}


// ═══ Reader ═══
document.getElementById('book-list')?.addEventListener('click', async (e) => {
    const li = e.target.closest('li');
    if (!li) return;

    // Handle chapter click
    if (li.dataset.chapter) {
        const book = li.dataset.parentBook;
        const chapter = li.dataset.chapter;
        console.log(`📖 Loading chapter: ${book}/${chapter}`);
        loadChapter(book, chapter);

        document.querySelectorAll('.sidebar-list li').forEach(item => item.classList.remove('active'));
        li.classList.add('active');
        closeSidebarOnMobile();
        return;
    }

    // Handle book click
    const book = li.dataset.book;
    if (!book) return;

    console.log(`📚 Book clicked: ${book}`);

    // Toggle manual instead of calculated
    const currentlyExpanded = li.classList.toggle('expanded');

    // Close others
    document.querySelectorAll('.sidebar-list li.expanded').forEach(item => {
        if (item !== li) item.classList.remove('expanded');
    });

    if (!currentlyExpanded) return;

    // Fetch chapters if not already loaded
    let submenu = li.querySelector('.submenu');
    if (!submenu) {
        console.log(`🔍 Fetching chapters for: ${book}`);
        li.insertAdjacentHTML('beforeend', `<div class="submenu-loading">...</div>`);
        try {
            const res = await fetch(`${API_URL}/knowledge/kulliyat/${book}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

            const data = await res.json();
            li.querySelector('.submenu-loading')?.remove();

            submenu = document.createElement('ul');
            submenu.className = 'submenu';

            if (data.chapters && data.chapters.length > 0) {
                state.chapters = data.chapters;
                submenu.innerHTML = data.chapters.map(c => `
                    <li data-chapter="${c.slug}" data-parent-book="${book}">${c.title}</li>
                `).join('');
                console.log(`✅ Loaded ${data.chapters.length} chapters.`);
            } else {
                submenu.innerHTML = '<li class="empty-submenu">Henüz içerik yok</li>';
            }
            li.appendChild(submenu);
        } catch (err) {
            console.error('Tree fetch error:', err);
            const loading = li.querySelector('.submenu-loading');
            if (loading) loading.innerHTML = '❌';
        }
    } else {
        // Update state logic
        const chapterItems = submenu.querySelectorAll('li[data-chapter]');
        state.chapters = Array.from(chapterItems).map(item => ({
            slug: item.dataset.chapter,
            title: item.textContent
        }));
    }
});

async function loadChapter(book, chapter, updateTab = true, scrollToText = null, forceScrollTop = null) {
    console.log('loadChapter çağrıldı:', { book, chapter, updateTab, scrollToText, forceScrollTop });
    const readerTitle = document.getElementById('reader-title');
    const content = document.getElementById('reader-content');

    // Update Global State
    state.currentBook = book;
    state.currentChapter = chapter;

    if (updateTab) {
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (activeTab) {
            activeTab.book = book;
            activeTab.chapter = chapter;
            // Temporary title while loading
            activeTab.title = 'Yükleniyor...';
            renderTabs();
        }
    }

    // Ensure state.chapters is populated for the current book (Critical for Navigation)
    if (!state.chapters || state.chapters.length === 0 || (state.chapters[0] && state.chapters[0].slug.split('-')[0] !== chapter.split('-')[0] && state.currentBook !== book)) {
        // We need to fetch the chapter list for this book
        try {
            const res = await fetch(`${API_URL}/knowledge/kulliyat/${book}`);
            if (res.ok) {
                const data = await res.json();
                if (data.chapters) {
                    state.chapters = data.chapters;
                    console.log(`✅ Loaded chapter list for ${book} (Navigation Ready)`);
                }
            }
        } catch (e) {
            console.error('Failed to load chapter list for navigation', e);
        }
    }

    content.innerHTML = '<div class="reading-loading"><div class="spinner"></div><p>Yükleniyor...</p></div>';
    switchView('reader');

    try {
        const res = await fetch(`${API_URL}/knowledge/kulliyat/${book}/${chapter}`);
        if (!res.ok) throw new Error('İçerik yüklenemedi');

        const text = await res.text();

        // Clean markdown (same logic as before)
        const cleanText = text.replace(/^---[\s\S]*?---\n*/, '');
        const polishedText = cleanText.replace(/^# .*\n/, '');

        // Store for Simplification Feature
        state.chapterText = polishedText;
        state.isSimplified = false;
        const simBtn = document.getElementById('simplify-toggle');
        if (simBtn) {
            simBtn.innerHTML = '<span class="icon">✨</span> Sadeleştir';
            simBtn.classList.remove('active');
            simBtn.disabled = false;
        }

        // Formatting: use proper title from API data
        const chapterData = state.chapters?.find(c => c.slug === chapter);
        const displayTitle = chapterData?.title || chapter.replace(/^\d{3}-/, '').split('-').map(w => (w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

        // Update Breadcrumbs: use display name from sidebar
        const bookLi = document.querySelector(`li[data-book="${book}"]`);
        const bookName = bookLi?.childNodes[0]?.textContent?.trim() || book.charAt(0).toUpperCase() + book.slice(1);
        const breadcrumbsHTML = `
            <span>Külliyat</span> <span class="breadcrumb-sep">/</span>
            <span>${bookName}</span> <span class="breadcrumb-sep">/</span>
            <span style="color:var(--text-primary); font-weight:500;">${displayTitle}</span>
        `;
        document.getElementById('reader-breadcrumbs').innerHTML = breadcrumbsHTML;

        // Render Content
        content.innerHTML = `
            <div class="reader-body">
                ${formatMarkdown(polishedText)}
            </div>
            <div class="reader-nav reader-nav-bottom">
                <button class="nav-prev btn btn-ghost" onclick="navigateChapter(-1)">← Önceki</button>
                <div class="reader-nav-info"></div>
                <button class="nav-next btn btn-ghost" onclick="navigateChapter(1)">Sonraki →</button>
            </div>
        `;

        // Update Sticky Nav Title
        const stickyTitle = document.getElementById('sticky-chapter-title');
        if (stickyTitle) {
            const currentC = state.chapters.find(c => c.slug === chapter);
            stickyTitle.textContent = currentC ? currentC.title : '';
        }

        updateNavButtons();
        initOttomanTooltips(content);
        updateBookmarkButtonUI();

        // Handle Scrolling
        if (scrollToText) {
            setTimeout(() => {
                const found = findAndScrollToText(content, scrollToText);
                if (!found) content.scrollTop = 0;
            }, 100);
        } else if (forceScrollTop !== null) {
            setTimeout(() => {
                content.scrollTop = forceScrollTop;
            }, 100);
        } else {
            content.scrollTop = 0;
        }

        // Update Tab State
        if (updateTab) {
            const activeTab = state.tabs.find(t => t.id === state.activeTabId);
            if (activeTab) {
                activeTab.title = displayTitle;
                activeTab.content = polishedText;
                activeTab.breadcrumbs = breadcrumbsHTML;
                renderTabs();
                saveTabsState();

                // Also save to User Progress (Backend)
                saveUserProgress(book, chapter);

                // Load Workspace Data (Notes & Concepts)
                loadWorkspaceData(book, chapter);

                // Load Workspace Data (Notes & Concepts)
                loadWorkspaceData(book, chapter);

                // Sync Data Sequentially (Safe)
                // This ensures we have the latest notes and highlights for the current chapter
                await syncUserData();

                // Re-apply highlights after sync
                const currentNotes = state.notes.filter(n => n.source_book === book && n.source_section === chapter);
                applyHighlightsFromNotes(currentNotes);

                // Trigger Auto-Reference Analysis (Agent) - OPTIONAL: keep if needed
                setTimeout(() => {
                    findReferences(polishedText);
                }, 500);
            }
        }
    } catch (err) {
        content.innerHTML = `<div class="form-error">❌ ${err.message}</div>`;
    }
}

function findAndScrollToText(container, text) {
    if (!text || text.length < 5) return false;

    // Normalize logic: remove punctuation, lowercase
    // But text walker needs precision. Let's try simple exact match first, then lenient.
    // For now, let's use window.find() which is simplest but browser dependent, 
    // OR tree walker.
    // Given formatting (markdown -> html) mismatches, exact string match often fails.
    // We'll search for the first 50 chars of the text.

    const searchPart = text.substring(0, 50).replace(/[^\w\sığüşöçİĞÜŞÖÇâîû]/g, '').toLowerCase();

    // Tree Walker Approach
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        const nodeText = node.textContent.replace(/[^\w\sığüşöçİĞÜŞÖÇâîû]/g, '').toLowerCase();
        if (nodeText.includes(searchPart)) {
            // Found it! Scroll parent into view
            const parent = node.parentElement;
            parent.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Temporary yellow highlight for 3 seconds
            const previousBg = parent.style.backgroundColor;
            const previousTransition = parent.style.transition;
            parent.style.transition = 'background-color 180ms ease';
            parent.style.backgroundColor = 'rgba(255, 235, 59, 0.65)';
            setTimeout(() => {
                parent.style.backgroundColor = previousBg;
                parent.style.transition = previousTransition;
            }, 3000);
            return true;
        }
    }
    return false;
}

async function saveUserProgress(book, chapter) {
    if (!state.user) return;
    try {
        await fetch(`${API_URL}/user/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ book_slug: book, chapter_slug: chapter, percentage: 0 })
        });
    } catch (e) { console.error('Progress save error', e); }
}

function updateNavButtons() {
    const prevBtns = document.querySelectorAll('.nav-prev');
    const nextBtns = document.querySelectorAll('.nav-next');
    if (prevBtns.length === 0 || nextBtns.length === 0) return;

    const idx = state.chapters.findIndex(c => c.slug === state.currentChapter);
    const isFirst = idx <= 0;
    const isLast = idx === -1 || idx >= state.chapters.length - 1;

    prevBtns.forEach(btn => btn.disabled = isFirst);
    nextBtns.forEach(btn => btn.disabled = isLast);
}

async function navigateChapter(dir) {
    // Safety check: if chapters not loaded, try to load them
    if (!state.chapters || state.chapters.length === 0) {
        try {
            const res = await fetch(`${API_URL}/knowledge/kulliyat/${state.currentBook}`);
            if (res.ok) {
                const data = await res.json();
                state.chapters = data.chapters || [];
            }
        } catch (e) { console.error('Nav fetch error', e); }
    }

    let idx = state.chapters.findIndex(c => c.slug === state.currentChapter);

    // If exact slug not found (mismatch?), try fuzzy match or first
    if (idx === -1 && state.chapters.length > 0) {
        // Fallback: try to find by similarity or just default to 0
        idx = 0;
    }

    const nextIdx = idx + dir;

    if (nextIdx >= 0 && nextIdx < state.chapters.length) {
        const nextChapter = state.chapters[nextIdx];
        loadChapter(state.currentBook, nextChapter.slug);

        // Update sidebar active class
        const sidebarLi = document.querySelector(`.submenu li[data-chapter="${nextChapter.slug}"]`);
        if (sidebarLi) {
            document.querySelectorAll('.submenu li').forEach(li => li.classList.remove('active'));
            sidebarLi.classList.add('active');
            // Ensure parent is expanded
            const parentLi = sidebarLi.closest('li[data-book]');
            if (parentLi && !parentLi.classList.contains('expanded')) {
                parentLi.classList.add('expanded');
            }
            sidebarLi.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

window.navigateChapter = navigateChapter;
window.loadChapter = loadChapter;

async function loadSection(type, book, section) {
    try {
        const res = await fetch(`${API_URL}/knowledge/${type}/${book}/${section}`);
        if (res.ok) {
            const md = await res.text();
            const readerContent = document.getElementById('reader-content');
            readerContent.innerHTML = formatMarkdown(md);
            readerContent.classList.add('ottoman-text');
            initOttomanTooltips(readerContent);
        }
    } catch (e) {
        console.error('Load section error:', e);
    }
}

// ═══ Highlighting System ═══
function applyHighlightsFromNotes(notes) {
    if (!notes || notes.length === 0) return;

    // Clear existing highlights first? Maybe not needed if we re-render content on load
    // But if called dynamically, we might want to avoid duplicates. 
    // For now, simpler is better: assume fresh content or idempotent wrapping.

    notes.forEach(note => {
        if (note.source_text && note.color) {
            // Distinguish between pure Highlight and Note (with content)
            // If it has content OR explicitly typed as 'note' (and not just empty content note)
            // Actually, simplest check: if it has content, it's a note.
            // If it's a highlight type, it's a highlight.

            const hasContent = note.content && note.content.trim().length > 0;
            const isNoteType = note.type === 'note'; // Backend might differentiate

            // User wants "box" for notes (making explanation) and "underline" for highlights
            // If user saved a note with empty content, it is effectively a highlight.

            let styleColor = note.color;
            if (hasContent) {
                styleColor = `note-${note.color}`;
            }

            highlightText(note.source_text, styleColor);
        }
    });
}

function highlightText(text, color) {
    if (!text || text.length < 3) return;

    const container = document.getElementById('reader-content');
    if (!container) return;

    // Clean text for matching
    const cleanSearch = text.trim();

    // Advanced: Use TreeWalker to find text nodes
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const nodesToHighlight = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.textContent.includes(cleanSearch)) {
            // Check if already highlighted to avoid double wrapping
            if (node.parentElement.classList.contains('highlight-' + color)) continue;
            nodesToHighlight.push(node);
        }
    }

    // Apply highlights
    nodesToHighlight.forEach(node => {
        const span = document.createElement('span');
        span.className = `highlight-${color}`;
        span.textContent = cleanSearch;

        // Split node if necessary
        const fullText = node.textContent;
        const idx = fullText.indexOf(cleanSearch);

        if (idx >= 0) {
            const before = fullText.substring(0, idx);
            const after = fullText.substring(idx + cleanSearch.length);

            const fragment = document.createDocumentFragment();
            if (before) fragment.appendChild(document.createTextNode(before));
            fragment.appendChild(span);
            if (after) fragment.appendChild(document.createTextNode(after));

            node.parentNode.replaceChild(fragment, node);
        }
    });
}

async function loadWorkspaceData(book, chapter) {
    if (!state.user) return;

    // 1. Clear previous data
    const conceptsList = document.getElementById('workspace-concepts-list');
    const notesList = document.getElementById('workspace-notes-list');
    if(conceptsList) conceptsList.innerHTML = '<div class="spinner"></div>';
    if(notesList) notesList.innerHTML = '<div class="spinner"></div>';

    try {
        // Load favorites
        const favorites = state.notes.filter(n => (n.tags || []).includes('favori'));
        renderWorkspaceFavorites(favorites);

        // Fetch Notes (Existing endpoint or filter local?) 
        // We already have state.notes but better to fetch fresh or filter
        // For efficiency, let's filter local state.notes first, but backend refetch is safer for sync
        const chapterNotes = state.notes.filter(n => n.source_book === book && n.source_section === chapter);

        // Render ALL notes in the panel (no filter)
        renderWorkspaceNotes(state.notes);

        // Apply highlights ONLY for the current chapter
        applyHighlightsFromNotes(chapterNotes);

    } catch (e) {
        console.error('Workspace fetch error', e);
        if(conceptsList) conceptsList.innerHTML = '<div class="form-error">Veri yüklenemedi</div>';
    }
}

function renderWorkspaceFavorites(favorites) {
    const container = document.getElementById('workspace-concepts-list');
    if (!container) return;
    if (!favorites || favorites.length === 0) {
        container.innerHTML = '<div class="empty-state-sm">Henüz favorilere eklenmiş bir öğe yok.</div>';
        return;
    }

    container.innerHTML = favorites.map(f => `
        <div class="concept-card" onclick="viewNote('${f.id}')">
            <div class="concept-header">
                <span class="concept-term">${f.title || 'Favori'}</span>
                <span class="concept-date">${new Date(f.created_at).toLocaleDateString('tr-TR')}</span>
            </div>
            <div class="concept-preview">${(f.aiResponse || f.content || '').substring(0, 100)}...</div>
        </div>
    `).join('');
}

function renderWorkspaceNotes(notes) {
    const container = document.getElementById('workspace-notes-list');
    if (!container) return;
    if (!notes || notes.length === 0) {
        container.innerHTML = '<div class="empty-state-sm">Henüz not yok.</div>';
        return;
    }

    const grouped = {};
    notes.forEach(note => {
        const book = note.source_book || 'Genel Kitap';
        const section = note.source_section || 'Genel Bölüm';
        if (!grouped[book]) grouped[book] = {};
        if (!grouped[book][section]) grouped[book][section] = [];
        grouped[book][section].push(note);
    });
} // End of renderWorkspaceNotes (Temporary - will be fixed below)

// ─── Geçmişi Yükle ───
async function loadConversations() {
    if (!state.user) return;
    try {
        const res = await fetch(`${API_URL}/conversations`, {
            headers: { Authorization: `Bearer ${state.token}` }
        })
        state.conversations = await res.json()
        renderConversations()
    } catch (err) {
        console.error('Geçmiş yüklenemedi:', err)
    }
}

// ─── Konuşma Kartı Render ───
function renderConvItem(conv, inCategory) {
    const badge = state._convCats[conv.id] || ''
    const excerpt = state._convExcerpts[conv.id] || ''
    const dateStr = formatDateTime(conv.updated_at)
    return `
    <div class="gecmis-item"
         data-id="${conv.id}"
         draggable="true"
         ondragstart="onConvDragStart(event,'${conv.id}')"
         ondragover="onConvDragOver(event)"
         ondrop="onConvDrop(event,'${conv.id}')"
         ondragend="onConvDragEnd(event)"
         onclick="loadConversation('${conv.id}')">
        <div class="gecmis-item-top">
            <span class="gecmis-drag-handle" title="Taşı">⠿</span>
            <span class="gecmis-item-baslik">${escapeHtml(conv.title)}</span>
            <button class="gecmis-sil-btn" onclick="deleteConversation(event,'${conv.id}')" title="Sil">×</button>
        </div>
        <div class="gecmis-item-divider"></div>
        ${excerpt ? `<div class="gecmis-item-excerpt">"${escapeHtml(excerpt)}..."</div>` : ''}
        <div class="gecmis-item-footer">
            ${badge ? `<span class="gecmis-cat-badge">${escapeHtml(badge)}</span>` : ''}
            <span class="gecmis-item-date">${dateStr}</span>
            ${inCategory ? `<button class="gecmis-uncat-btn" onclick="removeFromCategory(event,'${conv.id}')" title="Kategoriden çıkar">↑</button>` : ''}
            <button class="gecmis-cat-btn" onclick="openCategoryPicker(event,'${conv.id}')" title="Etiket ekle">🏷</button>
        </div>
    </div>`
}

// ─── Geçmiş Listesini Render Et ───
function renderConversations() {
    const listEl = document.getElementById('gecmis-listesi')
    if (!listEl) return

    if (!state.conversations || !state.conversations.length) {
        listEl.innerHTML = `<div class="gecmis-empty">Henüz konuşma yok.<br>Bir soru sorarak başla.</div>`
        return
    }

    let convs = [...state.conversations]

    // Filtre
    if (state._gecmisSearch) {
        const q = state._gecmisSearch.toLowerCase()
        convs = convs.filter(c => c.title.toLowerCase().includes(q))
    }

    // Sıralama
    if (state._gecmisSort === 'date-asc') {
        convs.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))
    } else if (state._gecmisSort === 'name-asc') {
        convs.sort((a, b) => a.title.localeCompare(b.title, 'tr'))
    } else {
        convs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    }

    if (!convs.length) {
        listEl.innerHTML = `<div class="gecmis-empty">Sonuç bulunamadı.</div>`
        return
    }

    const catMap = state._catMap
    const uncategorized = convs.filter(c => !catMap[c.id])
    let html = uncategorized.map(c => renderConvItem(c, false)).join('')

    state._cats.forEach(cat => {
        const catConvs = convs.filter(c => catMap[c.id] === cat.id)
        const isOpen = cat.open !== false
        html += `
        <div class="gecmis-cat-accordion"
             data-cat-id="${cat.id}"
             ondragover="onCatDragOver(event,'${cat.id}')"
             ondragleave="onCatDragLeave(event)"
             ondrop="onCatDrop(event,'${cat.id}')">
            <div class="gecmis-cat-header" onclick="toggleConvCategory('${cat.id}')">
                <button class="gecmis-cat-toggle-btn" onclick="event.stopPropagation();toggleConvCategory('${cat.id}')">${isOpen ? '▾' : '▸'}</button>
                <span class="gecmis-cat-name" onclick="event.stopPropagation()" ondblclick="event.stopPropagation();editCatName('${cat.id}',this)" title="Düzenlemek için çift tıkla">${escapeHtml(cat.name)}</span>
                <span class="gecmis-cat-count">${catConvs.length}</span>
                <button class="gecmis-cat-del" onclick="event.stopPropagation();deleteCategory('${cat.id}')" title="Kategoriyi sil">×</button>
            </div>
            <div class="gecmis-cat-body" style="${isOpen ? '' : 'display:none'}">${catConvs.map(c => renderConvItem(c, true)).join('')}</div>
        </div>`
    })

    listEl.innerHTML = html
}

// ─── Konuşmayı Yükle (tıklanınca) ───
async function loadConversation(convId) {
    state.currentConvId = convId

    try {
        const res = await fetch(`${API_URL}/conversations/${convId}/messages`, {
            headers: { Authorization: `Bearer ${state.token}` }
        })
        const messages = await res.json()

        const conv = state.conversations.find(c => c.id === convId)
        const titleEl = document.getElementById('conv-view-title')
        const msgsEl = document.getElementById('conv-view-messages')

        if (titleEl) titleEl.textContent = conv ? conv.title : 'Konuşma'
        if (msgsEl) {
            msgsEl.innerHTML = messages.map(m => `
                <div class="message ${m.role}">
                    <div class="message-avatar">${m.role === 'user' ? '👤' : '🕌'}</div>
                    <div class="message-body">
                        ${m.role === 'assistant' ? parseCitationLinks(formatMarkdown(m.content)) : `<p>${escapeHtml(m.content)}</p>`}
                    </div>
                </div>
            `).join('')
        }

        state._convViewMessages = messages
        openModal('conv-view-modal')

    } catch (err) {
        showToast('Konuşma yüklenemedi', 'error')
    }
}

function copyConvToClipboard() {
    if (!state._convViewMessages) return
    const text = state._convViewMessages.map(m =>
        `${m.role === 'user' ? 'Sen' : 'NurZeka'}: ${m.content}`
    ).join('\n\n')
    navigator.clipboard.writeText(text).then(() => showToast('Kopyalandı ✓', 'success'))
}

function shareConv() {
    if (!state._convViewMessages) return
    const titleEl = document.getElementById('conv-view-title')
    const title = titleEl ? titleEl.textContent : 'NurZeka Konuşması'
    const text = state._convViewMessages.map(m =>
        `${m.role === 'user' ? 'Sen' : 'NurZeka'}: ${m.content}`
    ).join('\n\n')
    if (navigator.share) {
        navigator.share({ title, text })
    } else {
        navigator.clipboard.writeText(text).then(() => showToast('Panoya kopyalandı ✓', 'success'))
    }
}

// ─── Yeni Konuşma Başlat ───
function startNewConversation() {
    state.currentConvId = null
    state.chatHistory = []
    clearChatArea()

    // Show welcome
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.classList.remove('hidden');
}

// ─── Konuşmayı Kaydet ───
async function saveCurrentConversation() {
    if (!state.user) {
        showToast('Kaydetmek için giriş yap', 'error');
        return;
    }
    if (!state.chatHistory.length) {
        showToast('Kaydedilecek konuşma yok', 'error');
        return;
    }

    try {
        const firstUser = state.chatHistory.find(m => m.role === 'user');
        const title = firstUser ? firstUser.content.slice(0, 60) : 'Konuşma';

        const convRes = await fetch(`${API_URL}/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
            body: JSON.stringify({ title })
        });
        if (!convRes.ok) throw new Error();
        const conv = await convRes.json();

        const msgCount = state.chatHistory.length;
        for (const msg of state.chatHistory) {
            await fetch(`${API_URL}/conversations/${conv.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
                body: JSON.stringify({ role: msg.role, content: msg.content })
            });
        }

        state.currentConvId = conv.id;

        // Excerpt: ilk AI cevabının başı (local)
        const firstAI = state.chatHistory.find(m => m.role === 'assistant');
        if (firstAI) {
            state._convExcerpts[conv.id] = firstAI.content.replace(/[#*`]/g, '').slice(0, 120);
            localStorage.setItem('nurzeka_conv_excerpts', JSON.stringify(state._convExcerpts));
        }

        // Kaydedilen mesajları temizle — çift kayıt engeli
        state.chatHistory = []
        state.currentConvId = null

        // Optimistic update — mevcut listeyi silmeden başa ekle
        state.conversations.unshift({
            id: conv.id, title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: msgCount
        });
        renderConversations();
        showToast('Konuşma kaydedildi ✓', 'success');
    } catch (err) {
        showToast('Kaydetme başarısız', 'error');
    }
}

// ─── Tekli Mesaj Çifti Kaydet ───
async function saveSingleExchange(question, answer) {
    if (!state.user) { showToast('Kaydetmek için giriş yap', 'error'); return; }
    try {
        const title = question.slice(0, 60)
        const convRes = await fetch(`${API_URL}/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
            body: JSON.stringify({ title })
        });
        if (!convRes.ok) throw new Error();
        const conv = await convRes.json();

        for (const [role, content] of [['user', question], ['assistant', answer]]) {
            await fetch(`${API_URL}/conversations/${conv.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
                body: JSON.stringify({ role, content })
            });
        }

        state._convExcerpts[conv.id] = answer.replace(/[#*`]/g, '').slice(0, 120)
        localStorage.setItem('nurzeka_conv_excerpts', JSON.stringify(state._convExcerpts))

        // Optimistic update — mevcut listeyi silmeden başa ekle
        state.conversations.unshift({
            id: conv.id, title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: 2
        });
        renderConversations();
        showToast('Bu soru-cevap kaydedildi ✓', 'success');
    } catch {
        showToast('Kaydetme başarısız', 'error');
    }
}

// ─── Sohbet Alanını Temizle ───
function clearChatArea() {
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.classList.add('hidden');
}

// ─── Konuşma Sil ───
async function deleteConversation(event, convId) {
    if (event) event.stopPropagation()

    if (!confirm('Bu konuşmayı silmek istiyor musun?')) return

    // Optimistic update
    state.conversations = state.conversations.filter(c => c.id !== convId)
    renderConversations()

    if (state.currentConvId === convId) {
        startNewConversation()
    }

    try {
        await fetch(`${API_URL}/conversations/${convId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${state.token}` }
        })
    } catch (err) {
        await loadConversations()
        showToast('Silinemedi, tekrar dene', 'error')
    }
}

// ─── Yardımcı: Tarih Grupla ───
function groupByDate(conversations) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const week = new Date(today); week.setDate(week.getDate() - 7)

    const groups = { 'Bugün': [], 'Bu Hafta': [], 'Daha Önce': [] }

    conversations.forEach(conv => {
        const d = new Date(conv.updated_at)
        if (d >= today) groups['Bugün'].push(conv)
        else if (d >= week) groups['Bu Hafta'].push(conv)
        else groups['Daha Önce'].push(conv)
    })

    return Object.fromEntries(
        Object.entries(groups).filter(([_, v]) => v.length > 0)
    )
}

function formatDate(isoStr) {
    const d = new Date(isoStr)
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function formatDateTime(isoStr) {
    const d = new Date(isoStr)
    const date = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
    const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    return `${date} · ${time}`
}

function updateConvMeta(convId) {
    if (!convId) return;
    const conv = state.conversations.find(c => c.id === convId)
    if (conv) {
        conv.message_count += 2
        conv.updated_at = new Date().toISOString()
        state.conversations = [
            conv,
            ...state.conversations.filter(c => c.id !== convId)
        ]
        renderConversations()
    } else {
        // Find was not successful, reload all
        loadConversations();
    }
}

function scrollChatToBottom() {
    const chatEl = document.getElementById('chat-messages');
    if (chatEl && chatEl.parentElement) {
        chatEl.parentElement.scrollTop = chatEl.parentElement.scrollHeight;
    }
}

// ─── Kategori Picker ───
const CONV_CATS = ['Genel', 'Akaid', 'Ahlak', 'İbadet', 'Siyer', 'Külliyat', 'Diğer']

function openCategoryPicker(event, convId) {
    event.stopPropagation()
    document.querySelectorAll('.gecmis-cat-picker').forEach(el => el.remove())

    const picker = document.createElement('div')
    picker.className = 'gecmis-cat-picker'
    picker.innerHTML = CONV_CATS.map(cat => `
        <button onclick="setConvCategory(event,'${convId}','${cat}')"
                class="${(state._convCats[convId] || '') === cat ? 'active' : ''}">
            ${cat}
        </button>
    `).join('') + `<button onclick="setConvCategory(event,'${convId}','')" class="cat-temizle">Kaldır</button>`

    const btn = event.currentTarget
    const rect = btn.getBoundingClientRect()
    picker.style.position = 'fixed'
    picker.style.top = (rect.bottom + 4) + 'px'
    picker.style.right = (window.innerWidth - rect.right) + 'px'
    document.body.appendChild(picker)

    setTimeout(() => {
        document.addEventListener('click', () => picker.remove(), { once: true })
    }, 0)
}

function setConvCategory(event, convId, cat) {
    event.stopPropagation()
    document.querySelectorAll('.gecmis-cat-picker').forEach(el => el.remove())
    if (cat) {
        state._convCats[convId] = cat
    } else {
        delete state._convCats[convId]
    }
    localStorage.setItem('nurzeka_conv_cats', JSON.stringify(state._convCats))
    renderConversations()
}

// ─── Drag & Drop ───
function onConvDragStart(event, convId) {
    state._dragConvId = convId
    event.dataTransfer.effectAllowed = 'move'
    event.currentTarget.classList.add('dragging')
}

function onConvDragOver(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    event.currentTarget.classList.add('drag-over')
    setTimeout(() => event.currentTarget.classList.remove('drag-over'), 200)
}

function onConvDrop(event, targetId) {
    event.preventDefault()
    event.stopPropagation()
    const fromId = state._dragConvId
    if (!fromId || fromId === targetId) return

    // Mevcut sıralamayı al veya oluştur
    let order = state._convOrder.length
        ? [...state._convOrder]
        : state.conversations.map(c => c.id)

    const fromIdx = order.indexOf(fromId)
    const toIdx = order.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return

    order.splice(fromIdx, 1)
    order.splice(toIdx, 0, fromId)
    state._convOrder = order
    localStorage.setItem('nurzeka_conv_order', JSON.stringify(order))
    renderConversations()
}

function onConvDragEnd(event) {
    event.currentTarget.classList.remove('dragging')
    state._dragConvId = null
}

// ─── Kategori Yönetimi ───
function saveCats() {
    localStorage.setItem('nurzeka_cats', JSON.stringify(state._cats))
    localStorage.setItem('nurzeka_catmap', JSON.stringify(state._catMap))
}

function createCategory() {
    const name = prompt('Kategori adı:', 'Yeni Kategori')
    if (!name || !name.trim()) return
    state._cats.push({ id: generateUUID(), name: name.trim(), open: true })
    saveCats()
    renderConversations()
}

function toggleConvCategory(catId) {
    const cat = state._cats.find(c => c.id === catId)
    if (!cat) return
    cat.open = !(cat.open !== false)
    saveCats()
    renderConversations()
}

function editCatName(catId, nameEl) {
    const cat = state._cats.find(c => c.id === catId)
    if (!cat) return
    const input = document.createElement('input')
    input.type = 'text'
    input.value = cat.name
    input.className = 'gecmis-cat-name-input'
    nameEl.replaceWith(input)
    input.focus()
    input.select()
    const save = () => {
        const v = input.value.trim()
        if (v) cat.name = v
        saveCats()
        renderConversations()
    }
    input.addEventListener('blur', save)
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); save() }
        if (e.key === 'Escape') renderConversations()
    })
}

function deleteCategory(catId) {
    if (!confirm('Kategoriyi sil? Konuşmalar kategorisiz kalır.')) return
    state._cats = state._cats.filter(c => c.id !== catId)
    Object.keys(state._catMap).forEach(convId => {
        if (state._catMap[convId] === catId) delete state._catMap[convId]
    })
    saveCats()
    renderConversations()
}

function removeFromCategory(event, convId) {
    event.stopPropagation()
    delete state._catMap[convId]
    saveCats()
    renderConversations()
}

function onUncatDragOver(event) {
    // sadece kategori içinden gelen kartlar için kabul et
    if (!state._dragConvId || !state._catMap[state._dragConvId]) return
    event.preventDefault()
    document.getElementById('gecmis-listesi').classList.add('uncat-drop-target')
}

function onUncatDragLeave(event) {
    // listeden tamamen çıkınca kaldır
    if (!event.currentTarget.contains(event.relatedTarget)) {
        event.currentTarget.classList.remove('uncat-drop-target')
    }
}

function onUncatDrop(event) {
    event.preventDefault()
    event.currentTarget.classList.remove('uncat-drop-target')
    const convId = state._dragConvId
    if (!convId) return
    delete state._catMap[convId]
    saveCats()
    renderConversations()
}

function onCatDragOver(event) {
    event.preventDefault()
    event.currentTarget.classList.add('drop-target')
}

function onCatDragLeave(event) {
    event.currentTarget.classList.remove('drop-target')
}

function onCatDrop(event, catId) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.classList.remove('drop-target')
    const convId = state._dragConvId
    if (!convId) return
    state._catMap[convId] = catId
    saveCats()
    renderConversations()
}

function onGecmisSearch(val) {
    state._gecmisSearch = val
    renderConversations()
}

function onGecmisSort(val) {
    state._gecmisSort = val
    renderConversations()
}

// Expose to global window
window.loadConversation = loadConversation;
window.startNewConversation = startNewConversation;
window.deleteConversation = deleteConversation;
window.saveCurrentConversation = saveCurrentConversation;
window.copyConvToClipboard = copyConvToClipboard;
window.shareConv = shareConv;
window.openCategoryPicker = openCategoryPicker;
window.setConvCategory = setConvCategory;
window.onConvDragStart = onConvDragStart;
window.onConvDragOver = onConvDragOver;
window.onConvDrop = onConvDrop;
window.onConvDragEnd = onConvDragEnd;
window.saveSingleExchange = saveSingleExchange;
window.createCategory = createCategory;
window.toggleConvCategory = toggleConvCategory;
window.editCatName = editCatName;
window.deleteCategory = deleteCategory;
window.removeFromCategory = removeFromCategory;
window.onCatDragOver = onCatDragOver;
window.onCatDragLeave = onCatDragLeave;
window.onCatDrop = onCatDrop;
window.onGecmisSearch = onGecmisSearch;
window.onGecmisSort = onGecmisSort;
window.onUncatDragOver = onUncatDragOver;
window.onUncatDragLeave = onUncatDragLeave;
window.onUncatDrop = onUncatDrop;

function renderWorkspaceNotes(notes) {
    const container = document.getElementById('workspace-notes-list');
    if (!container) return;
    if (!notes || notes.length === 0) {
        container.innerHTML = '<div class="empty-state-sm">Henüz not yok.</div>';
        return;
    }

    const grouped = {};
    notes.forEach(note => {
        const book = note.source_book || 'Genel Kitap';
        const section = note.source_section || 'Genel Bölüm';
        if (!grouped[book]) grouped[book] = {};
        if (!grouped[book][section]) grouped[book][section] = [];
        grouped[book][section].push(note);
    });

    let html = '';
    for (const [book, sections] of Object.entries(grouped)) {
        const bookId = 'ws-book-' + book.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        let totalBookNotes = 0;
        let sectionsHtml = '';

        for (const [section, sectionNotes] of Object.entries(sections)) {
            totalBookNotes += sectionNotes.length;
            const secId = bookId + '-sec-' + section.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

            sectionsHtml += `
            <div class="note-category section-group" style="margin-left: 10px;" ondragover="window.handleCategoryDragOver(event, this)" ondragleave="window.handleCategoryDragLeave(event, this)" ondrop="window.handleCategoryDrop(event, '${book}', '${section}')">
                <div class="note-category-header" onclick="window.toggleCategory('${secId}', event)" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.85em; font-weight: 600; color: var(--text-secondary); margin: 8px 0 5px 5px; padding-bottom: 3px; border-bottom: 1px dashed var(--border-color); user-select: none;">
                    <span>${section} (${sectionNotes.length})</span>
                    <span id="icon-${secId}" style="transition: transform 0.2s;">▶</span>
                </div>
                <div id="${secId}" style="display: none; padding-left: 10px; border-left: 2px solid var(--border-color);">
                    ${sectionNotes.map(n => {
                const isHighlight = n.type === 'highlight' || (!n.content && !n.aiResponse);
                const previewText = n.content || n.aiResponse || n.source_text || '';
                const icon = isHighlight ? '🖍️' : '📝';
                const safePreview = (text) => text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : '';

                return `
                        <div class="note-card" style="position:relative; cursor:pointer" onclick="handleNoteClick('${n.id}')" draggable="true" ondragstart="window.handleNoteDragStart(event, '${n.id}')">
                            <div style="position:absolute; right:5px; top:5px; display:flex; gap:5px; z-index:2">
                                <button onclick="event.stopPropagation(); window.editNote('${n.id}')" class="btn-icon-sm" title="Düzenle" style="background:rgba(255,255,255,0.8); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer">✏️</button>
                                <button onclick="event.stopPropagation(); viewNote('${n.id}')" class="btn-icon-sm" title="Detay" style="background:rgba(255,255,255,0.8); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer">👁️</button>
                                <button onclick="event.stopPropagation(); window.deleteNote('${n.id}', event)" class="btn-icon-sm btn-delete-note" title="Sil" style="background:rgba(255,255,255,0.8); color:var(--danger); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer">🗑️</button>
                                <span title="Sürükle" style="cursor:grab; background:rgba(255,255,255,0.8); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center;">↕️</span>
                            </div>
                            <div class="note-header" style="padding-right:110px">
                                <span class="note-title">${icon} ${n.title || (isHighlight ? 'Vurgulama' : 'Not')}</span>
                                <span class="note-date">${new Date(n.created_at).toLocaleDateString('tr-TR')}</span>
                            </div>
                            <div class="note-preview" style="${isHighlight ? 'font-style:italic; opacity:0.8' : ''}">
                                "${safePreview(previewText).substring(0, 60)}${previewText.length > 60 ? '...' : ''}"
                            </div>
                        </div>`;
            }).join('')}
                </div>
            </div>`;
        } // Close sections loop

        html += `
        <div class="note-category book-group">
            <div class="note-category-header" onclick="window.toggleCategory('${bookId}', event)" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.95em; font-weight: bold; color: var(--primary); margin: 15px 0 5px 0; padding-bottom: 5px; border-bottom: 2px solid var(--primary); user-select: none;">
                <span>${book} (${totalBookNotes})</span>
                <span id="icon-${bookId}" style="transition: transform 0.2s;">▶</span>
            </div>
            <div id="${bookId}" style="display: none;">
                ${sectionsHtml}
            </div>
        </div>`;
    } // Close books loop

    container.innerHTML = html;
} // Close renderWorkspaceNotes

window.handleNoteClick = (id) => {
    try {
        console.log('handleNoteClick called for ID:', id);
        const note = state.notes.find(n => n.id === id);

        if (!note) {
            console.error('Note not found in state for ID:', id);
            console.log('Available notes:', state.notes.map(n => n.id));
            return;
        }

        console.log('Note found:', note.title);

        // 1. Navigate to Source (Wrapped in try-catch to not block modal)
        if (note.source_book && note.source_section) {
            try {
                console.log('Navigating to:', note.source_book, note.source_section);
                if (state.currentBook === note.source_book && state.currentChapter === note.source_section) {
                    const content = document.getElementById('reader-content');
                    if (window.findAndScrollToText) {
                        window.findAndScrollToText(content, note.source_text);
                    }
                } else {
                    // Navigate to chapter
                    loadChapter(note.source_book, note.source_section, true, note.source_text);
                }
            } catch (navErr) {
                console.error('Navigation error:', navErr);
            }
        }

        // 2. Open Note Detail Modal
        console.log('Opening note view...');
        viewNote(id);
    } catch (e) {
        console.error('handleNoteClick Error:', e);
        alert('Hata: ' + e.message);
    }
};

window.goToNoteSourceByType = (book, section, text) => {
    // Deprecated but kept for backward compatibility if needed
    if (state.currentBook === book && state.currentChapter === section) {
        const content = document.getElementById('reader-content');
        if (window.findAndScrollToText) {
            window.findAndScrollToText(content, text);
        }
    } else {
        loadChapter(book, section, true, text);
    }
};

// ═══ Notes & Highlights ═══

async function highlightSelection() {
    const text = state.selectedText;
    if (!text) return;

    // 1. UI: Hide popup immediately
    const popup = document.getElementById('text-select-popup');
    if (popup) popup.classList.add('hidden');

    // 2. Auth Check
    if (!state.user) {
        alert('Vurgulama yapmak için giriş yapmalısınız.');
        openModal('auth-modal');
        return;
    }

    // 3. Construct Data Object (Defensive coding)
    const tempId = Date.now().toString(); // Temporary ID for optimistic update
    const note = {
        id: tempId,
        type: 'highlight',
        title: 'Vurgulama',
        content: '',
        source_text: text,
        source_book: state.currentBook || 'bilinmeyen-kitap',
        source_section: state.currentChapter || 'bilinmeyen-bolum',
        color: 'yellow',
        created_at: new Date().toISOString()
    };

    // 4. Optimistic UI Update (Performance & UX)
    state.notes.push(note);
    highlightText(text, 'yellow');

    // 5. Local Persistence (Safety / Offline Support)
    try {
        saveNotesLocally();
    } catch (e) {
        console.error('Local storage save failed:', e);
    }

    // Update Sidebar if active
    if (document.getElementById('ws-notes') && document.getElementById('ws-notes').classList.contains('active')) {
        renderWorkspaceNotes(state.notes);
    }

    // 6. Backend Sync (Async)
    try {
        const res = await fetch(`${API_URL}/user-data/highlights`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                book_slug: note.source_book,
                chapter_slug: note.source_section,
                text: text,
                color: note.color,
                range_start: '0',
                range_end: '0'
            })
        });

        if (res.ok) {
            const data = await res.json();
            // Update local ID with real backend ID
            const localNote = state.notes.find(n => n.id === tempId);
            if (localNote && data.highlight) {
                localNote.id = data.highlight.id; // Swapping Temp ID -> Real UUID
                localNote.created_at = data.highlight.created_at;
                saveNotesLocally(); // Re-save with real ID

                // 🟢 FIX: Re-render UI to update onclick handlers with new UUID
                refreshNotesSidebar();
                if (document.getElementById('ws-notes') && document.getElementById('ws-notes').classList.contains('active')) {
                    renderWorkspaceNotes(state.notes);
                }
            }
        } else {
            throw new Error(`Highlight sync failed: ${res.status}`);
        }
    } catch (e) {
        console.error('Save highlight network error:', e);
        // Rollback
        const isUpdate = !isNew;
        if (isUpdate && oldNote) {
            state.notes = state.notes.map(n => n.id === note.id ? oldNote : n);
        } else if (!isUpdate) {
            state.notes = state.notes.filter(n => n.id !== note.id);
        }
        saveNotesLocally();
        refreshNotesSidebar();
        if (document.getElementById('ws-notes') && document.getElementById('ws-notes').classList.contains('active')) {
            renderWorkspaceNotes(state.notes);
        }
        if (typeof renderWorkspaceFavorites === 'function') {
            renderWorkspaceFavorites(state.notes.filter(n => (n.tags || []).includes('favori')));
        }
        if (typeof showToast === 'function') showToast('Vurgulama kaydedilemedi, tekrar dene', 'error');
    }
}

async function saveNoteToBackend(note, isNew = true) {
    // 1. Always save locally as backup/cache (Redundant call for safety)
    saveNotesLocally();

    // 2. If User Logged In, Sync with Server
    if (state.user && state.token) {
        try {
            console.log('Syncing note with backend:', note.id);

            // Determine if Create (POST) or Update (PUT)
            // Local IDs are usually timestamps (13 chars), Backend IDs are UUIDs (36 chars)
            const isUpdate = !isNew;
            const method = isUpdate ? 'PUT' : 'POST';
            const url = isUpdate ? `${API_URL}/notes/${note.id}` : `${API_URL}/notes`;

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify(note)
            });

            if (!res.ok) {
                throw new Error(`Backend ${method} failed: ${res.status}`);
            } else {
                const data = await res.json();
                console.log(`Backend ${method} success.`);

                // If it was a new note (POST), the backend returns the real UUID
                if (!isUpdate && data.note && data.note.id) {
                    // Update the local note with the real backend ID
                    // This ensures subsequent edits use the correct UUID
                    const localNote = state.notes.find(n => n.id === note.id);
                    if (localNote) {
                        localNote.id = data.note.id;
                        saveNotesLocally();
                        // Also update the UI card to reflect the new ID in onclick handler
                        refreshNotesSidebar();
                        if (document.getElementById('ws-notes') && document.getElementById('ws-notes').classList.contains('active')) {
                            renderWorkspaceNotes(state.notes);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Backend save error:', e);
            // Rollback
            const isUpdate = !isNew;
            if (isUpdate && oldNote) {
                state.notes = state.notes.map(n => n.id === note.id ? oldNote : n);
            } else if (!isUpdate) {
                state.notes = state.notes.filter(n => n.id !== note.id);
            }
            saveNotesLocally();
            refreshNotesSidebar();
            if (document.getElementById('ws-notes') && document.getElementById('ws-notes').classList.contains('active')) {
                renderWorkspaceNotes(state.notes);
            }
            if (typeof renderWorkspaceFavorites === 'function') {
                renderWorkspaceFavorites(state.notes.filter(n => (n.tags || []).includes('favori')));
            }
            if (typeof showToast === 'function') showToast('Not kaydedilemedi, tekrar dene', 'error');
        }
    } else {
        console.log('User not logged in, saved locally only.');
    }
}

function saveNotesLocally() {
    localStorage.setItem('nurzeka_notes', JSON.stringify(state.notes));
}

// ═══ Unified Data Sync ═══

async function syncUserData() {
    if (!state.token) return;

    console.log('🔄 Syncing user data (Notes & Highlights)...');

    try {
        // Fetch both in parallel
        const [notesRes, highlightsRes] = await Promise.all([
            fetch(`${API_URL}/notes`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
            fetch(`${API_URL}/user-data/highlights`, { headers: { 'Authorization': `Bearer ${state.token}` } })
        ]);

        let notes = [];
        let highlights = [];

        // Process Notes
        if (notesRes.ok) {
            const data = await notesRes.json();
            notes = data.notes || [];
            console.log('Fetched notes from backend:', notes.length);
        } else {
            console.error('Notes fetch failed:', notesRes.status);
        }

        // Process Highlights
        if (highlightsRes.ok) {
            const data = await highlightsRes.json();
            const rawHighlights = data.highlights || [];

            // Convert to Note structure
            highlights = rawHighlights.map(h => ({
                id: h.id,
                type: 'highlight',
                title: 'Vurgulama',
                content: '',
                source_text: h.text,
                source_book: h.book_slug,
                source_section: h.chapter_slug,
                color: h.color,
                created_at: h.created_at
            }));
        } else {
            console.error('Highlights fetch failed:', highlightsRes.status);
        }

        // MERGE: Combine notes and highlights
        console.log('Fetched highlights from backend:', highlights.length);
        // We use a Map to ensure unique IDs if any overlap (though unlikely across tables)
        const merged = [...notes, ...highlights];

        // Update State
        state.notes = merged;
        console.log(`✅ Data Synced: ${notes.length} notes, ${highlights.length} highlights. Total: ${state.notes.length}`);

        // Update Local Storage
        saveNotesLocally();

        // Render if needed
        if (state.currentBook && state.currentChapter) {
            const chapterNotes = state.notes.filter(n => n.source_book === state.currentBook && n.source_section === state.currentChapter);
            if (document.getElementById('ws-notes')) {
                renderWorkspaceNotes(state.notes);
            }
            applyHighlightsFromNotes(chapterNotes);
        }

    } catch (e) {
        console.error('❌ Sync User Data Error:', e);
    }
}

// Deprecated but kept for compatibility (wraps sync)
async function loadNotes() {
    return syncUserData();
}

async function loadHighlights() {
    return syncUserData(); // Redirect to sync
}

// Global exposure
window.syncUserData = syncUserData;
window.loadNotes = loadNotes;
window.loadHighlights = loadHighlights;

// Bookmark Toggle Logic (Updated)
async function toggleBookmark() {
    if (!state.user) {
        alert('Ayraç eklemek için giriş yapmalısınız.');
        openModal('auth-modal');
        return;
    }

    // Check if already bookmarked
    const existing = state.bookmarks.find(b => b.book_slug === state.currentBook && b.chapter_slug === state.currentChapter);

    if (existing) {
        // Remove
        await deleteBookmark(existing.id, { stopPropagation: () => { } }); // Hacky dummy event
        updateBookmarkButtonUI();
    } else {
        // Add
        try {
            const titleEl = document.getElementById('sticky-chapter-title');
            const label = titleEl && titleEl.textContent ? titleEl.textContent : state.currentChapter;

            const res = await fetch(`${API_URL}/user-data/bookmarks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    book_slug: state.currentBook,
                    chapter_slug: state.currentChapter,
                    label: label
                })
            });

            if (res.ok) {
                const data = await res.json();
                state.bookmarks.push(data.bookmark);
                localStorage.setItem('nurzeka_bookmarks', JSON.stringify(state.bookmarks));
                renderWorkspaceBookmarks();
                updateBookmarkButtonUI();
            }
        } catch (e) {
            console.error('Add bookmark error:', e);
        }
    }
}

function updateBookmarkButtonUI() {
    const btn = document.getElementById('bookmark-toggle');
    if (!btn) return;

    const isBookmarked = state.bookmarks.some(b => b.book_slug === state.currentBook && b.chapter_slug === state.currentChapter);

    if (isBookmarked) {
        btn.classList.add('active');
        btn.style.color = 'var(--primary)';
    } else {
        btn.classList.remove('active');
        btn.style.color = '';
    }
}

// Expose
window.toggleBookmark = toggleBookmark;
window.loadBookmarks = loadBookmarks;
window.loadHighlights = loadHighlights;
window.renderWorkspaceBookmarks = renderWorkspaceBookmarks;


function viewNote(id) {
    try {
        console.log('viewNote called for ID:', id);
        const note = state.notes.find(n => n.id === id);
        if (!note) {
            console.error('viewNote: Note not found');
            return;
        }

        const modal = document.getElementById('note-view-modal');
        if (!modal) {
            console.error('viewNote: Modal element not found');
            return;
        }

        const isHighlight = note.type === 'highlight';

        // Title & Date
        const titleEl = document.getElementById('view-note-title');
        if (titleEl) titleEl.textContent = note.title || (isHighlight ? 'Vurgulama' : 'Not');

        const dateEl = document.getElementById('view-note-date');
        if (dateEl) dateEl.textContent = new Date(note.created_at).toLocaleString('tr-TR');

        // Content Area
        const contentBox = document.getElementById('view-note-content');
        if (contentBox) {
            contentBox.innerHTML = ''; // Clear first

            // 1. Quote Section (Always show if exists)
            if (note.source_text) {
                const quoteDiv = document.createElement('div');
                quoteDiv.innerHTML = `
                    <div style="font-size:0.85em; color:var(--text-secondary); margin-bottom:4px">Alıntılanan Metin:</div>
                    <div style="background:var(--bg-secondary); padding:10px; border-left:4px solid var(--amber); font-style:italic; margin-bottom:15px">
                        "${formatMarkdown(note.source_text)}"
                    </div>
                `;
                contentBox.appendChild(quoteDiv);
            }

            // 2. User Thoughts Section
            if (!isHighlight && note.content) {
                const thoughtsDiv = document.createElement('div');
                thoughtsDiv.innerHTML = `
                    <div style="font-size:0.85em; color:var(--text-secondary); margin-bottom:4px">Düşünceleriniz:</div>
                    <div style="padding:5px 0">
                        ${formatMarkdown(note.content)}
                    </div>
                `;
                contentBox.appendChild(thoughtsDiv);
            }
        }

        // Buttons
        const actions = modal.querySelector('.form-actions');

        // "Edit" Button
        let editBtn = document.getElementById('btn-edit-note');
        if (!editBtn) {
            editBtn = document.createElement('button');
            editBtn.id = 'btn-edit-note';
            editBtn.className = 'btn btn-secondary'; // Assuming secondary class exists, or use custom style
            editBtn.style.marginRight = 'auto'; // Push others to right? Or just place it.
            editBtn.style.background = '#3498db';
            editBtn.style.color = 'white';
            editBtn.innerHTML = '✏️ Düzenle';
            actions.insertBefore(editBtn, actions.firstChild);
        }
        editBtn.onclick = () => editNote(id);

        // "Go to Source"
        let goBtn = document.getElementById('btn-go-source');
        if (!goBtn) {
            goBtn = document.createElement('button');
            goBtn.id = 'btn-go-source';
            goBtn.className = 'btn btn-amber';
            goBtn.style.marginLeft = '10px';
            goBtn.innerHTML = '📖 Kaynağa Git';
            actions.appendChild(goBtn); // Append instead of insertBefore to control order
        }
        goBtn.onclick = () => goToNoteSource(note);
        goBtn.classList.remove('hidden');

        // "Delete"
        let delBtn = document.getElementById('btn-delete-note');
        if (!delBtn) {
            delBtn = document.createElement('button');
            delBtn.id = 'btn-delete-note';
            delBtn.className = 'btn btn-danger';
            delBtn.style.marginLeft = '10px';
            delBtn.style.background = '#e74c3c';
            delBtn.style.color = 'white';
            delBtn.innerHTML = '🗑️ Sil';
            actions.appendChild(delBtn);
        }
        delBtn.onclick = (e) => deleteNote(id, e);

        // Hide AI section
        const aiSection = document.getElementById('view-note-ai-section');
        if (aiSection) aiSection.classList.add('hidden');

        console.log('Opening note view modal...');
        openModal('note-view-modal');
    } catch (e) {
        console.error('viewNote Error:', e);
        alert('Not görüntülenirken hata: ' + e.message);
    }
}

function goToNoteSource(note) {
    closeModal('note-view-modal');
    if (note.source_book && note.source_section) {
        // If already in that chapter, just scroll
        if (state.currentBook === note.source_book && state.currentChapter === note.source_section) {
            const content = document.getElementById('reader-content');
            findAndScrollToText(content, note.source_text);
        } else {
            loadChapter(note.source_book, note.source_section, true, note.source_text);
        }
    }
}

async function deleteNote(id, event) {
    try {
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
    } catch (e) { }
    if (!confirm('Bu notu/vurguyu silmek istediğinize emin misiniz?')) return;

    // 🟢 MANTIK HATASI ÇÖZÜMÜ: Önce tipi bul, sonra listeden sil
    const note = state.notes.find(n => n.id === id) || { type: 'note' };
    const isHighlight = note && note.type === 'highlight';

    // 🟢 FIX: Optimistic Deletion with Rollback capability
    const originalNotes = [...state.notes]; // Clone for safe rollback
    state.notes = state.notes.filter(n => n.id !== id);
    if (typeof renderNotes === 'function') renderNotes(); // 🟢 UI anında güncellensin
    saveNotesLocally();

    closeModal('note-view-modal');

    // Refresh Sidebar and Workspace IMMEDIATELY
    refreshNotesSidebar();
    if (document.getElementById('ws-notes') && document.getElementById('ws-notes').classList.contains('active')) {
        renderWorkspaceNotes(state.notes);
    }

    // Delete from backend database (Fire and Forget)
    if (state.token) {
        // Run in background without awaiting, catch errors silently
        (async () => {
            try {
                const endpoint = isHighlight
                    ? `${API_URL}/user-data/highlights/${id}`
                    : `${API_URL}/notes/${id}`;

                const res = await fetch(endpoint, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${state.token}` }
                });

                if (!res.ok) {
                    // 🟢 FIX: If backend says 404, it means record is already gone. 
                    // Don't throw/rollback, just let the optimistic delete stand.
                    if (res.status === 404) {
                        console.warn('Note already deleted from backend (404). Cleaned up local state.');
                        return;
                    }
                    throw new Error('Delete failed: ' + res.status);
                }
            } catch (e) {
                console.error('Backend note/highlight delete error:', e);
                // Rollback
                state.notes = originalNotes;
                if (typeof renderNotes === 'function') renderNotes(); // 🟢 UI geri gelsin
                saveNotesLocally();
                refreshNotesSidebar();
                if (document.getElementById('ws-notes') && document.getElementById('ws-notes').classList.contains('active')) {
                    renderWorkspaceNotes(state.notes);
                }
                if (typeof renderWorkspaceFavorites === 'function') {
                    renderWorkspaceFavorites(state.notes.filter(n => (n.tags || []).includes('favori')));
                }
                if (typeof showToast === 'function') showToast('Not silinemedi, tekrar dene', 'error');
            }
        })();
    }

    // Refresh Highlights (Trigger re-render of chapter or just reload)
    // For immediate feedback without reload:
    if (isHighlight && state.currentBook && state.currentChapter) {
        // Optimistic UI: Reload chapter content to clear highlights instantly
        if (typeof loadChapter === 'function') {
            loadChapter(state.currentBook, state.currentChapter, false);
        }
    }
    // Re-render current content text
    const content = document.getElementById('reader-content');
    // Re-render current content text directly if highlight
    if (isHighlight && state.chapterText && !state.isSimplified) {
        content.innerHTML = formatMarkdown(state.chapterText);
        initOttomanTooltips(content);
        // Re-apply remaining notes
        const remainingNotes = state.notes.filter(n => n.source_book === state.currentBook && n.source_section === state.currentChapter);
        applyHighlightsFromNotes(remainingNotes);
    }
}

// Expose
window.highlightSelection = highlightSelection;
window.viewNote = viewNote;
window.goToNoteSource = goToNoteSource;
window.deleteNote = deleteNote;
window.loadNotes = loadNotes;

// ═══ Search ═══
async function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    executeSearch(query, 'search-results');
}

async function performHeaderSearch() {
    const input = document.getElementById('header-search-input');
    const query = input.value.trim();
    if (!query) return;

    // If it's a smart jump, we don't need to switch views
    const isJump = await executeSearch(query, 'search-results', true);

    if (!isJump) {
        // If not a jump, switch to search view to show results
        switchView('search');
        document.getElementById('search-input').value = query;
    } else {
        input.value = ''; // Clear header on successful jump
        input.blur();
    }
}

async function executeSearch(query, resultsId, jumpOnly = false) {
    // Smart Jump Logic (e.g., "21.söz")
    const patterns = [
        { regex: /^(\d+)\.?\s*(söz|soz)/i, book: 'sozler' },
        { regex: /^(\d+)\.?\s*(mektub|mektup)/i, book: 'mektubat' },
        { regex: /^(\d+)\.?\s*(lema)/i, book: 'lemalar' },
        { regex: /^(\d+)\.?\s*(şua|sua)/i, book: 'sualar' }
    ];

    for (const p of patterns) {
        const match = query.match(p.regex);
        if (match) {
            const num = parseInt(match[1]);
            const book = p.book;
            const paddedNum = num.toString().padStart(3, '0');

            console.log(`🎯 Smart Jump detected: ${num} in ${book}`);

            try {
                // Fetch chapter list for this book to find the exact slug
                const res = await fetch(`${API_URL}/knowledge/kulliyat/${book}`);
                const data = await res.json();
                if (data.chapters) {
                    const chapter = data.chapters.find(c => c.slug.startsWith(paddedNum));
                    if (chapter) {
                        state.chapters = data.chapters; // Sync state for navigation buttons
                        loadChapter(book, chapter.slug);
                        return true; // Successfully jumped
                    }
                }
            } catch (err) {
                console.error('Smart jump fetch error:', err);
            }
        }
    }

    if (jumpOnly) return false;

    const results = document.getElementById(resultsId);
    if (!results) return false;

    results.innerHTML = '<div class="empty-state">Aranıyor...</div>';

    try {
        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: query })
        });

        if (res.ok) {
            const data = await res.json();
            results.innerHTML = '';

            if (data.sources && data.sources.length > 0) {
                data.sources.forEach(s => {
                    results.innerHTML += `
                        <div class="search-result-card">
                            ${renderSourceCard(s)}
                        </div>
                    `;
                });
            }

            if (data.answer) {
                results.innerHTML = `
          <div style="padding:16px;background:var(--bg-tertiary);border:1px solid var(--amber);border-radius:12px;margin-bottom:16px">
            <div style="color:var(--amber);font-weight:600;margin-bottom:8px">🕌 NurZeka Cevabı</div>
            ${formatMarkdown(data.answer)}
          </div>
        ` + results.innerHTML;
            }
        }
    } catch (e) {
        results.innerHTML = '<div class="empty-state">Arama hatası</div>';
    }
    return false;
}

window.performHeaderSearch = performHeaderSearch;

// ═══ Tools ═══
async function runScraper() {
    if (!confirm('Bilgi tabanını güncellemek için scraper çalıştırılsın mı?')) return;
    addMessage('assistant', '🔄 Scraper başlatılıyor... Bu işlem birkaç dakika sürebilir.');
}

async function reindexKB() {
    try {
        const res = await fetch(`${API_URL}/chat/reindex`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            alert(`✅ ${data.message}`);
        }
    } catch (e) {
        alert('Hata: ' + e.message);
    }
}

async function showStats() {
    try {
        const res = await fetch(`${API_URL}/chat/stats`);
        if (res.ok) {
            const data = await res.json();
            alert(`📊 İstatistikler\n\nİndeksleme: ${data.isIndexed ? 'Aktif' : 'Pasif'}\nToplam Parça: ${data.totalChunks}\nKitaplar: ${data.books.length}\nBölümler: ${data.sections.length}`);
        }
    } catch (e) {
        alert('Hata: ' + e.message);
    }
}

// ═══ Initialize ═══
document.addEventListener('DOMContentLoaded', () => {
    loadAuth();
    loadOttomanDict();
    initTabs();
    initResizer(); // Initialize panel resizer
    initMobileSidebar(); // Initialize mobile sidebar close button
    renderHistory(); // Load history

    // Bottom nav for mobile
    if (window.innerWidth <= 768) {
        const nav = document.querySelector('.main-nav');
        if (nav) {
            nav.style.display = 'flex';
            document.querySelector('.header-center').style.display = 'none';
        }
        // Show Mobile Insight Tab
        const mobileTab = document.getElementById('mobile-insight-toggle');
        if (mobileTab) mobileTab.classList.remove('hidden');
    } else {
        // Open Insight Panel by default on desktop ONLY
        if (window.innerWidth > 768) {
            setTimeout(() => {
                const panel = document.getElementById('insight-panel');
                if (panel && panel.classList.contains('hidden')) {
                    togglePanel('insight-panel');
                }
            }, 500);
        }
    }
});

// Make functions globally available
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.switchAuthTab = switchAuthTab;
window.switchView = switchView;
window.toggleSidebar = toggleSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
// ═══ Panel System ═══
function togglePanel(panelId) {
    // If empty string passed (e.g. from logo click), close all panels
    if (!panelId) {
        document.querySelectorAll('.side-panel').forEach(p => {
            p.classList.add('hidden');
            document.body.classList.remove('insight-panel-open');
        });
        return;
    }

    const panel = document.getElementById(panelId);
    if (!panel) return;

    if (panel.classList.contains('hidden')) {
        // OPENING A PANEL

        // 1. Mobile Exclusivity: Close other panels first
        if (window.innerWidth <= 768) {
            // Close Sidebar if opening Insight Panel
            if (panelId === 'insight-panel') {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.remove('open');
                    state.sidebarOpen = false;
                }
            }
            // Close Insight Panel if opening something else (e.g. Notes)
            if (panelId !== 'insight-panel') {
                const insightPanel = document.getElementById('insight-panel');
                if (insightPanel) {
                    insightPanel.classList.add('hidden');
                    document.body.classList.remove('insight-panel-open');
                }
            }
            // Close Notes Panel if opening Insight Panel
            if (panelId === 'insight-panel') {
                const notesPanel = document.getElementById('notes-panel');
                if (notesPanel) notesPanel.classList.add('hidden');
            }
        }

        panel.classList.remove('hidden');

        if (panelId === 'insight-panel') {
            document.body.classList.add('insight-panel-open');
            // Hide opening tab
            const mobileTab = document.getElementById('mobile-insight-toggle');
            if (mobileTab) mobileTab.classList.add('hidden');

            // Show closing tab (if on mobile)
            if (window.innerWidth <= 768) {
                const closeTab = document.getElementById('mobile-insight-close');
                if (closeTab) closeTab.classList.remove('hidden');
            }
        }
    } else {
        // CLOSING A PANEL
        panel.classList.add('hidden');
        if (panelId === 'insight-panel') {
            document.body.classList.remove('insight-panel-open');
            // Show opening tab when closed (if on mobile)
            if (window.innerWidth <= 768) {
                const mobileTab = document.getElementById('mobile-insight-toggle');
                if (mobileTab) mobileTab.classList.remove('hidden');

                // Hide closing tab
                const closeTab = document.getElementById('mobile-insight-close');
                if (closeTab) closeTab.classList.add('hidden');
            }
        }
    }
}

function switchWorkspaceTab(tabName) {
    // Buttons
    document.querySelectorAll('.ws-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('onclick').includes(tabName));
    });

    // Content
    document.querySelectorAll('.ws-content').forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('active');
    });

    const target = document.getElementById(`ws-${tabName}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');

        // Refresh content if needed
        if (tabName === 'bookmarks') renderBookmarks();
    }

    if (tabName === 'gecmis') {
        loadConversations();
    }
    if (tabName === 'notes') {
        // Optionally refresh notes if needed, though they are usually usually loaded per chapter
    }
}

// ═══ Bookmark System ═══
async function toggleBookmark() {
    if (!state.user) {
        alert('Ayraç eklemek için giriş yapmalısınız.');
        openModal('auth-modal');
        return;
    }

    if (!state.currentBook || !state.currentChapter) {
        alert('Önce bir bölüm açmalısınız.');
        return;
    }

    // Find by CONTENT (Book + Chapter), not ID
    const exists = state.bookmarks.find(b =>
        (b.book === state.currentBook || b.book_slug === state.currentBook) &&
        (b.chapter === state.currentChapter || b.chapter_slug === state.currentChapter)
    );

    const scrollPos = document.getElementById('reader-content')?.scrollTop || 0;
    const title = document.getElementById('sticky-chapter-title')?.textContent || 'Risale Bölümü';

    try {
        if (exists) {
            // OPTIMISTIC REMOVE
            state.bookmarks = state.bookmarks.filter(b => b !== exists);

            updateBookmarkButtonUI();
            renderBookmarks();
            renderWorkspaceBookmarks(); // Sync "Atölye" list
            localStorage.setItem('nurzeka_bookmarks', JSON.stringify(state.bookmarks));

            // BACKEND SYNC
            if (exists.id && exists.id.length > 20) {
                await fetch(`${API_URL}/user-data/bookmarks/${exists.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${state.token}` }
                });
            } else {
                console.warn('Deleting bookmark without synced UUID.');
            }

        } else {
            // OPTIMISTIC ADD
            const titleEl = document.getElementById('sticky-chapter-title');
            const label = titleEl && titleEl.textContent ? titleEl.textContent : state.currentChapter;
            const tempId = 'temp-' + Date.now();
            const scrollPos = document.getElementById('reader-content')?.scrollTop || 0;

            const newBookmark = {
                id: tempId,
                book: state.currentBook,
                book_slug: state.currentBook,
                chapter: state.currentChapter,
                chapter_slug: state.currentChapter,
                title: label, // Use label for title as well
                label: label,
                selector: scrollPos.toString(),
                created_at: new Date().toISOString()
            };

            state.bookmarks.push(newBookmark);

            updateBookmarkButtonUI();
            renderWorkspaceBookmarks();
            renderBookmarks();
            localStorage.setItem('nurzeka_bookmarks', JSON.stringify(state.bookmarks));

            // BACKEND SYNC
            try {
                const res = await fetch(`${API_URL}/user-data/bookmarks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.token}`
                    },
                    body: JSON.stringify({
                        book_slug: state.currentBook,
                        chapter_slug: state.currentChapter,
                        label: label,
                        selector: scrollPos.toString()
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    const item = state.bookmarks.find(b => b.id === tempId);
                    if (item && data.bookmark) {
                        item.id = data.bookmark.id;
                        localStorage.setItem('nurzeka_bookmarks', JSON.stringify(state.bookmarks));
                    }
                } else {
                    throw new Error('Save failed');
                }
            } catch (e) {
                console.error('Bookmark save failed:', e);
                state.bookmarks = state.bookmarks.filter(b => b.id !== tempId);
                updateBookmarkButtonUI();
                renderWorkspaceBookmarks();
                alert('Ayraç kaydedilemedi.');
            }
        }
    } catch (e) {
        console.error('Bookmark toggle error:', e);
        alert('Hata: ' + e.message);
    }
}

function updateBookmarkButtonUI() {
    const btn = document.getElementById('bookmark-toggle');
    if (!btn) return;

    if (!state.currentBook || !state.currentChapter) {
        btn.classList.remove('active');
        btn.style.color = '';
        return;
    }

    const isBookmarked = state.bookmarks.some(b =>
        (b.book === state.currentBook || b.book_slug === state.currentBook) &&
        (b.chapter === state.currentChapter || b.chapter_slug === state.currentChapter)
    );

    if (isBookmarked) {
        btn.classList.add('active');
        btn.style.color = 'var(--primary)';
    } else {
        btn.classList.remove('active');
        btn.style.color = '';
    }
}

function renderBookmarks() {
    const list = document.getElementById('workspace-bookmarks-list');
    if (!list) return;

    if (!state.bookmarks || state.bookmarks.length === 0) {
        list.innerHTML = '<div class="empty-state-sm">Henüz eklenmiş ayraç yok.</div>';
        return;
    }

    list.innerHTML = state.bookmarks.map(b => `
        <div class="bookmark-item" onclick="loadChapter('${b.book_slug || b.book}', '${b.chapter_slug || b.chapter}', true, null, ${b.selector || 0})">
            <div class="bookmark-info" style="pointer-events:none;">
                <div class="bookmark-title">${b.label || b.title || 'Bölüm'}</div>
                <div class="bookmark-meta">${(b.book_slug || b.book || '').toUpperCase()} • ${new Date(b.created_at || Date.now()).toLocaleDateString('tr-TR')}</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); deleteBookmark('${b.id}', event)">✕</button>
        </div>
    `).join('');
}

function removeBookmark(id) {
    state.bookmarks = state.bookmarks.filter(b => b.id !== id);
    localStorage.setItem('nurzeka_bookmarks', JSON.stringify(state.bookmarks));
    renderBookmarks();
    renderWorkspaceBookmarks();
    updateBookmarkButtonUI();
}

window.toggleBookmark = toggleBookmark;
window.removeBookmark = removeBookmark;

function analyzeSelection() {
    const text = state.selectedText;
    if (!text) return;

    // Hide selection popup
    document.getElementById('text-select-popup').classList.add('hidden');

    // Trigger analysis
    analyzeConcept(text);
}

// ═══ Reference System (Atıf) ═══
async function triggerReferenceAnalysis() {
    const content = document.getElementById('reader-content');
    if (!content) return;

    // Get text from reader (strip HTML)
    const text = content.innerText;
    if (text.length < 50) return;

    await findReferences(text);
}

async function findReferences(text) {
    const list = document.getElementById('workspace-references-list');
    if (!list) return;

    list.innerHTML = `
        <div class="empty-state-sm">
            <div class="loader-sm"></div>
            <p>Atıflar taranıyor (Ajan)...</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/references`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text.substring(0, 5000), // Limit payload
                currentBook: state.currentBook,
                currentChapter: state.currentChapter
            })
        });

        if (!res.ok) throw new Error('Servis hatası');

        const data = await res.json();
        renderReferences(data.references);

        // Auto-switch to references tab if references found
        if (data.references && data.references.length > 0) {
            const panel = document.getElementById('insight-panel');
            if (panel && panel.classList.contains('hidden')) {
                togglePanel('insight-panel');
            }
            switchWorkspaceTab('references');
        }

    } catch (e) {
        console.error('Atıf hatası:', e);
        list.innerHTML = `
            <div class="form-error">
                <p>⚠️ Atıf analizi yapılamadı.</p>
                <p style="font-size:0.8em;opacity:0.8">${e.message}</p>
                <button class="btn btn-sm btn-outline" onclick="triggerReferenceAnalysis()">Tekrar Dene</button>
            </div>
        `;
    }
}

function renderReferences(refs) {
    const list = document.getElementById('workspace-references-list');
    if (!refs || refs.length === 0) {
        list.innerHTML = '<div class="empty-state-sm">Bu bölümle doğrudan ilişkili atıf bulunamadı.</div>';
        return;
    }

    list.innerHTML = refs.map(r => `
        <div class="reference-card" onclick="goToReference('${r.book}', '${r.section}', '${escapeHtml(r.excerpt)}')">
            <div class="ref-header">
                <span class="ref-book">📖 ${r.bookTitle || formatBookName(r.book)}</span>
                <span class="ref-score">%${Math.round(r.score * 100)}</span>
            </div>
            <div class="ref-section">${r.sectionTitle || formatSectionName(r.section)}</div>
            <div class="ref-excerpt">"${r.excerpt}"</div>
        </div>
    `).join('');
}

async function goToReference(book, section, text) {
    // Open Reference Modal instead of navigation
    try {
        const modal = document.getElementById('reference-view-modal');
        const contentEl = document.getElementById('view-ref-content');
        const titleEl = document.getElementById('view-ref-title');
        const bookEl = document.getElementById('view-ref-book');
        const goBtn = document.getElementById('go-to-ref-source-btn');

        // Loading State
        contentEl.innerHTML = '<div class="reading-loading"><div class="spinner"></div><p>Atıf yükleniyor...</p></div>';
        openModal('reference-view-modal');

        // Fetch Content
        const res = await fetch(`${API_URL}/knowledge/kulliyat/${book}/${section}`);
        if (!res.ok) throw new Error('İçerik yüklenemedi');

        const rawText = await res.text();
        const cleanText = rawText.replace(/^---[\s\S]*?---\n*/, '').replace(/^# .*\n/, '');

        let formatted = formatMarkdown(cleanText);

        // Highlight the referenced text if found
        if (text) {
            const cleanRef = text.replace(/[^\w\sığüşöçİĞÜŞÖÇâîû]/g, '').substring(0, 50);
            // Simple highlight approach - might need tree walker for robust partial matching
            // For now, let's just display the content. 
            // Ideally we scroll to it.
        }

        contentEl.innerHTML = formatted;

        // Metadata
        titleEl.textContent = formatSectionName(section);
        bookEl.textContent = formatBookName(book);

        // "Go to Full" Button Logic
        goBtn.onclick = () => {
            closeModal('reference-view-modal');
            // Navigate in main view
            loadChapter(book, section, true, text);
        };

        // Scroll to text if possible (Simple Match)
        setTimeout(() => {
            if (text) findAndScrollToText(contentEl, text);
        }, 300);

    } catch (e) {
        console.error('Ref modal error:', e);
        document.getElementById('view-ref-content').innerHTML = `<div class="form-error">Hata: ${e.message}</div>`;
    }
}

function formatBookName(slug) {
    return slug ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ') : '';
}

function formatSectionName(slug) {
    return slug ? slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
}

// Make globally available
window.switchWorkspaceTab = switchWorkspaceTab;
window.triggerReferenceAnalysis = triggerReferenceAnalysis;
window.findReferences = findReferences;
window.goToReference = goToReference;


// --- Simplification Feature ---
state.isSimplified = false;
state.simplifiedCache = {};
state.chapterText = '';

async function toggleSimplification() {
    const btn = document.getElementById('simplify-toggle');
    const content = document.querySelector('.reader-body');
    if (!content) return;

    if (state.isSimplified) {
        // Revert to Original
        state.isSimplified = false;
        btn.innerHTML = '<span class="icon">✨</span> Sadeleştir';
        btn.classList.remove('active');
        content.classList.remove('simplified-mode');

        // Restore with proper formatting
        content.innerHTML = formatMarkdown(state.chapterText);
        initOttomanTooltips(document.getElementById('reader-content'));

    } else {
        // Switch to Simplified
        const key = `${state.currentBook}/${state.currentChapter}`;

        if (state.simplifiedCache[key]) {
            applySimplifiedText(state.simplifiedCache[key]);
        } else {
            // Fetch from AI
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-sm"></span> Lütfen bekleyin...';
            content.innerHTML = `
                <div class="loading-state" style="text-align:center; padding:40px; color:var(--text-secondary);">
                    <div class="spinner"></div>
                    <p style="margin-top:10px">Yapay zeka metni aslına sadık kalarak sadeleştiriyor...</p>
                    <small style="opacity:0.7; display:block; margin-top:5px">Esma-i Hüsna ve Kur'ani kavramlar korunuyor.</small>
                </div>
            `;

            try {
                const res = await fetch(`${API_URL}/analyze/simplify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: state.chapterText })
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `Servis hatası (${res.status})`);
                }

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let simplifiedText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    simplifiedText += decoder.decode(value, { stream: true });
                }

                state.simplifiedCache[key] = simplifiedText;
                applySimplifiedText(simplifiedText);

            } catch (e) {
                console.error(e);
                content.innerHTML = `<div class="form-error">Hata: ${e.message}. Lütfen tekrar deneyin.</div>`;
                setTimeout(() => {
                    state.isSimplified = false;
                    content.innerHTML = formatMarkdown(state.chapterText);
                    btn.disabled = false;
                    btn.innerHTML = '<span class="icon">✨</span> Sadeleştir';
                }, 3000);
            }
        }
    }
}

function applySimplifiedText(text) {
    const btn = document.getElementById('simplify-toggle');
    const content = document.querySelector('.reader-body');

    state.isSimplified = true;
    content.innerHTML = formatMarkdown(text);
    content.classList.add('simplified-mode');

    btn.disabled = false;
    btn.innerHTML = '<span class="icon">📜</span> Orijinale Dön';
    btn.classList.add('active');

    document.getElementById('reader-content').scrollTop = 0;
}

window.toggleSimplification = toggleSimplification;
window.saveSelectionAsNote = saveSelectionAsNote;
window.copySelection = copySelection;
window.highlightSelection = highlightSelection;
window.askSelection = askSelection;
window.handleSaveNote = handleSaveNote;
window.deleteNote = deleteNote;
// ═══ Footnote Interaction ═══
document.addEventListener('click', (e) => {
    if (e.target.matches('.hasiye-link')) {
        e.preventDefault();
        e.stopPropagation();

        // Close existing
        const existing = document.querySelector('.footnote-popup');
        if (existing) existing.remove();

        const id = e.target.getAttribute('data-id');
        const content = e.target.getAttribute('data-content');

        const popup = document.createElement('div');
        popup.className = 'footnote-popup';
        popup.innerHTML = `
            <div class="footnote-popup-header">
                Haşiye ${id}
                <button class="footnote-popup-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="footnote-content">${content}</div>
        `;

        document.body.appendChild(popup);

        // Position
        const rect = e.target.getBoundingClientRect();
        let top = rect.bottom + window.scrollY + 10;
        let left = rect.left + window.scrollX - 20;

        // Boundary checks
        if (left < 10) left = 10;
        if (left + 300 > document.body.scrollWidth) left = document.body.scrollWidth - 320;

        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;

        // Add close on outside click
        const closeHandler = (evt) => {
            if (!popup.contains(evt.target) && evt.target !== e.target) {
                popup.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }
});


// ═══ Bookmarks & Highlights Loading ═══

async function loadBookmarks() {
    if (!state.token) return;

    try {
        const res = await fetch(`${API_URL}/user-data/bookmarks`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            const data = await res.json();
            state.bookmarks = data.bookmarks || [];
            localStorage.setItem('nurzeka_bookmarks', JSON.stringify(state.bookmarks));
            renderWorkspaceBookmarks();
        }
    } catch (e) {
        console.error('Load bookmarks error:', e);
    }
}

function renderWorkspaceBookmarks() {
    const container = document.getElementById('workspace-bookmarks-list');
    if (!container) return;

    const bookmarks = state.bookmarks;

    if (!bookmarks || bookmarks.length === 0) {
        container.innerHTML = '<div class="empty-state-sm">Henüz eklenmiş ayraç yok.</div>';
        return;
    }

    container.innerHTML = bookmarks.map(b => `
        <div class="bookmark-card" onclick="loadChapter('${b.book_slug}', '${b.chapter_slug}', true, null)">
            <div class="bookmark-header">
               <span class="bookmark-title">🔖 ${b.label || b.chapter_slug}</span>
               <button onclick="deleteBookmark('${b.id}', event)" class="btn-icon-sm">✕</button>
            </div>
            <div class="bookmark-meta">${b.book_slug} - ${new Date(b.created_at).toLocaleDateString('tr-TR')}</div>
        </div>
    `).join('');
}

window.deleteBookmark = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Bu ayracı silmek istediğinize emin misiniz?')) return;

    try {
        const res = await fetch(`${API_URL}/user-data/bookmarks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (res.ok) {
            state.bookmarks = state.bookmarks.filter(b => b.id !== id);
            localStorage.setItem('nurzeka_bookmarks', JSON.stringify(state.bookmarks));
            renderWorkspaceBookmarks();
            renderBookmarks(); // Sync header dropdown
            updateBookmarkButtonUI();
        }
    } catch (err) {
        console.error('Delete bookmark error:', err);
    }
};

async function loadHighlights() {
    if (!state.token) return;

    try {
        const res = await fetch(`${API_URL}/user-data/highlights`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            const data = await res.json();

            // Convert highlights to note-like structure for unified rendering
            const hlNotes = data.highlights.map(h => ({
                id: h.id,
                type: 'highlight', // distinct type
                title: 'Vurgulama',
                content: '',
                source_text: h.text,
                source_book: h.book_slug,
                source_section: h.chapter_slug,
                color: h.color,
                created_at: h.created_at
            }));

            // Merge avoiding duplicates (by ID)
            const existingIds = new Set(state.notes.map(n => n.id));
            const newHighlights = hlNotes.filter(h => !existingIds.has(h.id));
            state.notes = [...state.notes, ...newHighlights];

            // Re-render
            if (state.currentBook && state.currentChapter) {
                const chapterNotes = state.notes.filter(n => n.source_book === state.currentBook && n.source_section === state.currentChapter);
                applyHighlightsFromNotes(chapterNotes);
            }
        }
    } catch (e) {
        console.error('Load highlights error:', e);
    }
}


// 🟢 SYSTEMATIC FIX: Unified Data Synchronization
async function syncUserData() {
    console.trace('syncUserData ÇAĞRILDI');
    if (!state.user) return;
    try {
        console.log('🔄 Syncing user data...');
        console.log('Current state.notes BEFORE sync:', state.notes.length);

        // 1. Fetch Notes
        const resNotes = await fetch(`${API_URL}/notes`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const notesData = resNotes.ok ? await resNotes.json() : { notes: [] };

        // 2. Fetch Highlights
        const resHighlights = await fetch(`${API_URL}/user-data/highlights`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const highlightsData = resHighlights.ok ? await resHighlights.json() : { highlights: [] };

        // 3. Normalize Highlights to "Note" format
        const hlNotes = (highlightsData.highlights || []).map(h => ({
            id: h.id, // UUID from backend
            type: 'highlight',
            title: 'Vurgulama',
            content: '', // Highlights have empty content
            source_text: h.text,
            source_book: h.book_slug,
            source_section: h.chapter_slug,
            color: h.color,
            created_at: h.created_at
        }));

        // 4. Merge Strategies
        // We need to merge backend notes + backend highlights.
        // If a note and a highlight have the SAME ID, the note wins (it might have content).
        // But usually they are distinct entities.

        const allItems = [...(notesData.notes || [])];
        const existingIds = new Set(allItems.map(n => n.id));

        hlNotes.forEach(h => {
            if (!existingIds.has(h.id)) {
                allItems.push(h);
            }
        });

        // 5. Update State & Cache
        state.notes = allItems;
        saveNotesLocally();

        // 6. Fetch Bookmarks
        const resBookmarks = await fetch(`${API_URL}/user-data/bookmarks`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resBookmarks.ok) {
            const bData = await resBookmarks.json();
            state.bookmarks = bData.bookmarks || [];
            localStorage.setItem('nurzeka_bookmarks', JSON.stringify(state.bookmarks));
        }

        console.log(`✅ Sync complete. ${state.notes.length} notes/highlights loaded.`);

        // 7. Update UI for Current Chapter
        if (state.currentBook && state.currentChapter) {
            const currentNotes = state.notes.filter(n => n.source_book === state.currentBook && n.source_section === state.currentChapter);
            applyHighlightsFromNotes(currentNotes);
        }
        renderWorkspaceBookmarks();
        updateBookmarkButtonUI();

        if (typeof renderNotes === 'function') renderNotes();
        if (typeof renderWorkspaceNotes === 'function') renderWorkspaceNotes(state.notes);

    } catch (e) {
        console.error('❌ Sync error:', e);
    }
}
window.syncUserData = syncUserData;

// ═══ Günlük Tefekkür (Daily Quote) ═══
async function loadDailyQuote() {
    try {
        const response = await fetch(`${API_URL}/quotes/daily`);
        if (!response.ok) return;
        const data = await response.json();

        const textEl = document.getElementById('daily-quote-text');
        const sourceEl = document.getElementById('daily-quote-source');
        const containerEl = document.getElementById('daily-quote-container');

        if (textEl && sourceEl && containerEl) {
            textEl.innerHTML = `&ldquo;${data.text}&rdquo;`;
            sourceEl.textContent = `— ${data.source}`;
            containerEl.classList.remove('hidden');
        }

        window.currentDailyQuote = data;
    } catch (err) {
        console.error("Daily quote error:", err);
    }
}

window.askAboutDailyQuote = function () {
    if (!window.currentDailyQuote) return;
    const input = document.getElementById('chat-input');
    if (!input) return;

    input.value = `Günün tefekkürü bölümündeki şu pasajı bana açıklar mısın?\n\n"${window.currentDailyQuote.text}"\n(${window.currentDailyQuote.source})`;
    input.focus();

    if (typeof autoResize === 'function') autoResize(input);
    if (typeof switchView === 'function') switchView('chat');

    input.scrollIntoView({ behavior: 'smooth' });
};

window.shareDailyQuote = function () {
    if (!window.currentDailyQuote) return;

    const textToShare = `✨ Günün Tefekkürü\n\n"${window.currentDailyQuote.text}"\n\n— ${window.currentDailyQuote.source}\n\n📖 NurZek uygulamasından paylaşıldı: nurzek.com`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToShare).then(() => {
            if (typeof showToast === 'function') {
                showToast('Pasaj panoya kopyalandı ✓', 'success');
            } else {
                alert('Pasaj panoya kopyalandı ✓');
            }
        }).catch(err => {
            console.error('Kopyalama hatası:', err);
        });
    } else {
        // Fallback for non-https local dev if needed
        let textArea = document.createElement("textarea");
        textArea.value = textToShare;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            if (typeof showToast === 'function') showToast('Pasaj panoya kopyalandı ✓', 'success');
        } catch (err) {
            console.error('Fallback kopyalama hatası', err);
        }
        document.body.removeChild(textArea);
    }
};

document.addEventListener('DOMContentLoaded', loadDailyQuote);
document.addEventListener('DOMContentLoaded', renderSuggestions);
// ═══ Edit & Drag-and-Drop Notes ═══
window.editNote = function (id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    document.getElementById('note-id').value = note.id || '';
    document.getElementById('note-title').value = note.title || '';
    document.getElementById('note-content').value = note.content || '';
    document.getElementById('note-source-text').value = note.source_text || '';
    document.getElementById('note-ai-response').value = note.aiResponse || '';

    const aiDisplayContainer = document.getElementById('note-ai-response-container');
    const aiDisplay = document.getElementById('note-ai-response-display');
    if (aiDisplayContainer && aiDisplay) {
        if (note.aiResponse) {
            aiDisplay.innerHTML = note.aiResponse;
            aiDisplayContainer.classList.remove('hidden');
        } else {
            aiDisplay.innerHTML = '';
            aiDisplayContainer.classList.add('hidden');
        }
    }

    openModal('note-modal');
};

let draggedNoteId = null;

window.handleNoteDragStart = function (event, id) {
    draggedNoteId = id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id); // required for Firefox
};

window.handleCategoryDragOver = function (event, element) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    element.style.backgroundColor = 'rgba(0,0,0,0.05)';
};

window.handleCategoryDragLeave = function (event, element) {
    element.style.backgroundColor = '';
};

window.handleCategoryDrop = function (event, targetBook, targetSection) {
    event.preventDefault();
    event.currentTarget.style.backgroundColor = ''; // Remove drag-hover style

    if (!draggedNoteId) return;

    const note = state.notes.find(n => n.id === draggedNoteId);
    if (!note) return;

    let newBook = targetBook;
    let newSection = targetSection;

    if (targetBook === 'Genel Kitap' || targetSection === 'Genel Bölüm') {
        newBook = null;
        newSection = null;
    }

    // Only update if it actually moved
    if (note.source_book !== newBook || note.source_section !== newSection) {
        note.source_book = newBook;
        note.source_section = newSection;

        saveNotesLocally();
        renderNotes();
        if (typeof renderWorkspaceNotes === 'function') renderWorkspaceNotes(state.notes);
        if (typeof saveNoteToBackend === 'function') saveNoteToBackend(note, false);

        if (typeof showToast === 'function') showToast('Not taşındı ✓', 'success');
    }

    draggedNoteId = null;
};

// ═══ Concept Search Engine (Kavram Keşif Katmanı) ═══
window.performHeaderSearch = function () {
    const query = document.getElementById('header-search-input').value.trim();
    if (!query) return;

    // Yönlendir ve arama kutusunu doldur
    document.getElementById('search-input').value = query;
    if (typeof switchView === 'function') switchView('search');

    executeConceptSearch(query);
};

window.performSearch = function () {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    executeConceptSearch(query);
};

async function executeConceptSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '<div class="insight-loading"><div class="spinner"></div><p>Kavramlar taranıyor...</p></div>';

    try {
        const response = await fetch(`${API_URL}/concept-search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Arama başarısız oldu.');

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            resultsContainer.innerHTML = '<div class="empty-state">Sonuç bulunamadı.</div>';
            return;
        }

        let html = '<div class="search-results-list" style="display:flex; flex-direction:column; gap:15px; margin-top:20px;">';

        let currentBook = null;

        data.results.forEach(item => {
            // Group by book
            if (item.book !== currentBook) {
                html += `<div class="search-book-header" style="margin-top:20px; padding-bottom:5px; border-bottom:2px solid var(--border-color); color:var(--primary); font-weight:bold; font-size:1.1em;">📚 ${item.book || 'Bilinmeyen Eser'}</div>`;
                currentBook = item.book;
            }

            const safeText = item.text ? item.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : '';
            const preview = safeText.substring(0, 250) + (safeText.length > 250 ? '...' : '');

            // Highlight query in preview
            const highlightRegex = new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
            const styledPreview = preview.replace(highlightRegex, '<mark style="background-color: var(--amber); color: #fff; padding: 0 4px; border-radius: 3px;">$1</mark>');

            html += `
            <div class="search-result-card glass-card" style="padding:15px; border-radius:8px; border-left:4px solid var(--primary);">
                <div class="search-result-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <span style="font-size:0.9em; color:var(--text-secondary); font-weight:600;">${item.canonical || (item.book + ' - ' + item.section)}</span>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-outline btn-sm" onclick="readSearchResult('${item.book}', '${item.section}')" style="font-size:0.8em; padding:4px 8px;">📖 Oku</button>
                        <button class="btn btn-amber btn-sm" onclick="askSearchResult('${safeText.replace(/'/g, "&#39;")}', '${item.canonical || item.book}')" style="font-size:0.8em; padding:4px 8px;">💬 Sor</button>
                    </div>
                </div>
                <div class="search-result-text" style="font-size:0.95em; line-height:1.6; color:var(--text-color);">
                    "${styledPreview}"
                </div>
            </div>`;
        });

        html += '</div>';
        resultsContainer.innerHTML = html;

    } catch (err) {
        resultsContainer.innerHTML = `<div class="form-error">❌ ${err.message}</div>`;
    }
}

window.readSearchResult = function (book, section) {
    if (typeof loadChapter === 'function') {
        const bookSlug = book.toLowerCase().replace(/['\s]/g, '-').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/^-+|-+$/g, '');
        const sectionSlug = section.toLowerCase().replace(/['\s]/g, '-').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/\./g, '').replace(/^-+|-+$/g, '');

        loadChapter(bookSlug, sectionSlug);
        switchView('reader');
    }
};

window.askSearchResult = function (text, source) {
    const input = document.getElementById('chat-input');
    if (!input) return;

    input.value = `Şu metni bana açıklar mısın?\n\n"${text}"\n(${source})`;
    input.focus();

    if (typeof autoResize === 'function') autoResize(input);
    if (typeof switchView === 'function') switchView('chat');

    input.scrollIntoView({ behavior: 'smooth' });
};

// ═══ Concept Map (Kavram Haritası) ═══
let conceptNetwork = null;

window.loadConceptMap = async function (query) {
    await drawConceptMap(query);
};

window.drawConceptMap = async function (conceptName) {
    if (!conceptName) return;

    // Switch to Map tab
    if (typeof switchWorkspaceTab === 'function') {
        switchWorkspaceTab('map');
    }

    // Ensure Atölye is open
    const panel = document.getElementById('insight-panel');
    if (panel && panel.classList.contains('hidden')) {
        togglePanel('insight-panel');
    }

    const container = document.getElementById('concept-map-container');
    if (!container) return;

    const inputField = document.getElementById('concept-map-input');
    if (inputField && inputField.value !== conceptName) {
        inputField.value = conceptName;
    }

    container.innerHTML = '<div class="insight-loading"><div class="spinner"></div><p>Derin Harita oluşturuluyor...</p></div>';

    try {
        const response = await fetch(`${API_URL}/concept-map`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concept: conceptName })
        });
        if (!response.ok) throw new Error('Harita verisi alınamadı');

        const data = await response.json();

        if (!data.nodes || data.nodes.length <= 1) {
            container.innerHTML = '<div class="empty-state-sm">Bu kavram için yeterli bağlantı bulunamadı.</div>';
            return;
        }

        container.innerHTML = '<div id="concept-map-canvas"></div><div id="concept-card" class="hidden"></div>';
        const canvasContainer = document.getElementById('concept-map-canvas');

        const nodes = new vis.DataSet(data.nodes);
        const edges = new vis.DataSet(data.edges);

        const options = {
            nodes: {
                shape: 'ellipse',
                font: { size: 14, face: 'Inter', color: '#4a4a4a', bold: { color: '#8b6914' } },
                borderWidth: 2
            },
            edges: {
                color: { color: '#c9a84c', opacity: 0.6 },
                smooth: { type: 'curvedCW', roundness: 0.2 }
            },
            physics: {
                enabled: true,
                forceAtlas2Based: {
                    gravitationalConstant: -50,
                    centralGravity: 0.01,
                    springLength: 100,
                    springConstant: 0.08
                },
                maxVelocity: 50,
                solver: 'forceAtlas2Based',
                stabilization: { iterations: 150 }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                zoomView: true,
                dragView: true
            }
        };

        conceptNetwork = new vis.Network(canvasContainer, { nodes, edges }, options);

        // Click Event: Open Unified Card
        conceptNetwork.on("click", async function (params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const clickedNode = data.nodes.find(n => n.id === nodeId);
                if (clickedNode) window.showConceptCard(clickedNode.label);
            }
        });

        // Double Click Event: Expand Map
        conceptNetwork.on("doubleClick", async function (params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const clickedNode = data.nodes.find(n => n.id === nodeId);
                if (nodeId !== 0 && clickedNode) {
                    await drawConceptMap(clickedNode.label);
                }
            }
        });

    } catch (err) {
        container.innerHTML = `<div class="form-error">❌ ${err.message}</div>`;
    }
};

window.showConceptCard = async function (conceptName) {
    const card = document.getElementById('concept-card');
    if (!card) return;

    card.classList.remove('hidden');
    card.innerHTML = `<div class="loading-spinner">DeepSeek Açıklama ve Külliyat Bağlantıları Yükleniyor...</div>`;

    try {
        const res = await fetch(`${API_URL}/concept-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concept: conceptName })
        });
        const data = await res.json();

        // Gruplama
        const grouped = {};
        if (data.occurrences) {
            data.occurrences.forEach(item => {
                if (!grouped[item.kitap]) grouped[item.kitap] = [];
                grouped[item.kitap].push(item);
            });
        }

        const listHTML = Object.entries(grouped).map(([kitap, items]) => `
            <div class="occurrence-group">
                <div class="occurrence-group-header">
                    ${kitap} <span class="count-badge">${items.length}</span>
                </div>
                ${items.map(item => {
            const safeText = item.metin_ipucu.replace(/`/g, '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
            return `
                    <div class="occurrence-item" onclick="goToPassage('${item.book_slug}', '${item.chapter_slug}', \`${safeText}\`)">
                        <div class="occurrence-bolum">${item.bolum_adi}</div>
                        <div class="occurrence-pasaj">${item.pasaj}</div>
                    </div>
                `}).join('')}
            </div>
        `).join('');

        card.innerHTML = `
            <div class="concept-card-inner">
                <div class="concept-card-header">
                    <span class="concept-name">📖 ${data.concept}</span>
                    <button onclick="closeConceptCard()" class="close-btn">✕</button>
                </div>
                
                <div class="concept-explanation">
                    ${data.explanation.replace(/\n/g, '<br>')}
                </div>
                
                <div class="concept-footer" style="padding-top: 10px; border-top: 1px solid #eee; margin-top:10px;">
                    <div style="font-weight:600;font-size:13px;color:#8b6914;margin-bottom:8px;">
                        📍 Külliyatta ${data.count} yerde geçer:
                    </div>
                    <div class="occurrence-list-inline" style="max-height: 250px; overflow-y: auto;">
                        ${listHTML || '<div class="empty-state-sm">Geçtiği yer bulunamadı.</div>'}
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        card.innerHTML = `<div class="form-error" style="padding:10px;">Açıklama yüklenemedi.</div>`;
    }
};

window.closeConceptCard = function () {
    const card = document.getElementById('concept-card');
    if (card) {
        card.innerHTML = '';
        card.classList.add('hidden');
    }
};

window.goToPassage = async function (bookSlug, chapterSlug, metinIpucu) {
    if (window.innerWidth < 1024) {
        const readerSection = document.getElementById('reader-section');
        const workspaceSection = document.getElementById('workspace-section');
        if (readerSection && workspaceSection) {
            readerSection.style.display = 'flex';
            workspaceSection.style.display = 'none';
            document.body.classList.remove('workspace-open');
        }
    }

    // loadChapter accepts: book, chapter, updateTab, scrollToText, forceScrollTop
    await loadChapter(bookSlug, chapterSlug, true, metinIpucu, false);

    setTimeout(() => {
        const paragraphs = document.querySelectorAll('.reader-content p');

        // Önce uzun eşleşme dene (40 karakter)
        let targetEl = null;
        const longHint = metinIpucu.slice(0, 40).trim();
        const shortHint = metinIpucu.slice(0, 20).trim();

        for (const el of paragraphs) {
            if (el.textContent.includes(longHint)) {
                targetEl = el;
                break;
            }
        }

        // Bulamazsa kısa eşleşme dene (20 karakter)
        if (!targetEl) {
            for (const el of paragraphs) {
                if (el.textContent.includes(shortHint)) {
                    targetEl = el;
                    break;
                }
            }
        }

        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.style.transition = 'background-color 0.4s';
            targetEl.style.backgroundColor = '#f5e642';
            setTimeout(() => {
                targetEl.style.backgroundColor = 'transparent';
            }, 2500);
        }
    }, 1000);
};

// ═══ Reader Settings ═══
window.toggleReaderSettings = function () {
    const dropdown = document.getElementById('reader-settings-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
};

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('reader-settings-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!e.target.closest('#reader-settings-dropdown') && !e.target.closest('[onclick="toggleReaderSettings()"]')) {
            dropdown.classList.add('hidden');
        }
    }
});

let currentReaderFontSize = 17; // px
let currentReaderLineSpacing = 1.8; // em

function applyReaderSettings() {
    const root = document.documentElement;
    console.log('Font size uygulanıyor:', currentReaderFontSize);
    root.style.setProperty('--reader-font-size', parseFloat(currentReaderFontSize) + 'px');
    root.style.setProperty('--reader-line-height', parseFloat(currentReaderLineSpacing).toFixed(1));

    // Save to localStorage
    try {
        localStorage.setItem('readerSettings', JSON.stringify({
            fontSize: parseFloat(currentReaderFontSize),
            lineSpacing: parseFloat(currentReaderLineSpacing),
            theme: document.documentElement.getAttribute('data-theme') || 'light'
        }));
    } catch (e) { }
}

window.changeFontSize = function (delta) {
    currentReaderFontSize = parseFloat(currentReaderFontSize) + parseFloat(delta);
    if (currentReaderFontSize < 12) currentReaderFontSize = 12;
    if (currentReaderFontSize > 36) currentReaderFontSize = 36;
    applyReaderSettings();
    if (typeof window.showToast === 'function') window.showToast('Yazı boyutu: ' + currentReaderFontSize + 'px', 'success');
};

window.changeLineSpacing = function (delta) {
    currentReaderLineSpacing = parseFloat(currentReaderLineSpacing) + parseFloat(delta);
    if (currentReaderLineSpacing < 1.0) currentReaderLineSpacing = 1.0;
    if (currentReaderLineSpacing > 3.0) currentReaderLineSpacing = 3.0;
    applyReaderSettings();
    if (typeof window.showToast === 'function') window.showToast('Satır aralığı: ' + currentReaderLineSpacing.toFixed(1), 'success');
};

const THEMES = {
    light: {
        '--reader-bg': '#ffffff',
        '--reader-color': '#333333'
    },
    sepia: {
        '--reader-bg': '#f5f0e8',
        '--reader-color': '#5c4a32'
    },
    dark: {
        '--reader-bg': '#1a1a1a',
        '--reader-color': '#e0d5c5'
    }
};

window.changeTheme = function (themeName) {
    const theme = THEMES[themeName];
    if (!theme) return;
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
    // Set attributes for any rogue CSS that still uses it
    document.documentElement.setAttribute('data-theme', themeName);
    document.body.setAttribute('data-theme', themeName);

    applyReaderSettings();
    if (typeof window.showToast === 'function') window.showToast('Tema değiştirildi: ' + themeName, 'success');
};

window.loadReaderSettings = function () {
    try {
        const saved = localStorage.getItem('readerSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            if (settings.fontSize) currentReaderFontSize = parseFloat(settings.fontSize);
            if (settings.lineSpacing) currentReaderLineSpacing = parseFloat(settings.lineSpacing);
            if (settings.theme) {
                document.documentElement.setAttribute('data-theme', settings.theme);
                document.body.setAttribute('data-theme', settings.theme);
                const themeData = THEMES[settings.theme];
                if (themeData) {
                    const root = document.documentElement;
                    Object.entries(themeData).forEach(([key, value]) => {
                        root.style.setProperty(key, value);
                    });
                }
            }
            applyReaderSettings();
        }
    } catch (e) { console.error('Error loading settings', e); }
};

// Ensure settings load on startup
document.addEventListener('DOMContentLoaded', loadReaderSettings);
// Force load once just in case DOMContentLoaded already fired
loadReaderSettings();
