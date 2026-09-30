// Set the theme before first paint (avoids a light/dark flash). Kept as a
// separate file rather than an inline <script> so the Content-Security-Policy in
// nginx.conf can disallow inline scripts.
(function () {
  var stored = localStorage.getItem("theme");
  var theme =
    stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
})();
