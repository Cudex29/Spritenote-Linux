// sysinfo.js — datos del sistema para el neofetch.
//
// Electron recopila los datos nativos en el proceso principal y los pasa al
// renderer mediante el hash #sysinfo=<json-urlencoded> al cargar index.html.
// Lo que no viene del proceso principal (GPU, resolución, locale, zona horaria)
// se obtiene con APIs del navegador. El fallback sin datos nativos se conserva
// para que index.html siga siendo previsualizable durante desarrollo.

const SysInfo = (() => {

  // ── helpers de navegador (siempre disponibles) ───────────────
  function getGpu() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return null;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const r = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        return r.replace(/ANGLE \(([^,]+),\s*/i, '').replace(/\s*\(0x[^)]+\)[^)]*\)/g, '').replace(/Direct3D.*/i, '').trim();
      }
      return gl.getParameter(gl.RENDERER) || null;
    } catch { return null; }
  }

  function getOsFromUA() {
    const ua = navigator.userAgent;
    if (/Linux.*Android/i.test(ua)) return 'Android';
    if (/Linux/i.test(ua)) return navigator.userAgentData?.platform || 'Linux';
    if (/Mac OS X|macOS/i.test(ua)) return 'macOS';
    if (/Windows NT 10/i.test(ua)) return 'Windows 10/11';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/CrOS/i.test(ua)) return 'ChromeOS';
    return navigator.platform || 'Unknown';
  }

  function getLocale() {
    return navigator.language || Intl.DateTimeFormat().resolvedOptions().locale || 'es';
  }
  function getTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
  }
  function getResolution() {
    return `${screen.width}×${screen.height}`;
  }
  function getColorDepth() {
    return screen.colorDepth ? `${screen.colorDepth}bit` : null;
  }
  function getCores() {
    return navigator.hardwareConcurrency || '?';
  }
  function getRamGB() {
    return navigator.deviceMemory ? `${navigator.deviceMemory} GB` : null;
  }

  // ── leer datos nativos pasados por Electron (URL hash) ───────
  function readNative() {
    try {
      const m = location.hash.match(/sysinfo=([^&]+)/);
      if (!m) return null;
      const data = JSON.parse(decodeURIComponent(m[1]));
      // Limpiar el hash de la URL para que no quede visible/feo
      history.replaceState(null, '', location.pathname + location.search);
      return data;
    } catch { return null; }
  }

  // uptime de sesión (fallback si no hay datos del sistema)
  const _sessionStart = Date.now();
  function sessionUp() {
    const mins = Math.floor((Date.now() - _sessionStart) / 60000);
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  // formatear segundos → "1d 3h 12m"
  function fmtUptime(totalSec) {
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  }

  // ── ensamblar ────────────────────────────────────────────────
  const N = readNative(); // datos del proceso principal, o null

  const data = N ? {
    // ── Electron: datos reales del sistema ──
    user:       N.user || null,
    hostname:   N.hostname || 'spritenote',
    os:         N.os || getOsFromUA(),
    arch:       N.arch || null,
    cpu:        N.cpu || `${getCores()} cores`,
    ram:        N.ram || getRamGB(),
    gpu:        getGpu(),
    resolution: getResolution(),
    colorDepth: getColorDepth(),
    locale:     getLocale(),
    tz:         getTimezone(),
    uptime:     () => {
      // uptime real del sistema = uptime al lanzar + tiempo transcurrido
      if (N.uptimeAtLaunch != null && N.capturedAt) {
        const elapsed = Math.floor((Date.now() - N.capturedAt) / 1000);
        return fmtUptime(N.uptimeAtLaunch + Math.max(0, elapsed));
      }
      if (N.uptimeAtLaunch != null) return fmtUptime(N.uptimeAtLaunch);
      return sessionUp();
    },
    isNative: true,
  } : {
    // ── Abierto directamente en el navegador (sin launcher) ────
    user:       localStorage.getItem('spritenote:username') || null,
    hostname:   'spritenote',
    os:         getOsFromUA(),
    arch:       null,
    cpu:        `${getCores()} cores`,
    ram:        getRamGB(),
    gpu:        getGpu(),
    resolution: getResolution(),
    colorDepth: getColorDepth(),
    locale:     getLocale(),
    tz:         getTimezone(),
    uptime:     () => sessionUp(),
    isNative: false,
  };

  return data;
})();

window.SysInfo = SysInfo;
