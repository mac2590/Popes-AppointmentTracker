const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const Store = require('electron-store');
const nodemailer = require('nodemailer');
const schedule = require('node-schedule');

// Secure storage for settings
const store = new Store({
  encryptionKey: 'popes-family-tracker-2024'
});

let mainWindow;
let oauthServer;

// Google OAuth2 configuration
// Users need to create their own credentials at console.cloud.google.com
const GOOGLE_CLIENT_ID = store.get('googleClientId') || '';
const GOOGLE_CLIENT_SECRET = store.get('googleClientSecret') || '';
const REDIRECT_URI = 'http://localhost:8085/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

let oauth2Client = null;

function createOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null;
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Initialize reminder scheduler
  initializeReminderScheduler();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (oauthServer) {
    oauthServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Check if credentials are configured
ipcMain.handle('check-credentials', () => {
  const clientId = store.get('googleClientId');
  const clientSecret = store.get('googleClientSecret');
  return {
    hasCredentials: !!(clientId && clientSecret),
    clientId: clientId || ''
  };
});

// Save Google credentials
ipcMain.handle('save-google-credentials', (event, { clientId, clientSecret }) => {
  store.set('googleClientId', clientId);
  store.set('googleClientSecret', clientSecret);
  oauth2Client = createOAuth2Client();
  return { success: true };
});

// Check authentication status
ipcMain.handle('check-auth', () => {
  const tokens = store.get('googleTokens');
  return { isAuthenticated: !!tokens };
});

// Start Google OAuth flow
ipcMain.handle('start-google-auth', async () => {
  oauth2Client = createOAuth2Client();

  if (!oauth2Client) {
    return { success: false, error: 'Google credentials not configured' };
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  // Start local server to receive OAuth callback
  return new Promise((resolve) => {
    if (oauthServer) {
      oauthServer.close();
    }

    oauthServer = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);

      if (parsedUrl.pathname === '/oauth2callback') {
        const code = parsedUrl.query.code;

        if (code) {
          try {
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            store.set('googleTokens', tokens);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                             display: flex; justify-content: center; align-items: center; height: 100vh;
                             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                  <div style="text-align: center; color: white;">
                    <h1>Successfully Connected!</h1>
                    <p>You can close this window and return to the app.</p>
                  </div>
                </body>
              </html>
            `);

            oauthServer.close();
            mainWindow.webContents.send('auth-success');
            resolve({ success: true });
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Authentication Failed</h1></body></html>');
            resolve({ success: false, error: error.message });
          }
        }
      }
    }).listen(8085);

    shell.openExternal(authUrl);
  });
});

// Fetch calendar events
ipcMain.handle('fetch-events', async (event, { startDate, endDate }) => {
  const tokens = store.get('googleTokens');

  if (!tokens) {
    return { success: false, error: 'Not authenticated' };
  }

  oauth2Client = createOAuth2Client();
  if (!oauth2Client) {
    return { success: false, error: 'Google credentials not configured' };
  }

  oauth2Client.setCredentials(tokens);

  // Refresh token if expired
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      store.set('googleTokens', credentials);
      oauth2Client.setCredentials(credentials);
    } catch (error) {
      store.delete('googleTokens');
      return { success: false, error: 'Token expired, please re-authenticate' };
    }
  }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    // Get selected calendars and manual calendars
    const selectedCalendars = store.get('selectedCalendars', []);
    const manualCalendars = store.get('manualCalendars', []);

    // Get list of all calendars
    const calendarList = await calendar.calendarList.list();
    const allEvents = [];

    // Build list of calendars to fetch from
    let calendarsToFetch = calendarList.data.items;

    // Filter by selected calendars if any are selected
    if (selectedCalendars.length > 0) {
      calendarsToFetch = calendarsToFetch.filter(cal => selectedCalendars.includes(cal.id));
    }

    // Fetch events from selected calendars
    for (const cal of calendarsToFetch) {
      try {
        const response = await calendar.events.list({
          calendarId: cal.id,
          timeMin: startDate,
          timeMax: endDate,
          singleEvents: true,
          orderBy: 'startTime'
        });

        const events = response.data.items.map(event => ({
          id: event.id,
          calendarId: cal.id,
          calendarName: cal.summary,
          title: event.summary || 'No Title',
          description: event.description || '',
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          allDay: !event.start.dateTime,
          location: event.location || ''
        }));

        allEvents.push(...events);
      } catch (err) {
        console.log(`Could not fetch events from calendar: ${cal.summary}`);
      }
    }

    // Fetch events from manually added calendars
    for (const manualCal of manualCalendars) {
      try {
        const response = await calendar.events.list({
          calendarId: manualCal.id,
          timeMin: startDate,
          timeMax: endDate,
          singleEvents: true,
          orderBy: 'startTime'
        });

        const events = response.data.items.map(event => ({
          id: event.id,
          calendarId: manualCal.id,
          calendarName: manualCal.name || manualCal.id,
          title: event.summary || 'No Title',
          description: event.description || '',
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          allDay: !event.start.dateTime,
          location: event.location || ''
        }));

        allEvents.push(...events);
      } catch (err) {
        console.log(`Could not fetch events from manual calendar: ${manualCal.id}`);
      }
    }

    return { success: true, events: allEvents };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Disconnect Google account
ipcMain.handle('disconnect-google', () => {
  store.delete('googleTokens');
  return { success: true };
});

// Get list of all calendars from Google
ipcMain.handle('get-calendar-list', async () => {
  const tokens = store.get('googleTokens');

  if (!tokens) {
    return { success: false, error: 'Not authenticated' };
  }

  oauth2Client = createOAuth2Client();
  if (!oauth2Client) {
    return { success: false, error: 'Google credentials not configured' };
  }

  oauth2Client.setCredentials(tokens);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const calendarList = await calendar.calendarList.list();
    const calendars = calendarList.data.items.map(cal => ({
      id: cal.id,
      name: cal.summary,
      color: cal.backgroundColor || '#007AFF',
      primary: cal.primary || false
    }));
    return { success: true, calendars };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get selected calendar IDs
ipcMain.handle('get-selected-calendars', () => {
  return store.get('selectedCalendars', []);
});

// Save selected calendar IDs
ipcMain.handle('save-selected-calendars', (event, calendarIds) => {
  store.set('selectedCalendars', calendarIds);
  return { success: true };
});

// Get manually added calendar IDs
ipcMain.handle('get-manual-calendars', () => {
  return store.get('manualCalendars', []);
});

// Save manually added calendar IDs
ipcMain.handle('save-manual-calendars', (event, calendars) => {
  store.set('manualCalendars', calendars);
  return { success: true };
});

// Email settings
ipcMain.handle('get-email-settings', () => {
  return {
    recipientEmail: store.get('recipientEmail') || '',
    smtpHost: store.get('smtpHost') || 'smtp.gmail.com',
    smtpPort: store.get('smtpPort') || 587,
    smtpUser: store.get('smtpUser') || '',
    smtpPass: store.get('smtpPass') || '',
    remindersEnabled: store.get('remindersEnabled') || false,
    morningReminderTime: store.get('morningReminderTime') || '07:00',
    eveningReminderTime: store.get('eveningReminderTime') || '19:00'
  };
});

ipcMain.handle('save-email-settings', (event, settings) => {
  store.set('recipientEmail', settings.recipientEmail);
  store.set('smtpHost', settings.smtpHost);
  store.set('smtpPort', settings.smtpPort);
  store.set('smtpUser', settings.smtpUser);
  store.set('smtpPass', settings.smtpPass);
  store.set('remindersEnabled', settings.remindersEnabled);
  store.set('morningReminderTime', settings.morningReminderTime);
  store.set('eveningReminderTime', settings.eveningReminderTime);

  // Reschedule reminders
  initializeReminderScheduler();

  return { success: true };
});

// Test email configuration
ipcMain.handle('test-email', async () => {
  const settings = {
    smtpHost: store.get('smtpHost'),
    smtpPort: store.get('smtpPort'),
    smtpUser: store.get('smtpUser'),
    smtpPass: store.get('smtpPass'),
    recipientEmail: store.get('recipientEmail')
  };

  if (!settings.smtpUser || !settings.smtpPass || !settings.recipientEmail) {
    return { success: false, error: 'Email settings incomplete' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass
      }
    });

    await transporter.sendMail({
      from: settings.smtpUser,
      to: settings.recipientEmail,
      subject: 'Popes Appointment Tracker - Test Email',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px;">
          <h2>Email Configuration Successful!</h2>
          <p>Your email reminders are now set up correctly.</p>
          <p style="color: #666;">- Popes Appointment Tracker</p>
        </div>
      `
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Reminder scheduler
let morningJob = null;
let eveningJob = null;

function initializeReminderScheduler() {
  // Cancel existing jobs
  if (morningJob) morningJob.cancel();
  if (eveningJob) eveningJob.cancel();

  const remindersEnabled = store.get('remindersEnabled');
  if (!remindersEnabled) return;

  const morningTime = store.get('morningReminderTime') || '07:00';
  const eveningTime = store.get('eveningReminderTime') || '19:00';

  const [morningHour, morningMinute] = morningTime.split(':').map(Number);
  const [eveningHour, eveningMinute] = eveningTime.split(':').map(Number);

  // Morning reminder - today's schedule
  morningJob = schedule.scheduleJob({ hour: morningHour, minute: morningMinute }, async () => {
    await sendDailyReminder('morning');
  });

  // Evening reminder - tomorrow's appointments
  eveningJob = schedule.scheduleJob({ hour: eveningHour, minute: eveningMinute }, async () => {
    await sendDailyReminder('evening');
  });
}

async function sendDailyReminder(type) {
  const tokens = store.get('googleTokens');
  const settings = {
    smtpHost: store.get('smtpHost'),
    smtpPort: store.get('smtpPort'),
    smtpUser: store.get('smtpUser'),
    smtpPass: store.get('smtpPass'),
    recipientEmail: store.get('recipientEmail')
  };

  if (!tokens || !settings.smtpUser || !settings.recipientEmail) return;

  oauth2Client = createOAuth2Client();
  if (!oauth2Client) return;

  oauth2Client.setCredentials(tokens);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Determine date range
  const today = new Date();
  let startDate, endDate, subject;

  if (type === 'morning') {
    startDate = new Date(today.setHours(0, 0, 0, 0));
    endDate = new Date(today.setHours(23, 59, 59, 999));
    subject = `Today's Schedule - ${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
  } else {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    startDate = new Date(tomorrow.setHours(0, 0, 0, 0));
    endDate = new Date(tomorrow.setHours(23, 59, 59, 999));
    subject = `Tomorrow's Appointments - ${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
  }

  try {
    const calendarList = await calendar.calendarList.list();
    const allEvents = [];

    for (const cal of calendarList.data.items) {
      try {
        const response = await calendar.events.list({
          calendarId: cal.id,
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        });
        allEvents.push(...response.data.items);
      } catch (err) {
        // Skip calendars we can't access
      }
    }

    if (allEvents.length === 0) {
      return; // No events, no email needed
    }

    // Categorize and format events
    const categorizer = require('./src/categorizer');
    const eventList = allEvents.map(event => {
      const category = categorizer.categorize(event.summary || '');
      const time = event.start.dateTime
        ? new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : 'All day';
      return { ...event, category, formattedTime: time };
    });

    const html = generateEmailHtml(eventList, type === 'morning' ? 'today' : 'tomorrow');

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass
      }
    });

    await transporter.sendMail({
      from: settings.smtpUser,
      to: settings.recipientEmail,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Failed to send reminder:', error);
  }
}

function generateEmailHtml(events, dayLabel) {
  const categoryColors = {
    work: '#007AFF',
    brand: '#34C759',
    research: '#8E8E93',
    holiday: '#FFCC00',
    date: '#FF69B4',
    seb: '#AF52DE'
  };

  const categoryEmojis = {
    work: '💼',
    brand: '🚀',
    research: '🔬',
    holiday: '🏖️',
    date: '💕',
    seb: '👦'
  };

  const eventsHtml = events.map(event => `
    <div style="padding: 12px; margin: 8px 0; background: #f8f8f8; border-left: 4px solid ${categoryColors[event.category]}; border-radius: 4px;">
      <div style="font-weight: 600; color: #333;">
        ${categoryEmojis[event.category]} ${event.summary || 'No Title'}
      </div>
      <div style="color: #666; font-size: 14px; margin-top: 4px;">
        ${event.formattedTime}${event.location ? ` • ${event.location}` : ''}
      </div>
    </div>
  `).join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; border-bottom: 2px solid #007AFF; padding-bottom: 10px;">
        Your ${dayLabel === 'today' ? "Today's" : "Tomorrow's"} Schedule
      </h2>
      <p style="color: #666;">You have ${events.length} appointment${events.length !== 1 ? 's' : ''} ${dayLabel}:</p>
      ${eventsHtml}
      <p style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
        Sent by Popes Appointment Tracker
      </p>
    </div>
  `;
}
