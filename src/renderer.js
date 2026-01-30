/**
 * Renderer Process - Main UI Logic
 * Handles user interactions and coordinates between calendar and settings
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize calendar
  window.calendarManager.init();

  // Check credentials and auth status
  await checkInitialState();

  // Set up event listeners
  setupEventListeners();

  // Listen for auth success from main process
  window.electronAPI.onAuthSuccess(() => {
    updateConnectionStatus(true);
    window.calendarManager.refresh();
  });
});

/**
 * Check initial state of credentials and authentication
 */
async function checkInitialState() {
  // Check if Google credentials are configured
  const credentialsStatus = await window.electronAPI.checkCredentials();

  if (credentialsStatus.hasCredentials) {
    // Credentials exist, check if authenticated
    const authStatus = await window.electronAPI.checkAuth();
    updateConnectionStatus(authStatus.isAuthenticated);

    // Pre-fill client ID in settings
    document.getElementById('client-id').value = credentialsStatus.clientId;
  } else {
    // No credentials, show setup needed
    updateConnectionStatus(false);
    document.getElementById('connect-btn').textContent = 'Setup Required';
  }

  // Load email settings
  await loadEmailSettings();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Connect button
  document.getElementById('connect-btn').addEventListener('click', handleConnect);

  // View toggle buttons
  document.getElementById('week-view-btn').addEventListener('click', () => setView('week'));
  document.getElementById('month-view-btn').addEventListener('click', () => setView('month'));
  document.getElementById('agenda-view-btn').addEventListener('click', () => setView('agenda'));

  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', () => {
    window.calendarManager.refresh();
  });

  // Settings modal
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('close-settings').addEventListener('click', closeSettings);
  document.querySelector('#settings-modal .modal-backdrop').addEventListener('click', closeSettings);

  // Credentials help modal
  document.getElementById('credentials-help').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('credentials-help-modal').classList.remove('hidden');
  });
  document.getElementById('close-credentials-help').addEventListener('click', () => {
    document.getElementById('credentials-help-modal').classList.add('hidden');
  });
  document.querySelector('#credentials-help-modal .modal-backdrop').addEventListener('click', () => {
    document.getElementById('credentials-help-modal').classList.add('hidden');
  });

  // Save credentials
  document.getElementById('save-credentials-btn').addEventListener('click', saveCredentials);

  // Disconnect button
  document.getElementById('disconnect-btn').addEventListener('click', handleDisconnect);

  // Email settings
  document.getElementById('reminders-enabled').addEventListener('change', toggleEmailSettings);
  document.getElementById('save-email-btn').addEventListener('click', saveEmailSettings);
  document.getElementById('test-email-btn').addEventListener('click', testEmail);

  // Calendar settings
  document.getElementById('add-manual-calendar-btn').addEventListener('click', addManualCalendar);
}

/**
 * Handle connect/authenticate button click
 */
async function handleConnect() {
  const credentialsStatus = await window.electronAPI.checkCredentials();

  if (!credentialsStatus.hasCredentials) {
    // No credentials, open settings
    openSettings();
    return;
  }

  const connectBtn = document.getElementById('connect-btn');
  connectBtn.disabled = true;
  connectBtn.innerHTML = `
    <div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
    Connecting...
  `;

  const result = await window.electronAPI.startGoogleAuth();

  if (!result.success) {
    alert('Authentication failed: ' + (result.error || 'Unknown error'));
    connectBtn.disabled = false;
    connectBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12c6.627 0 12-5.373 12-12S18.627 0 12 0zm.14 19.018c-3.868 0-7-3.14-7-7.018c0-3.878 3.132-7.018 7-7.018c1.89 0 3.47.697 4.682 1.829l-1.974 1.978v-.004c-.735-.702-1.667-1.062-2.708-1.062c-2.31 0-4.187 1.956-4.187 4.273c0 2.315 1.877 4.277 4.187 4.277c2.096 0 3.522-1.202 3.816-2.852H12.14v-2.737h6.585c.088.47.135.96.135 1.474c0 4.01-2.677 6.86-6.72 6.86z"/>
      </svg>
      Connect Google Calendar
    `;
  }
}

/**
 * Handle disconnect button click
 */
async function handleDisconnect() {
  if (confirm('Are you sure you want to disconnect your Google account?')) {
    await window.electronAPI.disconnectGoogle();
    updateConnectionStatus(false);
    window.calendarManager.calendar.removeAllEvents();
  }
}

/**
 * Update connection status UI
 * @param {boolean} isConnected - Whether the user is connected
 */
function updateConnectionStatus(isConnected) {
  const statusEl = document.getElementById('connection-status');
  const statusText = statusEl.querySelector('.status-text');
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const accountText = document.getElementById('account-text');

  if (isConnected) {
    statusEl.classList.add('connected');
    statusText.textContent = 'Connected';
    connectBtn.classList.add('hidden');
    disconnectBtn.classList.remove('hidden');
    accountText.textContent = 'Connected to Google Calendar';
  } else {
    statusEl.classList.remove('connected');
    statusText.textContent = 'Not Connected';
    connectBtn.classList.remove('hidden');
    connectBtn.disabled = false;
    connectBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12c6.627 0 12-5.373 12-12S18.627 0 12 0zm.14 19.018c-3.868 0-7-3.14-7-7.018c0-3.878 3.132-7.018 7-7.018c1.89 0 3.47.697 4.682 1.829l-1.974 1.978v-.004c-.735-.702-1.667-1.062-2.708-1.062c-2.31 0-4.187 1.956-4.187 4.273c0 2.315 1.877 4.277 4.187 4.277c2.096 0 3.522-1.202 3.816-2.852H12.14v-2.737h6.585c.088.47.135.96.135 1.474c0 4.01-2.677 6.86-6.72 6.86z"/>
      </svg>
      Connect Google Calendar
    `;
    disconnectBtn.classList.add('hidden');
    accountText.textContent = 'Not connected';
  }
}

