/** Teléfonos táctiles reales (excluye PC con ratón y tablets). */
export const PHONE_MEDIA_QUERY =
  '(max-width: 600px) and (pointer: coarse) and (hover: none)';

export const DESKTOP_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

function minScreenSide(): number {
  return Math.min(window.screen.width, window.screen.height);
}

/** Ratón/trackpad de escritorio → nunca tratamos como teléfono. */
export function isDesktopPointer(): boolean {
  return window.matchMedia(DESKTOP_POINTER_QUERY).matches;
}

/**
 * Teléfono: pantalla física pequeña + táctil sin hover (excluye iPad y PC).
 */
export function isPhone(): boolean {
  if (isDesktopPointer()) {
    return false;
  }
  if (minScreenSide() > 600) {
    return false;
  }
  return window.matchMedia(PHONE_MEDIA_QUERY).matches;
}

export function shouldShowOrientationLock(): boolean {
  return isPhone() && window.matchMedia('(orientation: portrait)').matches;
}

let bound = false;

/** Muestra el aviso solo en teléfonos en vertical durante partida. */
export function syncOrientationGate(): void {
  const playing = document.body.classList.contains('is-playing');
  const show = playing && shouldShowOrientationLock();

  document.body.classList.toggle('needs-landscape', show);

  const lock = document.getElementById('orientation-lock');
  if (lock) {
    lock.hidden = !show;
    lock.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
}

export function bindOrientationGate(): void {
  if (bound) {
    syncOrientationGate();
    return;
  }
  bound = true;

  const update = () => syncOrientationGate();
  window.addEventListener('orientationchange', update);
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  syncOrientationGate();
}

/**
 * Intenta bloquear orientación horizontal en teléfonos.
 * Requiere gesto del usuario; puede fallar fuera de PWA / fullscreen.
 */
export async function tryLockLandscape(): Promise<void> {
  if (!isPhone()) {
    return;
  }

  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  };

  if (typeof orientation?.lock !== 'function') {
    return;
  }

  try {
    await orientation.lock('landscape');
  } catch {
    // El overlay CSS/JS cubre portrait si el lock falla.
  }
}
