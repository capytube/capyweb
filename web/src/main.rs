mod api;
mod app;
mod domain;
mod webmcp;

fn main() {
    console_error_panic_hook::set_once();
    leptos::mount::mount_to_body(app::App);
}
