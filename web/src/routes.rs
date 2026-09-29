//! Every top-level page the app links to, in one place, so the nav, the footer and the WebMCP
//! `open_page` tool cannot disagree about names or paths. URLs match the React app's routes so
//! shared links keep working (docs/WASM_PLAN.md section 2).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Page {
    Home,
    Watch,
    Play,
    Shop,
    Robot,
    Profile,
    About,
    Privacy,
    Terms,
    Deletion,
}

impl Page {
    pub const ALL: [Page; 10] = [
        Page::Home,
        Page::Watch,
        Page::Play,
        Page::Shop,
        Page::Robot,
        Page::Profile,
        Page::About,
        Page::Privacy,
        Page::Terms,
        Page::Deletion,
    ];

    /// Desktop top-bar links.
    pub const NAV: [Page; 5] = [Page::Home, Page::Watch, Page::Play, Page::Shop, Page::Robot];

    /// Phone tab bar: the four core pages plus the account.
    pub const TABS: [Page; 5] = [
        Page::Home,
        Page::Watch,
        Page::Play,
        Page::Shop,
        Page::Profile,
    ];

    /// Footer links.
    pub const FOOTER: [Page; 5] = [
        Page::About,
        Page::Robot,
        Page::Privacy,
        Page::Terms,
        Page::Deletion,
    ];

    pub fn path(self) -> &'static str {
        match self {
            Page::Home => "/",
            Page::Watch => "/watch",
            Page::Play => "/play",
            Page::Shop => "/shop",
            Page::Robot => "/robot",
            Page::Profile => "/profile",
            Page::About => "/about-us",
            Page::Privacy => "/privacy-policy",
            Page::Terms => "/terms-of-service",
            Page::Deletion => "/deletion",
        }
    }

    /// Short label for navigation.
    pub fn label(self) -> &'static str {
        match self {
            Page::Home => "Home",
            Page::Watch => "Watch",
            Page::Play => "Play",
            Page::Shop => "Shop",
            Page::Robot => "Robot",
            Page::Profile => "Me",
            Page::About => "About",
            Page::Privacy => "Privacy",
            Page::Terms => "Terms",
            Page::Deletion => "Delete my data",
        }
    }

    /// Stable machine name, used by the WebMCP `open_page` tool.
    pub fn name(self) -> &'static str {
        match self {
            Page::Home => "home",
            Page::Watch => "watch",
            Page::Play => "play",
            Page::Shop => "shop",
            Page::Robot => "robot",
            Page::Profile => "account",
            Page::About => "about",
            Page::Privacy => "privacy",
            Page::Terms => "terms",
            Page::Deletion => "deletion",
        }
    }

    pub fn from_name(name: &str) -> Option<Page> {
        Page::ALL.into_iter().find(|p| p.name() == name)
    }
}

/// The production origin. Canonical links name it on every stage (dev tells crawlers to stay
/// out), and `web/index.html`, `web/sitemap.xml` and `web/robots.txt` carry it too; a test
/// keeps them equal.
pub const SITE_ORIGIN: &str = "https://capytube.xyz";

/// The canonical URL for a routed path: the origin plus the path only, with no query or
/// fragment and no trailing slash (except the root). `/watch/` and `/watch?x=1` are `/watch`,
/// as the router treats them.
pub fn canonical_url(path: &str) -> String {
    let path = path.split(['?', '#']).next().unwrap_or_default();
    let path = path.trim_end_matches('/');
    let slash = if path.starts_with('/') { "" } else { "/" };
    format!("{SITE_ORIGIN}{slash}{path}")
}

