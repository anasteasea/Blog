// Состояние данных
let users = JSON.parse(localStorage.getItem('social_users_v3')) || {};
let posts = JSON.parse(localStorage.getItem('social_posts_v3')) || [];
let currentUser = JSON.parse(localStorage.getItem('current_user_v3')) || null;
let currentTab = 'all'; 
let activeTagFilter = null;

// Элементы DOM
const authSection = document.getElementById('auth-section');
const blogSection = document.getElementById('blog-section');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');
const postsFeed = document.getElementById('posts-feed');
const postForm = document.getElementById('post-form');
const suggestionsList = document.getElementById('users-suggestions');

// --- НАВИГАЦИЯ И АВТОРИЗАЦИЯ ---
document.getElementById('to-register').addEventListener('click', (e) => {
    e.preventDefault(); 
    toggleAuthForms(false);
});

document.getElementById('to-login').addEventListener('click', (e) => {
    e.preventDefault(); 
    toggleAuthForms(true);
});

function toggleAuthForms(showLogin) {
    loginBox.classList.toggle('hidden', !showLogin);
    registerBox.classList.toggle('hidden', showLogin);
}

document.getElementById('tab-all').addEventListener('click', () => switchTab('all'));
document.getElementById('tab-following').addEventListener('click', () => switchTab('following'));

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tab-all').classList.toggle('active', tab === 'all');
    document.getElementById('tab-following').classList.toggle('active', tab === 'following');
    renderPosts();
}

// Регистрация
document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const avatarColor = document.querySelector('input[name="reg-avatar"]:checked').value;

    if (users[email]) return alert('Этот Email уже зарегистрирован!');

    users[email] = { name, password, avatarColor, following: [] };
    localStorage.setItem('social_users_v3', JSON.stringify(users));
    alert('Регистрация успешна!');
    toggleAuthForms(true);
});

// Вход
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (users[email] && users[email].password === password) {
        currentUser = email;
        localStorage.setItem('current_user_v3', JSON.stringify(currentUser));
        initApp();
    } else {
        alert('Неверный логин или пароль!');
    }
});

// Выход
document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('current_user_v3');
    initApp();
});

function initApp() {
    if (currentUser && users[currentUser]) {
        authSection.classList.add('hidden');
        blogSection.classList.remove('hidden');
        
        const me = users[currentUser];
        document.getElementById('current-user-name').textContent = me.name;
        const myAvatar = document.getElementById('current-user-avatar');
        myAvatar.textContent = me.name[0];
        myAvatar.style.backgroundColor = me.avatarColor;

        if (!me.following) me.following = [];

        renderPosts();
        renderSuggestions();
    } else {
        blogSection.classList.add('hidden');
        authSection.classList.remove('hidden');
    }
}

// Создание/редактирование поста
postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const editId = document.getElementById('edit-post-id').value;
    const visibility = document.getElementById('post-visibility').value;
    const tagsInput = document.getElementById('post-tags').value;

    const processedTags = tagsInput.split(/[\s,]+/)
        .map(tag => tag.replace('#', '').trim().toLowerCase())
        .filter(tag => tag.length > 0);

    if (editId) {
        const post = posts.find(p => p.id == editId);
        if (post && post.authorEmail === currentUser) {
            post.title = title;
            post.content = content;
            post.tags = processedTags;
            post.visibility = visibility;
        }
    } else {
        const newPost = {
            id: Date.now(),
            title,
            content,
            authorEmail: currentUser,
            date: new Date().toLocaleDateString('ru-RU', {hour:'2-digit', minute:'2-digit'}),
            likes: [],
            comments: [],
            visibility: visibility,
            accessRequests: [],
            allowedUsers: [],
            tags: processedTags
        };
        posts.push(newPost);
    }
    saveData();
    renderPosts();
    resetEditor();
});

// Рендеринг облака тегов
function renderTagsCloud() {
    const tagsCloud = document.getElementById('tags-cloud');
    if (!tagsCloud) return;

    let allTags = [];
    posts.forEach(post => {
        if (post.tags) allTags = allTags.concat(post.tags);
    });

    const uniqueTags = [...new Set(allTags)];

    if (uniqueTags.length === 0) {
        tagsCloud.innerHTML = '<span style="color:#888; font-size:0.85rem; font-style:italic;">Тегов пока нет</span>';
        return;
    }

    let cloudHTML = `<span class="tag-badge ${!activeTagFilter ? 'active-filter' : ''}" onclick="filterByTag(null)">❌ Все темы</span>`;
    uniqueTags.forEach(tag => {
        const isActive = activeTagFilter === tag;
        cloudHTML += `<span class="tag-badge ${isActive ? 'active-filter' : ''}" onclick="filterByTag('${tag}')">#${escapeHTML(tag)}</span>`;
    });
    tagsCloud.innerHTML = cloudHTML;
}

