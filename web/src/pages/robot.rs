//! Robot (W9): a static port of the React robot page. Booking and driving controls are not
//! rendered until their routes exist; the demo video loads only when the viewer presses play.

use crate::components::chrome::PageHead;
use leptos::prelude::*;

// CloudFront media routing is tracked by capyweb-2gx. Never fetch this before Play.
const DEMO_VIDEO: &str = "/media/capytube-stream.mp4";

struct Prototype {
    id: &'static str,
    name: &'static str,
    model: &'static str,
}

const ROBOTS: [Prototype; 3] = [
    Prototype {
        id: "prototype-1",
        name: "Prototype 1",
        model: "ROLA model pending confirmation",
    },
    Prototype {
        id: "prototype-2",
        name: "Prototype 2",
        model: "ROLA model pending confirmation",
    },
    Prototype {
        id: "prototype-3",
        name: "Prototype 3",
        model: "ROLA model pending confirmation",
    },
];

struct DemoSlot {
    id: &'static str,
    robot_id: &'static str,
    starts_at: &'static str,
    label: &'static str,
    status: &'static str,
    bid_count: u32,
}

// Fixed preview dates from robotMarketplace.ts; explicitly show Thailand time rather than
// letting the viewer's timezone make these historical demo slots look like live availability.
const SLOTS: [DemoSlot; 3] = [
    DemoSlot {
        id: "slot-demo-1",
        robot_id: "prototype-1",
        starts_at: "2026-09-26T10:00:00+07:00",
        label: "Sat, Sep 26, 2026 · 10:00–11:00",
        status: "Auction scaffold open",
        bid_count: 0,
    },
    DemoSlot {
        id: "slot-demo-2",
        robot_id: "prototype-2",
        starts_at: "2026-09-26T12:00:00+07:00",
        label: "Sat, Sep 26, 2026 · 12:00–13:00",
        status: "Schedule preview",
        bid_count: 0,
    },
    DemoSlot {
        id: "slot-demo-3",
        robot_id: "prototype-3",
        starts_at: "2026-09-27T15:00:00+07:00",
        label: "Sun, Sep 27, 2026 · 15:00–16:00",
        status: "Schedule preview",
        bid_count: 0,
    },
];

#[component]
pub fn Robot() -> impl IntoView {
    view! {
        <div class="robot-page">
            <PageHead title="Watch now. Drive when your hour begins."
                eyebrow="Capybara robot experience · private prototype"
                lede="A window into the capybara habitat, with one supervised robot controller at a time. The stream below uses existing demo footage while the ROLA hardware API is being verified."/>
            <ul class="robot-badges" aria-label="Prototype status">
                <li>"Demo stream"</li><li>"Robot controls: API pending"</li><li>"No payment enabled"</li>
            </ul>
            <p class="notice">"Booking is coming. These are demo slots, not live availability. Watch the recorded demo without signing in."</p>
            <div class="robot-viewer">
                <section class="card" aria-labelledby="robot-camera">
                    <p class="eyebrow">"Habitat camera · Recorded demo"</p>
                    <h2 id="robot-camera">"Magnus demo feed"</h2>
                    <video controls preload="none" playsinline poster="/assets/posters/magnus-gym.webp" aria-label="Magnus recorded demo" aria-describedby="robot-video-note">
                        <source src=DEMO_VIDEO type="video/mp4"/>
                        "Your browser does not support this video. The recorded demo shows Magnus in his habitat."
                    </video>
                    <p id="robot-video-note">"Fixed-camera fallback stays available even when the robot is charging."</p>
                </section>
                <aside class="card" aria-labelledby="robot-controls">
                    <p class="eyebrow">"Controller preview"</p>
                    <h2 id="robot-controls">"Controls stay locked"</h2>
                    <p>"Only the owner of the active slot will receive control. A staff supervisor can stop the robot at any time."</p>
                    <ul class="robot-safety">
                        <li>"One active controller"</li><li>"Dead-man stop on disconnect"</li>
                        <li>"Speed and zone limits"</li><li>"Staff emergency override"</li>
                    </ul>
                </aside>
            </div>
            <section aria-labelledby="robot-slots">
                <p class="eyebrow">"Hourly access"</p>
                <h2 id="robot-slots">"Choose a prototype slot"</h2>
                <p>"First sale · Demo schedule · Thailand time (UTC+07:00)"</p>
                <ul class="robot-slots">
                    {SLOTS.iter().map(|slot| {
                        let robot = ROBOTS.iter().find(|robot| robot.id == slot.robot_id)
                            .expect("demo slots reference known prototypes");
                        view! {
                            <li class="card" data-slot=slot.id>
                                <h3>{robot.name}</h3>
                                <p>{robot.model}</p>
                                <p class="text-leafGreen">"Hardware bridge not connected"</p>
                                <p><time datetime=slot.starts_at>{slot.label}</time></p>
                                <p>{slot.status}</p>
                                <p>{format!("{} bids · price TBD", slot.bid_count)}</p>
                            </li>
                        }
                    }).collect_view()}
                </ul>
                <p>"Currency, reserve price and bid increment are intentionally unset."</p>
                <div class="notice">
                    <h3>"No resale listings yet"</h3>
                    <p>"Ownership and transfer records are scaffolded. Listings stay disabled until fees, price caps and transfer cutoff are approved."</p>
                </div>
            </section>
            <section aria-labelledby="robot-how">
                <h2 id="robot-how">"How this will work"</h2>
                <ol class="robot-steps">
                    <li><h3>"Watch freely"</h3><p>"The habitat stream remains viewable even when no robot slot is active."</p></li>
                    <li><h3>"Win an hour"</h3><p>"Book or bid after the operator sets currency, auction and refund rules."</p></li>
                    <li><h3>"Check in safely"</h3><p>"The slot owner gets time-limited controls with live staff supervision."</p></li>
                    <li><h3>"Transfer if needed"</h3><p>"Resale stays inside the platform with an audit trail and configurable cap."</p></li>
                </ol>
            </section>
        </div>
    }
}
