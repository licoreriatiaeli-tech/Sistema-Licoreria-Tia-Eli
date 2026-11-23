/**
 * SIDEBAR MODERNO - TIA ELI LICORERIA
 * Manejador interactivo de tema, colapso/expansión, sincronización y métricas
 */

(function() {
  'use strict';

  function initSidebarModern() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // --- CONTROLES DE TEMA (MODO DÍA / NOCHE) ---
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const headerSunIcon = document.getElementById('header-theme-sun');
    const headerMoonIcon = document.getElementById('header-theme-moon');
    const btnThemeCollapsed = document.getElementById('btn-theme-collapsed');
    const microSunIcon = document.getElementById('micro-sun-icon');
    const microMoonIcon = document.getElementById('micro-moon-icon');

    function syncThemeUI() {
      const isDark = document.documentElement.dataset.theme === 'dark' ||
                     document.documentElement.classList.contains('dark');

      // Botón fluido en header (Día / Noche)
      if (headerSunIcon && headerMoonIcon) {
        if (isDark) {
          headerSunIcon.style.display = 'block';
          headerMoonIcon.style.display = 'none';
          headerSunIcon.classList.remove('hidden');
          headerMoonIcon.classList.add('hidden');
        } else {
          headerSunIcon.style.display = 'none';
          headerMoonIcon.style.display = 'block';
          headerSunIcon.classList.add('hidden');
          headerMoonIcon.classList.remove('hidden');
        }
      }
      if (btnThemeToggle) {
        btnThemeToggle.setAttribute('title', isDark ? 'Cambiar a Modo Día' : 'Cambiar a Modo Noche');
      }

      // Micro botón para modo colapsado
      if (microSunIcon && microMoonIcon) {
        if (isDark) {
          microSunIcon.style.display = 'block';
          microMoonIcon.style.display = 'none';
          microSunIcon.classList.remove('hidden');
          microMoonIcon.classList.add('hidden');
        } else {
          microSunIcon.style.display = 'none';
          microMoonIcon.style.display = 'block';
          microSunIcon.classList.add('hidden');
          microMoonIcon.classList.remove('hidden');
        }
      }
      if (btnThemeCollapsed) {
        btnThemeCollapsed.setAttribute('title', isDark ? 'Cambiar a Modo Día' : 'Cambiar a Modo Noche');
      }
    }

    let _lastThemeToggleTime = 0;
    function handleToggleTheme(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const now = Date.now();
      if (now - _lastThemeToggleTime < 180) return;
      _lastThemeToggleTime = now;

      if (typeof window.toggleTheme === 'function') {
        window.toggleTheme();
      } else {
        const isDark = document.documentElement.dataset.theme === 'dark' || document.documentElement.classList.contains('dark');
        const next = isDark ? 'light' : 'dark';
        if (typeof window.applyTheme === 'function') {
          window.applyTheme(next);
        } else {
          document.documentElement.dataset.theme = next;
          document.documentElement.classList.toggle('dark', next === 'dark');
          localStorage.setItem('tiaeli_theme', next);
          syncThemeUI();
        }
      }
    }

    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', handleToggleTheme);
    }
    if (btnThemeCollapsed) {
      btnThemeCollapsed.addEventListener('click', handleToggleTheme);
    }
    const themeCollapsedMicro = document.getElementById('theme-collapsed-micro');
    if (themeCollapsedMicro) {
      themeCollapsedMicro.addEventListener('click', (e) => {
        if (e.target !== btnThemeCollapsed && !btnThemeCollapsed?.contains(e.target)) {
          handleToggleTheme(e);
        }
      });
    }

    document.addEventListener('themeChanged', syncThemeUI);
    syncThemeUI();

    // --- ANIMACIÓN DE GIRO DE BOTÓN DE SINCRONIZACIÓN ---
    const btnSync = document.getElementById('btn-sync');
    const syncIcon = document.getElementById('sync-icon');

    if (btnSync && syncIcon) {
      btnSync.addEventListener('click', () => {
        syncIcon.classList.add('rotate-[360deg]');
        setTimeout(() => {
          syncIcon.classList.remove('rotate-[360deg]');
        }, 550);
        if (typeof window.sincronizar === 'function') {
          window.sincronizar();
        }
      });
    }

    // --- COLAPSO / EXPANSIÓN DEL SIDEBAR ---
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnSidebarLogo = document.getElementById('btn-sidebar-logo');
    const iconExpanded = document.getElementById('sidebar-icon-expanded');
    const iconCollapsed = document.getElementById('sidebar-icon-collapsed');

    function setSidebarCollapsed(collapsed) {
      if (collapsed) {
        sidebar.classList.add('sidebar-collapsed');
        if (iconExpanded) {
          iconExpanded.classList.add('hidden');
          iconExpanded.classList.remove('block');
        }
        if (iconCollapsed) {
          iconCollapsed.classList.remove('hidden');
          iconCollapsed.classList.add('block');
        }
        if (btnToggleSidebar) btnToggleSidebar.setAttribute('title', 'Expandir Menú');
        localStorage.setItem('tiaeli_sidebar_collapsed', 'true');
      } else {
        sidebar.classList.remove('sidebar-collapsed');
        if (iconExpanded) {
          iconExpanded.classList.remove('hidden');
          iconExpanded.classList.add('block');
        }
        if (iconCollapsed) {
          iconCollapsed.classList.add('hidden');
          iconCollapsed.classList.remove('block');
        }
        if (btnToggleSidebar) btnToggleSidebar.setAttribute('title', 'Colapsar Menú');
        localStorage.setItem('tiaeli_sidebar_collapsed', 'false');
      }
    }

    function handleToggleSidebar(e) {
      if (e) e.stopPropagation();
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        const overlay = document.getElementById('overlay');
        if (overlay) overlay.classList.toggle('active');
        return;
      }
      const isCurrentlyCollapsed = sidebar.classList.contains('sidebar-collapsed');
      setSidebarCollapsed(!isCurrentlyCollapsed);
    }

    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', handleToggleSidebar);
    }
    if (btnSidebarLogo) {
      btnSidebarLogo.addEventListener('click', handleToggleSidebar);
    }

    // Restaurar preferencia en pantallas de escritorio
    if (window.innerWidth > 768) {
      const savedCollapsed = localStorage.getItem('tiaeli_sidebar_collapsed');
      if (savedCollapsed === 'true') {
        setSidebarCollapsed(true);
      }
    }

    // --- FLOATING TOOLTIP PARA MODO COLAPSADO (CERO DESBORDE HORIZONTAL) ---
    let floatingTip = document.getElementById('sidebar-floating-tooltip');
    if (!floatingTip) {
      floatingTip = document.createElement('div');
      floatingTip.id = 'sidebar-floating-tooltip';
      floatingTip.style.cssText = [
        'position: fixed',
        'display: none',
        'align-items: center',
        'gap: 6px',
        'padding: 6px 12px',
        'background: #0f172a',
        'color: #ffffff',
        'font-size: 12px',
        'font-weight: 600',
        'border-radius: 8px',
        'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.3)',
        'border: 1px solid rgba(255,255,255,0.14)',
        'pointer-events: none',
        'z-index: 99999',
        'white-space: nowrap',
        'opacity: 0',
        'transition: opacity 0.15s ease, transform 0.15s ease'
      ].join(';');
      document.body.appendChild(floatingTip);
    }

    function attachFloatingTooltips() {
      const items = sidebar.querySelectorAll('.nav-btn, #sidebarUserContainer, #btn-sidebar-logo');
      items.forEach(el => {
        el.addEventListener('mouseenter', () => {
          if (!sidebar.classList.contains('sidebar-collapsed')) return;
          const text = el.getAttribute('title') ||
                       el.dataset.section ||
                       el.querySelector('.sidebar-text-hide')?.textContent?.trim();
          if (!text) return;
          floatingTip.textContent = text;
          const rect = el.getBoundingClientRect();
          floatingTip.style.left = (rect.right + 10) + 'px';
          floatingTip.style.top = (rect.top + rect.height / 2) + 'px';
          floatingTip.style.transform = 'translateY(-50%)';
          floatingTip.style.display = 'flex';
          requestAnimationFrame(() => { floatingTip.style.opacity = '1'; });
        });
        el.addEventListener('mouseleave', () => {
          floatingTip.style.opacity = '0';
          setTimeout(() => {
            if (floatingTip.style.opacity === '0') floatingTip.style.display = 'none';
          }, 150);
        });
      });
    }
    attachFloatingTooltips();

    // --- ACTUALIZACIÓN DINÁMICA DE MÉTRICAS Y USUARIO ---
    function updateSidebarMetrics() {
      // Contador de inventario
      const invCount = document.getElementById('sidebar-inv-count');
      const invCountTip = document.getElementById('sidebar-inv-count-tip');
      const totalProds = (window.productos && Array.isArray(window.productos)) ? window.productos.length : 0;
      if (invCount) invCount.textContent = totalProds.toLocaleString();
      if (invCountTip) invCountTip.textContent = totalProds.toLocaleString();

      // Usuario actual
      const user = window.sesion || (typeof window.usuarioActual === 'function' ? window.usuarioActual() : null) || 'ELI';
      const u = (window.usuarios && Array.isArray(window.usuarios))
        ? (window.usuarios.find(x => x.nombre.toUpperCase() === user.toUpperCase()) || {})
        : {};

      const avatar = document.getElementById('sidebarUserAvatar');
      const name = document.getElementById('sidebarUserName');
      const role = document.getElementById('sidebarUserRole');
      const tipName = document.getElementById('sidebarUserTipName');
      const tipRole = document.getElementById('sidebarUserTipRole');
      const roleText = (user.toUpperCase() === 'ELI' ? 'Administrador' : 'Cajero / Operador');

      if (avatar) {
        avatar.textContent = user.charAt(0).toUpperCase();
        avatar.style.backgroundColor = u.color || '#ea580c';
      }
      if (name) name.textContent = user;
      if (role) role.textContent = roleText;
      if (tipName) tipName.textContent = user;
      if (tipRole) tipRole.textContent = roleText;
    }

    window.updateSidebarMetrics = updateSidebarMetrics;
    updateSidebarMetrics();

    // Actualizar periódicamente y ante eventos del sistema
    if (window.EventBus) {
      window.EventBus.on('section:changed', updateSidebarMetrics);
      window.EventBus.on('theme:changed', syncThemeUI);
    }
    setInterval(updateSidebarMetrics, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarModern);
  } else {
    initSidebarModern();
  }
})();
