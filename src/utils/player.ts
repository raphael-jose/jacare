// Save player info to sessionStorage (survives navigation within the session).
// NOTE: isCreator is deliberately NOT stored here — sessionStorage is shared
// between tabs of the same browser, so a guest tab would "inherit" the host's
// creator status. Creator status comes from the SERVER (creatorId) instead.
export function savePlayerInfo(name: string, avatar: string) {
  sessionStorage.setItem('playerName', name);
  sessionStorage.setItem('playerAvatar', avatar);
}

// Read player info from sessionStorage (with defaults)
export function getPlayerInfo() {
  return {
    name: sessionStorage.getItem('playerName') || 'Jogador',
    avatar: sessionStorage.getItem('playerAvatar') || 'heart-rose',
  };
}