/**
 * Set calendar view
 * @param {string} view - 'week', 'month', or 'agenda'
 */
function setView(view) {
  // Update button states
  document.getElementById('week-view-btn').classList.toggle('active', view === 'week');
  document.getElementById('month-view-btn').classList.toggle('active', view === 'month');
  document.getElementById('agenda-view-btn').classList.toggle('active', view === 'agenda');

  // Update calendar
  window.calendarManager.setView(view);
}

/**
 * Open settings modal
 */
async function openSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');

  // Update account status
  const authStatus = await window.electronAPI.checkAuth();
  updateConnectionStatus(authStatus.isAuthenticated);

  // Load calendar settings
  await loadCalendarSettings();
}

/**
 * Close settings modal
 */
function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

/**
 * Save Google credentials
 */
async function saveCredentials() {
  const clientId = document.getElementById('client-id').value.trim();
  const clientSecret = document.getElementById('client-secret').value.trim();

  if (!clientId || !clientSecret) {
    alert('Please enter both Client ID and Client Secret');
    return;
  }

  const btn = document.getElementById('save-credentials-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await window.electronAPI.saveGoogleCredentials({ clientId, clientSecret });

    btn.textContent = 'Saved!';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Save Credentials';
    }, 2000);

    // Update connect button
    const connectBtn = document.getElementById('connect-btn');
    connectBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12c6.627 0 12-5.373 12-12S18.627 0 12 0zm.14 19.018c-3.868 0-7-3.14-7-7.018c0-3.878 3.132-7.018 7-7.018c1.89 0 3.47.697 4.682 1.829l-1.974 1.978v-.004c-.735-.702-1.667-1.062-2.708-1.062c-2.31 0-4.187 1.956-4.187 4.273c0 2.315 1.877 4.277 4.187 4.277c2.096 0 3.522-1.202 3.816-2.852H12.14v-2.737h6.585c.088.47.135.96.135 1.474c0 4.01-2.677 6.86-6.72 6.86z"/>
      </svg>
      Connect Google Calendar
    `;
  } catch (error) {
    alert('Failed to save credentials: ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Save Credentials';
  }
}

/**
 * Toggle email settings visibility
 */
function toggleEmailSettings() {
  const enabled = document.getElementById('reminders-enabled').checked;
  const settings = document.getElementById('email-settings');

  if (enabled) {
    settings.style.display = 'block';
  } else {
    settings.style.display = 'none';
  }
}

/**
 * Load email settings from storage
 */
async function loadEmailSettings() {
  const settings = await window.electronAPI.getEmailSettings();

  document.getElementById('reminders-enabled').checked = settings.remindersEnabled;
  document.getElementById('recipient-email').value = settings.recipientEmail;
  document.getElementById('smtp-host').value = settings.smtpHost;
  document.getElementById('smtp-port').value = settings.smtpPort;
  document.getElementById('smtp-user').value = settings.smtpUser;
  document.getElementById('smtp-pass').value = settings.smtpPass;
  document.getElementById('morning-time').value = settings.morningReminderTime;
  document.getElementById('evening-time').value = settings.eveningReminderTime;

  // Toggle visibility based on enabled state
  toggleEmailSettings();
}

/**
 * Save email settings
 */
async function saveEmailSettings() {
  const settings = {
    remindersEnabled: document.getElementById('reminders-enabled').checked,
    recipientEmail: document.getElementById('recipient-email').value.trim(),
    smtpHost: document.getElementById('smtp-host').value.trim(),
    smtpPort: parseInt(document.getElementById('smtp-port').value) || 587,
    smtpUser: document.getElementById('smtp-user').value.trim(),
    smtpPass: document.getElementById('smtp-pass').value,
    morningReminderTime: document.getElementById('morning-time').value,
    eveningReminderTime: document.getElementById('evening-time').value
  };

  const btn = document.getElementById('save-email-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await window.electronAPI.saveEmailSettings(settings);

    btn.textContent = 'Saved!';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Save Email Settings';
    }, 2000);
  } catch (error) {
    alert('Failed to save email settings: ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Save Email Settings';
  }
}

/**
 * Send a test email
 */
async function testEmail() {
  // First save the current settings
  await saveEmailSettings();

  const btn = document.getElementById('test-email-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const result = await window.electronAPI.testEmail();

    if (result.success) {
      btn.textContent = 'Sent!';
      alert('Test email sent successfully! Check your inbox.');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    alert('Failed to send test email: ' + error.message);
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Send Test Email';
    }, 2000);
  }
}

/**
 * Load calendar settings (list and manual calendars)
 */
async function loadCalendarSettings() {
  const authStatus = await window.electronAPI.checkAuth();

  if (!authStatus.isAuthenticated) {
    document.getElementById('calendar-list-placeholder').textContent = 'Connect to Google to see your calendars';
    return;
  }

  // Load Google calendars
  const result = await window.electronAPI.getCalendarList();

  if (result.success) {
    const selectedCalendars = await window.electronAPI.getSelectedCalendars();
    renderCalendarList(result.calendars, selectedCalendars);
  } else {
    document.getElementById('calendar-list-placeholder').textContent = 'Could not load calendars';
  }

  // Load manual calendars
  const manualCalendars = await window.electronAPI.getManualCalendars();
  renderManualCalendars(manualCalendars);
}

/**
 * Render calendar list with checkboxes
 */
function renderCalendarList(calendars, selectedCalendars) {
  const container = document.getElementById('calendar-list');

  if (calendars.length === 0) {
    container.innerHTML = '<p class="help-text">No calendars found</p>';
    return;
  }

  // If no calendars are selected, treat all as selected (default behavior)
  const effectiveSelected = selectedCalendars.length === 0
    ? calendars.map(c => c.id)
    : selectedCalendars;

  const html = calendars.map(cal => `
    <label class="calendar-item">
      <input type="checkbox"
             value="${cal.id}"
             ${effectiveSelected.includes(cal.id) ? 'checked' : ''}
             onchange="handleCalendarToggle()">
      <span class="calendar-color-dot" style="background-color: ${cal.color}"></span>
      <span class="calendar-name">${cal.name}${cal.primary ? ' (Primary)' : ''}</span>
    </label>
  `).join('');

  container.innerHTML = html;
}

/**
 * Handle calendar checkbox toggle
 */
async function handleCalendarToggle() {
  const checkboxes = document.querySelectorAll('#calendar-list input[type="checkbox"]');
  const selectedIds = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  await window.electronAPI.saveSelectedCalendars(selectedIds);

  // Refresh the calendar view
  window.calendarManager.refresh();
}

/**
 * Add a manual calendar
 */
async function addManualCalendar() {
  const idInput = document.getElementById('manual-calendar-id');
  const nameInput = document.getElementById('manual-calendar-name');

  const calendarId = idInput.value.trim();
  const calendarName = nameInput.value.trim() || calendarId;

  if (!calendarId) {
    alert('Please enter a calendar ID');
    return;
  }

  const manualCalendars = await window.electronAPI.getManualCalendars();

  // Check if already exists
  if (manualCalendars.some(c => c.id === calendarId)) {
    alert('This calendar has already been added');
    return;
  }

  manualCalendars.push({ id: calendarId, name: calendarName });
  await window.electronAPI.saveManualCalendars(manualCalendars);

  // Clear inputs
  idInput.value = '';
  nameInput.value = '';

  // Re-render list
  renderManualCalendars(manualCalendars);

  // Refresh calendar
  window.calendarManager.refresh();
}

/**
 * Remove a manual calendar
 */
async function removeManualCalendar(calendarId) {
  let manualCalendars = await window.electronAPI.getManualCalendars();
  manualCalendars = manualCalendars.filter(c => c.id !== calendarId);
  await window.electronAPI.saveManualCalendars(manualCalendars);

  // Re-render list
  renderManualCalendars(manualCalendars);

  // Refresh calendar
  window.calendarManager.refresh();
}

/**
 * Render manual calendars list
 */
function renderManualCalendars(calendars) {
  const container = document.getElementById('manual-calendar-list');

  if (calendars.length === 0) {
    container.innerHTML = '';
    return;
  }

  const html = calendars.map(cal => `
    <div class="manual-calendar-item">
      <div class="manual-calendar-info">
        <span class="manual-calendar-name">${cal.name}</span>
        <span class="manual-calendar-id">${cal.id}</span>
      </div>
      <button class="btn btn-icon btn-delete" onclick="removeManualCalendar('${cal.id}')" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `).join('');

  container.innerHTML = html;
}
