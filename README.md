# Popes Family Appointment Tracker

A macOS desktop app to track family appointments with Google Calendar integration, automatic color-coding, and email reminders.

## Features

- **Google Calendar Integration** - Syncs with all your Google calendars
- **Weekly/Monthly Views** - Toggle between calendar views
- **Automatic Color-Coding** - Events are categorized by keywords:
  - 💼 **Work** (blue) - meetings, office, client, etc.
  - 🚀 **Building Business** (green) - startup, venture, project, etc.
  - 🏖️ **Holidays** (yellow) - vacation, trip, travel, etc.
  - 💕 **Date Nights** (pink) - date, dinner, romantic, etc.
  - 👦 **Seb** (purple) - school, pickup, practice, doctor, etc.
- **Email Reminders** - Daily morning and evening email summaries

## Quick Start

### 1. Install Dependencies

```bash
cd Popes-AppointmentTracker
npm install
```

### 2. Run the App

```bash
npm start
```

### 3. Set Up Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project named "Popes Appointment Tracker"
3. Enable the **Google Calendar API**
4. Configure OAuth consent screen (External, add your email as test user)
5. Create OAuth 2.0 credentials (Desktop app)
6. Copy Client ID and Client Secret into the app settings

### 4. Connect Your Calendar

1. Click "Connect Google Calendar" in the app
2. Sign in with your Google account
3. Grant calendar read access
4. Your events will appear!

## Building for Distribution

To create a standalone macOS app:

```bash
npm run build
```

The built app will be in the `dist/` folder as:
- `.dmg` installer
- `.zip` archive

## Email Reminders Setup

1. Open Settings in the app
2. Enable email reminders
3. Enter your email address
4. Configure SMTP settings:
   - For Gmail: Use smtp.gmail.com, port 587
   - Create an [App Password](https://myaccount.google.com/apppasswords) for the SMTP password
5. Set reminder times (default: 7am morning, 7pm evening)
6. Click "Send Test Email" to verify

## Project Structure

```
Popes-AppointmentTracker/
├── main.js              # Electron main process
├── preload.js           # Security bridge
├── src/
│   ├── index.html       # App UI
│   ├── styles.css       # Styling
│   ├── renderer.js      # Frontend logic
│   ├── calendar.js      # FullCalendar integration
│   └── categorizer.js   # Event categorization
├── assets/
│   └── icon.icns        # App icon (optional)
└── package.json
```

## Customizing Categories

Edit `src/categorizer.js` to add or modify category keywords:

```javascript
const categories = {
  work: {
    keywords: ['work', 'meeting', 'office', ...],
    color: '#007AFF',
    emoji: '💼'
  },
  // Add your own categories here
};
```

## Troubleshooting

**"Session expired" error**
- Click "Connect Google Calendar" to re-authenticate

**Events not showing**
- Check that you granted calendar read permissions
- Try clicking the refresh button
- Ensure your calendars are visible in Google Calendar

**Email reminders not working**
- Verify SMTP settings are correct
- For Gmail, make sure you're using an App Password, not your regular password
- Check that reminders are enabled in settings
