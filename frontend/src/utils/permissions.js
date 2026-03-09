// src/hooks/usePermissions.js

export const usePermissions = (currentUserRole) => {
  const isHost = currentUserRole === 'HOST';
  const canEdit = currentUserRole === 'HOST' || currentUserRole === 'EDITOR';

  return {
    // Edit & Host actions
    canEditCode: canEdit,
    canCreateFile: canEdit,
    canDeleteFile: canEdit,
    
    // Host-only actions
    canSaveWorkspace: isHost,
    canChangeLanguage: isHost,
    canAssignPermissions: isHost,
    canKickUser: isHost,
    
    // Universal actions (always true, but good to explicitly define)
    canRunCode: true,
    canChat: true,
    canDownload: true,

    // Helper for tooltips
    getTooltipMessage: (actionRequiredRole) => {
        if (actionRequiredRole === 'HOST' && !isHost) {
            return "Only the host can perform this action";
        }
        if (actionRequiredRole === 'EDITOR' && !canEdit) {
            return "You are in read-only mode";
        }
        return "";
    }
  };
};