/**
 * useScreenSecurity — ApexConnect Screen Protection
 *
 * Platform behaviour:
 *  ┌─────────────┬──────────────────────────────────────────────────────────┐
 *  │ Electron    │ setContentProtection(true) in main.js — GPU secure       │
 *  │ (Win/Mac)   │ surface. Screenshots/OBS/Game Bar → solid black.         │
 *  ├─────────────┼──────────────────────────────────────────────────────────┤
 *  │ Android     │ FLAG_SECURE via expo-screen-capture + app.json plugin.   │
 *  │             │ Screenshots and screen recordings → black frame.         │
 *  ├─────────────┼──────────────────────────────────────────────────────────┤
 *  │ iOS         │ Apple does not allow full blocking of home+power         │
 *  │             │ screenshot. We use Apple's approved APIs:                │
 *  │             │  • preventScreenCaptureAsync() — blurs content when      │
 *  │             │    screen recording is active (Control Center)           │
 *  │             │  • addScreenshotListener() — fires AFTER screenshot →    │
 *  │             │    shows alert warning. App Store compliant.             │
 *  ├─────────────┼──────────────────────────────────────────────────────────┤
 *  │ Web         │ Instant blackout on window focus loss + keyboard         │
 *  │ (browser)   │ interception + getDisplayMedia blocked.                  │
 *  └─────────────┴──────────────────────────────────────────────────────────┘
 */

import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

// ─── CSS injected once into <head> ─────────────────────────────────────────
const CSS = `
  * {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none !important;
  }
  input, textarea {
    -webkit-user-select: text !important;
    user-select: text !important;
  }
  img, a, video {
    -webkit-user-drag: none !important;
  }
  button, input, textarea, select, [role="button"], label {
    pointer-events: auto !important;
  }

  /*
   * The blackout layer.
   * Uses visibility:hidden (not display:none) so the browser has
   * already composited it — switching to visible is INSTANT, zero paint delay.
   */
  #__ac_shield {
    visibility: hidden;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    pointer-events: all;
  }
  #__ac_shield.show {
    visibility: visible !important;
  }
  #__ac_shield svg {
    width: 60px; height: 60px; opacity: .45;
  }
  #__ac_shield h2 {
    color: #fff;
    font: 700 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    margin: 0; letter-spacing: .4px;
  }
  #__ac_shield p {
    color: rgba(255,255,255,.4);
    font: 400 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    margin: 0;
  }

  @media print {
    body > * { display: none !important; }
    #__ac_shield {
      visibility: visible !important;
      background: #fff !important;
    }
    #__ac_shield h2 { color: #000 !important; }
  }
`;

function createShield(): HTMLDivElement {
  const d = document.createElement('div');
  d.id = '__ac_shield';
  d.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="white"
         stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75
        M3.75 21.75h16.5A2.25 2.25 0 0 0 22.5 19.5V12a2.25 2.25 0 0 0-2.25-2.25H3.75
        A2.25 2.25 0 0 0 1.5 12v7.5a2.25 2.25 0 0 0 2.25 2.25z"/>
    </svg>
    <h2>ApexConnect — Protected</h2>
    <p>Click inside the app to continue</p>
  `;
  return d;
}

function blockGetDisplayMedia() {
  try {
    const nav = navigator as any;
    if (nav?.mediaDevices?.getDisplayMedia) {
      Object.defineProperty(nav.mediaDevices, 'getDisplayMedia', {
        configurable: false,
        writable: false,
        value: () =>
          Promise.reject(
            new DOMException(
              'Screen capture blocked by ApexConnect security policy.',
              'NotAllowedError'
            )
          ),
      });
    }
  } catch { /* already defined or restricted */ }
}

// ─────────────────────────────────────────────────────────────────────────────
export function useScreenSecurity() {
  useEffect(() => {
    // ── Native (Android + iOS) ────────────────────────────────────────────────
    if (Platform.OS !== 'web') {
      // Android: FLAG_SECURE — screenshots and recordings go black (OS-enforced)
      // iOS: blurs content when screen recording (Control Center) is active
      ScreenCapture.preventScreenCaptureAsync().catch(console.warn);

      // iOS: addScreenshotListener fires AFTER the home+power screenshot is taken.
      // We cannot prevent it on iOS (Apple OS restriction), but we can warn the user.
      // This is Apple-approved and used by banking/finance apps on the App Store.
      let screenshotSub: ScreenCapture.Subscription | null = null;
      if (Platform.OS === 'ios') {
        screenshotSub = ScreenCapture.addScreenshotListener(() => {
          Alert.alert(
            '⚠️ Screenshot Detected',
            'Screenshots of ApexConnect are not permitted. This action has been logged.',
            [{ text: 'Understood', style: 'destructive' }],
            { cancelable: false }
          );
        });
      }

      return () => {
        ScreenCapture.allowScreenCaptureAsync().catch(console.warn);
        screenshotSub?.remove();
      };
    }

    // ── Web ───────────────────────────────────────────────────────────────────

    // 1. Inject CSS
    let style = document.getElementById('__ac_css') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = '__ac_css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    // 2. Insert shield (always in DOM, visibility toggled)
    let shield = document.getElementById('__ac_shield') as HTMLDivElement | null;
    if (!shield) {
      shield = createShield();
      document.body.insertBefore(shield, document.body.firstChild);
    }
    const sh = shield; // stable reference

    const show = () => sh.classList.add('show');
    const hide = () => sh.classList.remove('show');

    // 3. Block getDisplayMedia
    blockGetDisplayMedia();

    // 4. Window focus / blur — most important: covers Snipping Tool,
    //    Xbox Game Bar, any external capture tool that steals focus
    window.addEventListener('blur', show);
    window.addEventListener('focus', hide);

    // 5. Page visibility (tab switch, minimise)
    const onVis = () => document.visibilityState === 'hidden' ? show() : hide();
    document.addEventListener('visibilitychange', onVis);

    // 6. Keyboard — block & blackout on PrintScreen immediately
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key?.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Blackout immediately on PrintScreen keydown
      if (e.code === 'PrintScreen' || k === 'printscreen') {
        show();
        e.preventDefault();
        e.stopImmediatePropagation();
        navigator.clipboard?.writeText('').catch(() => {});
        // Restore after 1 second
        setTimeout(hide, 1000);
        return;
      }

      const blocked =
        (ctrl && k === 's') ||          // Save page
        (ctrl && k === 'p') ||          // Print
        (ctrl && k === 'u') ||          // View source
        (ctrl && shift && k === 's') || // Some capture tools
        (ctrl && shift && k === 'i') || // DevTools
        (ctrl && shift && k === 'j') || // DevTools Console
        (ctrl && shift && k === 'c') || // DevTools Inspect
        k === 'f12';                    // DevTools

      if (blocked) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // Clear clipboard again on keyup in case OS captured before keydown fired
      if (e.code === 'PrintScreen' || e.key?.toLowerCase() === 'printscreen') {
        navigator.clipboard?.writeText('').catch(() => {});
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);

    // 7. Right-click disabled
    const onCtxMenu = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
    document.addEventListener('contextmenu', onCtxMenu, true);

    // 8. Drag disabled
    const onDrag = (e: DragEvent) => e.preventDefault();
    document.addEventListener('dragstart', onDrag, true);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener('blur', show);
      window.removeEventListener('focus', hide);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('contextmenu', onCtxMenu, true);
      document.removeEventListener('dragstart', onDrag, true);
      sh.remove();
      document.getElementById('__ac_css')?.remove();
    };
  }, []);
}
