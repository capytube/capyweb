import { useMemo, useState } from 'react';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import toast from 'react-hot-toast';
import VideoPlayer from '../VideoPlayer';
import { demoSlots, prototypeRobots } from '../../domain/robotMarketplace';
import styles from './RobotExperience.module.css';

const fallbackVideo = 'https://magnus-video-public.s3.ap-southeast-1.amazonaws.com/capytube-stream.mp4';

const formatSlot = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));

export default function RobotExperience() {
  const isLoggedIn = useIsLoggedIn();
  const { setShowAuthFlow } = useDynamicContext();
  const [selectedRobot, setSelectedRobot] = useState(prototypeRobots[0].id);
  const [selectedSlot, setSelectedSlot] = useState(demoSlots[0].id);
  const [mode, setMode] = useState<'primary' | 'resale'>('primary');
  const [showControls, setShowControls] = useState(false);

  const robot = useMemo(() => prototypeRobots.find((item) => item.id === selectedRobot)!, [selectedRobot]);
  const slot = useMemo(() => demoSlots.find((item) => item.id === selectedSlot)!, [selectedSlot]);

  const requireAccount = () => {
    if (!isLoggedIn) {
      setShowAuthFlow(true);
      return;
    }
    toast('This is a scaffold. Bids and bookings are disabled until currency, payment and auction rules are approved.');
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Capybara robot experience · private prototype</p>
          <h1>Watch now. Drive when your hour begins.</h1>
          <p className={styles.intro}>
            A live window into the capybara habitat, with one supervised robot controller at a time. The stream below
            uses existing demo footage while the ROLA hardware API is being verified.
          </p>
          <div className={styles.badges}>
            <span className={styles.liveBadge}><i /> Demo stream</span>
            <span>Robot controls: API pending</span>
            <span>No payment enabled</span>
          </div>
        </div>
        <div className={styles.robotSummary}>
          <span>Selected robot</span>
          <strong>{robot.name}</strong>
          <small>{robot.model}</small>
          <div className={styles.statusLine}><i /> Hardware bridge not connected</div>
        </div>
      </section>

      <section className={styles.viewerGrid}>
        <div className={styles.videoCard}>
          <div className={styles.videoHeader}>
            <div><span>Habitat camera</span><strong>Magnus demo feed</strong></div>
            <span className={styles.demoPill}>Recorded demo</span>
          </div>
          <VideoPlayer streamId="robot-experience-demo" videoUrl={fallbackVideo} />
          <div className={styles.videoFooter}>
            <span>Fixed-camera fallback stays available even when the robot is charging.</span>
            <button type="button" onClick={() => setShowControls((current) => !current)}>
              {showControls ? 'Hide' : 'Preview'} safe controls
            </button>
          </div>
        </div>

        <aside className={styles.controlCard} aria-label="Robot controls preview">
          <p className={styles.sectionLabel}>Controller preview</p>
          <h2>{showControls ? 'Safe control surface' : 'Controls stay locked'}</h2>
          <p>
            Only the owner of the active slot will receive control. A staff supervisor can stop the robot at any time.
          </p>
          <div className={`${styles.controls} ${showControls ? '' : styles.controlsLocked}`}>
            <button type="button" aria-label="Move forward" disabled>↑</button>
            <button type="button" aria-label="Turn left" disabled>←</button>
            <button type="button" aria-label="Stop" className={styles.stop} disabled>Stop</button>
            <button type="button" aria-label="Turn right" disabled>→</button>
            <button type="button" aria-label="Move backward" disabled>↓</button>
          </div>
          <ul className={styles.safetyList}>
            <li>One active controller</li>
            <li>Dead-man stop on disconnect</li>
            <li>Speed and zone limits</li>
            <li>Staff emergency override</li>
          </ul>
        </aside>
      </section>

      <section className={styles.marketplace}>
        <div className={styles.marketHeader}>
          <div><p className={styles.sectionLabel}>Hourly access</p><h2>Choose a prototype slot</h2></div>
          <div className={styles.tabs}>
            <button type="button" className={mode === 'primary' ? styles.activeTab : ''} onClick={() => setMode('primary')}>First sale</button>
            <button type="button" className={mode === 'resale' ? styles.activeTab : ''} onClick={() => setMode('resale')}>Resale</button>
          </div>
        </div>

        {mode === 'primary' ? (
          <div className={styles.slotGrid}>
            {demoSlots.map((item, index) => {
              const itemRobot = prototypeRobots.find((candidate) => candidate.id === item.robotId)!;
              const chosen = selectedSlot === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`${styles.slotCard} ${chosen ? styles.selectedSlot : ''}`}
                  onClick={() => { setSelectedSlot(item.id); setSelectedRobot(item.robotId); }}
                >
                  <span className={styles.slotNumber}>0{index + 1}</span>
                  <span className={styles.slotTime}>{formatSlot(item.startsAt)}</span>
                  <strong>{itemRobot.name}</strong>
                  <small>{item.status === 'auction_open' ? 'Auction scaffold open' : 'Schedule preview'}</small>
                  <span className={styles.slotMeta}>{item.bidCount} bids · price TBD</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>No resale listings yet</strong>
            <p>Ownership and transfer records are scaffolded. Listings stay disabled until fees, price caps and transfer cutoff are approved.</p>
          </div>
        )}

        <div className={styles.bidPanel}>
          <div>
            <span>Selected hour</span>
            <strong>{formatSlot(slot.startsAt)} - {formatSlot(slot.endsAt).split(', ').pop()}</strong>
            <small>Currency, reserve price and bid increment are intentionally unset.</small>
          </div>
          <button type="button" onClick={requireAccount}>{isLoggedIn ? 'Review bidding scaffold' : 'Sign in to continue'}</button>
        </div>
      </section>

      <section className={styles.howItWorks}>
        <p className={styles.sectionLabel}>How this will work</p>
        <div className={styles.steps}>
          <article><span>1</span><h3>Watch freely</h3><p>The habitat stream remains viewable even when no robot slot is active.</p></article>
          <article><span>2</span><h3>Win an hour</h3><p>Book or bid after the operator sets currency, auction and refund rules.</p></article>
          <article><span>3</span><h3>Check in safely</h3><p>The slot owner gets time-limited controls with live staff supervision.</p></article>
          <article><span>4</span><h3>Transfer if needed</h3><p>Resale stays inside the platform with an audit trail and configurable cap.</p></article>
        </div>
      </section>
    </div>
  );
}
