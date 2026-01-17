/**
 * Calendar Module
 * Handles FullCalendar initialization and event display
 */

class CalendarManager {
  constructor() {
    this.calendar = null;
    this.currentView = 'timeGridWeek';
    this.events = [];
  }

  /**
   * Initialize the FullCalendar instance
   */
  init() {
    const calendarEl = document.getElementById('calendar');

    this.calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: this.currentView,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: ''
      },
      height: '100%',
      nowIndicator: true,
      dayMaxEvents: true,
      weekNumbers: false,
      navLinks: true,
      editable: false,
      selectable: false,
      eventDisplay: 'block',
      eventTimeFormat: {
        hour: 'numeric',
        minute: '2-digit',
        meridiem: 'short'
      },
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      allDaySlot: true,
      weekends: true,
      firstDay: 0, // Sunday

      // Event callbacks
      eventDidMount: (info) => {
        // Add tooltip with event details
        info.el.title = `${info.event.title}\n${info.event.extendedProps.location || ''}`;
      },

      eventClick: (info) => {
        this.showEventDetails(info.event);
      },

      // When dates change (navigation), reload events
      datesSet: (dateInfo) => {
        this.loadEvents(dateInfo.start, dateInfo.end);
      }
    });

    this.calendar.render();
  }

  /**
   * Switch between week and month views
   * @param {string} view - 'week' or 'month'
   */
  setView(view) {
    if (view === 'week') {
      this.currentView = 'timeGridWeek';
    } else if (view === 'month') {
      this.currentView = 'dayGridMonth';
    }

    if (this.calendar) {
      this.calendar.changeView(this.currentView);
    }
  }

  /**
   * Load events from Google Calendar
   * @param {Date} start - Start date
   * @param {Date} end - End date
   */
  async loadEvents(start, end) {
    const loadingOverlay = document.getElementById('loading-overlay');

    // Check if authenticated
    const authStatus = await window.electronAPI.checkAuth();
    if (!authStatus.isAuthenticated) {
      return;
    }

    loadingOverlay.classList.remove('hidden');

    try {
      const result = await window.electronAPI.fetchEvents({
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });

      if (result.success) {
        this.displayEvents(result.events);
      } else {
        console.error('Failed to load events:', result.error);
        if (result.error.includes('re-authenticate')) {
          // Token expired, update UI
          document.getElementById('connection-status').classList.remove('connected');
          document.querySelector('.status-text').textContent = 'Session expired';
        }
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      loadingOverlay.classList.add('hidden');
    }
  }

  /**
   * Display events on the calendar
   * @param {Array} events - Array of event objects
   */
  displayEvents(events) {
    // Remove existing events
    this.calendar.removeAllEvents();

    // Add categorized events
    const calendarEvents = events.map(event => {
      const category = window.Categorizer.categorize(event.title);

      return {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        classNames: [`category-${category}`],
        extendedProps: {
          category: category,
          description: event.description,
          location: event.location,
          calendarName: event.calendarName
        }
      };
    });

    this.calendar.addEventSource(calendarEvents);
    this.events = events;
  }

  /**
   * Show event details in a popup/modal
   * @param {object} event - FullCalendar event object
   */
  showEventDetails(event) {
    const category = event.extendedProps.category;
    const emoji = window.Categorizer.getCategoryEmoji(category);
    const color = window.Categorizer.getCategoryColor(category);

    // Format time
    let timeStr = '';
    if (event.allDay) {
      timeStr = 'All day';
    } else {
      const startTime = event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const endTime = event.end ? event.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
      timeStr = endTime ? `${startTime} - ${endTime}` : startTime;
    }

    // Create and show a simple alert for now
    // Could be enhanced with a custom modal
    const details = [
      `${emoji} ${event.title}`,
      ``,
      `Time: ${timeStr}`,
      event.extendedProps.location ? `Location: ${event.extendedProps.location}` : '',
      event.extendedProps.calendarName ? `Calendar: ${event.extendedProps.calendarName}` : '',
      event.extendedProps.description ? `\nDescription: ${event.extendedProps.description}` : ''
    ].filter(Boolean).join('\n');

    alert(details);
  }

  /**
   * Refresh the calendar
   */
  refresh() {
    if (this.calendar) {
      const view = this.calendar.view;
      this.loadEvents(view.activeStart, view.activeEnd);
    }
  }

  /**
   * Navigate to today
   */
  goToToday() {
    if (this.calendar) {
      this.calendar.today();
    }
  }

  /**
   * Get current date range
   * @returns {object} - { start, end }
   */
  getDateRange() {
    if (this.calendar) {
      const view = this.calendar.view;
      return {
        start: view.activeStart,
        end: view.activeEnd
      };
    }
    return null;
  }
}

// Create global instance
window.calendarManager = new CalendarManager();
