// Deleting a script: the confirmation dialog's words (components/DeleteProjectModal.jsx).

/** The warning: the drive part only when a folder is linked. */
export function deleteWarning(title, { synced = false } = {}) {
  const name = String(title || '').trim() || 'Untitled';
  return synced
    ? `This will permanently remove '${name}' from this browser and delete the .draftline file from your synced drive folder.`
    : `This will permanently remove '${name}' from this browser.`;
}
