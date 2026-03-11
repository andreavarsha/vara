import schema from './data/schema.json';

let guestId = localStorage.getItem('vara_guest_id') || crypto.randomUUID();
if (!localStorage.getItem('vara_guest_id')) {
  localStorage.setItem('vara_guest_id', guestId);
}

const PLACEHOLDER_SVG = `<svg class="placeholder-dress" viewBox="0 0 100 150" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M50 10 L30 50 L35 140 L65 140 L70 50 Z" stroke="#005C5C"/>
  <path d="M50 25 L50 50" stroke="#005C5C"/>
</svg>`;

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const user = window.netlifyIdentity?.currentUser();
  if (user) {
    return user.jwt().then((token) => ({ ...headers, Authorization: `Bearer ${token}` }));
  }
  return Promise.resolve(headers);
}

async function fetchApi(url, options = {}) {
  const headers = await getHeaders();
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  const data = res.ok ? await res.json().catch(() => ({})) : await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

function renderForm(container, state) {
  const canGenerate = state.occasion && state.ageRange;
  container.innerHTML = `
    <div class="layout layout--hero">
    <section class="form-section form-glass">
      <span class="brand-year">2026</span>
      <h1 class="brand-title">VarA</h1>
      <p class="brand-tagline">Your 2026 dress ideas. Three questions. Five silhouettes.</p>
      <div class="form-fields">
        <div>
          <label class="form-label">What's the occasion?</label>
          <select id="occasion" data-field="occasion">
            <option value="">Select...</option>
            ${schema.occasions.map((o) => `<option value="${o.value}" ${state.occasion === o.value ? 'selected' : ''}>${o.value}</option>`)}
          </select>
        </div>
        <div>
          <label class="form-label">Age range</label>
          <select id="ageRange" data-field="ageRange">
            <option value="">Select...</option>
            ${schema.age_ranges.map((a) => `<option value="${a.value}" ${state.ageRange === a.value ? 'selected' : ''}>${a.value}</option>`)}
          </select>
        </div>
        <div>
          <label class="form-label">Material <span class="optional">(optional)</span></label>
          <select id="material" data-field="material">
            <option value="No preference">No preference</option>
            ${schema.materials.map((m) => `<option value="${m.value}" ${state.material === m.value ? 'selected' : ''}>${m.value}</option>`)}
          </select>
        </div>
        <button class="btn btn-primary" id="generateBtn" ${!canGenerate ? 'disabled' : ''}>
          Generate My Looks
        </button>
      </div>
    </section>
    </div>
  `;

  const occasionEl = container.querySelector('#occasion');
  const ageEl = container.querySelector('#ageRange');
  const materialEl = container.querySelector('#material');
  const btn = container.querySelector('#generateBtn');

  const update = () => {
    state.occasion = occasionEl.value;
    state.ageRange = ageEl.value;
    state.material = materialEl.value;
    btn.disabled = !state.occasion || !state.ageRange;
  };

  occasionEl.addEventListener('change', update);
  ageEl.addEventListener('change', update);
  materialEl.addEventListener('change', update);

  btn.addEventListener('click', () => state.onGenerate?.());
}

function renderLoading(container) {
  container.innerHTML = `
    <div class="loading-wrap">
      <div class="loading-shimmer shimmer"></div>
      <p class="loading-text">VarA is designing your looks...</p>
      <p class="loading-sub">Five trends. Five silhouettes. All yours.</p>
    </div>
  `;
}

function renderError(container, message, onRetry) {
  container.innerHTML = `
    <div class="error-wrap">
      <h2>VarA is taking a moment</h2>
      <p>${message}</p>
      ${onRetry ? '<button class="btn btn-primary" id="retryBtn">Try again</button>' : ''}
    </div>
  `;
  const retry = container.querySelector('#retryBtn');
  if (retry) retry.addEventListener('click', onRetry);
}

function renderCards(container, cards, occasion, state) {
  const isLoggedIn = !!state.user;
  const savedIds = new Set((state.savedCards || []).map((c) => c.id));

  container.innerHTML = `
    <div class="layout">
    <h2 class="serif" style="margin-bottom: 0.5rem;">Your 2026 Looks Are Ready</h2>
    <p style="margin-bottom: 1.5rem; opacity: 0.9;">For: ${occasion}</p>
    ${/* imageGenFailed banner removed — placeholder cards are self-explanatory */ ''}
    <div class="cards-grid" id="cardsGrid"></div>
    ${state.limitReached ? `
      <div class="soft-cta">
        <p class="serif">You've curated 3 concept boards. More is coming.</p>
        ${isLoggedIn ? '<a href="#saved" class="btn btn-secondary">View My Saved Designs</a>' : ''}
      </div>
    ` : '<button class="btn btn-primary" id="generateAgain" style="margin-top: 1.5rem;">Generate Again</button>'}
    </div>
  `;

  const grid = container.querySelector('#cardsGrid');
  cards.forEach((card, i) => {
    const isSaved = savedIds.has(card.id);
    const heartSvg = isSaved
      ? '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
      : '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>';

    const cardEl = document.createElement('div');
    cardEl.className = 'card glass';
    cardEl.innerHTML = `
      <div class="card-image-wrap">
        ${PLACEHOLDER_SVG}
        <button class="heart-btn ${isSaved ? 'filled' : ''}" data-card-id="${card.id || i}" data-silhouette="${card.silhouette}" aria-label="Save design">
          ${heartSvg}
        </button>
      </div>
      <div class="card-body">
        <span class="card-badge">${card.silhouette}</span>
        <div class="card-occasion">For: ${occasion}</div>
        <p class="card-analysis">${card.styleAnalysis || ''}</p>
        <div class="card-trends">
          ${(card.trendEvidence || []).map((t) => `<span class="card-trend-tag">${t}</span>`).join('')}
        </div>
      </div>
    `;

    // Progressively load image in background
    const imgWrap = cardEl.querySelector('.card-image-wrap');
    if (card.imagePromptContext) {
      const imgEl = document.createElement('img');
      imgEl.alt = card.silhouette;
      imgEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;opacity:0;transition:opacity 0.4s';
      imgWrap.style.position = 'relative';
      imgWrap.appendChild(imgEl);

      fetch('/.netlify/functions/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card.imagePromptContext),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.base64) {
            imgEl.src = `data:${data.mimeType || 'image/jpeg'};base64,${data.base64}`;
            imgEl.onload = () => {
              imgWrap.querySelector('.placeholder-dress')?.remove();
              imgEl.style.opacity = '1';
            };
          }
        })
        .catch(() => { /* keep placeholder on error */ });
    }

    const heartBtn = cardEl.querySelector('.heart-btn');
    heartBtn.addEventListener('click', () => state.onHeartClick?.(card, heartBtn, cardEl));

    grid.appendChild(cardEl);
  });

  const againBtn = container.querySelector('#generateAgain');
  if (againBtn) againBtn.addEventListener('click', () => state.onGenerate?.());
}

