// Tipos leves via JSDoc (o projeto é JS puro, sem .ts) — só para
// autocomplete/IntelliSense, não afetam o build.

/**
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string|null} full_name
 * @property {string|null} avatar_url
 * @property {string|null} phone
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} slug
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} icon
 * @property {string|null} image_url
 * @property {boolean} featured
 * @property {number} order_index
 */

/**
 * @typedef {'pending'|'active'|'suspended'|'rejected'} BusinessStatus
 */

/**
 * @typedef {Object} Business
 * @property {string} id
 * @property {string|null} owner_id
 * @property {string} slug
 * @property {string} name
 * @property {string|null} subcategory
 * @property {string|null} description
 * @property {string|null} address
 * @property {string|null} neighborhood
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {string|null} phone
 * @property {string|null} whatsapp
 * @property {string|null} email
 * @property {string|null} website
 * @property {string|null} instagram
 * @property {string|null} facebook
 * @property {Object|null} hours
 * @property {'$'|'$$'|'$$$'|'$$$$'|null} price_range
 * @property {BusinessStatus} status
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} BusinessCategory
 * @property {string} business_id
 * @property {string} category_id
 * @property {boolean} is_primary
 */

export {};