window.filterByTag = (tag) => {
    activeTagFilter = tag;
    renderTagsCloud();
    renderPosts();
};

// Отрисовка постов
function renderPosts() {
    postsFeed.innerHTML = '';
    const myInfo = users[currentUser];

    let filteredPosts = [...posts];
    if (currentTab === 'following') {
        filteredPosts = posts.filter(p => myInfo.following.includes(p.authorEmail) || p.authorEmail === currentUser);
    }

    if (activeTagFilter) {
        filteredPosts = filteredPosts.filter(p => p.tags && p.tags.includes(activeTagFilter));
    }

    renderTagsCloud(); 

    if (filteredPosts.length === 0) {
        postsFeed.innerHTML = '<p style="text-align:center; color:#888; padding: 20px;">Постов не найдено...</p>';
        return;
    }

    filteredPosts.reverse().forEach(post => {
        const author = users[post.authorEmail] || { name: 'Удаленный пользователь', avatarColor: '#aaa' };
        const isAuthor = post.authorEmail === currentUser;
        const hasLiked = post.likes.includes(currentUser);
        
        const isPublic = post.visibility !== 'request';
        const isAllowed = post.allowedUsers && post.allowedUsers.includes(currentUser);
        const canViewContent = isAuthor || isPublic || isAllowed;
        const hasRequested = post.accessRequests && post.accessRequests.includes(currentUser);

        const card = document.createElement('div');
        card.className = 'post-card';
        
        let postBodyHTML = '';
        if (canViewContent) {
            const tagsHTML = post.tags && post.tags.length > 0 
                ? `<div class="post-tags-list">${post.tags.map(t => `<span class="post-tag" onclick="filterByTag('${t}')">#${escapeHTML(t)}</span>`).join(' ')}</div>`
                : '';

            postBodyHTML = `
                <h3 style="margin-top:10px;">${escapeHTML(post.title)} ${!isPublic ? '🔒 (Приватный)' : ''}</h3>
                <div style="white-space:pre-wrap; margin-bottom:15px;">${escapeHTML(post.content)}</div>
                ${tagsHTML}
            `;
        } else {
            postBodyHTML = `
                <h3 style="margin-top:10px; color:#888;">🔒 Скрытый пост</h3>
                <div class="locked-content">
                    <p>Этот материал доступен только по одобренному запросу.</p>
                    ${hasRequested 
                        ? '<button class="btn-secondary" disabled>⏳ Запрос отправлен</button>' 
                        : `<button onclick="sendAccessRequest(${post.id})">🔑 Запросить доступ</button>`
                    }
                </div>
            `;
        }

        let authorRequestsHTML = '';
        if (isAuthor && post.accessRequests && post.accessRequests.length > 0) {
            authorRequestsHTML = `
                <div class="requests-panel">
                    <strong>🔔 Запросы на доступ:</strong>
                    ${post.accessRequests.map(reqEmail => {
                        const reqUser = users[reqEmail] || { name: reqEmail };
                        return `
                            <div class="request-user-item">
                                <span>${escapeHTML(reqUser.name)}</span>
                                <button class="btn-sm" onclick="approveAccess(${post.id}, '${reqEmail}')">Одобрить</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="post-header">
                <div class="avatar" style="background-color: ${author.avatarColor}">${author.name}</div>
                <div class="post-meta">
                    <h4>${escapeHTML(author.name)}</h4>
                    <span>${post.date}</span>
                </div>
            </div>
            
            ${authorRequestsHTML}
            ${postBodyHTML}
            
            ${canViewContent ? `
                <div class="post-actions">
                    <button class="btn-secondary" onclick="toggleLike(${post.id})">
                        ${hasLiked ? '❤️' : '🤍'} ${post.likes.length}
                    </button>
                    ${isAuthor ? `
                        <div class="author-actions">
                            <button class="btn-secondary btn-sm" onclick="startEdit(${post.id})">Ред.</button>
                            <button class="btn-danger btn-sm" onclick="deletePost(${post.id})">Удл.</button>
                        </div>
                    ` : ''}
                </div>

                <div class="comments-section">
                    <div class="comments-list">
                        ${post.comments.map(c => {
                            const cAuthor = users[c.email] || { name: 'Гость', avatarColor: '#ccc' };
                            return `
                                <div class="comment">
                                    <div class="avatar" style="background-color: ${cAuthor.avatarColor}; width:24px; height:24px; font-size:0.7rem;">${cAuthor.name}</div>
                                    <div class="comment-text">
                                        <b>${escapeHTML(cAuthor.name)}</b>: ${escapeHTML(c.text)}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <form class="comment-form" onsubmit="addComment(event, ${post.id})">
                        <input type="text" placeholder="Написать комментарий..." required>
                        <button type="submit" class="btn-sm">ОК</button>
                    </form>
                </div>
            ` : ''}
        `;
        postsFeed.appendChild(card);
    });
}

// Виджет подписок
function renderSuggestions() {
    suggestionsList.innerHTML = '';
    const myInfo = users[currentUser];

    Object.keys(users).forEach(email => {
        if (email === currentUser) return; 

        const user = users[email];
        const isFollowing = myInfo.following.includes(email);

        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <div class="suggestion-info">
                <div class="avatar" style="background-color: ${user.avatarColor}; width:30px; height:30px; font-size:0.9rem;">${user.name}</div>
                <span>${escapeHTML(user.name)}</span>
            </div>
            <button class="${isFollowing ? 'btn-secondary' : ''} btn-sm" onclick="toggleFollow('${email}')">
                ${isFollowing ? 'Отписаться' : 'Подписаться'}
            </button>
        `;
        suggestionsList.appendChild(item);
    });
}

// Функции интеракций
window.sendAccessRequest = (id) => {
    const post = posts.find(p => p.id === id);
    if (!post.accessRequests) post.accessRequests = [];
    if (!post.accessRequests.includes(currentUser)) {
        post.accessRequests.push(currentUser);
        saveData();
        renderPosts();
    }
};

window.approveAccess = (postId, userEmail) => {
    const post = posts.find(p => p.id === postId);
    if (!post.allowedUsers) post.allowedUsers = [];
    post.allowedUsers.push(userEmail);
    post.accessRequests = post.accessRequests.filter(email => email !== userEmail);
    saveData();
    renderPosts();
};

window.toggleFollow = (email) => {
    const myInfo = users[currentUser];
    const index = myInfo.following.indexOf(email);
    if (index === -1) myInfo.following.push(email);
    else myInfo.following.splice(index, 1);
    saveData();
    renderSuggestions();
    if (currentTab === 'following') renderPosts();
};

window.toggleLike = (id) => {
    const post = posts.find(p => p.id === id);
    const index = post.likes.indexOf(currentUser);
    if (index === -1) post.likes.push(currentUser);
    else post.likes.splice(index, 1);
    saveData();
    renderPosts();
};

window.addComment = (e, postId) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const post = posts.find(p => p.id === postId);
    post.comments.push({ email: currentUser, text: input.value.trim() });
    saveData();
    renderPosts();
};

window.deletePost = (id) => {
    if (confirm('Удалить пост?')) {
        posts = posts.filter(p => p.id !== id);
        saveData();
        renderPosts();
    }
};

window.startEdit = (id) => {
    const post = posts.find(p => p.id === id);
    document.getElementById('edit-post-id').value = post.id;
    document.getElementById('post-title').value = post.title;
    document.getElementById('post-content').value = post.content;
    document.getElementById('post-visibility').value = post.visibility || 'public';
    document.getElementById('post-tags').value = post.tags ? post.tags.join(', ') : '';
    document.getElementById('editor-title').textContent = 'Редактировать пост';
    document.getElementById('submit-post-btn').textContent = 'Сохранить';
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
};

document.getElementById('cancel-edit-btn').addEventListener('click', resetEditor);

function resetEditor() {
    postForm.reset();
    document.getElementById('edit-post-id').value = '';
    document.getElementById('post-visibility').value = 'public';
    document.getElementById('post-tags').value = '';
    document.getElementById('editor-title').textContent = 'Создать пост';
    document.getElementById('submit-post-btn').textContent = 'Опубликовать';
    document.getElementById('cancel-edit-btn').classList.add('hidden');
}

function saveData() {
    localStorage.setItem('social_users_v3', JSON.stringify(users));
    localStorage.setItem('social_posts_v3', JSON.stringify(posts));
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

initApp();
