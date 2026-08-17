// settings.js - centro de ajustes, importador de mascotas y editor avanzado.

const CHARACTER_REACTIONS = [
  ['idle', 'Reposo', true], ['celebrate', 'Celebrar'], ['coffee', 'Café / actividad'],
  ['heart', 'Cariño / clic'], ['sleep', 'Dormir'], ['idea', 'Idea'],
  ['confused', 'Confusión'], ['workout', 'Ejercicio'], ['dizzy', 'Mareo'],
  ['shy', 'Tímido'], ['jump', 'Salto'], ['phone', 'Chat compacto'],
  ['idle2', 'Reposo variante 2'], ['idle3', 'Reposo variante 3'],
];

const SettingsCenter = {
  app: null,
  initialized: false,
  selectedKey: 'clawd',
  draft: null,
  pendingGifState: null,
  modeKeys: ['normal', 'alternate'],

  init(app) {
    this.app = app;
    if (this.initialized) return;
    this.initialized = true;
    const overlay = document.getElementById('visualizer-settings-overlay');
    const openButton = document.getElementById('visualizer-settings-open');
    if (!overlay || !openButton) return;

    const close = () => {
      overlay.hidden = true;
      openButton.setAttribute('aria-expanded', 'false');
      openButton.focus();
    };
    const open = () => {
      this.app._syncMusicVisualizerSettingsUI();
      this.renderCharacterList();
      this.selectCharacter(this.selectedKey && window.PETS[this.selectedKey] ? this.selectedKey : window.clawd?.getPetKey?.() || 'clawd');
      this.renderDeveloperSelect();
      overlay.hidden = false;
      openButton.setAttribute('aria-expanded', 'true');
      setTimeout(() => overlay.querySelector('.settings-tabs button:not([hidden])')?.focus(), 20);
    };
    openButton.addEventListener('click', open);
    document.getElementById('visualizer-settings-close')?.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !overlay.hidden) close();
    });

    document.querySelectorAll('[data-settings-tab]').forEach(button => {
      button.addEventListener('click', () => this.showTab(button.dataset.settingsTab));
    });
    document.getElementById('settings-developer-unlock')?.addEventListener('click', () => {
      const tab = document.querySelector('[data-settings-tab="developer"]');
      if (tab) tab.hidden = false;
      this.renderDeveloperSelect();
      this.showTab('developer');
    });

    const ranges = {
      'visualizer-bars': ['bars', Number],
      'visualizer-sensitivity': ['sensitivity', Number],
      'visualizer-gap': ['gap', Number],
      'visualizer-smoothing': ['smoothing', Number],
    };
    Object.entries(ranges).forEach(([id, [key, parse]]) => {
      document.getElementById(id)?.addEventListener('input', event => this.app._updateMusicVisualizerSetting(key, parse(event.target.value)));
    });
    document.querySelectorAll('#visualizer-layout-options [data-layout]').forEach(button => {
      button.addEventListener('click', () => this.app._updateMusicVisualizerSetting('layout', button.dataset.layout));
    });
    document.querySelectorAll('#visualizer-style-options [data-style]').forEach(button => {
      button.addEventListener('click', () => this.app._updateMusicVisualizerSetting('style', button.dataset.style));
    });
    document.getElementById('visualizer-settings-reset')?.addEventListener('click', () => {
      this.app._musicSettings = { ...MUSIC_VISUALIZER_DEFAULTS };
      if (this.app._musicAnalyser) this.app._musicAnalyser.smoothingTimeConstant = this.app._musicSettings.smoothing;
      this.app._saveMusicVisualizerSettings();
      this.app._syncMusicVisualizerSettingsUI();
    });

    document.getElementById('character-list')?.addEventListener('click', event => {
      const button = event.target.closest('[data-character-key]');
      if (button) this.selectCharacter(button.dataset.characterKey);
    });
    document.getElementById('character-new')?.addEventListener('click', () => this.newCharacter());
    document.getElementById('character-save')?.addEventListener('click', () => this.saveCharacter());
    document.getElementById('character-delete')?.addEventListener('click', () => this.deleteCharacter());
    document.getElementById('character-package-import')?.addEventListener('click', () => this.importPackage());
    document.getElementById('character-package-export')?.addEventListener('click', () => this.exportPackage());
    document.getElementById('character-avatar-choose')?.addEventListener('click', () => this.chooseAvatar());
    document.getElementById('character-reactions')?.addEventListener('click', event => {
      const button = event.target.closest('[data-reaction-state]');
      if (button) this.chooseGif(button.dataset.reactionState);
    });
    document.getElementById('character-name')?.addEventListener('input', event => {
      if (this.draft?.isNew && !this.draft.keyTouched) document.getElementById('character-key').value = this.slug(event.target.value);
    });
    document.getElementById('character-key')?.addEventListener('input', event => {
      if (this.draft) this.draft.keyTouched = true;
      event.target.value = this.slug(event.target.value);
    });
    document.getElementById('character-sidebar-scale')?.addEventListener('input', event => {
      const scale = Math.min(1.45, Math.max(.8, Number(event.target.value) || 1));
      if (this.draft) this.draft.profile.sidebarScale = scale;
      document.getElementById('character-sidebar-scale-value').textContent = `${Math.round(scale * 100)}%`;
      if (window.clawd?.getPetKey?.() === this.selectedKey) {
        document.documentElement.style.setProperty('--pet-sidebar-scale', String(scale));
      }
    });
    document.getElementById('character-gif-fallback')?.addEventListener('change', event => this.readFallbackGif(event));
    document.getElementById('character-avatar-fallback')?.addEventListener('change', event => this.readFallbackAvatar(event));
    document.getElementById('character-package-fallback')?.addEventListener('change', event => this.readFallbackPackage(event));

    document.getElementById('developer-character-select')?.addEventListener('change', event => this.loadPersonalities(event.target.value));
    document.getElementById('personality-save')?.addEventListener('click', () => this.savePersonalities());
    ['personality-a-prompt', 'personality-b-prompt'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updatePromptCounts());
    });
  },

  showTab(name) {
    document.querySelectorAll('[data-settings-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.settingsTab === name)));
    document.querySelectorAll('[data-settings-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.settingsPane === name));
    if (name === 'characters') this.renderCharacterList();
    if (name === 'developer') this.renderDeveloperSelect();
  },

  slug(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  },

  cloneProfile(profile) {
    return JSON.parse(JSON.stringify(profile || {}));
  },

  renderCharacterList() {
    const list = document.getElementById('character-list');
    if (!list) return;
    list.innerHTML = Object.values(window.PETS).map(profile => {
      const active = profile.key === this.selectedKey;
      const badge = profile.custom ? 'CUSTOM' : 'CORE';
      return `<button type="button" data-character-key="${escHtml(profile.key)}" class="${active ? 'active' : ''}">
        <img src="${escHtml(profile.avatar || profile.assets.idle)}" alt=""><span><b>${escHtml(profile.emoji || '◆')} ${escHtml(profile.label)}</b><small>${badge} · ${escHtml(profile.key)}</small></span>
      </button>`;
    }).join('');
  },

  selectCharacter(key) {
    const profile = window.PETS[key];
    if (!profile) return;
    this.selectedKey = key;
    this.draft = { profile: this.cloneProfile(profile), isNew: false, keyTouched: true };
    document.getElementById('character-name').value = profile.label || '';
    document.getElementById('character-key').value = profile.key;
    document.getElementById('character-key').disabled = true;
    document.getElementById('character-emoji').value = profile.emoji || '◆';
    const sidebarScale = Number(profile.sidebarScale) || 1;
    document.getElementById('character-sidebar-scale').value = sidebarScale;
    document.getElementById('character-sidebar-scale-value').textContent = `${Math.round(sidebarScale * 100)}%`;
    document.getElementById('character-scale-field').hidden = !profile.custom;
    const removeButton = document.getElementById('character-delete');
    const hasCoreOverride = !profile.custom && Boolean(Store.characters.get(profile.key));
    removeButton.hidden = !profile.custom && !hasCoreOverride;
    removeButton.textContent = profile.custom ? 'ELIMINAR' : 'RESTAURAR CORE';
    document.getElementById('character-editor-note').textContent = profile.custom
      ? 'Perfil personalizado. Los cambios se aplican en cuanto guardes.'
      : 'Personaje incluido. Puedes reemplazar reacciones, foto de perfil o personalidades sin modificar los archivos originales.';
    this.renderAvatar();
    this.renderReactions();
    this.renderCharacterList();
  },

  newCharacter() {
    this.selectedKey = '';
    this.draft = {
      isNew: true, keyTouched: false,
      profile: { key: '', label: '', display: '', emoji: '◆', aliases: [], assets: {}, avatar: '', idleVariants: ['idle'], mood: {}, temp: {}, pokeState: 'heart', personalities: { normal: '', alternate: '' }, personalityLabels: { normal: 'normal', alternate: 'alterno' }, defaultPersonality: 'normal', personalityVersion: 1, behavior: {}, sidebarScale: 1, custom: true },
    };
    ['character-name', 'character-key'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('character-key').disabled = false;
    document.getElementById('character-emoji').value = '◆';
    document.getElementById('character-sidebar-scale').value = 1;
    document.getElementById('character-sidebar-scale-value').textContent = '100%';
    document.getElementById('character-scale-field').hidden = false;
    document.getElementById('character-delete').hidden = true;
    document.getElementById('character-editor-note').textContent = 'Asigna un nombre e importa al menos el GIF idle. La foto de perfil es recomendada para que sus notificaciones se vean como del personaje.';
    this.renderAvatar();
    this.renderReactions();
    this.renderCharacterList();
    document.getElementById('character-name')?.focus();
  },

  renderAvatar() {
    const preview = document.getElementById('character-avatar-preview');
    const button = document.getElementById('character-avatar-choose');
    if (!preview || !this.draft) return;
    const src = this.draft.profile.avatar || this.draft.profile.assets?.idle || '';
    preview.innerHTML = src
      ? `<img src="${escHtml(src)}" alt="${escHtml(this.draft.profile.label || 'avatar')}">`
      : '<i>+</i>';
    if (button) button.textContent = src ? 'REEMPLAZAR FOTO' : 'IMPORTAR FOTO';
  },

  renderReactions() {
    const grid = document.getElementById('character-reactions');
    if (!grid || !this.draft) return;
    const assets = this.draft.profile.assets || {};
    grid.innerHTML = CHARACTER_REACTIONS.map(([state, label, required]) => {
      const src = assets[state];
      return `<button type="button" data-reaction-state="${state}" class="reaction-slot ${src ? 'loaded' : ''}">
        <span class="reaction-preview">${src ? `<img src="${escHtml(src)}" alt="${escHtml(label)}">` : '<i>+</i>'}</span>
        <span><b>${escHtml(label)}${required ? ' *' : ''}</b><small>${src ? 'REEMPLAZAR GIF' : 'IMPORTAR GIF'}</small></span>
      </button>`;
    }).join('');
  },

  currentFormKey() {
    return this.slug(document.getElementById('character-key')?.value);
  },

  async chooseGif(state) {
    const key = this.currentFormKey();
    if (!key) return this.message('warn', 'personaje', 'Escribe el nombre o ID antes de importar GIF.');
    this.pendingGifState = state;
    if (window.spritenote?.characters?.selectGif) {
      const result = await window.spritenote.characters.selectGif({ key, state });
      if (result?.canceled) return;
      if (!result?.ok) return this.message('warn', 'GIF rechazado', result?.error || 'No se pudo importar.');
      this.draft.profile.assets[state] = result.url;
      this.renderReactions();
      return;
    }
    document.getElementById('character-gif-fallback')?.click();
  },

  readFallbackGif(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !this.pendingGifState) return;
    if (file.type !== 'image/gif' || file.size > 2 * 1024 * 1024) return this.message('warn', 'GIF rechazado', 'En modo web el GIF debe pesar menos de 2 MB. Usa Electron para el límite de 20 MB.');
    const reader = new FileReader();
    reader.onload = () => { this.draft.profile.assets[this.pendingGifState] = reader.result; this.renderReactions(); };
    reader.readAsDataURL(file);
  },

  async chooseAvatar() {
    const key = this.currentFormKey();
    if (!key) return this.message('warn', 'foto de perfil', 'Escribe el nombre o ID antes de importar la foto.');
    if (window.spritenote?.characters?.selectAvatar) {
      const result = await window.spritenote.characters.selectAvatar({ key });
      if (result?.canceled) return;
      if (!result?.ok) return this.message('warn', 'foto rechazada', result?.error || 'No se pudo importar.');
      this.draft.profile.avatar = result.url;
      this.renderAvatar();
      this.renderCharacterList();
      return;
    }
    document.getElementById('character-avatar-fallback')?.click();
  },

  readFallbackAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
      return this.message('warn', 'foto rechazada', 'En modo web usa PNG/JPG/WebP de menos de 2 MB. En Electron el límite es 5 MB.');
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.draft.profile.avatar = reader.result;
      this.renderAvatar();
      this.renderCharacterList();
    };
    reader.readAsDataURL(file);
  },

  formProfile() {
    const base = this.cloneProfile(this.draft?.profile || {});
    const key = this.currentFormKey();
    const label = String(document.getElementById('character-name')?.value || '').trim();
    return {
      ...base, key, label, display: label,
      emoji: String(document.getElementById('character-emoji')?.value || '◆').trim().slice(0, 4) || '◆',
      aliases: Array.from(new Set([key, ...(base.aliases || [])])),
      custom: !['clawd', 'femme'].includes(key),
      sidebarScale: Math.min(1.45, Math.max(.8, Number(document.getElementById('character-sidebar-scale')?.value) || 1)),
      idleVariants: ['idle', 'idle2', 'idle3'].filter(state => base.assets?.[state]),
    };
  },

  saveCharacter() {
    const profile = this.formProfile();
    if (!profile.label) return this.message('warn', 'personaje', 'El nombre es obligatorio.');
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(profile.key)) return this.message('warn', 'personaje', 'El ID necesita entre 2 y 40 caracteres: letras, números o guiones.');
    if (this.draft.isNew && window.PETS[profile.key]) return this.message('warn', 'personaje', 'Ese ID ya está en uso.');
    if (!profile.assets?.idle) return this.message('warn', 'personaje', 'Importa el GIF idle antes de guardar.');
    Store.characters.upsert(profile);
    window.refreshCharacterProfiles?.();
    this.refreshCommandPetCatalog();
    this.selectedKey = profile.key;
    this.selectCharacter(profile.key);
    this.renderDeveloperSelect(profile.key);
    if (window.clawd?.getPetKey?.() === profile.key) {
      window.clawd.setPet(profile.key);
      this.app?._aiApplyPersonaUI?.();
    }
    this.message('info', 'personaje guardado', `${profile.label} ya está disponible en <b>:pet</b>.`);
  },

  async deleteCharacter() {
    const profile = window.PETS[this.selectedKey];
    if (!profile) return;
    const isCore = !profile.custom;
    const question = isCore
      ? `¿Restaurar el perfil original de ${profile.label}? Se quitarán sus GIF y prompts personalizados.`
      : `¿Eliminar a ${profile.label} y sus GIF importados?`;
    if (!confirm(question)) return;
    if (window.clawd?.getPetKey?.() === profile.key) window.clawd.setPet('clawd');
    Store.characters.remove(profile.key);
    await window.spritenote?.characters?.removeAssets?.(profile.key);
    window.refreshCharacterProfiles?.();
    this.refreshCommandPetCatalog();
    const nextKey = isCore ? profile.key : 'clawd';
    if (isCore) window.clawd?.setPet?.(profile.key);
    this.selectCharacter(nextKey);
    this.renderDeveloperSelect(nextKey);
    this.message('info', isCore ? 'perfil restaurado' : 'personaje eliminado', isCore ? `${profile.label} volvió a su configuración original.` : `${profile.label} fue retirado.`);
  },

  async importPackage() {
    if (window.spritenote?.characters?.importPackage) {
      const result = await window.spritenote.characters.importPackage();
      if (result?.canceled) return;
      if (!result?.ok) return this.message('warn', 'paquete rechazado', result?.error || 'No se pudo importar.');
      Store.characters.upsert(result.profile);
      window.refreshCharacterProfiles?.();
      this.refreshCommandPetCatalog();
      this.selectedKey = result.profile.key;
      this.selectCharacter(result.profile.key);
      this.renderDeveloperSelect(result.profile.key);
      return this.message('info', 'paquete importado', `${result.profile.label} está listo.`);
    }
    document.getElementById('character-package-fallback')?.click();
  },

  readFallbackPackage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || file.size > 8 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const pack = JSON.parse(reader.result);
        if (pack.format !== 'spritenote-character' || !pack.profile || !pack.files?.idle) throw new Error('Paquete inválido');
        const assets = Object.fromEntries(Object.entries(pack.files).map(([state, base64]) => [state, `data:image/gif;base64,${base64}`]));
        const avatar = pack.avatar?.data
          ? `data:${pack.avatar.mime || 'image/png'};base64,${pack.avatar.data}`
          : (pack.profile.avatar || '');
        const profile = { ...pack.profile, assets, avatar, custom: true };
        Store.characters.upsert(profile);
        window.refreshCharacterProfiles?.();
        this.refreshCommandPetCatalog();
        this.selectCharacter(profile.key);
      } catch (error) { this.message('warn', 'paquete rechazado', error.message); }
    };
    reader.readAsText(file);
  },

  async exportPackage() {
    const profile = this.formProfile();
    if (!profile.assets?.idle) return this.message('warn', 'exportar', 'El personaje necesita un GIF idle.');
    if (window.spritenote?.characters?.exportPackage) {
      const result = await window.spritenote.characters.exportPackage(profile);
      if (!result?.ok && !result?.canceled) this.message('warn', 'exportar', result?.error || 'No se pudo exportar.');
      else if (result?.ok) this.message('info', 'paquete exportado', 'El archivo .spritepet quedó listo para compartir.');
      return;
    }
    this.message('warn', 'exportar', 'La exportación de paquetes está disponible en la app Electron.');
  },

  renderDeveloperSelect(preferredKey) {
    const select = document.getElementById('developer-character-select');
    if (!select) return;
    const previous = preferredKey || select.value || this.selectedKey || 'clawd';
    select.innerHTML = Object.values(window.PETS).map(profile => `<option value="${escHtml(profile.key)}">${escHtml(profile.label)}</option>`).join('');
    select.value = window.PETS[previous] ? previous : 'clawd';
    this.loadPersonalities(select.value);
  },

  loadPersonalities(key) {
    const profile = window.PETS[key];
    if (!profile) return;
    const realModes = Object.keys(profile.personalities || {}).filter(mode => typeof profile.personalities[mode] === 'string' && profile.personalities[mode].trim());
    const first = realModes.includes('normal') ? 'normal' : (realModes[0] || 'normal');
    const second = realModes.find(mode => mode !== first) || (Object.keys(profile.personalities || {}).find(mode => mode !== first) || 'alternate');
    this.modeKeys = [first, second];
    document.getElementById('personality-a-label').value = profile.personalityLabels?.[first] || first;
    document.getElementById('personality-b-label').value = profile.personalityLabels?.[second] || second;
    document.getElementById('personality-a-prompt').value = profile.personalities?.[first] || '';
    document.getElementById('personality-b-prompt').value = profile.personalities?.[second] || '';
    document.getElementById('personality-validation').textContent = `Editando ${profile.label}. Cada modo mantiene un historial de conversación separado.`;
    this.updatePromptCounts();
  },

  updatePromptCounts() {
    ['a', 'b'].forEach(slot => {
      const value = document.getElementById(`personality-${slot}-prompt`)?.value || '';
      document.getElementById(`personality-${slot}-count`).textContent = `${value.length} caracteres`;
    });
  },

  savePersonalities() {
    const key = document.getElementById('developer-character-select')?.value;
    const profile = this.cloneProfile(window.PETS[key]);
    if (!profile) return;
    const prompts = ['a', 'b'].map(slot => String(document.getElementById(`personality-${slot}-prompt`)?.value || '').trim());
    const labels = ['a', 'b'].map(slot => String(document.getElementById(`personality-${slot}-label`)?.value || '').trim());
    if (prompts.some(prompt => prompt.length < 40)) return this.message('warn', 'system prompt', 'Cada modo necesita al menos 40 caracteres para definir una voz estable.');
    if (labels.some(label => !label)) return this.message('warn', 'system prompt', 'Pon un nombre corto a ambos modos.');
    profile.personalities = { ...(profile.personalities || {}), [this.modeKeys[0]]: prompts[0], [this.modeKeys[1]]: prompts[1] };
    profile.personalityLabels = { ...(profile.personalityLabels || {}), [this.modeKeys[0]]: labels[0], [this.modeKeys[1]]: labels[1] };
    profile.personalityVersion = Number(profile.personalityVersion || 0) + 1;
    Store.characters.upsert(profile);
    window.refreshCharacterProfiles?.();
    if (window.clawd?.getPetKey?.() === key) window.clawd.setPet(key);
    this.app?._aiRefreshState?.();
    document.getElementById('personality-validation').textContent = 'GUARDADO // ambos modos están disponibles en la vista IA.';
    this.message('info', 'personalidades', `Los dos modos de ${profile.label} fueron actualizados.`);
  },

  message(type, title, body) {
    if (window.Toast?.show) Toast.show(type, title, body);
  },

  refreshCommandPetCatalog() {
    const command = window.Command?.registry?.find?.(item => item.name === 'pet');
    if (command) command.sub = Object.keys(window.PETS || {});
  },
};

window.SettingsCenter = SettingsCenter;
