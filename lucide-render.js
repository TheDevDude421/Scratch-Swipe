lucide.createIcons();
function observeLucideIcons() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (
          node.matches &&
          node.matches("i[data-lucide]") &&
          node.tagName !== "SVG"
        ) {
          window.lucide.createIcons({ node });
        }
        const icons =
          node.querySelectorAll &&
          node.querySelectorAll("i[data-lucide]:not(svg)");
        if (icons && icons.length) {
          window.lucide.createIcons({ elements: Array.from(icons) });
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
observeLucideIcons();
window.lucide.createIcons();
