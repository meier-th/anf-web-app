export const APP_TIMINGS = {
  onlineHeartbeatMs: 120000,
  readyAutoOffMs: 300000,
  lobbyPollMs: 3000,
  chatReconnectMs: 1500,
  fightTurnTickMs: 30000,
  fightTurnWindowMs: 30200
} as const;

export const DIALOG_SIZES = {
  auth: {width: '560px'},
  room: {width: '200px', height: '200px'},
  queue: {width: '980px', height: '640px'},
  chat: {width: '760px', height: '560px'},
  raceChoice: {width: '800px', height: '600px'}
} as const;

export const APP_MESSAGES = {
  queuePreparing: 'Preparing lobby...',
  queueSelectOrCreate: 'Select a lobby to join, create your own, or use a code.',
  queueAlreadyInLobby: 'You are already in a lobby.',
  queueCreated: 'Lobby created. Share the code and wait for players.',
  queueLeaveCurrentFirst: 'Leave your current lobby first.',
  queueJoined: 'Joined lobby. Waiting for leader to start.',
  queueCopyFailed: 'Could not copy automatically.',
  queueReadyToStart: 'Ready to start.',
  fightNotFound: 'Fight not found',
  chatWelcome: 'Welcome to the chat!',
  chatConnecting: 'Connecting to chat... your message will be sent automatically.',
  chatSystemSendFailed: 'Failed to send system message.',
  toastSuccess: 'Success',
  toastError: 'Error',
  lobbyCodeCopied: 'Lobby code copied.',
  unableToSurrender: 'Unable to surrender'
} as const;

export const FIGHT_CONSTANTS = {
  summonLevelTwoThreshold: 10,
  defaultSkill: 'Physical attack',
  surrenderAttackName: 'surrender'
} as const;

export const FIGHT_UI = {
  timerStepMs: 1000,
  announcementDelayMs: 500,
  announcementDurationMs: 2000,
  finishDelayMs: 1000,
  maxAttackEvents: 8,
  maxDebugLines: 24,
  projectileSizePx: 16,
  projectileDurationMs: 200,
  projectileCleanupMs: 260,
  impactFlashMs: 160
} as const;

export const FIGHT_MESSAGES = {
  notEnoughChakra: 'Not enough chakra',
  notYourTurn: 'Not your turn!'
} as const;
