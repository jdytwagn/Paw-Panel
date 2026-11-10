(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotchPlatform = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function capabilities(platform) {
    return {
      platform,
      unavailableHomeModules: platform === 'darwin' ? [] : ['music', 'windows'],
      automaticPaste: platform === 'darwin',
      autoLaunch: platform === 'darwin' || platform === 'win32',
    };
  }

  function effectiveHiddenModules(hidden, registry, unavailable) {
    const available = registry.filter((id) => !unavailable.includes(id));
    const result = registry.filter((id) => hidden.includes(id) || unavailable.includes(id));
    // A workspace moved from Mac may have only unavailable widgets visible.
    if (available.length && available.every((id) => result.includes(id))) {
      return result.filter((id) => id !== available[0]);
    }
    return result;
  }

  function panelBounds(platform, display, expanded, petEntry = platform === 'win32') {
    const area = petEntry ? display.workArea : display.bounds;
    if (petEntry && !expanded) {
      const width = Math.min(88, area.width);
      const height = Math.min(88, area.height);
      return {
        x: area.x + Math.max(0, area.width - width - 24),
        y: area.y + Math.max(0, area.height - height - 20),
        width,
        height,
      };
    }
    const strip = Math.max(0, display.workArea.y - display.bounds.y) || 38;
    const width = expanded ? Math.max(1, Math.min(1240, display.workArea.width - (petEntry ? 48 : 24))) : Math.min(200, area.width);
    const maxHeight = petEntry ? Math.max(1, area.height - 48) : Math.max(strip, area.height - 24);
    const height = expanded ? Math.min(616, maxHeight) : strip;
    const y = petEntry ? Math.round(area.y + (area.height - height) / 2) : area.y;
    return { x: Math.round(area.x + (area.width - width) / 2), y, width, height };
  }
  function portableMediaPath(directory, value) {
    return `${directory}/${String(value).replace(/\\/g, '/').split('/').pop()}`;
  }
  return { capabilities, effectiveHiddenModules, panelBounds, portableMediaPath };
});