function renderAccountGateModal(container, trigger, state) {
  const headline = trigger === 'heart' ? 'Save this look to your VarA board.' : 'VarA has more ideas for you.';
  const body = trigger === 'heart'
    ? 'Create a free account to save designs you love and unlock 2 more sessions.'
    : 'Create a free account to keep designing and save the looks you love.';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'accountGateModal';
  modal.innerHTML = `
    <div class="modal glass">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h2 class="serif">${headline}</h2>
      <p>${body}</p>
      <button class="btn btn-primary" id="signupBtn">Create free account</button>
      <a href="#" class="modal-link" id="signinLink">Sign in instead</a>
    </div>
  `;

  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
    state.onModalDismiss?.();
  });
  modal.querySelector('#signupBtn').addEventListener('click', () => {
    window.netlifyIdentity?.open('signup');
    modal.remove();
  });
  modal.querySelector('#signinLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.netlifyIdentity?.open('login');
    modal.remove();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  container.appendChild(modal);
}

export function initApp() {
  const app = document.getElementById('app');
  const main = document.getElementById('main') || app;
  const state = {
    occasion: '',
    ageRange: '',
    material: 'No preference',
    user: null,
    savedCards: [],
    cards: null,
    imageGenFailed: false,
    limitReached: false,
    guestGenUsed: false,
  };

  function showForm() {
    renderForm(main, state);
  }

  async function doGenerate() {
    if (!state.occasion || !state.ageRange) return;

    const user = window.netlifyIdentity?.currentUser();
    state.user = user;
    state.guestGenUsed = !user && (state.guestGenUsed || (await getGenerationCount()) > 0);

    renderLoading(main);

    try {
      const headers = await getHeaders();
      const res = await fetch('/.netlify/functions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          occasion: state.occasion,
          ageRange: state.ageRange,
          material: state.material === 'No preference' ? null : state.material,
          guestId: user ? undefined : guestId,
          userId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.limitReached && data.isGuest) {
          state.showAccountGate = true;
          state.gateTrigger = 'generate';
          renderForm(main, state);
          state.onGenerate = doGenerate;
          renderAccountGateModal(main, 'generate', state);
          return;
        }
        throw new Error(data.error || 'Request failed');
      }

      state.cards = data.cards.map((c, i) => ({ ...c, id: `${Date.now()}_${i}_${c.silhouette}` }));
      state.imageGenFailed = data.imageGenFailed;
      state.limitReached = data.limitReached;
      state.generationCount = data.generationCount;

      renderCards(main, state.cards, state.occasion, state);
      state.onGenerate = doGenerate;
      state.onHeartClick = handleHeartClick;
    } catch (err) {
      renderError(
        main,
        err.message || 'Something went wrong. Please try again shortly.',
        () => { showForm(); state.onGenerate = doGenerate; }
      );
    }
  }

  async function getGenerationCount() {
    return 0;
  }

  async function handleHeartClick(card, heartBtn, cardEl) {
    const user = window.netlifyIdentity?.currentUser();
    if (!user) {
      renderAccountGateModal(main, 'heart', state);
      return;
    }

    const isSaved = heartBtn.classList.contains('filled');
    const action = isSaved ? 'unsave' : 'save';

    try {
      const payload = action === 'save'
        ? { ...card, id: card.id || `${Date.now()}_${card.silhouette}` }
        : card;

      await fetchApi('/.netlify/functions/save-card', {
        method: 'POST',
        body: JSON.stringify({ action, card: payload }),
      });

      state.savedCards = (await fetchApi('/.netlify/functions/get-saved-cards')).savedCards || [];
      heartBtn.classList.toggle('filled', action === 'save');
      heartBtn.innerHTML = action === 'save'
        ? '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
        : '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>';
    } catch (err) {
      console.error('Save failed:', err);
    }
  }

  state.onGenerate = doGenerate;
  showForm();

  window.netlifyIdentity?.on('init', (user) => {
    state.user = user;
    if (user) {
      fetchApi('/.netlify/functions/get-saved-cards')
        .then((r) => { state.savedCards = r.savedCards || []; })
        .catch(() => {});
    }
  });
  window.netlifyIdentity?.on('login', () => {
    state.user = window.netlifyIdentity.currentUser();
    window.netlifyIdentity.close();
    if (state.cards) {
      renderCards(main, state.cards, state.occasion, state);
      state.onGenerate = doGenerate;
      state.onHeartClick = handleHeartClick;
    } else {
      showForm();
    }
  });
  window.netlifyIdentity?.on('logout', () => {
    state.user = null;
    state.savedCards = [];
  });

  if (window.location.hash === '#saved') {
    (async () => {
      const user = window.netlifyIdentity?.currentUser();
      if (!user) {
        renderAccountGateModal(main, 'heart', state);
        return;
      }
      try {
        const { savedCards } = await fetchApi('/.netlify/functions/get-saved-cards');
        state.savedCards = savedCards;
        main.innerHTML = `
          <div class="layout">
            <h1 class="serif">My Saved Designs</h1>
            <p style="margin-bottom: 1.5rem;">${savedCards.length} saved</p>
            <div class="cards-grid">
              ${savedCards.map((c) => `
                <div class="card glass">
                  <div class="card-image-wrap">
                    ${c.imageBase64 ? `<img src="data:image/png;base64,${c.imageBase64}" alt="${c.silhouette}" />` : PLACEHOLDER_SVG}
                  </div>
                  <div class="card-body">
                    <span class="card-badge">${c.silhouette}</span>
                    <p class="card-analysis">${c.styleAnalysis || ''}</p>
                    <div class="card-trends">
                      ${(c.trendEvidence || []).map((t) => `<span class="card-trend-tag">${t}</span>`).join('')}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            <p style="margin-top: 1.5rem;"><a href="#" class="btn btn-secondary">Back to VarA</a></p>
          </div>
        `;
        app.querySelector('a[href="#"]')?.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.hash = '';
          initApp();
        });
      } catch {
        renderAccountGateModal(main, 'heart', state);
      }
    })();
    return;
  }

}