/// The document title for a page heading: "Watch · CapyTube".
pub fn title_for(heading: &str) -> String {
    if heading.is_empty() {
        "CapyTube, capybara cameras".to_string()
    } else {
        format!("{heading} · CapyTube")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_round_trip_and_are_unique() {
        for p in Page::ALL {
            assert_eq!(Page::from_name(p.name()), Some(p));
        }
        let mut names: Vec<_> = Page::ALL.iter().map(|p| p.name()).collect();
        names.sort();
        names.dedup();
        assert_eq!(names.len(), Page::ALL.len());
    }

    #[test]
    fn paths_match_the_react_routes() {
        let paths: Vec<_> = Page::ALL.iter().map(|p| p.path()).collect();
        assert_eq!(
            paths,
            [
                "/",
                "/watch",
                "/play",
                "/shop",
                "/robot",
                "/profile",
                "/about-us",
                "/privacy-policy",
                "/terms-of-service",
                "/deletion"
            ]
        );
    }

    /// infra/site/template.yaml answers 404 at the edge for any other path, so its route list must
    /// be the app's: every page, the sign-in callback, and the two id routes (capyweb-1w5).
    #[test]
    fn edge_routes_match_the_app() {
        let template = include_str!("../../infra/site/template.yaml");
        let mut want: Vec<String> = Page::ALL.iter().map(|p| p.path().to_string()).collect();
        want.push("/auth/callback".into());
        let lists: Vec<Vec<String>> = template
            .lines()
            .filter_map(|l| l.trim().strip_prefix("var ROUTES = ["))
            .map(|rest| {
                rest.trim_end_matches("];")
                    .split(", ")
                    .map(|s| s.trim_matches('\'').to_string())
                    .collect()
            })
            .collect();
        assert_eq!(lists.len(), 2, "SpaFunction and NotFoundFunction");
        for list in lists {
            assert_eq!(list, want);
        }
        let ids = r"/^\/(stream|shop)\/[^\/]+$/";
        assert_eq!(
            template.matches(ids).count(),
            2,
            "both allow /stream/<id> and /shop/<id>"
        );
        // A new route in the app must be added to the edge list too.
        let app = include_str!("app.rs");
        assert_eq!(app.matches("<Route path=").count(), want.len() + 2);
        for dynamic in [r#"path!("/stream/:capyId")"#, r#"path!("/shop/:id")"#] {
            assert!(app.contains(dynamic), "{dynamic}");
        }
    }

    #[test]
    fn unknown_page_name_is_none() {
        assert_eq!(Page::from_name("admin"), None);
        assert_eq!(Page::from_name("/watch"), None);
    }

    #[test]
    fn canonical_is_the_path_only() {
        for (path, want) in [
            ("/", "https://capytube.xyz/"),
            ("", "https://capytube.xyz/"),
            ("/watch", "https://capytube.xyz/watch"),
            ("/watch/", "https://capytube.xyz/watch"),
            ("/play?capy=magnus", "https://capytube.xyz/play"),
            (
                "/stream/magnus?cam=wall-cam#chat",
                "https://capytube.xyz/stream/magnus",
            ),
            ("/shop/capy-1234/", "https://capytube.xyz/shop/capy-1234"),
        ] {
            assert_eq!(canonical_url(path), want, "{path}");
        }
    }

    /// Every sitemap URL is a page of the app on the production origin, in canonical form, and
    /// the capybara rooms and passes are exactly the seed's: each capybara a camera watches, and
    /// every pass. web/fixtures is the seed as the API serves it (the fixtures check keeps it
    /// so); each id is also looked up in the seed file itself.
    #[test]
    fn sitemap_matches_the_app_and_the_seed() {
        let sitemap = include_str!("../sitemap.xml");
        let mut got: Vec<String> = sitemap
            .split("<loc>")
            .skip(1)
            .map(|rest| {
                let url = rest.split("</loc>").next().unwrap();
                assert_eq!(canonical_url(url.trim_start_matches(SITE_ORIGIN)), url);
                url.strip_prefix(SITE_ORIGIN)
                    .unwrap_or_else(|| panic!("{url} is not on {SITE_ORIGIN}"))
                    .to_string()
            })
            .collect();

        let items = |json: &str| -> Vec<serde_json::Value> {
            let v: serde_json::Value = serde_json::from_str(json).unwrap();
            v["items"].as_array().unwrap().clone()
        };
        let id = |v: &serde_json::Value| v["id"].as_str().unwrap().to_string();
        let watched: Vec<String> = items(include_str!("../fixtures/streams.json"))
            .iter()
            .flat_map(|s| s["capybara_ids"].as_array().unwrap().clone())
            .map(|c| c.as_str().unwrap().to_string())
            .collect();
        let rooms: Vec<String> = items(include_str!("../fixtures/capybaras.json"))
            .iter()
            .map(id)
            .filter(|c| watched.contains(c))
            .collect();
        let passes: Vec<String> = items(include_str!("../fixtures/nfts.json"))
            .iter()
            .map(id)
            .collect();
        assert!(!rooms.is_empty() && !passes.is_empty());
        let seed = include_str!("../../backend/src/scripts/seed-data.ts");
        for id in rooms.iter().chain(&passes) {
            assert!(
                seed.contains(&format!("id: \"{id}\"")),
                "{id} is in the seed"
            );
        }

        // Every page but the account (it is per person); the sign-in callback is not a page.
        let mut want: Vec<String> = Page::ALL
            .iter()
            .filter(|p| **p != Page::Profile)
            .map(|p| p.path().to_string())
            .collect();
        want.extend(rooms.iter().map(|c| format!("/stream/{c}")));
        want.extend(passes.iter().map(|p| format!("/shop/{p}")));
        got.sort();
        want.sort();
        assert_eq!(got, want);
    }

    /// The origin in the shell's share image, the sitemap and robots.txt is `SITE_ORIGIN`, and
    /// the shell has no canonical or og:url (it is served for every route).
    #[test]
    fn static_files_name_the_site_origin() {
        let shell = include_str!("../index.html");
        assert!(shell.contains(&format!(
            r#"<meta property="og:image" content="{SITE_ORIGIN}/assets/"#
        )));
        assert!(!shell.contains(r#"rel="canonical""#));
        assert!(!shell.contains(r#"property="og:url""#));
        let robots = include_str!("../robots.txt");
        assert!(robots
            .trim_end()
            .ends_with(&format!("Sitemap: {SITE_ORIGIN}/sitemap.xml")));
        let sitemap = include_str!("../sitemap.xml");
        assert_eq!(
            sitemap.matches("<loc>").count(),
            sitemap.matches(&format!("<loc>{SITE_ORIGIN}/")).count()
        );
    }

    #[test]
    fn titles() {
        assert_eq!(title_for("Watch"), "Watch · CapyTube");
        assert_eq!(title_for(""), "CapyTube, capybara cameras");
    }
}
