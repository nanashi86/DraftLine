// Projects (ProjectsDrawer.jsx) closes on a click outside it.

/**
 * With Projects open, does a press on `target` close it (and go on to what was pressed)? Not inside
 * the panel, nor on the dimmed backdrop (that closes it by itself, swallowing the click), nor in a
 * dialog (Delete Screenplay?), a dropdown list drawn over the page, or the button that toggles Projects.
 */
export function projectsClickCloses(target, panel) {
  if (!target?.closest || panel?.contains(target)) return false;
  return !target.closest('.pd-backdrop, dialog, .dl-select-list, [data-projects-toggle]');
}
