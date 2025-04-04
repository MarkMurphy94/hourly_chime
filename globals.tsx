const NOTIFICATION_CHANNEL_ID = 'GC_app_21';
const DEFAULT_SOUND = 'twangy_old_clock_louder.wav'; // Default sound file name
const CHIME_STORAGE_KEY = 'chimes';
const DAYS_STORAGE_KEY = 'days';
const AVAILABLE_SOUNDS = [
    { module: require('./assets/sounds/gong_sounding_clock.mp3'), filename: 'Hourly Chime - gong.mp3' },
    { module: require('./assets/sounds/single_ding.mp3'), filename: 'Hourly Chime - single chime.mp3' },
    { module: require('./assets/sounds/ting_tung.aiff'), filename: 'Hourly Chime - ting tung.aiff' },
    { module: require('./assets/sounds/twangy_old_clock_louder.wav'), filename: 'Hourly Chime - grandfather clock.wav' }
];

export {
    NOTIFICATION_CHANNEL_ID,
    DEFAULT_SOUND,
    CHIME_STORAGE_KEY,
    DAYS_STORAGE_KEY,
    AVAILABLE_SOUNDS
}