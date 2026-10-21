// Deleting a script: the typed confirmation and the dialog's words (components/DeleteProjectModal.jsx).

export const DELETE_WORD = 'DELETE';

/** The Permanently Delete button only works once exactly "DELETE" is typed (capitals; spaces around ignored). */
export const isDeleteConfirmed = (typed) => String(typed ?? '').trim() === DELETE_WORD;

/** The warning: the drive part only when a folder is linked. */
export function deleteWarning(title, { synced = false } = {}) {
  const name = String(title || '').trim() || 'Untitled';
  return synced
    ? `This will permanently remove '${name}' from this browser and delete the .draftline file from your synced drive folder.`
    : `This will permanently remove '${name}' from this browser.`;
}
