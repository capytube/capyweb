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

    #[test]
    fn unknown_page_name_is_none() {
        assert_eq!(Page::from_name("admin"), None);
        assert_eq!(Page::from_name("/watch"), None);
    }

    #[test]
    fn titles() {
        assert_eq!(title_for("Watch"), "Watch · CapyTube");
        assert_eq!(title_for(""), "CapyTube, capybara cameras");
    }
}
