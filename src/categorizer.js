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
  brand: {
    keywords: ['writing', 'posting', 'reaching out'],
    color: '#34C759',
    emoji: '🚀'
  },
  research: {
    keywords: ['research', 'study', 'analysis', 'experiment', 'investigation', 'learning', 'course', 'workshop', 'reading', 'explore'],
    color: '#8E8E93',
    emoji: '🔬'
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
 * @returns {string} - The category name ('work', 'brand', 'holiday', 'date', 'seb', or 'research')
 */
function categorize(title) {
  if (!title) return 'research';

  const lowerTitle = title.toLowerCase();

  for (const [category, config] of Object.entries(categories)) {
    for (const keyword of config.keywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return 'research';
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
  return categories.research.color; // Default to research
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
  return categories.research.emoji; // Default to research
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
