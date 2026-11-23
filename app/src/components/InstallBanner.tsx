import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';

const DISMISS_KEY = 'contactSheet.install.dismissed.v1';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari / Edge
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isAppleTouch() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isEdge() {
  return /Edg\//.test(navigator.userAgent || '');
}

export function InstallBanner() {
  const [hidden, setHidden] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onShow = () => {
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
      setHidden(false);
      setGuideOpen(true);
    };

    try {
      if (localStorage.getItem(DISMISS_KEY) !== '1') setHidden(false);
    } catch {
      setHidden(false);
    }

    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('cs:show-install', onShow);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('cs:show-install', onShow);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
    setGuideOpen(false);
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      try {
        const choice = await deferred.userChoice;
        if (choice.outcome === 'accepted') dismiss();
      } catch {
        /* ignore */
      }
      setDeferred(null);
      return;
    }
    setGuideOpen(true);
  }

  if (hidden) return null;

  const apple = isAppleTouch();
  const edge = isEdge();

  return (
    <>
      <div className="install-banner" role="region" aria-label="Install app">
        <div>
          <p>Add Contact Sheet to Home Screen</p>
          <div className="sub">
            {apple
              ? edge
                ? 'Works offline on your iPad · Edge menu → Add to Home Screen'
                : 'Works offline on your iPad · Share → Add to Home Screen'
              : 'Install for a full-screen app experience'}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={dismiss}>
            Not now
          </button>
          <button type="button" className="btn" onClick={install}>
            {deferred ? 'Install' : 'How'}
          </button>
        </div>
      </div>

      <Sheet open={guideOpen} title="Add to Home Screen" onClose={() => setGuideOpen(false)}>
        <p className="muted">
          Install Contact Sheet like an app. On iPad it opens full-screen and keeps working offline.
        </p>
        <div className="install-steps">
          {apple && edge ? (
            <>
              <div className="step">
                <div className="num">1</div>
                <div>
                  <b>Open the Edge menu</b>
                  <div className="muted">Tap ··· at the bottom (or top) of the browser.</div>
                </div>
              </div>
              <div className="step">
                <div className="num">2</div>
                <div>
                  <b>Add to Home Screen</b>
                  <div className="muted">Look for “Add to Home Screen” or “Install”.</div>
                </div>
              </div>
              <div className="step">
                <div className="num">3</div>
                <div>
                  <b>Confirm</b>
                  <div className="muted">Tap Add. Open Contact Sheet from your Home Screen anytime.</div>
                </div>
              </div>
            </>
          ) : apple ? (
            <>
              <div className="step">
                <div className="num">1</div>
                <div>
                  <b>Tap Share</b>
                  <div className="muted">The square with an upward arrow in Safari’s toolbar.</div>
                </div>
              </div>
              <div className="step">
                <div className="num">2</div>
                <div>
                  <b>Add to Home Screen</b>
                  <div className="muted">Scroll the actions list if you don’t see it right away.</div>
                </div>
              </div>
              <div className="step">
                <div className="num">3</div>
                <div>
                  <b>Confirm</b>
                  <div className="muted">Tap Add. Launch from your Home Screen for the app look.</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="step">
                <div className="num">1</div>
                <div>
                  <b>Open the browser menu</b>
                  <div className="muted">In Edge or Chrome, open the ··· menu.</div>
                </div>
              </div>
              <div className="step">
                <div className="num">2</div>
                <div>
                  <b>Install / Add to Home Screen</b>
                  <div className="muted">Choose Install app or Add to phone/Home Screen.</div>
                </div>
              </div>
            </>
          )}
        </div>
        <button type="button" className="btn primary wide" onClick={dismiss}>
          Got it
        </button>
      </Sheet>
    </>
  );
}
