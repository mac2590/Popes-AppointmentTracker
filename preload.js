const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Google credentials
  checkCredentials: () => ipcRenderer.invoke('check-credentials'),
  saveGoogleCredentials: (credentials) => ipcRenderer.invoke('save-google-credentials', credentials),

  // Authentication
  checkAuth: () => ipcRenderer.invoke('check-auth'),
  startGoogleAuth: () => ipcRenderer.invoke('start-google-auth'),
  disconnectGoogle: () => ipcRenderer.invoke('disconnect-google'),

  // Calendar
  fetchEvents: (params) => ipcRenderer.invoke('fetch-events', params),
  getCalendarList: () => ipcRenderer.invoke('get-calendar-list'),
  getSelectedCalendars: () => ipcRenderer.invoke('get-selected-calendars'),
  saveSelectedCalendars: (calendarIds) => ipcRenderer.invoke('save-selected-calendars', calendarIds),
  getManualCalendars: () => ipcRenderer.invoke('get-manual-calendars'),
  saveManualCalendars: (calendars) => ipcRenderer.invoke('save-manual-calendars', calendars),

  // Email settings
  getEmailSettings: () => ipcRenderer.invoke('get-email-settings'),
  saveEmailSettings: (settings) => ipcRenderer.invoke('save-email-settings', settings),
  testEmail: () => ipcRenderer.invoke('test-email'),

  // Event listeners
  onAuthSuccess: (callback) => {
    ipcRenderer.on('auth-success', callback);
    return () => ipcRenderer.removeListener('auth-success', callback);
  }
});
