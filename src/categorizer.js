/**
 * Event Categorizer
 * Categorizes calendar events based on keywords in their titles
 */

const categories = {
  work: {
    keywords: ['work', 'meeting', 'office', 'client', 'call', 'conference', 'standup', 'review', 'interview', 'presentation'],
    color: '#007AFF',
    emoji: '💼'
  },
  business: {
    keywords: ['business', 'startup', 'venture', 'project', 'investor', 'pitch', 'strategy', 'planning', 'launch', 'growth'],
    color: '#34C759',
    emoji: '🚀'
  },
  holiday: {
    keywords: ['holiday', 'vacation', 'trip', 'travel', 'flight', 'hotel', 'beach', 'resort', 'getaway', 'break'],
    color: '#FFCC00',
    emoji: '🏖️'
  },
  date: {
    keywords: ['date', 'dinner', 'romantic', 'anniversary', 'restaurant', 'movie', 'theatre', 'couples', 'wine', 'spa'],
    color: '#FF69B4',
    emoji: '💕'
  },
  seb: {
    keywords: ['seb', 'sebastian', 'school', 'pickup', 'practice', 'doctor', 'pediatric', 'soccer', 'swimming', 'playdate', 'birthday party', 'recital', 'parent-teacher', 'homework'],
    color: '#AF52DE',
    emoji: '👦'
  }
};

/**
 * Categorize an event based on its title
 * @param {string} title - The event title
 * @returns {string} - The category name ('work', 'business', 'holiday', 'date', 'seb', or 'other')
 */
function categorize(title) {
  if (!title) return 'other';

  const lowerTitle = title.toLowerCase();

  for (const [category, config] of Object.entries(categories)) {
    for (const keyword of config.keywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return 'other';
}

/**
 * Get the color for a category
 * @param {string} category - The category name
 * @returns {string} - The hex color code
 */
function getCategoryColor(category) {
  if (categories[category]) {
    return categories[category].color;
  }
  return '#8E8E93'; // Default gray for 'other'
}

/**
 * Get the emoji for a category
 * @param {string} category - The category name
 * @returns {string} - The emoji
 */
function getCategoryEmoji(category) {
  if (categories[category]) {
    return categories[category].emoji;
  }
  return '📅'; // Default calendar for 'other'
}

/**
 * Get all category information
 * @returns {object} - The categories configuration
 */
function getCategories() {
  return categories;
}

// Export for Node.js (main process)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { categorize, getCategoryColor, getCategoryEmoji, getCategories };
}

// Also make available globally for browser (renderer process)
if (typeof window !== 'undefined') {
  window.Categorizer = { categorize, getCategoryColor, getCategoryEmoji, getCategories };
}
