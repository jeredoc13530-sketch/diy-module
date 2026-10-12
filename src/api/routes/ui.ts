// ============================================================================
//  /api/diy/ui — Interface complète avec Authentification (LocalStorage + Cookie)
// ============================================================================
import { Hono } from 'hono';
import { prisma } from '../../lib/prisma';
import { searchAndIngestWeb } from '../../../services/liveSearch';

const ui = new Hono();

ui.get('/', async (c) => {
  const searchQuery = c.req.query('search') || '';

  if (searchQuery.trim().length > 0) {
    await searchAndIngestWeb(searchQuery);
  }

  const whereClause: any = { moderationStatus: 'APPROVED' };
  if (searchQuery) {
    whereClause.OR = [
      { title: { contains: searchQuery } },
      { description: { contains: searchQuery } },
      { tags: { contains: searchQuery } },
    ];
  }

  const [popularTips, totalTips, totalSavings] = await Promise.all([
    prisma.diyTip.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        slug: true, title: true, category: true, difficulty: true,
        estimatedMonthlySaving: true, roiMonths: true,
        sourceCredit: true, sourceUrl: true, description: true,
      },
    }),
    prisma.diyTip.count({ where: { moderationStatus: 'APPROVED' } }),
    prisma.diyTip.aggregate({
      where: { moderationStatus: 'APPROVED' },
      _sum: { estimatedMonthlySaving: true },
    }),
  ]);

  const tipsHtml = popularTips.map(tip => `
    <div class="card">
      <div class="card-content">
        <div class="card-meta">
          <span class="badge">${tip.category}</span>
          <span>Difficulté: ${tip.difficulty}</span>
        </div>
        <h3 class="card-title"><a href="${tip.sourceUrl}" target="_blank" style="color:inherit; text-decoration:none;">${tip.title} &nearr;</a></h3>
        <p class="desc">${(tip.description || '').substring(0, 120)}...</p>
        <p class="saving" style="margin-top:10px;">Économies estimées: ${tip.estimatedMonthlySaving}€ / mois</p>
        <p style="font-size:0.8rem; color:#777; margin-top:5px;">Source: ${tip.sourceCredit}</p>
      </div>
    </div>
  `).join('');

  const sectionTitle = searchQuery ? ('Résultats pour "' + searchQuery + '" (Web & Base)') : 'Astuces récentes';

  return c.html(
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fais Tes Économies Toi-Même</title>
  <style>
    :root {
      --primary: #4CAF50; --secondary: #8BC34A; --dark: #2E7D32;
      --light: #E8F5E9; --text: #333; --text-light: #777;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    body { background-color: #f9f9f9; color: var(--text); line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    header { background: linear-gradient(135deg, var(--dark) 0%, var(--primary) 100%); color: white; padding: 15px 0; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    .header-inner { display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.3rem; font-weight: bold; }
    .logo span { color: #FFD54F; }
    .user-area { display: flex; align-items: center; gap: 10px; }
    .btn-auth { background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s; }
    .btn-auth:hover { background: rgba(255,255,255,0.35); }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: #FFD54F; color: #333; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; }
    .hero { background-color: var(--light); padding: 40px 0; text-align: center; }
    .search-bar { margin: 20px auto; max-width: 600px; display: flex; gap: 10px; }
    .search-bar input { flex: 1; padding: 12px 16px; border: 2px solid #c8e6c9; border-radius: 25px; font-size: 1rem; outline: none; transition: border-color 0.3s; }
    .search-bar input:focus { border-color: var(--primary); }
    .search-bar button { background: linear-gradient(135deg, var(--dark), var(--primary)); color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-weight: bold; transition: transform 0.2s; }
    .search-bar button:hover { transform: scale(1.05); }
    .stats { display: flex; justify-content: center; gap: 30px; margin: 25px 0; flex-wrap: wrap; }
    .stat { background-color: white; padding: 18px 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); min-width: 160px; }
    .stat-value { font-size: 2rem; font-weight: bold; color: var(--primary); }
    .section { padding: 30px 0; }
    .section-title { text-align: center; margin-bottom: 25px; color: var(--dark); font-size: 1.6rem; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
    .card { background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.3s, box-shadow 0.3s; border: 1px solid #e8f5e9; }
    .card:hover { transform: translateY(-4px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); }
    .card-content { padding: 18px; }
    .card-title { font-size: 1.05rem; margin-bottom: 6px; color: var(--dark); line-height: 1.4; }
    .card-meta { display: flex; justify-content: space-between; color: var(--text-light); font-size: 0.8rem; margin-bottom: 8px; }
    .badge { background: linear-gradient(135deg, var(--secondary), var(--primary)); color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.72rem; }
    .saving { color: var(--primary); font-weight: bold; font-size: 0.95rem; }
    .desc { font-size: 0.85rem; color: #555; line-height: 1.5; }
    footer { background-color: var(--dark); color: white; text-align: center; padding: 20px 0; margin-top: 40px; }

    /* Modal */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
    .modal-overlay.show { display: flex !important; }
    .modal { background: white; border-radius: 16px; padding: 30px; max-width: 420px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .modal h2 { color: var(--dark); margin-bottom: 5px; text-align: center; }
    .modal p.subtitle { color: var(--text-light); text-align: center; margin-bottom: 20px; font-size: 0.9rem; }
    .modal input { width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 1rem; margin-bottom: 12px; outline: none; transition: border-color 0.3s; }
    .modal input:focus { border-color: var(--primary); }
    .modal .btn-primary { width: 100%; padding: 12px; background: linear-gradient(135deg, var(--dark), var(--primary)); color: white; border: none; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer; }
    .modal .divider { display: flex; align-items: center; gap: 10px; margin: 20px 0; color: var(--text-light); font-size: 0.85rem; }
    .modal .divider::before, .modal .divider::after { content: ''; flex: 1; height: 1px; background: #e0e0e0; }
    .btn-google { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; background: white; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 500; }
    .btn-google:hover { background: #f5f5f5; }
    .btn-google svg { width: 20px; height: 20px; }
    .modal .switch-link { text-align: center; margin-top: 15px; font-size: 0.85rem; color: var(--text-light); }
    .modal .switch-link a { color: var(--primary); cursor: pointer; font-weight: bold; }
    .error-msg { color: #e53935; font-size: 0.85rem; margin-bottom: 10px; text-align: center; min-height: 20px; }

    /* Google Account Chooser Modal */
    .google-chooser-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000; align-items: center; justify-content: center; }
    .google-chooser-overlay.show { display: flex !important; }
    .google-modal { background: white; border-radius: 8px; padding: 24px; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.25); text-align: left; }
    .google-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .google-header svg { width: 32px; height: 32px; }
    .google-header h3 { font-size: 1.15rem; color: #202124; font-weight: 500; }
    .google-subtitle { font-size: 0.9rem; color: #5f6368; margin-bottom: 20px; line-height: 1.4; }
    .google-account-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; max-height: 240px; overflow-y: auto; }
    .google-account-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 8px; cursor: pointer; transition: background 0.2s; background: #fff; }
    .google-account-item:hover { background: #f8f9fa; border-color: #bdc1c6; }
    .google-avatar-circle { width: 36px; height: 36px; border-radius: 50%; background: #1a73e8; color: white; display: flex; align-items: center; justify-content: center; font-weight: 500; font-size: 1rem; }
    .google-account-info { flex: 1; overflow: hidden; }
    .google-account-name { font-weight: 500; font-size: 0.9rem; color: #202124; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .google-account-email { font-size: 0.8rem; color: #5f6368; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .google-add-account { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px dashed #dadce0; border-radius: 8px; cursor: pointer; font-size: 0.9rem; color: #1a73e8; font-weight: 500; justify-content: center; transition: background 0.2s; }
    .google-add-account:hover { background: #f1f3f4; }
  </style>
</head>
<body>

  <!-- Header -->
  <header>
    <div class="container header-inner">
      <div class="logo">&#x1F331; Épargne<span>+</span></div>
      <div class="user-area" id="userArea">
        <button class="btn-auth" id="btnLogin">Se connecter</button>
        <button class="btn-auth" id="btnRegister">S'inscrire</button>
      </div>
    </div>
  </header>

  <!-- Modal Auth -->
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal">
      <!-- Login Form -->
      <div id="loginForm">
        <h2>Bon retour &#x1F44B;</h2>
        <p class="subtitle">Connectez-vous pour suivre vos astuces</p>
        <div class="error-msg" id="loginError"></div>
        <input type="email" id="loginEmail" placeholder="Votre email">
        <input type="password" id="loginPassword" placeholder="Mot de passe">
        <button class="btn-primary" id="submitLogin" type="button">Se connecter</button>
        <div class="divider">ou continuer avec</div>
        <button class="btn-google" id="btnGoogleLogin" type="button">
          <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Se connecter avec Google
        </button>
        <div class="switch-link">Pas encore de compte ? <a id="toRegister">S'inscrire</a></div>
      </div>

      <!-- Register Form -->
      <div id="registerForm" style="display:none;">
        <h2>Créer un compte &#x1F680;</h2>
        <p class="subtitle">Commencez à économiser dès maintenant</p>
        <div class="error-msg" id="registerError"></div>
        <input type="text" id="regName" placeholder="Votre prénom">
        <input type="email" id="regEmail" placeholder="Votre email">
        <input type="password" id="regPassword" placeholder="Mot de passe (min. 6 caractères)">
        <button class="btn-primary" id="submitRegister" type="button">Créer mon compte</button>
        <div class="divider">ou continuer avec</div>
        <button class="btn-google" id="btnGoogleRegister" type="button">
          <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          S'inscrire avec Google
        </button>
        <div class="switch-link">Déjà un compte ? <a id="toLogin">Se connecter</a></div>
      </div>
    </div>
  </div>

  <!-- Google Account Chooser Popup Modal -->
  <div class="google-chooser-overlay" id="googleChooserOverlay">
    <div class="google-modal">
      <div class="google-header">
        <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        <h3>Connexion Google</h3>
      </div>
      <p class="google-subtitle">Choisir votre compte Gmail pour continuer vers <strong>Fais Tes Économies Toi-Même</strong></p>

      <div class="google-account-list" id="googleAccountList">
        <!-- Rempli dynamiquement (vide par défaut pour exiger votre vrai compte) -->
      </div>

      <div class="google-add-account" id="googleAddAccountBtn">
        <span>+ Connexion avec votre vrai compte Gmail</span>
      </div>

      <div style="text-align: right; margin-top: 15px;">
        <button type="button" id="googleCancelBtn" style="background: none; border: none; color: #1a73e8; font-weight: 500; cursor: pointer; padding: 6px 12px;">Annuler</button>
      </div>
    </div>
  </div>

  <main>
    <section class="hero">
      <div class="container">
        <h2>Trouvez ou cherchez n'importe quelle astuce DIY</h2>
        <p>Tapez un mot-clé : la recherche interroge le web en direct et enrichit la base !</p>

        <form class="search-bar" method="GET" action="/api/diy/ui">
          <input type="text" name="search" placeholder="Ex: produit vaisselle maison, kombucha, lessive..." value="${searchQuery}">
          <button type="submit">&#x1F50D; Rechercher & Scraper le Web</button>
        </form>

        <div class="stats">
          <div class="stat"><div class="stat-value">${totalTips}</div><div class="stat-label">Astuces validées</div></div>
          <div class="stat"><div class="stat-value">${(totalSavings._sum.estimatedMonthlySaving ?? 0).toFixed(0)}&#x20AC;</div><div class="stat-label">Économies / mois</div></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <h2 class="section-title">${sectionTitle}</h2>
        ${popularTips.length === 0 ? '<p style="text-align:center;color:#999;">Aucune astuce trouvée. Essayez une autre recherche !</p>' : ''}
        <div class="card-grid">${tipsHtml}</div>
      </div>
    </section>
  </main>

  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} Fais Tes Économies Toi-Même</p>
    </div>
  </footer>

  <script>
    var modalOverlay = document.getElementById('modalOverlay');
    var loginForm = document.getElementById('loginForm');
    var registerForm = document.getElementById('registerForm');
    var userArea = document.getElementById('userArea');
    var googleChooserOverlay = document.getElementById('googleChooserOverlay');

    function openModal(mode) {
      modalOverlay.classList.add('show');
      if (mode === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
      } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      }
      document.getElementById('loginError').textContent = '';
      document.getElementById('registerError').textContent = '';
    }

    function closeModal() {
      modalOverlay.classList.remove('show');
    }

    function setupAuthButtons() {
      var btnL = document.getElementById('btnLogin');
      var btnR = document.getElementById('btnRegister');
      if (btnL) btnL.onclick = function() { openModal('login'); };
      if (btnR) btnR.onclick = function() { openModal('register'); };
    }

    setupAuthButtons();
    document.getElementById('toRegister').onclick = function() { openModal('register'); };
    document.getElementById('toLogin').onclick = function() { openModal('login'); };

    modalOverlay.onclick = function(e) {
      if (e.target === modalOverlay) closeModal();
    };

    function renderLoggedIn(user) {
      var initial = (user.name || user.email || 'U')[0].toUpperCase();
      userArea.innerHTML = '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div class="user-avatar">' + initial + '</div>' +
        '<div style="text-align:left;">' +
          '<div style="font-weight:bold;font-size:0.95rem;color:white;">' + (user.name || 'Utilisateur') + '</div>' +
          '<div style="font-size:0.75rem;opacity:0.85;color:white;">' + user.email + '</div>' +
        '</div>' +
        '<button class="btn-auth" id="btnLogout" style="margin-left:10px;background:rgba(255,255,255,0.25);">Déconnexion</button>' +
        '</div>';

      document.getElementById('btnLogout').onclick = function() {
        localStorage.removeItem('diy_token');
        localStorage.removeItem('diy_user');
        fetch('/api/diy/auth/logout', { method: 'POST' }).catch(function(){});
        userArea.innerHTML = '<button class="btn-auth" id="btnLogin">Se connecter</button>' +
          '<button class="btn-auth" id="btnRegister">S\\'inscrire</button>';
        setupAuthButtons();
      };
    }

    function onAuthSuccess(data) {
      if (data && data.user) {
        localStorage.setItem('diy_token', data.token);
        localStorage.setItem('diy_user', JSON.stringify(data.user));
        closeModal();
        renderLoggedIn(data.user);
      }
    }

    // Connexion
    document.getElementById('submitLogin').onclick = async function() {
      var email = document.getElementById('loginEmail').value.trim();
      var password = document.getElementById('loginPassword').value;
      if (!email || !password) {
        document.getElementById('loginError').textContent = 'Veuillez remplir tous les champs';
        return;
      }
      try {
        var res = await fetch('/api/diy/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: password })
        });
        var data = await res.json();
        if (res.ok) {
          onAuthSuccess(data);
        } else {
          document.getElementById('loginError').textContent = data.error || 'Identifiants incorrects';
        }
      } catch (e) {
        document.getElementById('loginError').textContent = 'Erreur réseau';
      }
    };

    // Inscription
    document.getElementById('submitRegister').onclick = async function() {
      var name = document.getElementById('regName').value.trim();
      var email = document.getElementById('regEmail').value.trim();
      var password = document.getElementById('regPassword').value;
      if (!email || !password) {
        document.getElementById('registerError').textContent = 'Email et mot de passe requis';
        return;
      }
      if (password.length < 6) {
        document.getElementById('registerError').textContent = 'Mot de passe : min. 6 caractères';
        return;
      }
      try {
        var res = await fetch('/api/diy/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: password, name: name })
        });
        var data = await res.json();
        if (res.ok) {
          onAuthSuccess(data);
        } else {
          document.getElementById('registerError').textContent = data.error || 'Erreur lors de l\\'inscription';
        }
      } catch (e) {
        document.getElementById('registerError').textContent = 'Erreur réseau';
      }
    };

    // Gestion du sélecteur de compte Google réel
    function getStoredGoogleAccounts() {
      try {
        return JSON.parse(localStorage.getItem('diy_google_accounts') || '[]');
      } catch(e) {
        return [];
      }
    }

    function saveGoogleAccount(acc) {
      var accs = getStoredGoogleAccounts();
      var exists = accs.some(function(a) { return a.email === acc.email; });
      if (!exists) {
        accs.unshift(acc);
        localStorage.setItem('diy_google_accounts', JSON.stringify(accs));
      }
    }

    function renderGoogleAccounts() {
      var listEl = document.getElementById('googleAccountList');
      var accs = getStoredGoogleAccounts();
      listEl.innerHTML = '';
      if (accs.length === 0) {
        listEl.innerHTML = '<p style="color:#5f6368;font-size:0.85rem;text-align:center;padding:10px 0;">Aucun compte enregistré sur cet appareil. Cliquez ci-dessous pour vous connecter avec votre vrai compte Gmail.</p>';
        return;
      }
      accs.forEach(function(acc) {
        var initial = (acc.name || acc.email || 'G')[0].toUpperCase();
        var item = document.createElement('div');
        item.className = 'google-account-item';
        item.innerHTML = '<div class="google-avatar-circle">' + initial + '</div>' +
          '<div class="google-account-info">' +
            '<div class="google-account-name">' + acc.name + '</div>' +
            '<div class="google-account-email">' + acc.email + '</div>' +
          '</div>';
        item.onclick = function() {
          loginWithGoogleAccount(acc.name, acc.email);
        };
        listEl.appendChild(item);
      });
    }

    async function loginWithGoogleAccount(name, email) {
      var payload = btoa(JSON.stringify({ email: email, name: name }));
      var idToken = "header." + payload + ".signature";

      try {
        var res = await fetch('/api/diy/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: idToken })
        });
        var data = await res.json();
        if (res.ok) {
          saveGoogleAccount({ name: name, email: email });
          googleChooserOverlay.classList.remove('show');
          onAuthSuccess(data);
        } else {
          alert(data.error || 'Erreur Google');
        }
      } catch (e) {
        alert('Erreur réseau');
      }
    }

    function openGoogleChooser() {
      renderGoogleAccounts();
      googleChooserOverlay.classList.add('show');
    }

    document.getElementById('btnGoogleLogin').onclick = openGoogleChooser;
    document.getElementById('btnGoogleRegister').onclick = openGoogleChooser;
    document.getElementById('googleCancelBtn').onclick = function() {
      googleChooserOverlay.classList.remove('show');
    };

    document.getElementById('googleAddAccountBtn').onclick = function() {
      var email = prompt("Entrez votre vraie adresse email Gmail (ex: nom@gmail.com) :", "");
      if (!email || !email.includes('@')) return;
      var name = prompt("Entrez votre prénom ou nom :", email.split('@')[0]);
      loginWithGoogleAccount(name || email.split('@')[0], email);
    };

    // Restaurer session existante au chargement
    var cached = localStorage.getItem('diy_user');
    if (cached) {
      try { renderLoggedIn(JSON.parse(cached)); } catch(e) {}
    }

    // Vérifier validité auprès du serveur
    var token = localStorage.getItem('diy_token');
    if (token) {
      fetch('/api/diy/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      }).then(function(res) {
        if (res.ok) {
          return res.json().then(function(u) { renderLoggedIn(u); });
        } else {
          localStorage.removeItem('diy_token');
          localStorage.removeItem('diy_user');
        }
      }).catch(function(){});
    }
  </script>
</body>
</html>`
  );
});

export default ui;
