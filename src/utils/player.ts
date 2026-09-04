// Save player info to sessionStorage (survives navigation within the session)
export function savePlayerInfo(name: string, avatar: string, isCreator: boolean = false) {
  sessionStorage.setItem('playerName', name);
  sessionStorage.setItem('playerAvatar', avatar);
  sessionStorage.setItem('playerIsCreator', isCreator ? '1' : '0');
}

// Read player info from sessionStorage (with defaults)
export function getPlayerInfo() {
  return {
    name: sessionStorage.getItem('playerName') || 'Jogador',
    avatar: sessionStorage.getItem('playerAvatar') || 'heart-rose',
    isCreator: sessionStorage.getItem('playerIsCreator') === '1',
  };
}
