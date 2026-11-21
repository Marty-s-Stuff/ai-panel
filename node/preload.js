// The AI panel's bridge for Electron apps. A sandboxed preload can only require('electron'), so COPY this block into
// the app's own preload.js (it is the GLB editor's window.glbTerm, under a neutral name). ai-panel.js finds it as
// window.aiPanelBridge. The IPC names match node/aipanel.js setup().
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aiPanelBridge', {
  agents: () => ipcRenderer.invoke('agents:list'),           // the AI assistant plugins: [{id, name, program, icon, installed, install, signIn:[{id,label,tip}], signOut, ...}]
  openAgentsFolder: () => ipcRenderer.invoke('agents:openFolder'), // the shared plugins folder in Explorer (made if missing, with the guide) -> its path
  info: agent => ipcRenderer.invoke('term:info', agent),     // one plugin (same shape)
  status: agent => ipcRenderer.invoke('term:status', agent), // its sign-in status: {installed, loggedIn, method}
  start: opts => ipcRenderer.invoke('term:start', opts),     // {agent, kind: 'chat'|'signin'|'signout'|'version', signInId, cwd, cols, rows} -> id
  pickFolder: start => ipcRenderer.invoke('term:pickFolder', start), // the Windows folder picker -> path | null
  folderExists: p => ipcRenderer.invoke('term:folderExists', p),
  write: (id, data) => ipcRenderer.send('term:write', id, data),
  resize: (id, cols, rows) => ipcRenderer.send('term:resize', id, cols, rows),
  kill: id => ipcRenderer.send('term:kill', id),
  onData: cb => ipcRenderer.on('term:data', (_e, id, data) => cb(id, data)),
  onExit: cb => ipcRenderer.on('term:exit', (_e, id, code) => cb(id, code)),
  update: (what, tag) => ipcRenderer.invoke('aipanel:update', what, tag), // panel updates: 'check' | 'install' (tag) | 'builtin'
});
