document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatContainer = document.getElementById('chat-container');
    const sendBtn = document.getElementById('send-btn');
    const voiceModeBtn = document.getElementById('voice-mode-btn');
    const voicePicker = document.getElementById('voice-picker');
    const voicePickerBtn = document.getElementById('voice-picker-btn');
    const voicePickerPanel = document.getElementById('voice-picker-panel');
    const voiceSelect = document.getElementById('voice-select');
    const voicePreviewBtn = document.getElementById('voice-preview-btn');
    const voiceRefreshBtn = document.getElementById('voice-refresh-btn');
    const voicePickerStatus = document.getElementById('voice-picker-status');
    const voicePickerMeta = document.getElementById('voice-picker-meta');
    const micBtn = document.getElementById('mic-btn');
    const statusIndicator = document.getElementById('status-indicator');
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    const historyToggle = document.getElementById('history-toggle');
    const historySidebar = document.getElementById('history-sidebar');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history');
    const newChatBtn = document.getElementById('new-chat-btn'); // New Chat Button

    // Search Modal Elements
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const modalSearchInput = document.getElementById('modal-search-input');
    const searchResultsList = document.getElementById('search-results-list');

    let isProcessing = false;
    let searchHistory = loadSearchHistory();
    let currentConversationId = null;
    let conversationMessages = [];
    let isReplayingConversation = false;
    let voiceConfig = { enabled: false, provider: 'elevenlabs', autoplay_supported: true, default_voice_id: '' };
    let voiceAudio = null;
    let voicePreviewAudio = null;
    let activeVoiceObjectUrl = null;
    let activeVoicePreviewObjectUrl = null;
    let activeVoiceButton = null;
    let activeVoiceMessageIndex = null;
    let activeVoicePlaybackMode = null;
    let activeVoicePreviewMode = null;
    let voiceList = [];
    let voiceListError = '';
    let isLoadingVoices = false;
    let temporaryBrowserVoiceFallback = false;
    let temporaryBrowserVoiceReason = '';
    let browserVoiceFallbackToastShown = false;
    let speechRecognition = null;
    let micListening = false;
    let micPermissionDenied = false;
    let micPermissionGranted = false;
    let micBaseInputValue = '';
    let micFinalTranscript = '';
    let micShouldBeListening = false;
    let micManualStopRequested = false;
    let micRestartTimer = null;
    let micRestartAttempts = 0;
    let micLastError = '';
    const VOICE_MODE_STORAGE_KEY = 'travelPlannerVoiceMode';
    const VOICE_SELECTION_STORAGE_KEY = 'travelPlannerSelectedVoice';
    const BROWSER_VOICE_OPTION_VALUE = '__browser_default__';
    const browserSpeechSupported = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    const speechRecognitionSupported = Boolean(SpeechRecognitionConstructor);
    let voiceModeEnabled = loadVoiceModePreference();
    let selectedVoiceId = loadVoiceSelectionPreference();
    const PLANNER_STORAGE_KEY = 'travelPlannerDraft';
    const plannerStepDefinitions = [
        { title: 'Trip Basics', caption: 'Route, timing, and trip style' },
        { title: 'Travelers', caption: 'Guests, rooms, and support needs' },
        { title: 'Budget & Stay', caption: 'Budget, stay type, and area' },
        { title: 'Preferences', caption: 'Interests, food, and pace' },
        { title: 'Personal Details', caption: 'Optional personalization only' },
        { title: 'Review', caption: 'Check everything before generating' }
    ];
    const cityOptions = [
        'Goa', 'Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata',
        'Pune', 'Jaipur', 'Udaipur', 'Manali', 'Shimla', 'Srinagar', 'Varanasi',
        'Kochi', 'Mysuru', 'Ooty', 'Pondicherry', 'Dubai', 'Singapore', 'Bangkok',
        'Tokyo', 'Seoul', 'Bali', 'Phuket', 'Paris', 'Rome', 'London', 'Barcelona',
        'New York', 'San Francisco'
    ];
    const tripTypeOptions = ['Solo', 'Couple', 'Family', 'Friends', 'Workation'];
    const flexibilityOptions = ['Fixed dates', 'Flexible by 1-2 days', 'Flexible anytime this month'];
    const budgetTypeOptions = ['Economy', 'Standard', 'Premium', 'Luxury'];
    const stayTypeOptions = ['Hotel', 'Resort', 'Hostel', 'Homestay', 'Apartment'];
    const roomPreferenceOptions = ['Single', 'Double', 'Twin', 'Suite'];
    const areaPreferenceOptions = ['Near beach', 'City center', 'Quiet area', 'Near attractions'];
    const mealPreferenceOptions = ['Breakfast included', 'Half board', 'No meal preference'];
    const interestOptions = ['Beaches', 'Food', 'Adventure', 'Nightlife', 'Nature', 'Shopping', 'Culture', 'Relaxation', 'Local experiences'];
    const transportPreferenceOptions = ['Cheapest', 'Fastest', 'Balanced', 'Flight preferred', 'Train preferred', 'Bus preferred'];
    const bookingModeOptions = ['Show both flights and trains', 'Flights only', 'Trains only', 'Best available option'];
    const paceOptions = ['Relaxed', 'Balanced', 'Packed'];
    const foodPreferenceOptions = ['Vegetarian', 'Non-vegetarian', 'Vegan', 'Jain', 'Seafood', 'No preference'];
    const languageOptions = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese'];
    const currencyOptions = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
    const genderOptions = ['Prefer not to say', 'Female', 'Male', 'Non-binary'];
    const ageGroupOptions = ['Under 18', '18-24', '25-34', '35-49', '50+'];
    const visaStatusOptions = ['Not required', 'Already have visa', 'Need visa guidance', 'Not sure'];
    const INDIA_COUNTRY_NAME = 'India';
    const cityCountryMap = {
        'goa': INDIA_COUNTRY_NAME,
        'delhi': INDIA_COUNTRY_NAME,
        'mumbai': INDIA_COUNTRY_NAME,
        'bengaluru': INDIA_COUNTRY_NAME,
        'bangalore': INDIA_COUNTRY_NAME,
        'hyderabad': INDIA_COUNTRY_NAME,
        'chennai': INDIA_COUNTRY_NAME,
        'kolkata': INDIA_COUNTRY_NAME,
        'pune': INDIA_COUNTRY_NAME,
        'jaipur': INDIA_COUNTRY_NAME,
        'udaipur': INDIA_COUNTRY_NAME,
        'manali': INDIA_COUNTRY_NAME,
        'shimla': INDIA_COUNTRY_NAME,
        'srinagar': INDIA_COUNTRY_NAME,
        'varanasi': INDIA_COUNTRY_NAME,
        'kochi': INDIA_COUNTRY_NAME,
        'cochin': INDIA_COUNTRY_NAME,
        'mysuru': INDIA_COUNTRY_NAME,
        'mysore': INDIA_COUNTRY_NAME,
        'ooty': INDIA_COUNTRY_NAME,
        'pondicherry': INDIA_COUNTRY_NAME,
        'puducherry': INDIA_COUNTRY_NAME,
        'dubai': 'United Arab Emirates',
        'singapore': 'Singapore',
        'bangkok': 'Thailand',
        'tokyo': 'Japan',
        'seoul': 'South Korea',
        'bali': 'Indonesia',
        'phuket': 'Thailand',
        'paris': 'France',
        'rome': 'Italy',
        'london': 'United Kingdom',
        'barcelona': 'Spain',
        'new york': 'United States',
        'san francisco': 'United States'
    };
    const countryAliases = {
        'india': INDIA_COUNTRY_NAME,
        'ind': INDIA_COUNTRY_NAME,
        'uae': 'United Arab Emirates',
        'u.a.e': 'United Arab Emirates',
        'united arab emirates': 'United Arab Emirates',
        'singapore': 'Singapore',
        'thailand': 'Thailand',
        'japan': 'Japan',
        'south korea': 'South Korea',
        'korea': 'South Korea',
        'republic of korea': 'South Korea',
        'indonesia': 'Indonesia',
        'france': 'France',
        'italy': 'Italy',
        'uk': 'United Kingdom',
        'u.k.': 'United Kingdom',
        'united kingdom': 'United Kingdom',
        'great britain': 'United Kingdom',
        'britain': 'United Kingdom',
        'spain': 'Spain',
        'usa': 'United States',
        'u.s.a': 'United States',
        'us': 'United States',
        'u.s.': 'United States',
        'united states': 'United States',
        'united states of america': 'United States'
    };
    let plannerState = loadPlannerDraft();
    let activePlannerStep = loadPlannerStep();

    function getDefaultPlannerState() {
        return {
            trip_details: {
                origin_city: '',
                destination_city: '',
                departure_date: '',
                date_mode: 'duration',
                return_date: '',
                duration_days: 5,
                trip_type: 'Couple',
                flexibility: 'Fixed dates'
            },
            travelers: {
                adults: 2,
                children: 0,
                rooms: 1,
                child_ages: [],
                senior_citizen: false,
                accessible_needs: false
            },
            stay_preferences: {
                budget_total: 40000,
                budget_type: 'Standard',
                stay_type: 'Hotel',
                room_preference: 'Double',
                area_preference: 'Near beach',
                meal_preference: 'Breakfast included'
            },
            transport_preferences: {
                preference: 'Balanced',
                pace: 'Balanced',
                booking_mode: 'Show both flights and trains'
            },
            interests: {
                activities: ['Beaches', 'Food'],
                food_preferences: ['No preference']
            },
            personal_info: {
                enabled: false,
                full_name: '',
                email: '',
                phone: '',
                home_city: '',
                preferred_language: 'English',
                preferred_currency: 'INR',
                gender: 'Prefer not to say',
                age_group: '25-34',
                emergency_contact_name: '',
                emergency_contact_phone: '',
                traveler_notes: ''
            },
            document_verification: {
                authorized: false,
                passport_verification: true,
                visa_verification: true,
                passport_number: '',
                passport_expiry_date: '',
                visa_status: 'Not sure',
                visa_expiry_date: '',
                destination_country: ''
            },
            special_requirements: {
                notes: ''
            }
        };
    }

    function normalizePlannerState(savedState) {
        const defaults = getDefaultPlannerState();
        const raw = savedState || {};
        return syncPlannerDerivedState({
            ...defaults,
            ...raw,
            trip_details: { ...defaults.trip_details, ...(raw.trip_details || {}) },
            travelers: { ...defaults.travelers, ...(raw.travelers || {}) },
            stay_preferences: { ...defaults.stay_preferences, ...(raw.stay_preferences || {}) },
            transport_preferences: { ...defaults.transport_preferences, ...(raw.transport_preferences || {}) },
            interests: { ...defaults.interests, ...(raw.interests || {}) },
            personal_info: { ...defaults.personal_info, ...(raw.personal_info || {}) },
            document_verification: { ...defaults.document_verification, ...(raw.document_verification || {}) },
            special_requirements: { ...defaults.special_requirements, ...(raw.special_requirements || {}) }
        });
    }

    function loadPlannerDraft() {
        try {
            const saved = localStorage.getItem(PLANNER_STORAGE_KEY);
            if (!saved) return getDefaultPlannerState();
            const parsed = JSON.parse(saved);
            return normalizePlannerState(parsed.plannerState || parsed);
        } catch (error) {
            console.error('Error loading planner draft:', error);
            return getDefaultPlannerState();
        }
    }

    function loadPlannerStep() {
        try {
            const saved = localStorage.getItem(PLANNER_STORAGE_KEY);
            if (!saved) return 0;
            const parsed = JSON.parse(saved);
            const step = Number(parsed.activePlannerStep);
            if (Number.isFinite(step) && step >= 0 && step < plannerStepDefinitions.length) {
                return step;
            }
        } catch (error) {
            console.error('Error loading planner step:', error);
        }
        return 0;
    }

    function loadVoiceModePreference() {
        try {
            return localStorage.getItem(VOICE_MODE_STORAGE_KEY) === 'true';
        } catch (error) {
            console.error('Error loading voice mode preference:', error);
            return false;
        }
    }

    function persistVoiceModePreference() {
        try {
            localStorage.setItem(VOICE_MODE_STORAGE_KEY, String(voiceModeEnabled));
        } catch (error) {
            console.error('Error saving voice mode preference:', error);
        }
    }

    function loadVoiceSelectionPreference() {
        try {
            return localStorage.getItem(VOICE_SELECTION_STORAGE_KEY) || '';
        } catch (error) {
            console.error('Error loading voice selection:', error);
            return '';
        }
    }

    function persistVoiceSelectionPreference() {
        try {
            if (selectedVoiceId) {
                localStorage.setItem(VOICE_SELECTION_STORAGE_KEY, selectedVoiceId);
            } else {
                localStorage.removeItem(VOICE_SELECTION_STORAGE_KEY);
            }
        } catch (error) {
            console.error('Error saving voice selection:', error);
        }
    }

    function isBrowserVoiceSelected() {
        return selectedVoiceId === BROWSER_VOICE_OPTION_VALUE;
    }

    function getVoiceButtonIconMarkup(isPlaying = false) {
        if (isPlaying) {
            return `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                </svg>
            `;
        }

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.5 8.5a5 5 0 0 1 0 7"></path>
            </svg>
        `;
    }

    function getEffectiveVoiceId() {
        if (isBrowserVoiceSelected()) {
            return '';
        }
        return String(selectedVoiceId || voiceConfig.default_voice_id || '').trim();
    }

    function canUseElevenLabsPlayback() {
        return Boolean(!isBrowserVoiceSelected() && voiceConfig.enabled && getEffectiveVoiceId());
    }

    function canUseBrowserSpeechPlayback() {
        return Boolean(browserSpeechSupported);
    }

    function canUseVoicePlayback() {
        return Boolean(canUseElevenLabsPlayback() || canUseBrowserSpeechPlayback());
    }

    function shouldUseTemporaryBrowserFallback() {
        return Boolean(temporaryBrowserVoiceFallback && canUseBrowserSpeechPlayback() && !isBrowserVoiceSelected());
    }

    function getPreferredVoiceProvider() {
        if (isBrowserVoiceSelected()) {
            return canUseBrowserSpeechPlayback() ? 'browser' : 'none';
        }
        if (shouldUseTemporaryBrowserFallback()) {
            return 'browser';
        }
        if (canUseElevenLabsPlayback()) {
            return 'elevenlabs';
        }
        if (canUseBrowserSpeechPlayback()) {
            return 'browser';
        }
        return 'none';
    }

    function getSelectedVoice() {
        if (isBrowserVoiceSelected()) {
            return null;
        }
        const effectiveVoiceId = getEffectiveVoiceId();
        if (!effectiveVoiceId) {
            return null;
        }

        return voiceList.find(voice => voice.voice_id === effectiveVoiceId) || null;
    }

    function getBrowserSpeechVoice() {
        if (!browserSpeechSupported) {
            return null;
        }

        const voices = window.speechSynthesis.getVoices();
        return (
            voices.find(voice => voice.default) ||
            voices.find(voice => /^en(-|_)/i.test(voice.lang || '')) ||
            voices[0] ||
            null
        );
    }

    function getBrowserVoiceSummary() {
        const browserVoice = getBrowserSpeechVoice();
        if (!browserVoice) {
            return 'Device default voice';
        }

        return `${browserVoice.name} (${browserVoice.lang || 'default'})`;
    }

    function prepareTextForBrowserSpeech(text, maxChars = 2500) {
        const normalized = String(text || '')
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
            .replace(/https?:\/\/\S+/g, ' ')
            .replace(/Ã¢â‚¬Â¢|â€¢/g, ', ')
            .replace(/->/g, ' to ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!normalized) {
            throw new Error('No speakable text was provided.');
        }

        if (normalized.length > maxChars) {
            return `${normalized.slice(0, maxChars - 3).trim()}...`;
        }

        return normalized;
    }

    function resetTemporaryBrowserFallback() {
        temporaryBrowserVoiceFallback = false;
        temporaryBrowserVoiceReason = '';
        browserVoiceFallbackToastShown = false;
    }

    function activateTemporaryBrowserFallback(reason = '') {
        if (!canUseBrowserSpeechPlayback()) {
            return;
        }

        temporaryBrowserVoiceFallback = true;
        temporaryBrowserVoiceReason = reason || '';
        renderVoicePicker();
        updateVoiceModeButton();
        updateAllMessageVoiceButtons();
    }

    function maybeShowBrowserFallbackToast() {
        if (!canUseBrowserSpeechPlayback() || browserVoiceFallbackToastShown) {
            return;
        }

        browserVoiceFallbackToastShown = true;
        showToast('ElevenLabs is unavailable right now. Using your device voice instead.');
    }

    function updateMicButton() {
        if (!micBtn) {
            return;
        }

        const label = micBtn.querySelector('.mic-btn-label');
        const disabled = isProcessing || !speechRecognitionSupported;
        micBtn.disabled = disabled;
        micBtn.classList.toggle('is-listening', micListening);
        micBtn.setAttribute('aria-pressed', micListening ? 'true' : 'false');
        micBtn.title = !speechRecognitionSupported
            ? 'Speech input is not supported in this browser'
            : (micListening ? 'Stop microphone input' : 'Speak your message');

        if (label) {
            label.textContent = !speechRecognitionSupported
                ? 'Mic off'
                : (micListening ? 'Listening' : 'Mic');
        }
    }

    function clearMicRestartTimer() {
        if (micRestartTimer) {
            clearTimeout(micRestartTimer);
            micRestartTimer = null;
        }
    }

    function resetSpeechRecognitionInstance() {
        if (!speechRecognition) {
            return;
        }

        try {
            speechRecognition.onstart = null;
            speechRecognition.onresult = null;
            speechRecognition.onerror = null;
            speechRecognition.onend = null;
            try {
                speechRecognition.abort();
            } catch (error) {
                console.error('Error aborting speech recognition during reset:', error);
            }
        } finally {
            speechRecognition = null;
        }
    }

    function scheduleMicRestart(reason = '') {
        if (!speechRecognitionSupported || !micShouldBeListening || isProcessing) {
            return;
        }

        const fatalErrors = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']);
        if (fatalErrors.has(reason)) {
            return;
        }

        if (micRestartAttempts >= 3) {
            micShouldBeListening = false;
            micManualStopRequested = false;
            updateMicButton();
            showToast(
                reason === 'network'
                    ? 'Microphone connection dropped. Tap the mic to continue.'
                    : 'Microphone paused. Tap the mic to continue.'
            );
            return;
        }

        clearMicRestartTimer();
        micRestartAttempts += 1;
        const delayMs = reason === 'network'
            ? Math.min(2200, 700 + (micRestartAttempts * 450))
            : (reason === 'no-speech' ? 300 : 450);
        micRestartTimer = window.setTimeout(() => {
            if (!micShouldBeListening || isProcessing) {
                return;
            }

            try {
                if (!speechRecognition || reason === 'network') {
                    resetSpeechRecognitionInstance();
                    initializeSpeechRecognition();
                }
                if (!speechRecognition) {
                    throw new Error('Speech recognition is unavailable.');
                }
                micManualStopRequested = false;
                speechRecognition.lang = document.documentElement.lang || navigator.language || 'en-US';
                speechRecognition.start();
            } catch (error) {
                console.error('Error restarting speech recognition:', error);
                micShouldBeListening = false;
                resetSpeechRecognitionInstance();
                updateMicButton();
                showToast('Microphone could not restart. Tap the mic and try again.');
            }
        }, delayMs);
    }

    function stopMicCapture(options = {}) {
        const { keepTranscript = true, immediate = false } = options;

        micShouldBeListening = false;
        micManualStopRequested = true;
        clearMicRestartTimer();

        if (speechRecognition && micListening) {
            try {
                if (immediate) {
                    speechRecognition.abort();
                } else {
                    speechRecognition.stop();
                }
            } catch (error) {
                console.error('Error stopping speech recognition:', error);
            }
        }

        micListening = false;
        if (!keepTranscript) {
            micFinalTranscript = '';
        }
        micRestartAttempts = 0;
        micLastError = '';
        updateMicButton();
    }

    async function ensureMicrophonePermission() {
        if (micPermissionGranted) {
            return true;
        }

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            return true;
        }

        try {
            if (navigator.permissions && typeof navigator.permissions.query === 'function') {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                if (permissionStatus.state === 'granted') {
                    micPermissionGranted = true;
                    micPermissionDenied = false;
                    return true;
                }
                if (permissionStatus.state === 'denied') {
                    micPermissionDenied = true;
                    showToast('Microphone permission is blocked. Allow mic access in your browser settings.');
                    return false;
                }
            }
        } catch (error) {
            console.error('Error checking microphone permission:', error);
        }

        try {
            showToast('Allow microphone access in your browser to use voice input.');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            micPermissionGranted = true;
            micPermissionDenied = false;
            return true;
        } catch (error) {
            console.error('Error requesting microphone permission:', error);

            const errorName = String(error?.name || '');
            if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || errorName === 'SecurityError') {
                micPermissionDenied = true;
                showToast('Microphone permission was blocked. Allow mic access in your browser settings.');
                return false;
            }

            if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError' || errorName === 'OverconstrainedError') {
                showToast('No microphone was detected on this device.');
                return false;
            }

            if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
                showToast('Your microphone is busy in another app. Close that app and try again.');
                return false;
            }

            showToast('Microphone access could not be started. Please check your browser microphone settings.');
            return false;
        }
    }

    function applyMicTranscript(interimTranscript = '') {
        const prefix = micBaseInputValue.trim();
        const spoken = `${micFinalTranscript} ${interimTranscript}`.trim();

        if (prefix && spoken) {
            userInput.value = `${prefix} ${spoken}`.replace(/\s+/g, ' ').trim();
            return;
        }

        userInput.value = prefix || spoken;
    }

    function initializeSpeechRecognition() {
        if (!speechRecognitionSupported || speechRecognition) {
            return;
        }

        speechRecognition = new SpeechRecognitionConstructor();
        speechRecognition.lang = document.documentElement.lang || navigator.language || 'en-US';
        speechRecognition.interimResults = true;
        speechRecognition.continuous = false;
        speechRecognition.maxAlternatives = 1;

        speechRecognition.onstart = () => {
            micPermissionDenied = false;
            micPermissionGranted = true;
            micLastError = '';
            micListening = true;
            clearMicRestartTimer();
            updateMicButton();
        };

        speechRecognition.onresult = (event) => {
            let interimTranscript = '';

            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const transcript = String(event.results[index][0]?.transcript || '').trim();
                if (!transcript) {
                    continue;
                }

                if (event.results[index].isFinal) {
                    micFinalTranscript = `${micFinalTranscript} ${transcript}`.trim();
                } else {
                    interimTranscript = `${interimTranscript} ${transcript}`.trim();
                }
            }

            micRestartAttempts = 0;
            applyMicTranscript(interimTranscript);
        };

        speechRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            micLastError = event.error || '';

            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                micPermissionDenied = true;
                stopMicCapture({ keepTranscript: true, immediate: true });
                showToast('Microphone permission was blocked. Allow mic access in your browser settings.');
                return;
            }

            if (event.error === 'no-speech') {
                return;
            }

            if (event.error === 'audio-capture') {
                stopMicCapture({ keepTranscript: true, immediate: true });
                showToast('No microphone was detected on this device.');
                return;
            }

            if (event.error === 'language-not-supported') {
                stopMicCapture({ keepTranscript: true, immediate: true });
                showToast('This browser does not support microphone dictation for the current language.');
                return;
            }

            if (event.error === 'aborted') {
                if (micManualStopRequested || isProcessing) {
                    return;
                }
                return;
            }

            if (event.error === 'network') {
                return;
            }

            if (micShouldBeListening) {
                return;
            }

            stopMicCapture({ keepTranscript: true, immediate: true });
            showToast('Microphone input could not continue. Please try again.');
        };

        speechRecognition.onend = () => {
            micListening = false;
            updateMicButton();
            userInput.focus();
            if (micShouldBeListening && !micManualStopRequested && !isProcessing) {
                scheduleMicRestart(micLastError);
                return;
            }
            micManualStopRequested = false;
            micRestartAttempts = 0;
        };
    }

    async function startMicCapture() {
        if (!speechRecognitionSupported) {
            showToast('Speech input is not supported in this browser.');
            return;
        }

        if (isProcessing) {
            showToast('Wait for the current reply before using the microphone.');
            return;
        }

        const hasPermission = await ensureMicrophonePermission();
        if (!hasPermission) {
            updateMicButton();
            return;
        }

        initializeSpeechRecognition();
        if (!speechRecognition) {
            showToast('Speech input is not available right now.');
            return;
        }

        clearMicRestartTimer();
        micShouldBeListening = true;
        micManualStopRequested = false;
        micRestartAttempts = 0;
        micLastError = '';
        micBaseInputValue = userInput.value.trim();
        micFinalTranscript = '';
        stopVoicePlayback();
        stopVoicePreview();

        try {
            speechRecognition.lang = document.documentElement.lang || navigator.language || 'en-US';
            speechRecognition.start();
            if (!micPermissionDenied) {
                showToast('Listening. Speak naturally and tap the mic again when you are done.');
            }
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            micShouldBeListening = false;
            micManualStopRequested = false;
            resetSpeechRecognitionInstance();
            updateMicButton();
            showToast('Microphone input could not start. Please try again.');
        }
    }

    function startBrowserSpeech(text, options = {}) {
        const { mode = 'message', messageIndex = null } = options;

        if (!canUseBrowserSpeechPlayback()) {
            throw new Error('Browser voice is not supported in this browser.');
        }

        const normalizedText = prepareTextForBrowserSpeech(text);
        const utterance = new SpeechSynthesisUtterance(normalizedText);
        const browserVoice = getBrowserSpeechVoice();

        if (browserVoice) {
            utterance.voice = browserVoice;
            utterance.lang = browserVoice.lang;
        }

        utterance.rate = 1;
        utterance.onend = () => {
            if (mode === 'preview') {
                stopVoicePreview();
            } else {
                stopVoicePlayback();
            }
        };
        utterance.onerror = () => {
            if (mode === 'preview') {
                stopVoicePreview();
                showToast('Browser voice preview failed.');
            } else {
                stopVoicePlayback();
                showToast('Browser voice playback failed.');
            }
        };

        window.speechSynthesis.cancel();

        if (mode === 'preview') {
            activeVoicePreviewMode = 'browser';
            updateVoicePreviewButton();
        } else {
            activeVoicePlaybackMode = 'browser';
            activeVoiceMessageIndex = messageIndex;
            updateAllMessageVoiceButtons();
        }

        window.speechSynthesis.speak(utterance);
    }

    function formatVoiceOptionLabel(voice) {
        const traits = [voice.category, voice.gender, voice.accent].filter(Boolean);
        const suffix = voice.is_default ? ' - Default' : '';
        return `${voice.name}${traits.length ? ` (${traits.join(', ')})` : ''}${suffix}`;
    }

    function formatVoiceMeta(voice) {
        if (!voice) {
            return '';
        }

        const traits = [voice.category, voice.gender, voice.accent, voice.age].filter(Boolean);
        const metaParts = [];
        if (traits.length) {
            metaParts.push(traits.join(' / '));
        }
        if (voice.description) {
            metaParts.push(voice.description);
        }
        return metaParts.join(' - ');
    }

    function appendVoiceOption(selectElement, value, label, { disabled = false } = {}) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.disabled = disabled;
        selectElement.appendChild(option);
    }

    function closeVoicePicker() {
        if (!voicePickerPanel || voicePickerPanel.hidden) {
            return;
        }

        voicePickerPanel.hidden = true;
        if (voicePickerBtn) {
            voicePickerBtn.classList.remove('is-active');
            voicePickerBtn.setAttribute('aria-expanded', 'false');
        }
    }

    function openVoicePicker() {
        if (!voicePickerPanel || (!voiceConfig.enabled && !canUseBrowserSpeechPlayback())) {
            return;
        }

        voicePickerPanel.hidden = false;
        if (voicePickerBtn) {
            voicePickerBtn.classList.add('is-active');
            voicePickerBtn.setAttribute('aria-expanded', 'true');
        }
        if (voiceSelect) {
            requestAnimationFrame(() => voiceSelect.focus());
        }
    }

    function updateVoicePreviewButton() {
        if (!voicePreviewBtn) {
            return;
        }

        const isPlaying = Boolean(
            (voicePreviewAudio && !voicePreviewAudio.paused) ||
            (activeVoicePreviewMode === 'browser' && browserSpeechSupported && window.speechSynthesis.speaking)
        );
        const canPreview = Boolean(canUseVoicePlayback() || getSelectedVoice()?.preview_url);

        voicePreviewBtn.disabled = !canPreview;
        voicePreviewBtn.classList.toggle('is-playing', isPlaying);
        voicePreviewBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
        voicePreviewBtn.textContent = isPlaying ? 'Stop preview' : 'Preview';
        voicePreviewBtn.title = canPreview
            ? (isPlaying ? 'Stop preview playback' : 'Preview the selected voice')
            : 'Voice preview is unavailable in this browser';
    }

    function renderVoicePicker() {
        const effectiveVoiceId = getEffectiveVoiceId();
        const selectedVoice = getSelectedVoice();
        const hasVoiceList = voiceList.length > 0;
        const canOpenVoiceSettings = Boolean(voiceConfig.enabled || canUseBrowserSpeechPlayback());
        const usingBrowserVoice = getPreferredVoiceProvider() === 'browser';
        const browserVoiceSummary = getBrowserVoiceSummary();
        const browserOptionLabel = `Device voice (${browserVoiceSummary})`;

        if (voicePickerBtn) {
            const label = voicePickerBtn.querySelector('.voice-picker-label');
            voicePickerBtn.disabled = !canOpenVoiceSettings;
            voicePickerBtn.title = canOpenVoiceSettings
                ? 'Voice settings'
                : 'Voice is unavailable in this browser';
            if (label) {
                if (isBrowserVoiceSelected() || (usingBrowserVoice && !canUseElevenLabsPlayback())) {
                    label.textContent = 'Device voice';
                } else if (selectedVoice) {
                    label.textContent = selectedVoice.name;
                } else if (effectiveVoiceId) {
                    label.textContent = 'Configured voice';
                } else if (isLoadingVoices) {
                    label.textContent = 'Loading voices';
                } else {
                    label.textContent = 'Pick voice';
                }
            }
        }

        if (voiceSelect) {
            voiceSelect.innerHTML = '';

            if (browserSpeechSupported) {
                appendVoiceOption(voiceSelect, BROWSER_VOICE_OPTION_VALUE, browserOptionLabel);
            }

            if (!voiceConfig.enabled && !browserSpeechSupported) {
                appendVoiceOption(voiceSelect, '', 'Voice is unavailable', { disabled: true });
                voiceSelect.disabled = true;
            } else if (isLoadingVoices && !voiceConfig.enabled) {
                appendVoiceOption(voiceSelect, '', 'Loading voices...', { disabled: true });
                voiceSelect.disabled = true;
            } else {
                if (!effectiveVoiceId && !isBrowserVoiceSelected() && voiceConfig.enabled) {
                    appendVoiceOption(voiceSelect, '', 'Choose a voice', { disabled: false });
                }

                if (effectiveVoiceId && !voiceList.some(voice => voice.voice_id === effectiveVoiceId)) {
                    appendVoiceOption(
                        voiceSelect,
                        effectiveVoiceId,
                        selectedVoiceId ? 'Saved voice selection' : 'Configured default voice'
                    );
                }

                voiceList.forEach(voice => {
                    appendVoiceOption(voiceSelect, voice.voice_id, formatVoiceOptionLabel(voice));
                });

                voiceSelect.disabled = !browserSpeechSupported && !hasVoiceList && !effectiveVoiceId;
                voiceSelect.value = isBrowserVoiceSelected()
                    ? BROWSER_VOICE_OPTION_VALUE
                    : (effectiveVoiceId || (browserSpeechSupported && !voiceConfig.enabled ? BROWSER_VOICE_OPTION_VALUE : ''));
            }
        }

        if (voicePickerStatus) {
            if (isBrowserVoiceSelected()) {
                voicePickerStatus.textContent = 'Using your device voice. This works even when ElevenLabs is unavailable.';
            } else if (temporaryBrowserVoiceFallback) {
                voicePickerStatus.textContent = 'ElevenLabs is unavailable right now, so the app will use your device voice automatically.';
            } else if (!voiceConfig.enabled && browserSpeechSupported) {
                voicePickerStatus.textContent = 'ElevenLabs is not configured, but your browser voice is ready to use.';
            } else if (!voiceConfig.enabled) {
                voicePickerStatus.textContent = 'Add ELEVENLABS_API_KEY to load account voices.';
            } else if (isLoadingVoices) {
                voicePickerStatus.textContent = 'Loading voices from ElevenLabs...';
            } else if (voiceListError) {
                voicePickerStatus.textContent = browserSpeechSupported
                    ? `${voiceListError} The app can still use your device voice.`
                    : voiceListError;
            } else if (browserSpeechSupported && canUseElevenLabsPlayback()) {
                voicePickerStatus.textContent = 'Automatic mode uses ElevenLabs first and falls back to your device voice if needed.';
            } else if (selectedVoice) {
                voicePickerStatus.textContent = selectedVoiceId
                    ? `Selected voice: ${selectedVoice.name}`
                    : `Using project default voice: ${selectedVoice.name}`;
            } else if (effectiveVoiceId) {
                voicePickerStatus.textContent = selectedVoiceId
                    ? 'Using your saved voice selection.'
                    : 'Using the project default voice from .env.';
            } else if (hasVoiceList) {
                voicePickerStatus.textContent = 'Choose a voice for previews and assistant playback.';
            } else {
                voicePickerStatus.textContent = 'No voices were returned for this ElevenLabs account.';
            }
        }

        if (voicePickerMeta) {
            const metaText = selectedVoice
                ? formatVoiceMeta(selectedVoice)
                : ([browserSpeechSupported ? browserVoiceSummary : '', temporaryBrowserVoiceReason].filter(Boolean).join(' - '));
            voicePickerMeta.hidden = !metaText;
            voicePickerMeta.textContent = metaText;
        }

        if (voiceRefreshBtn) {
            voiceRefreshBtn.disabled = (!voiceConfig.enabled && !browserSpeechSupported) || isLoadingVoices;
            voiceRefreshBtn.textContent = isLoadingVoices ? 'Refreshing...' : 'Refresh';
        }

        updateVoicePreviewButton();
    }

    async function getResponseErrorMessage(response, fallbackMessage) {
        try {
            const payload = await response.json();
            if (payload?.detail) {
                return payload.detail;
            }
        } catch (error) {
            console.error('Error parsing response payload:', error);
        }
        return fallbackMessage;
    }

    function updateVoiceModeButton() {
        if (!voiceModeBtn) return;

        const label = voiceModeBtn.querySelector('.voice-mode-label');
        const enabled = canUseVoicePlayback() && voiceModeEnabled;
        voiceModeBtn.disabled = !canUseVoicePlayback();
        voiceModeBtn.classList.toggle('is-active', enabled);
        voiceModeBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        voiceModeBtn.title = !canUseVoicePlayback()
            ? 'Voice is unavailable in this browser'
            : (enabled ? 'Assistant voice is on for new replies' : 'Turn on assistant voice for new replies');
        if (label) {
            label.textContent = !canUseVoicePlayback()
                ? 'Voice unavailable'
                : (enabled ? 'Voice on' : 'Voice off');
        }
    }

    function updateMessageVoiceButton(button) {
        if (!button) return;

        const messageIndex = Number(button.dataset.voiceMessageIndex);
        const message = conversationMessages[messageIndex];
        const isSpeakable = canUseVoicePlayback() && message && message.role === 'assistant' && Boolean((message.content || '').trim());
        const isPlaying = isSpeakable && activeVoiceMessageIndex === messageIndex && (
            (voiceAudio && !voiceAudio.paused) ||
            (activeVoicePlaybackMode === 'browser' && browserSpeechSupported && window.speechSynthesis.speaking)
        );

        button.disabled = !isSpeakable;
        button.classList.toggle('is-playing', Boolean(isPlaying));
        button.setAttribute('aria-label', isPlaying ? 'Stop voice playback' : 'Play assistant voice');
        button.title = !canUseVoicePlayback()
            ? 'Voice is unavailable in this browser'
            : (isPlaying ? 'Stop voice playback' : 'Play this reply as audio');
        button.innerHTML = getVoiceButtonIconMarkup(Boolean(isPlaying));
    }

    function updateAllMessageVoiceButtons() {
        document.querySelectorAll('.message-voice-btn').forEach(button => updateMessageVoiceButton(button));
    }

    async function initializeVoiceConfig() {
        try {
            const response = await fetch('/api/voice/config');
            if (!response.ok) {
                throw new Error(`Voice config failed: ${response.status}`);
            }
            voiceConfig = await response.json();
        } catch (error) {
            console.error('Error loading voice config:', error);
            voiceConfig = { enabled: false, provider: 'elevenlabs', autoplay_supported: true, default_voice_id: '' };
        }

        renderVoicePicker();
        updateVoiceModeButton();
        updateAllMessageVoiceButtons();

        if (!voiceConfig.enabled && !browserSpeechSupported) {
            stopVoicePlayback();
            stopVoicePreview();
            closeVoicePicker();
            return;
        }

        if (voiceConfig.enabled) {
            await loadAvailableVoices();
        }
    }

    function stopVoicePlayback() {
        if (browserSpeechSupported && activeVoicePlaybackMode === 'browser' && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
            window.speechSynthesis.cancel();
        }
        if (voiceAudio) {
            voiceAudio.pause();
            voiceAudio.src = '';
            voiceAudio = null;
        }
        if (activeVoiceObjectUrl) {
            URL.revokeObjectURL(activeVoiceObjectUrl);
            activeVoiceObjectUrl = null;
        }
        activeVoiceMessageIndex = null;
        activeVoiceButton = null;
        activeVoicePlaybackMode = null;
        updateAllMessageVoiceButtons();
    }

    function stopVoicePreview() {
        if (browserSpeechSupported && activeVoicePreviewMode === 'browser' && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
            window.speechSynthesis.cancel();
        }
        if (voicePreviewAudio) {
            voicePreviewAudio.pause();
            voicePreviewAudio.src = '';
            voicePreviewAudio = null;
        }
        if (activeVoicePreviewObjectUrl) {
            URL.revokeObjectURL(activeVoicePreviewObjectUrl);
            activeVoicePreviewObjectUrl = null;
        }
        activeVoicePreviewMode = null;
        updateVoicePreviewButton();
    }

    async function loadAvailableVoices(options = {}) {
        const { showFeedback = false } = options;

        if (!voiceConfig.enabled) {
            voiceList = [];
            voiceListError = '';
            renderVoicePicker();
            return;
        }

        if (showFeedback) {
            resetTemporaryBrowserFallback();
        }
        isLoadingVoices = true;
        voiceListError = '';
        renderVoicePicker();

        try {
            const response = await fetch('/api/voice/voices');
            if (!response.ok) {
                throw new Error(await getResponseErrorMessage(response, 'Could not load ElevenLabs voices.'));
            }

            const payload = await response.json();
            voiceList = Array.isArray(payload) ? payload : [];

            if (!selectedVoiceId && !voiceConfig.default_voice_id && voiceList.length === 1) {
                selectedVoiceId = voiceList[0].voice_id || '';
                persistVoiceSelectionPreference();
            }

            if (showFeedback) {
                showToast(voiceList.length ? 'ElevenLabs voices refreshed.' : 'No ElevenLabs voices were returned.');
            }
        } catch (error) {
            console.error('Error loading ElevenLabs voices:', error);
            voiceList = [];
            voiceListError = error.message || 'Could not load ElevenLabs voices.';
            if (showFeedback) {
                showToast(voiceListError);
            }
        } finally {
            isLoadingVoices = false;
            renderVoicePicker();
            updateVoiceModeButton();
            updateAllMessageVoiceButtons();
        }
    }

    function findAdjacentAssistantMessageContent(messageIndex, direction) {
        for (let cursor = messageIndex + direction; cursor >= 0 && cursor < conversationMessages.length; cursor += direction) {
            const message = conversationMessages[cursor];
            if (message?.role === 'assistant' && message.content) {
                return message.content;
            }
        }
        return '';
    }

    function shouldAutoPlayAssistantVoice(content) {
        return Boolean(
            canUseVoicePlayback() &&
            voiceModeEnabled &&
            !isReplayingConversation &&
            content &&
            !content.startsWith('Error:')
        );
    }

    async function speakConversationMessage(messageIndex, button, options = {}) {
        const { suppressUnavailableToast = false } = options;
        const message = conversationMessages[messageIndex];
        if (!message || message.role !== 'assistant' || !message.content) {
            return;
        }

        if (!canUseVoicePlayback()) {
            if (!suppressUnavailableToast) {
                showToast('Voice is unavailable in this browser.');
            }
            return;
        }

        const isCurrentlyPlaying = activeVoiceMessageIndex === messageIndex && (
            (voiceAudio && !voiceAudio.paused) ||
            (activeVoicePlaybackMode === 'browser' && browserSpeechSupported && window.speechSynthesis.speaking)
        );
        if (isCurrentlyPlaying) {
            stopVoicePlayback();
            return;
        }

        stopVoicePreview();
        stopVoicePlayback();
        activeVoiceMessageIndex = messageIndex;
        activeVoiceButton = button;
        updateAllMessageVoiceButtons();

        const preferredProvider = getPreferredVoiceProvider();
        if (preferredProvider === 'browser') {
            try {
                startBrowserSpeech(message.content, { mode: 'message', messageIndex });
                if (temporaryBrowserVoiceFallback && !suppressUnavailableToast) {
                    maybeShowBrowserFallbackToast();
                }
            } catch (error) {
                stopVoicePlayback();
                if (!suppressUnavailableToast) {
                    showToast(error.message || 'Browser voice playback failed.');
                }
            }
            return;
        }

        const effectiveVoiceId = getEffectiveVoiceId();
        try {
            const response = await fetch('/api/voice/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: message.content,
                    previous_text: findAdjacentAssistantMessageContent(messageIndex, -1),
                    next_text: findAdjacentAssistantMessageContent(messageIndex, 1),
                    voice_id: effectiveVoiceId
                })
            });

            if (!response.ok) {
                throw new Error(await getResponseErrorMessage(response, 'Voice playback could not start.'));
            }

            const audioBlob = await response.blob();
            activeVoiceObjectUrl = URL.createObjectURL(audioBlob);
            voiceAudio = new Audio(activeVoiceObjectUrl);
            activeVoicePlaybackMode = 'audio';
            voiceAudio.onended = () => stopVoicePlayback();
            voiceAudio.onerror = () => {
                stopVoicePlayback();
                showToast('Voice playback failed.');
            };
            await voiceAudio.play();
            resetTemporaryBrowserFallback();
            renderVoicePicker();
            updateAllMessageVoiceButtons();
        } catch (error) {
            console.error('Error playing voice response:', error);
            if (canUseBrowserSpeechPlayback()) {
                activateTemporaryBrowserFallback(error.message || 'ElevenLabs is unavailable.');
                maybeShowBrowserFallbackToast();
                try {
                    startBrowserSpeech(message.content, { mode: 'message', messageIndex });
                    return;
                } catch (fallbackError) {
                    stopVoicePlayback();
                    if (!suppressUnavailableToast) {
                        showToast(fallbackError.message || 'Browser voice playback failed.');
                    }
                    return;
                }
            }

            stopVoicePlayback();
            if (!suppressUnavailableToast) {
                showToast(error.message || 'Voice playback failed.');
            }
        }
    }

    async function previewSelectedVoice() {
        if (!canUseVoicePlayback() && !getSelectedVoice()?.preview_url) {
            showToast('Voice preview is unavailable in this browser.');
            return;
        }

        const isPreviewPlaying = Boolean(
            (voicePreviewAudio && !voicePreviewAudio.paused) ||
            (activeVoicePreviewMode === 'browser' && browserSpeechSupported && window.speechSynthesis.speaking)
        );
        if (isPreviewPlaying) {
            stopVoicePreview();
            return;
        }

        stopVoicePlayback();
        stopVoicePreview();

        const selectedVoice = getSelectedVoice();
        const previewText = 'Hello from your travel planner. I can help with flights, trains, stays, and travel documents.';
        const preferredProvider = getPreferredVoiceProvider();

        try {
            if (selectedVoice?.preview_url && preferredProvider !== 'browser') {
                voicePreviewAudio = new Audio(selectedVoice.preview_url);
                activeVoicePreviewMode = 'audio';
            } else if (preferredProvider === 'browser') {
                try {
                    startBrowserSpeech(previewText, { mode: 'preview' });
                    if (temporaryBrowserVoiceFallback) {
                        maybeShowBrowserFallbackToast();
                    }
                } catch (browserError) {
                    stopVoicePreview();
                    showToast(browserError.message || 'Browser voice preview failed.');
                }
                return;
            } else {
                const effectiveVoiceId = getEffectiveVoiceId();
                const response = await fetch('/api/voice/speak', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: previewText,
                        voice_id: effectiveVoiceId
                    })
                });

                if (!response.ok) {
                    throw new Error(await getResponseErrorMessage(response, 'Voice preview could not start.'));
                }

                const audioBlob = await response.blob();
                activeVoicePreviewObjectUrl = URL.createObjectURL(audioBlob);
                voicePreviewAudio = new Audio(activeVoicePreviewObjectUrl);
                activeVoicePreviewMode = 'audio';
            }

            voicePreviewAudio.onended = () => stopVoicePreview();
            voicePreviewAudio.onerror = () => {
                stopVoicePreview();
                showToast('Voice preview failed.');
            };

            updateVoicePreviewButton();
            await voicePreviewAudio.play();
            resetTemporaryBrowserFallback();
            renderVoicePicker();
            updateVoicePreviewButton();
        } catch (error) {
            console.error('Error previewing selected voice:', error);
            if (canUseBrowserSpeechPlayback()) {
                activateTemporaryBrowserFallback(error.message || 'ElevenLabs is unavailable.');
                maybeShowBrowserFallbackToast();
                try {
                    startBrowserSpeech(previewText, { mode: 'preview' });
                    return;
                } catch (fallbackError) {
                    stopVoicePreview();
                    showToast(fallbackError.message || 'Browser voice preview failed.');
                    return;
                }
            }

            stopVoicePreview();
            showToast(error.message || 'Voice preview failed.');
        }
    }

    function persistPlannerDraft(showFeedback = false) {
        try {
            localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify({
                plannerState,
                activePlannerStep
            }));
            if (showFeedback) {
                showToast('Draft saved locally.');
            }
        } catch (error) {
            console.error('Error saving planner draft:', error);
        }
    }

    function resetPlannerState() {
        plannerState = getDefaultPlannerState();
        activePlannerStep = 0;
        try {
            localStorage.removeItem(PLANNER_STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing planner draft:', error);
        }
    }

    function getTodayDateInputValue() {
        const now = new Date();
        const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        return localNow.toISOString().slice(0, 10);
    }

    function addDaysToDateInputValue(dateValue, days) {
        if (!dateValue) {
            return '';
        }

        const [year, month, day] = dateValue.split('-').map(Number);
        if (![year, month, day].every(Number.isFinite)) {
            return '';
        }

        const shiftedDate = new Date(Date.UTC(year, month - 1, day + days));
        return shiftedDate.toISOString().slice(0, 10);
    }

    function getReturnDateMinValue(departureDate = plannerState.trip_details.departure_date) {
        return departureDate ? addDaysToDateInputValue(departureDate, 1) : getTodayDateInputValue();
    }

    function syncPlannerDerivedState(state = plannerState) {
        const nextState = state;
        const today = getTodayDateInputValue();
        nextState.trip_details.duration_days = clampInteger(nextState.trip_details.duration_days, 1, 30, 5);
        nextState.travelers.adults = clampInteger(nextState.travelers.adults, 1, 9, 2);
        nextState.travelers.children = clampInteger(nextState.travelers.children, 0, 6, 0);
        nextState.travelers.rooms = clampInteger(nextState.travelers.rooms, 1, 6, 1);
        nextState.stay_preferences.budget_total = clampInteger(nextState.stay_preferences.budget_total, 5000, 500000, 40000);

        if (nextState.trip_details.departure_date && nextState.trip_details.departure_date < today) {
            nextState.trip_details.departure_date = '';
        }
        if (nextState.trip_details.return_date && nextState.trip_details.return_date < today) {
            nextState.trip_details.return_date = '';
        }
        if (!nextState.trip_details.departure_date) {
            nextState.trip_details.return_date = '';
        } else {
            const minimumReturnDate = getReturnDateMinValue(nextState.trip_details.departure_date);
            if (nextState.trip_details.return_date && nextState.trip_details.return_date < minimumReturnDate) {
                nextState.trip_details.return_date = '';
            }
        }

        if (!Array.isArray(nextState.travelers.child_ages)) {
            nextState.travelers.child_ages = [];
        }
        nextState.travelers.child_ages = nextState.travelers.child_ages.slice(0, nextState.travelers.children);
        while (nextState.travelers.child_ages.length < nextState.travelers.children) {
            nextState.travelers.child_ages.push('');
        }

        if (!Array.isArray(nextState.interests.activities)) {
            nextState.interests.activities = [];
        }
        if (!Array.isArray(nextState.interests.food_preferences)) {
            nextState.interests.food_preferences = ['No preference'];
        }

        return nextState;
    }

    function clampInteger(value, min, max, fallback) {
        const number = Number.parseInt(value, 10);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, number));
    }

    function normalizeLocationToken(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getCountryForCity(city) {
        return cityCountryMap[normalizeLocationToken(city)] || '';
    }

    function normalizeCountryName(country) {
        const normalized = normalizeLocationToken(country);
        return countryAliases[normalized] || country.trim();
    }

    function getPlannerDocumentContext(state = plannerState) {
        const bookingMode = String(state.transport_preferences?.booking_mode || '').trim();
        const rawOriginCity = String(state.trip_details?.origin_city || '').trim();
        const rawDestinationCity = String(state.trip_details?.destination_city || '').trim();
        const rawDestinationCountry = String(state.document_verification?.destination_country || '').trim();
        const originCountry = normalizeCountryName(getCountryForCity(rawOriginCity));
        const destinationCountry = normalizeCountryName(rawDestinationCountry || getCountryForCity(rawDestinationCity));
        const isFlightOnlyBooking = bookingMode === 'Flights only';
        const isTrainOnlyBooking = bookingMode === 'Trains only';
        const hasKnownRouteCountries = Boolean(originCountry && destinationCountry);
        const isInternationalRoute = hasKnownRouteCountries && originCountry !== destinationCountry;
        const isApplicable = isFlightOnlyBooking && isInternationalRoute;

        return {
            bookingMode,
            originCity: rawOriginCity,
            destinationCity: rawDestinationCity,
            originCountry,
            destinationCountry,
            isFlightOnlyBooking,
            isTrainOnlyBooking,
            isInternationalRoute,
            isApplicable
        };
    }

    function getSelectOptionsMarkup(options, selectedValue) {
        return options.map(option => `
            <option value="${escapeHtml(option)}" ${selectedValue === option ? 'selected' : ''}>${escapeHtml(option)}</option>
        `).join('');
    }

    function getChipGroupMarkup(groupPath, options, selectedValues, multi = false) {
        const selectedArray = Array.isArray(selectedValues) ? selectedValues : [selectedValues];
        return options.map(option => {
            const selected = selectedArray.includes(option);
            const label = option.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
            return `
                <button
                    type="button"
                    class="planner-chip ${selected ? 'is-selected' : ''}"
                    data-chip-group="${groupPath}"
                    data-chip-value="${escapeHtml(option)}"
                    data-chip-multi="${multi ? 'true' : 'false'}"
                    aria-pressed="${selected ? 'true' : 'false'}"
                >
                    ${escapeHtml(label)}
                </button>
            `;
        }).join('');
    }

    function getCounterMarkup(label, path, value, hint = '') {
        return `
            <div class="planner-counter-card">
                <div>
                    <div class="planner-label">${escapeHtml(label)}</div>
                    ${hint ? `<div class="planner-field-hint">${escapeHtml(hint)}</div>` : ''}
                </div>
                <div class="planner-counter">
                    <button type="button" class="planner-counter-btn" data-counter-path="${path}" data-counter-action="decrement" aria-label="Decrease ${escapeHtml(label)}">-</button>
                    <span class="planner-counter-value" data-counter-display="${path}">${value}</span>
                    <button type="button" class="planner-counter-btn" data-counter-path="${path}" data-counter-action="increment" aria-label="Increase ${escapeHtml(label)}">+</button>
                </div>
            </div>
        `;
    }

    function getChildAgeSelectorsMarkup() {
        if (!plannerState.travelers.children) {
            return `
                <div class="planner-inline-note">
                    Add children only if needed and we will open age selectors here.
                </div>
            `;
        }

        return plannerState.travelers.child_ages.map((age, index) => `
            <label class="planner-field planner-field--compact">
                <span class="planner-label">Child ${index + 1} age</span>
                <select class="planner-select" data-child-age-index="${index}">
                    <option value="">Select age</option>
                    ${Array.from({ length: 18 }, (_, year) => `
                        <option value="${year}" ${String(age) === String(year) ? 'selected' : ''}>${year} years</option>
                    `).join('')}
                </select>
            </label>
        `).join('');
    }

    function getCityOptionsMarkup() {
        return cityOptions.map(city => `<option value="${escapeHtml(city)}"></option>`).join('');
    }

    function getWelcomeMarkup() {
        return `
            <div class="welcome-message planner-welcome">
                <div class="planner-hero">
                    <span class="planner-badge">Booking-style AI planner</span>
                    <div class="hero-text">
                        <span class="gradient-text">Plan your perfect trip</span>
                    </div>
                    <p class="subtitle">Enter your preferences and let the AI build a personalized travel plan.</p>
                </div>

                <div class="planner-shell">
                    <section class="planner-card">
                        <div class="planner-stepper" aria-label="Trip planner steps">
                            ${plannerStepDefinitions.map((step, index) => `
                                <button type="button" class="planner-step-pill ${index === activePlannerStep ? 'is-active' : ''}" data-step-target="${index}">
                                    <span class="planner-step-number">${index + 1}</span>
                                    <span>
                                        <strong>${escapeHtml(step.title)}</strong>
                                        <small>${escapeHtml(step.caption)}</small>
                                    </span>
                                </button>
                            `).join('')}
                        </div>

                        <div class="planner-panel-stack">
                            ${getTripBasicsPanelMarkup()}
                            ${getTravelersPanelMarkup()}
                            ${getBudgetPanelMarkup()}
                            ${getPreferencesPanelMarkup()}
                            ${getPersonalDetailsPanelMarkup()}
                            ${getReviewPanelMarkup()}
                        </div>

                        <div class="planner-validation" id="planner-validation"></div>

                        <div class="planner-footer">
                            <div class="planner-footer-copy">
                                <span class="planner-overline">Progress</span>
                                <strong data-planner-progress>Step ${activePlannerStep + 1} of ${plannerStepDefinitions.length}</strong>
                            </div>
                            <div class="planner-footer-actions">
                                <button type="button" class="planner-button planner-button--ghost" data-planner-action="reset">Reset Form</button>
                                <button type="button" class="planner-button planner-button--secondary" data-planner-action="save">Save Draft</button>
                                <button type="button" class="planner-button planner-button--ghost" data-step-nav="back">Back</button>
                                <button type="button" class="planner-button planner-button--primary" data-step-nav="next">Continue</button>
                                <button type="button" class="planner-button planner-button--primary" data-planner-action="generate">Generate My Trip</button>
                            </div>
                        </div>
                    </section>

                    <aside class="planner-summary">
                        <div class="planner-summary-card">
                            <div class="planner-summary-header">
                                <div>
                                    <span class="planner-overline">Live summary</span>
                                    <h3>Review summary</h3>
                                </div>
                                <button type="button" class="planner-mini-link" data-edit-step="5">Review</button>
                            </div>
                            <div class="planner-summary-route" data-summary-route>
                                Add route and dates to see your trip snapshot.
                            </div>
                            <div class="planner-summary-pill-row">
                                <span class="planner-summary-pill" data-summary-trip-type>${escapeHtml(plannerState.trip_details.trip_type)}</span>
                                <span class="planner-summary-pill" data-summary-budget>${escapeHtml(plannerState.stay_preferences.budget_type)}</span>
                                <span class="planner-summary-pill" data-summary-stay>${escapeHtml(plannerState.stay_preferences.stay_type)}</span>
                            </div>
                            <div class="planner-summary-sections" data-summary-sections></div>
                            <p class="helper-note planner-summary-note">Personal details stay optional until you want deeper personalization or a later booking step.</p>
                        </div>
                    </aside>
                </div>

                <datalist id="planner-city-options">
                    ${getCityOptionsMarkup()}
                </datalist>
            </div>
        `;
    }

    function getTripBasicsPanelMarkup() {
        return `
            <section class="planner-step-panel" data-step-panel="0">
                <div class="planner-panel-heading">
                    <p class="planner-overline">Step 1</p>
                    <h2>Trip Basics</h2>
                    <p>Choose the route, dates, and style of trip you want to plan.</p>
                </div>
                <div class="planner-grid planner-grid--two">
                    <label class="planner-field">
                        <span class="planner-label">Origin city</span>
                        <input class="planner-input" list="planner-city-options" data-path="trip_details.origin_city" placeholder="Search departure city" value="${escapeHtml(plannerState.trip_details.origin_city)}">
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Destination city</span>
                        <input class="planner-input" list="planner-city-options" data-path="trip_details.destination_city" placeholder="Where do you want to go?" value="${escapeHtml(plannerState.trip_details.destination_city)}">
                    </label>
                    <div class="planner-field planner-field--full">
                        <span class="planner-label">Plan format</span>
                        <div class="planner-chip-row">
                            ${getChipGroupMarkup('trip_details.date_mode', ['round_trip', 'duration'], plannerState.trip_details.date_mode)}
                        </div>
                        <div class="planner-field-hint">Choose round trip dates or switch to a fixed duration plan.</div>
                    </div>
                    <label class="planner-field">
                        <span class="planner-label">Departure date</span>
                        <input id="planner-departure-date" class="planner-input" type="date" min="${getTodayDateInputValue()}" data-path="trip_details.departure_date" value="${escapeHtml(plannerState.trip_details.departure_date)}">
                    </label>
                    <label class="planner-field" data-return-field>
                        <span class="planner-label">Return date</span>
                        <input id="planner-return-date" class="planner-input" type="date" min="${getReturnDateMinValue(plannerState.trip_details.departure_date)}" data-path="trip_details.return_date" value="${escapeHtml(plannerState.trip_details.return_date)}">
                    </label>
                    <label class="planner-field" data-duration-field>
                        <span class="planner-label">Trip duration</span>
                        <input id="planner-duration-days" class="planner-input" type="number" min="1" max="30" data-path="trip_details.duration_days" value="${plannerState.trip_details.duration_days}">
                        <div class="planner-field-hint">Useful when your return date is still open.</div>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Trip type</span>
                        <select class="planner-select" data-path="trip_details.trip_type">
                            ${getSelectOptionsMarkup(tripTypeOptions, plannerState.trip_details.trip_type)}
                        </select>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Travel flexibility</span>
                        <select class="planner-select" data-path="trip_details.flexibility">
                            ${getSelectOptionsMarkup(flexibilityOptions, plannerState.trip_details.flexibility)}
                        </select>
                    </label>
                </div>
            </section>
        `;
    }

    function getTravelersPanelMarkup() {
        return `
            <section class="planner-step-panel" data-step-panel="1" hidden>
                <div class="planner-panel-heading">
                    <p class="planner-overline">Step 2</p>
                    <h2>Travelers</h2>
                    <p>Set traveler counts, room needs, and support preferences.</p>
                </div>
                <div class="planner-counter-grid">
                    ${getCounterMarkup('Adults', 'travelers.adults', plannerState.travelers.adults, '12+ years')}
                    ${getCounterMarkup('Children', 'travelers.children', plannerState.travelers.children, 'Below 12 years')}
                    ${getCounterMarkup('Rooms', 'travelers.rooms', plannerState.travelers.rooms, 'Suggested hotel rooms')}
                </div>
                <div class="planner-toggle-grid">
                    <label class="planner-switch">
                        <input type="checkbox" data-path="travelers.senior_citizen" ${plannerState.travelers.senior_citizen ? 'checked' : ''}>
                        <span>Include senior citizens</span>
                    </label>
                    <label class="planner-switch">
                        <input type="checkbox" data-path="travelers.accessible_needs" ${plannerState.travelers.accessible_needs ? 'checked' : ''}>
                        <span>Accessible travel needs</span>
                    </label>
                </div>
                <div class="planner-subsection">
                    <div class="planner-subsection-header">
                        <h3>Children ages</h3>
                        <p>We only show this when children are added.</p>
                    </div>
                    <div class="planner-grid planner-grid--three" data-child-age-container>
                        ${getChildAgeSelectorsMarkup()}
                    </div>
                </div>
            </section>
        `;
    }

    function getBudgetPanelMarkup() {
        return `
            <section class="planner-step-panel" data-step-panel="2" hidden>
                <div class="planner-panel-heading">
                    <p class="planner-overline">Step 3</p>
                    <h2>Budget & Stay</h2>
                    <p>Shape the budget, stay style, and neighborhood preference.</p>
                </div>
                <div class="planner-budget-card">
                    <div class="planner-budget-header">
                        <div>
                            <span class="planner-label">Total budget</span>
                            <p class="planner-field-hint">Set an overall trip budget in INR.</p>
                        </div>
                        <strong data-budget-display>INR ${formatCurrencyInr(plannerState.stay_preferences.budget_total)}</strong>
                    </div>
                    <input class="planner-range" id="planner-budget-range" type="range" min="5000" max="500000" step="1000" data-path="stay_preferences.budget_total" value="${plannerState.stay_preferences.budget_total}">
                    <input class="planner-input planner-input--compact" id="planner-budget-input" type="number" min="5000" max="500000" step="1000" data-path="stay_preferences.budget_total" value="${plannerState.stay_preferences.budget_total}">
                </div>
                <div class="planner-grid planner-grid--two">
                    <label class="planner-field">
                        <span class="planner-label">Budget type</span>
                        <select class="planner-select" data-path="stay_preferences.budget_type">
                            ${getSelectOptionsMarkup(budgetTypeOptions, plannerState.stay_preferences.budget_type)}
                        </select>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Room preference</span>
                        <select class="planner-select" data-path="stay_preferences.room_preference">
                            ${getSelectOptionsMarkup(roomPreferenceOptions, plannerState.stay_preferences.room_preference)}
                        </select>
                    </label>
                    <div class="planner-field planner-field--full">
                        <span class="planner-label">Stay preference</span>
                        <div class="planner-chip-row">
                            ${getChipGroupMarkup('stay_preferences.stay_type', stayTypeOptions, plannerState.stay_preferences.stay_type)}
                        </div>
                    </div>
                    <label class="planner-field">
                        <span class="planner-label">Area preference</span>
                        <select class="planner-select" data-path="stay_preferences.area_preference">
                            ${getSelectOptionsMarkup(areaPreferenceOptions, plannerState.stay_preferences.area_preference)}
                        </select>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Meal preference</span>
                        <select class="planner-select" data-path="stay_preferences.meal_preference">
                            ${getSelectOptionsMarkup(mealPreferenceOptions, plannerState.stay_preferences.meal_preference)}
                        </select>
                    </label>
                </div>
            </section>
        `;
    }

    function getPreferencesPanelMarkup() {
        return `
            <section class="planner-step-panel" data-step-panel="3" hidden>
                <div class="planner-panel-heading">
                    <p class="planner-overline">Step 4</p>
                    <h2>Preferences</h2>
                    <p>Tell us the vibe you want so the itinerary feels personal.</p>
                </div>
                <div class="planner-field planner-field--full">
                    <span class="planner-label">Interests</span>
                    <div class="planner-chip-row">
                        ${getChipGroupMarkup('interests.activities', interestOptions, plannerState.interests.activities, true)}
                    </div>
                </div>
                <div class="planner-grid planner-grid--two">
                    <label class="planner-field">
                        <span class="planner-label">Transport preference</span>
                        <select class="planner-select" data-path="transport_preferences.preference">
                            ${getSelectOptionsMarkup(transportPreferenceOptions, plannerState.transport_preferences.preference)}
                        </select>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Pace</span>
                        <select class="planner-select" data-path="transport_preferences.pace">
                            ${getSelectOptionsMarkup(paceOptions, plannerState.transport_preferences.pace)}
                        </select>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Booking mode</span>
                        <select class="planner-select" data-path="transport_preferences.booking_mode">
                            ${getSelectOptionsMarkup(bookingModeOptions, plannerState.transport_preferences.booking_mode)}
                        </select>
                    </label>
                </div>
                <div class="planner-field planner-field--full">
                    <span class="planner-label">Food preferences</span>
                    <div class="planner-chip-row">
                        ${getChipGroupMarkup('interests.food_preferences', foodPreferenceOptions, plannerState.interests.food_preferences, true)}
                    </div>
                </div>
                <label class="planner-field planner-field--full">
                    <span class="planner-label">Special requirements</span>
                    <textarea class="planner-textarea" data-path="special_requirements.notes" rows="4" placeholder="Examples: avoid nightlife, prefer walkable areas, need quiet rooms, travelling with elderly parents.">${escapeHtml(plannerState.special_requirements.notes)}</textarea>
                </label>
            </section>
        `;
    }

    function getPersonalDetailsPanelMarkup() {
        return `
            <section class="planner-step-panel" data-step-panel="4" hidden>
                <div class="planner-panel-heading">
                    <p class="planner-overline">Step 5</p>
                    <h2>Personal Details</h2>
                    <p>Used only to personalize your trip planning. You can skip this entirely.</p>
                </div>
                <label class="planner-switch planner-switch--primary">
                    <input type="checkbox" data-path="personal_info.enabled" ${plannerState.personal_info.enabled ? 'checked' : ''}>
                    <span>Add optional personalization details</span>
                </label>
                <div class="planner-grid planner-grid--two" data-personal-fields ${plannerState.personal_info.enabled ? '' : 'hidden'}>
                    <label class="planner-field">
                        <span class="planner-label">Full name</span>
                        <input class="planner-input" data-path="personal_info.full_name" placeholder="e.g. Alex Traveler" value="${escapeHtml(plannerState.personal_info.full_name)}">
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Email</span>
                        <input class="planner-input" type="email" data-path="personal_info.email" placeholder="name@example.com" value="${escapeHtml(plannerState.personal_info.email)}">
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Phone number</span>
                        <input class="planner-input" data-path="personal_info.phone" placeholder="+91 90000 00000" value="${escapeHtml(plannerState.personal_info.phone)}">
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Home city</span>
                        <input class="planner-input" list="planner-city-options" data-path="personal_info.home_city" placeholder="Home city" value="${escapeHtml(plannerState.personal_info.home_city)}">
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Preferred language</span>
                        <select class="planner-select" data-path="personal_info.preferred_language">
                            ${getSelectOptionsMarkup(languageOptions, plannerState.personal_info.preferred_language)}
                        </select>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Preferred currency</span>
                        <select class="planner-select" data-path="personal_info.preferred_currency">
                            ${getSelectOptionsMarkup(currencyOptions, plannerState.personal_info.preferred_currency)}
                        </select>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Gender (optional)</span>
                        <select class="planner-select" data-path="personal_info.gender">
                            ${getSelectOptionsMarkup(genderOptions, plannerState.personal_info.gender)}
                        </select>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Age group</span>
                        <select class="planner-select" data-path="personal_info.age_group">
                            ${getSelectOptionsMarkup(ageGroupOptions, plannerState.personal_info.age_group)}
                        </select>
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Emergency contact name</span>
                        <input class="planner-input" data-path="personal_info.emergency_contact_name" placeholder="Optional contact name" value="${escapeHtml(plannerState.personal_info.emergency_contact_name)}">
                    </label>
                    <label class="planner-field">
                        <span class="planner-label">Emergency contact phone</span>
                        <input class="planner-input" data-path="personal_info.emergency_contact_phone" placeholder="+91 90000 00000" value="${escapeHtml(plannerState.personal_info.emergency_contact_phone)}">
                    </label>
                    <label class="planner-field planner-field--full">
                        <span class="planner-label">Traveler notes</span>
                        <textarea class="planner-textarea" data-path="personal_info.traveler_notes" rows="3" placeholder="Any personal touches you want the planner to keep in mind.">${escapeHtml(plannerState.personal_info.traveler_notes)}</textarea>
                    </label>
                    <div class="planner-field planner-field--full">
                        <span class="planner-label">Document verification</span>
                        <div class="planner-toggle-grid">
                            <label class="planner-switch">
                                <input type="checkbox" data-path="document_verification.authorized" ${plannerState.document_verification.authorized ? 'checked' : ''}>
                                <span>Authorize passport and visa verification</span>
                            </label>
                            <label class="planner-switch">
                                <input type="checkbox" data-path="document_verification.passport_verification" ${plannerState.document_verification.passport_verification ? 'checked' : ''}>
                                <span>Verify passport details</span>
                            </label>
                            <label class="planner-switch">
                                <input type="checkbox" data-path="document_verification.visa_verification" ${plannerState.document_verification.visa_verification ? 'checked' : ''}>
                                <span>Verify visa details</span>
                            </label>
                        </div>
                        <div class="planner-grid planner-grid--two">
                            <label class="planner-field">
                                <span class="planner-label">Passport number</span>
                                <input class="planner-input" data-path="document_verification.passport_number" placeholder="Optional passport number" value="${escapeHtml(plannerState.document_verification.passport_number)}">
                            </label>
                            <label class="planner-field">
                                <span class="planner-label">Passport expiry</span>
                                <input class="planner-input" type="date" data-path="document_verification.passport_expiry_date" value="${escapeHtml(plannerState.document_verification.passport_expiry_date)}">
                            </label>
                            <label class="planner-field">
                                <span class="planner-label">Visa status</span>
                                <select class="planner-select" data-path="document_verification.visa_status">
                                    ${getSelectOptionsMarkup(visaStatusOptions, plannerState.document_verification.visa_status)}
                                </select>
                            </label>
                            <label class="planner-field">
                                <span class="planner-label">Visa expiry</span>
                                <input class="planner-input" type="date" data-path="document_verification.visa_expiry_date" value="${escapeHtml(plannerState.document_verification.visa_expiry_date)}">
                            </label>
                            <label class="planner-field planner-field--full">
                                <span class="planner-label">Destination country for document check</span>
                                <input class="planner-input" data-path="document_verification.destination_country" placeholder="Optional destination country" value="${escapeHtml(plannerState.document_verification.destination_country)}">
                            </label>
                        </div>
                        <div class="planner-field-hint">You can also upload passport or visa documents in chat. Verification only runs after authorization and is only enforced for international flight bookings.</div>
                    </div>
                </div>
                <p class="planner-privacy-note">Privacy note: keep this optional for planning and use placeholders in demos if you do not want to enter real personal data.</p>
            </section>
        `;
    }

    function getReviewPanelMarkup() {
        return `
            <section class="planner-step-panel" data-step-panel="5" hidden>
                <div class="planner-panel-heading">
                    <p class="planner-overline">Step 6</p>
                    <h2>Review & Generate Plan</h2>
                    <p>Check the summary below, edit anything you want, then generate your trip.</p>
                </div>
                <div class="planner-inline-note planner-inline-note--accent">
                    The AI will use this structured booking-style form plus your selections to create the plan.
                </div>
                <div class="planner-review-grid" data-review-sections></div>
            </section>
        `;
    }

    function formatCurrencyInr(value) {
        return new Intl.NumberFormat('en-IN').format(Number(value || 0));
    }

    function getPlannerValue(path) {
        return path.split('.').reduce((accumulator, key) => accumulator?.[key], plannerState);
    }

    function setPlannerValue(path, value) {
        const keys = path.split('.');
        let cursor = plannerState;
        keys.slice(0, -1).forEach(key => {
            cursor = cursor[key];
        });
        cursor[keys[keys.length - 1]] = value;
        syncPlannerDerivedState();
    }

    function renderWelcomeState() {
        chatContainer.innerHTML = getWelcomeMarkup();
        chatContainer.classList.remove('has-messages');
        updatePlannerUI();
    }

    function getPlannerSummaryData() {
        const route = [plannerState.trip_details.origin_city, plannerState.trip_details.destination_city].filter(Boolean).join(' -> ') || 'Choose your route';
        const dates = getPlannerDatesSummary();
        const travelerCount = plannerState.travelers.adults + plannerState.travelers.children;
        const travelerSummary = `${plannerState.travelers.adults} adults, ${plannerState.travelers.children} children, ${plannerState.travelers.rooms} rooms`;
        const interestsSummary = plannerState.interests.activities.length ? plannerState.interests.activities.join(', ') : 'Add interests';
        const personalSummary = getPersonalSummary();
        const documentSummary = getDocumentVerificationSummary();

        return {
            route,
            dates,
            travelerCount,
            travelerSummary,
            interestsSummary,
            personalSummary,
            documentSummary
        };
    }

    function getPlannerDatesSummary() {
        const { departure_date, return_date, duration_days, date_mode, flexibility } = plannerState.trip_details;
        if (!departure_date) {
            return 'Choose travel dates';
        }
        if (date_mode === 'round_trip') {
            return return_date ? `${departure_date} to ${return_date} (${flexibility})` : `Departure ${departure_date}`;
        }
        return `${departure_date} for ${duration_days} days (${flexibility})`;
    }

    function getPersonalSummary() {
        if (!plannerState.personal_info.enabled) {
            return 'Optional details not added';
        }
        const details = [
            plannerState.personal_info.full_name,
            plannerState.personal_info.preferred_language,
            plannerState.personal_info.preferred_currency
        ].filter(Boolean);
        return details.length ? details.join(' | ') : 'Optional details enabled';
    }

    function getDocumentVerificationSummary() {
        const documentContext = getPlannerDocumentContext();

        if (!documentContext.isApplicable) {
            return 'Passport and visa checks run only for international flight bookings';
        }

        if (!plannerState.document_verification.authorized) {
            return 'Document verification not authorized';
        }

        const details = [];
        if (plannerState.document_verification.passport_verification) {
            details.push('Passport check enabled');
        }
        if (plannerState.document_verification.visa_verification) {
            details.push(`Visa: ${plannerState.document_verification.visa_status}`);
        }
        if (plannerState.document_verification.destination_country) {
            details.push(plannerState.document_verification.destination_country);
        } else if (documentContext.destinationCountry) {
            details.push(documentContext.destinationCountry);
        }
        return details.length ? details.join(' | ') : 'Document verification authorized';
    }

    function validatePlannerState() {
        const errors = {
            0: [],
            1: [],
            2: [],
            3: [],
            4: [],
            5: []
        };

        const trip = plannerState.trip_details;
        const travelers = plannerState.travelers;
        const stay = plannerState.stay_preferences;
        const personal = plannerState.personal_info;
        const documents = plannerState.document_verification;
        const today = getTodayDateInputValue();

        if (!trip.origin_city) errors[0].push('Choose an origin city.');
        if (!trip.destination_city) errors[0].push('Choose a destination city.');
        if (trip.origin_city && trip.destination_city && trip.origin_city.toLowerCase() === trip.destination_city.toLowerCase()) {
            errors[0].push('Origin and destination should be different.');
        }
        if (!trip.departure_date) errors[0].push('Select a departure date.');
        if (trip.departure_date && trip.departure_date < today) {
            errors[0].push('Departure date cannot be in the past.');
        }
        if (trip.date_mode === 'round_trip') {
            if (!trip.return_date) {
                errors[0].push('Select a return date or switch to duration-based planning.');
            } else if (trip.return_date < today) {
                errors[0].push('Return date cannot be in the past.');
            } else if (trip.departure_date && trip.return_date < getReturnDateMinValue(trip.departure_date)) {
                errors[0].push('Return date should be after the departure date.');
            }
        } else if (!trip.duration_days || trip.duration_days < 1) {
            errors[0].push('Set a trip duration of at least 1 day.');
        }

        if ((travelers.adults + travelers.children) < 1) {
            errors[1].push('Add at least one traveler.');
        }
        if (travelers.children > 0 && travelers.child_ages.some(age => age === '' || age === null || age === undefined)) {
            errors[1].push('Select an age for every child.');
        }

        if (!stay.budget_total || stay.budget_total < 5000) {
            errors[2].push('Enter a realistic total budget.');
        }

        if (!plannerState.interests.activities.length) {
            errors[3].push('Pick at least one interest so the itinerary feels tailored.');
        }

        if (personal.enabled) {
            if (personal.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email)) {
                errors[4].push('Use a valid email format or leave it blank.');
            }
            if (personal.phone && !/^[+\d][\d\s-]{6,}$/.test(personal.phone)) {
                errors[4].push('Use a valid phone number format or leave it blank.');
            }
            if (personal.emergency_contact_phone && !/^[+\d][\d\s-]{6,}$/.test(personal.emergency_contact_phone)) {
                errors[4].push('Use a valid emergency contact phone number or leave it blank.');
            }
            const documentContext = getPlannerDocumentContext();
            if (documentContext.isApplicable && documents.passport_expiry_date && documents.passport_expiry_date < today) {
                errors[4].push('Passport expiry date cannot be in the past.');
            }
            if (
                documentContext.isApplicable &&
                documents.visa_status === 'Already have visa' &&
                documents.visa_expiry_date &&
                documents.visa_expiry_date < today
            ) {
                errors[4].push('Visa expiry date cannot be in the past.');
            }
        }

        const firstInvalidStep = Object.keys(errors)
            .map(Number)
            .find(step => errors[step].length > 0);

        return { errors, firstInvalidStep };
    }

    function updatePlannerUI() {
        syncPlannerDerivedState();

        const summary = getPlannerSummaryData();
        const validation = validatePlannerState();

        document.querySelectorAll('.planner-step-pill').forEach((pill, index) => {
            pill.classList.toggle('is-active', index === activePlannerStep);
        });
        document.querySelectorAll('.planner-step-panel').forEach((panel, index) => {
            panel.hidden = index !== activePlannerStep;
        });

        document.querySelectorAll('[data-chip-group]').forEach(chip => {
            const path = chip.dataset.chipGroup;
            const currentValue = getPlannerValue(path);
            const selected = Array.isArray(currentValue)
                ? currentValue.includes(chip.dataset.chipValue)
                : currentValue === chip.dataset.chipValue;
            chip.classList.toggle('is-selected', selected);
            chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });

        document.querySelectorAll('[data-counter-display]').forEach(display => {
            display.textContent = getPlannerValue(display.dataset.counterDisplay);
        });

        document.querySelectorAll('[data-summary-trip-type]').forEach(node => {
            node.textContent = plannerState.trip_details.trip_type;
        });
        document.querySelectorAll('[data-summary-budget]').forEach(node => {
            node.textContent = `${plannerState.stay_preferences.budget_type} • INR ${formatCurrencyInr(plannerState.stay_preferences.budget_total)}`;
        });
        document.querySelectorAll('[data-summary-stay]').forEach(node => {
            node.textContent = plannerState.stay_preferences.stay_type;
        });

        const summaryRoute = document.querySelector('[data-summary-route]');
        if (summaryRoute) {
            summaryRoute.textContent = `${summary.route} • ${summary.dates}`;
        }

        const budgetDisplay = document.querySelector('[data-budget-display]');
        if (budgetDisplay) {
            budgetDisplay.textContent = `INR ${formatCurrencyInr(plannerState.stay_preferences.budget_total)}`;
        }

        const budgetRange = document.getElementById('planner-budget-range');
        const budgetInput = document.getElementById('planner-budget-input');
        if (budgetRange) budgetRange.value = plannerState.stay_preferences.budget_total;
        if (budgetInput) budgetInput.value = plannerState.stay_preferences.budget_total;

        const returnField = document.querySelector('[data-return-field]');
        const durationField = document.querySelector('[data-duration-field]');
        const departureInput = document.getElementById('planner-departure-date');
        const returnInput = document.getElementById('planner-return-date');
        const durationInput = document.getElementById('planner-duration-days');
        const usesRoundTrip = plannerState.trip_details.date_mode === 'round_trip';
        if (returnField) returnField.hidden = !usesRoundTrip;
        if (durationField) durationField.hidden = usesRoundTrip;
        if (departureInput) {
            departureInput.min = getTodayDateInputValue();
            departureInput.value = plannerState.trip_details.departure_date;
        }
        if (returnInput) {
            returnInput.min = getReturnDateMinValue(plannerState.trip_details.departure_date);
            returnInput.value = plannerState.trip_details.return_date;
        }
        if (returnInput) returnInput.disabled = !usesRoundTrip || !plannerState.trip_details.departure_date;
        if (durationInput) durationInput.disabled = usesRoundTrip;

        const personalFields = document.querySelector('[data-personal-fields]');
        if (personalFields) {
            personalFields.hidden = !plannerState.personal_info.enabled;
        }

        const childAgeContainer = document.querySelector('[data-child-age-container]');
        if (childAgeContainer) {
            childAgeContainer.innerHTML = getChildAgeSelectorsMarkup();
        }

        renderPlannerSummarySections(summary);
        renderPlannerReviewSections(summary);
        renderPlannerValidation(validation);
        updatePlannerFooter(validation);
        persistPlannerDraft();
    }

    function renderPlannerSummarySections(summary) {
        const container = document.querySelector('[data-summary-sections]');
        if (!container) return;

        container.innerHTML = `
            ${getSummarySectionCard('Trip Basics', summary.route, summary.dates, 0)}
            ${getSummarySectionCard('Travelers', summary.travelerSummary, `${summary.travelerCount} total travelers`, 1)}
            ${getSummarySectionCard('Budget & Stay', `INR ${formatCurrencyInr(plannerState.stay_preferences.budget_total)} • ${plannerState.stay_preferences.budget_type}`, `${plannerState.stay_preferences.stay_type} • ${plannerState.stay_preferences.area_preference}`, 2)}
            ${getSummarySectionCard('Preferences', summary.interestsSummary, `${plannerState.transport_preferences.preference} • ${plannerState.transport_preferences.pace} • ${plannerState.transport_preferences.booking_mode}`, 3)}
            ${getSummarySectionCard('Personalization', summary.personalSummary, summary.documentSummary, 4)}
        `;
    }

    function renderPlannerReviewSections(summary) {
        const container = document.querySelector('[data-review-sections]');
        if (!container) return;

        container.innerHTML = `
            ${getReviewSectionCard('Route', summary.route, summary.dates, 0)}
            ${getReviewSectionCard('Travelers', summary.travelerSummary, plannerState.travelers.accessible_needs ? 'Accessible travel needs enabled' : 'Standard travel needs', 1)}
            ${getReviewSectionCard('Budget & Stay', `INR ${formatCurrencyInr(plannerState.stay_preferences.budget_total)} • ${plannerState.stay_preferences.budget_type}`, `${plannerState.stay_preferences.stay_type} • ${plannerState.stay_preferences.room_preference} • ${plannerState.stay_preferences.meal_preference}`, 2)}
            ${getReviewSectionCard('Preferences', summary.interestsSummary, `${plannerState.transport_preferences.preference} • ${plannerState.transport_preferences.pace} • ${plannerState.transport_preferences.booking_mode}`, 3)}
            ${getReviewSectionCard('Personalization', `${summary.personalSummary} • ${summary.documentSummary}`, plannerState.special_requirements.notes || 'No additional notes yet.', 4)}
        `;
    }

    function getSummarySectionCard(title, primary, secondary, step) {
        return `
            <article class="planner-summary-block">
                <div>
                    <h4>${escapeHtml(title)}</h4>
                    <p>${escapeHtml(primary)}</p>
                    <small>${escapeHtml(secondary)}</small>
                </div>
                <button type="button" class="planner-mini-link" data-edit-step="${step}">Edit</button>
            </article>
        `;
    }

    function getReviewSectionCard(title, primary, secondary, step) {
        return `
            <article class="planner-review-card">
                <div class="planner-review-card-header">
                    <div>
                        <h3>${escapeHtml(title)}</h3>
                        <p>${escapeHtml(primary)}</p>
                    </div>
                    <button type="button" class="planner-mini-link" data-edit-step="${step}">Edit</button>
                </div>
                <small>${escapeHtml(secondary)}</small>
            </article>
        `;
    }

    function renderPlannerValidation(validation) {
        const container = document.getElementById('planner-validation');
        if (!container) return;

        const errorsForStep = activePlannerStep === 5
            ? Object.values(validation.errors).flat()
            : validation.errors[activePlannerStep];

        if (!errorsForStep.length) {
            container.innerHTML = '<div class="planner-validation-success">Everything in this section looks ready.</div>';
            return;
        }

        container.innerHTML = `
            <div class="planner-validation-title">Please review the following:</div>
            <ul class="planner-validation-list">
                ${errorsForStep.map(error => `<li>${escapeHtml(error)}</li>`).join('')}
            </ul>
        `;
    }

    function updatePlannerFooter(validation) {
        const progress = document.querySelector('[data-planner-progress]');
        const backButton = document.querySelector('[data-step-nav="back"]');
        const nextButton = document.querySelector('[data-step-nav="next"]');
        const generateButton = document.querySelector('[data-planner-action="generate"]');

        if (progress) {
            progress.textContent = `Step ${activePlannerStep + 1} of ${plannerStepDefinitions.length}`;
        }
        if (backButton) {
            backButton.disabled = activePlannerStep === 0;
        }
        if (nextButton) {
            nextButton.hidden = activePlannerStep === plannerStepDefinitions.length - 1;
        }
        if (generateButton) {
            generateButton.hidden = activePlannerStep !== plannerStepDefinitions.length - 1;
            generateButton.disabled = validation.firstInvalidStep !== undefined;
        }
    }

    // Search Modal Logic
    if (searchBtn && searchModal) {
        searchBtn.addEventListener('click', () => {
            openSearchModal();
        });

        // Close on outside click
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                closeSearchModal();
            }
        });

        // Search filtering
        modalSearchInput.addEventListener('input', (e) => {
            renderSearchResults(e.target.value);
        });
    }

    function openSearchModal() {
        if (!searchModal) return;
        searchModal.classList.remove('hidden');
        requestAnimationFrame(() => searchModal.classList.add('active'));

        modalSearchInput.value = '';
        modalSearchInput.focus();
        renderSearchResults(); // Show all initially
    }

    function closeSearchModal() {
        if (!searchModal) return;
        searchModal.classList.remove('active');
        setTimeout(() => searchModal.classList.add('hidden'), 200);
    }

    function renderSearchResults(query = '') {
        if (!searchResultsList) return;
        searchResultsList.innerHTML = '';

        const filteredHistory = searchHistory.filter(c =>
            c.title.toLowerCase().includes(query.toLowerCase())
        );

        if (filteredHistory.length === 0) {
            searchResultsList.innerHTML = '<div style="padding: 1rem; color: #888;">No results found</div>';
            return;
        }

        filteredHistory.forEach(conversation => {
            const item = document.createElement('div');
            item.className = 'search-result-item';

            // Format time similarly to image "Today", "Dec 3", etc.
            const timeStr = formatSimpleDate(conversation.timestamp);

            item.innerHTML = `
                <div class="search-result-title">${escapeHtml(conversation.title)}</div>
                <div class="search-result-date">${timeStr}</div>
            `;

            item.addEventListener('click', () => {
                loadConversation(conversation.id);
                closeSearchModal();
                if (window.innerWidth < 768) {
                    historySidebar.classList.add('collapsed');
                }
            });

            searchResultsList.appendChild(item);
        });
    }

    function formatSimpleDate(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (date.toDateString() === now.toDateString()) {
            return 'Today';
        }
        if (diffDays === 1) {
            return 'Yesterday';
        }
        // Return "Dec 3"
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    // ...

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            startNewConversation();
            // On mobile, maybe close sidebar?
            if (window.innerWidth < 768) {
                historySidebar.classList.add('collapsed');
            }
        });
    }

    chatContainer.addEventListener('click', (event) => {
        const voiceButton = event.target.closest('[data-voice-message-index]');
        if (voiceButton) {
            const messageIndex = Number(voiceButton.dataset.voiceMessageIndex);
            if (Number.isFinite(messageIndex)) {
                void speakConversationMessage(messageIndex, voiceButton);
            }
            return;
        }

        const promptChip = event.target.closest('.prompt-chip');
        if (promptChip) {
            userInput.value = promptChip.dataset.prompt || promptChip.textContent.trim();
            userInput.focus();
            return;
        }

        const stepTarget = event.target.closest('[data-step-target]');
        if (stepTarget) {
            activePlannerStep = Number(stepTarget.dataset.stepTarget);
            updatePlannerUI();
            return;
        }

        const editStep = event.target.closest('[data-edit-step]');
        if (editStep) {
            activePlannerStep = Number(editStep.dataset.editStep);
            updatePlannerUI();
            return;
        }

        const counterButton = event.target.closest('[data-counter-path]');
        if (counterButton) {
            const path = counterButton.dataset.counterPath;
            const direction = counterButton.dataset.counterAction === 'increment' ? 1 : -1;
            adjustPlannerCounter(path, direction);
            updatePlannerUI();
            return;
        }

        const plannerChip = event.target.closest('[data-chip-group]');
        if (plannerChip) {
            handlePlannerChipSelection(plannerChip);
            updatePlannerUI();
            return;
        }

        const stepNav = event.target.closest('[data-step-nav]');
        if (stepNav) {
            const validation = validatePlannerState();
            if (stepNav.dataset.stepNav === 'back') {
                activePlannerStep = Math.max(0, activePlannerStep - 1);
                updatePlannerUI();
                return;
            }

            if (validation.errors[activePlannerStep]?.length) {
                renderPlannerValidation(validation);
                showToast('Finish the highlighted details before moving on.');
                return;
            }

            activePlannerStep = Math.min(plannerStepDefinitions.length - 1, activePlannerStep + 1);
            updatePlannerUI();
            return;
        }

        const plannerAction = event.target.closest('[data-planner-action]');
        if (plannerAction) {
            handlePlannerAction(plannerAction.dataset.plannerAction);
        }
    });

    chatContainer.addEventListener('input', (event) => {
        if (event.target.matches('[data-path]')) {
            updatePlannerField(event.target);
            updatePlannerUI();
        }
    });

    chatContainer.addEventListener('change', (event) => {
        if (event.target.matches('[data-path]')) {
            updatePlannerField(event.target);
            updatePlannerUI();
            return;
        }

        if (event.target.matches('[data-child-age-index]')) {
            plannerState.travelers.child_ages[Number(event.target.dataset.childAgeIndex)] = event.target.value;
            updatePlannerUI();
        }
    });

    if (voiceModeBtn) {
        voiceModeBtn.addEventListener('click', () => {
            if (!canUseVoicePlayback()) {
                showToast('Voice is unavailable in this browser.');
                return;
            }

            voiceModeEnabled = !voiceModeEnabled;
            persistVoiceModePreference();
            updateVoiceModeButton();
            if (!voiceModeEnabled) {
                stopVoicePlayback();
                stopVoicePreview();
            } else {
                showToast('Assistant voice is enabled for new replies.');
            }
        });
    }

    if (voicePickerBtn) {
        voicePickerBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!voiceConfig.enabled && !canUseBrowserSpeechPlayback()) {
                showToast('Voice is unavailable in this browser.');
                return;
            }

            if (voicePickerPanel?.hidden) {
                openVoicePicker();
            } else {
                closeVoicePicker();
            }
        });
    }

    if (voiceSelect) {
        voiceSelect.addEventListener('change', () => {
            selectedVoiceId = String(voiceSelect.value || '').trim();
            persistVoiceSelectionPreference();
            stopVoicePlayback();
            stopVoicePreview();
            if (isBrowserVoiceSelected()) {
                resetTemporaryBrowserFallback();
            }
            renderVoicePicker();
            updateVoiceModeButton();
            updateAllMessageVoiceButtons();

            if (isBrowserVoiceSelected()) {
                showToast('Using your device voice for assistant playback.');
                return;
            }

            if (!selectedVoiceId && canUseBrowserSpeechPlayback()) {
                showToast('Using your device voice as the fallback option.');
                return;
            }

            if (!selectedVoiceId) {
                showToast('Choose a voice to enable playback.');
                return;
            }

            const selectedVoice = getSelectedVoice();
            showToast(selectedVoice ? `${selectedVoice.name} selected for voice playback.` : 'Voice updated.');
        });
    }

    if (voicePreviewBtn) {
        voicePreviewBtn.addEventListener('click', () => {
            void previewSelectedVoice();
        });
    }

    if (voiceRefreshBtn) {
        voiceRefreshBtn.addEventListener('click', () => {
            if (!voiceConfig.enabled && canUseBrowserSpeechPlayback()) {
                resetTemporaryBrowserFallback();
                renderVoicePicker();
                updateVoiceModeButton();
                showToast('Device voice is ready to use.');
                return;
            }
            void loadAvailableVoices({ showFeedback: true });
        });
    }

    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (micListening) {
                stopMicCapture({ keepTranscript: true });
                return;
            }
            void startMicCapture();
        });
    }

    // Initialize history display
    renderHistory();
    renderWelcomeState();
    renderVoicePicker();
    updateVoiceModeButton();
    updateMicButton();
    void initializeVoiceConfig();

    if (browserSpeechSupported) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
            renderVoicePicker();
            updateVoiceModeButton();
        };
    }

    const fileInput = document.getElementById('file-input');
    let selectedFiles = [];  // Array to store multiple files

    // Toggle history sidebar
    historyToggle.addEventListener('click', () => {
        historySidebar.classList.toggle('collapsed');
    });

    const menuBtn = document.getElementById('attach-menu-btn');
    const menu = document.getElementById('attachment-menu');

    // Toggle Menu
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
            menu.classList.remove('active');
        }

        if (voicePicker && !voicePicker.contains(e.target)) {
            closeVoicePicker();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeVoicePicker();
            if (micListening) {
                stopMicCapture({ keepTranscript: true });
            }
        }
    });

    // Handle File Selection (Label triggers input, but we also want to close menu)
    fileInput.addEventListener('click', () => {
        menu.classList.remove('active');
    });

    // Get file type icon based on extension
    function getFileIcon(ext) {
        const icons = {
            'pdf': `<svg class="file-type-icon pdf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <text x="8" y="17" font-size="6" fill="currentColor" stroke="none">PDF</text>
            </svg>`,
            'docx': `<svg class="file-type-icon doc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>`,
            'doc': `<svg class="file-type-icon doc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>`,
            'txt': `<svg class="file-type-icon txt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>`,
            'default': `<svg class="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>`
        };
        return icons[ext] || icons['default'];
    }

    // Create a pill for a single file
    function createFilePill(file, index) {
        const pill = document.createElement('div');
        pill.className = 'file-pill';
        pill.dataset.fileIndex = index;

        const fileExtension = file.name.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(fileExtension);

        if (isImage) {
            // Create thumbnail preview for images
            const reader = new FileReader();
            reader.onload = (e) => {
                pill.innerHTML = `
                    <div class="file-preview">
                        <img src="${e.target.result}" alt="${file.name}" class="file-thumbnail">
                    </div>
                    <span class="file-name">${file.name}</span>
                    <button type="button" class="remove-file">×</button>
                `;
                attachRemoveListener(pill, index);
            };
            reader.readAsDataURL(file);

            // Show loading state
            pill.innerHTML = `
                <div class="file-preview loading">
                    <div class="thumbnail-loader"></div>
                </div>
                <span class="file-name">${file.name}</span>
                <button type="button" class="remove-file">×</button>
            `;
        } else {
            // Show file type icon for documents
            pill.innerHTML = `
                <div class="file-preview">
                    ${getFileIcon(fileExtension)}
                </div>
                <span class="file-name">${file.name}</span>
                <button type="button" class="remove-file">×</button>
            `;
        }

        attachRemoveListener(pill, index);
        return pill;
    }

    // Render all file pills
    function renderFilePills() {
        // Remove all existing pills
        document.querySelectorAll('.file-pill').forEach(pill => pill.remove());

        // Create new pills for each file
        selectedFiles.forEach((file, index) => {
            const pill = createFilePill(file, index);
            chatForm.insertBefore(pill, userInput);
        });
    }

    function attachRemoveListener(pill, index) {
        const removeBtn = pill.querySelector('.remove-file');
        if (removeBtn) {
            removeBtn.onclick = () => {
                // Remove file from array
                selectedFiles.splice(index, 1);
                // Re-render all pills (updates indices)
                renderFilePills();
                // Clear file input if no files left
                if (selectedFiles.length === 0) {
                    fileInput.value = '';
                }
            };
        }
    }

    // File Selection - handles multiple files
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            // Add new files to the array
            for (let i = 0; i < e.target.files.length; i++) {
                selectedFiles.push(e.target.files[i]);
            }
            renderFilePills();
            userInput.focus();
        }
    });

    function adjustPlannerCounter(path, direction) {
        const currentValue = Number(getPlannerValue(path) || 0);
        const limits = {
            'travelers.adults': { min: 1, max: 9 },
            'travelers.children': { min: 0, max: 6 },
            'travelers.rooms': { min: 1, max: 6 }
        };
        const config = limits[path] || { min: 0, max: 10 };
        const nextValue = Math.min(config.max, Math.max(config.min, currentValue + direction));
        setPlannerValue(path, nextValue);
    }

    function handlePlannerChipSelection(chip) {
        const path = chip.dataset.chipGroup;
        const value = chip.dataset.chipValue;
        const multi = chip.dataset.chipMulti === 'true';

        if (!multi) {
            setPlannerValue(path, value);
            return;
        }

        const currentValues = new Set(getPlannerValue(path) || []);
        if (currentValues.has(value)) {
            currentValues.delete(value);
        } else {
            if (path === 'interests.food_preferences' && value === 'No preference') {
                currentValues.clear();
            }
            if (path === 'interests.food_preferences' && value !== 'No preference') {
                currentValues.delete('No preference');
            }
            currentValues.add(value);
        }

        const nextValues = Array.from(currentValues);
        if (path === 'interests.food_preferences' && nextValues.length === 0) {
            nextValues.push('No preference');
        }
        setPlannerValue(path, nextValues);
    }

    function updatePlannerField(field) {
        const path = field.dataset.path;
        if (!path) return;

        let value;
        if (field.type === 'checkbox') {
            value = field.checked;
        } else if (field.type === 'number' || field.type === 'range') {
            value = Number(field.value);
        } else {
            value = field.value;
        }
        setPlannerValue(path, value);
    }

    function getPlannerPayload() {
        const documentContext = getPlannerDocumentContext();
        const documentVerificationPayload = documentContext.isApplicable
            ? {
                applicable: true,
                scope: 'international_flight_booking',
                authorized: plannerState.document_verification.authorized,
                passport_verification: plannerState.document_verification.passport_verification,
                visa_verification: plannerState.document_verification.visa_verification,
                passport_number: plannerState.document_verification.passport_number,
                passport_expiry_date: plannerState.document_verification.passport_expiry_date,
                visa_status: plannerState.document_verification.visa_status,
                visa_expiry_date: plannerState.document_verification.visa_expiry_date,
                destination_country: documentContext.destinationCountry || plannerState.document_verification.destination_country
            }
            : {
                applicable: false,
                scope: 'skip_for_non_international_flight_booking',
                authorized: false,
                passport_verification: false,
                visa_verification: false,
                passport_number: '',
                passport_expiry_date: '',
                visa_status: 'Not required',
                visa_expiry_date: '',
                destination_country: ''
            };

        return {
            trip_details: {
                origin_city: plannerState.trip_details.origin_city,
                destination_city: plannerState.trip_details.destination_city,
                departure_date: plannerState.trip_details.departure_date,
                return_date: plannerState.trip_details.date_mode === 'round_trip' ? plannerState.trip_details.return_date : '',
                duration_days: plannerState.trip_details.date_mode === 'duration' ? plannerState.trip_details.duration_days : null,
                trip_type: plannerState.trip_details.trip_type,
                flexibility: plannerState.trip_details.flexibility,
                planning_mode: plannerState.trip_details.date_mode
            },
            travelers: {
                adults: plannerState.travelers.adults,
                children: plannerState.travelers.children,
                child_ages: plannerState.travelers.child_ages,
                rooms: plannerState.travelers.rooms,
                senior_citizen: plannerState.travelers.senior_citizen,
                accessible_travel_needs: plannerState.travelers.accessible_needs
            },
            stay_preferences: {
                budget_total: plannerState.stay_preferences.budget_total,
                budget_type: plannerState.stay_preferences.budget_type,
                stay_type: plannerState.stay_preferences.stay_type,
                room_preference: plannerState.stay_preferences.room_preference,
                area_preference: plannerState.stay_preferences.area_preference,
                meal_preference: plannerState.stay_preferences.meal_preference
            },
            transport_preferences: {
                preference: plannerState.transport_preferences.preference,
                pace: plannerState.transport_preferences.pace,
                booking_mode: plannerState.transport_preferences.booking_mode
            },
            interests: {
                activities: plannerState.interests.activities,
                food_preferences: plannerState.interests.food_preferences
            },
            personal_info: {
                enabled: plannerState.personal_info.enabled,
                full_name: plannerState.personal_info.full_name,
                email: plannerState.personal_info.email,
                phone: plannerState.personal_info.phone,
                home_city: plannerState.personal_info.home_city,
                preferred_language: plannerState.personal_info.preferred_language,
                preferred_currency: plannerState.personal_info.preferred_currency,
                gender: plannerState.personal_info.gender,
                age_group: plannerState.personal_info.age_group,
                emergency_contact_name: plannerState.personal_info.emergency_contact_name,
                emergency_contact_phone: plannerState.personal_info.emergency_contact_phone,
                traveler_notes: plannerState.personal_info.traveler_notes
            },
            document_verification: documentVerificationPayload,
            special_requirements: {
                notes: plannerState.special_requirements.notes
            },
            submission_context: {
                source: 'web_booking_planner',
                document_verification_applicable: documentContext.isApplicable,
                transport_booking_mode: documentContext.bookingMode,
                route_scope: documentContext.isInternationalRoute ? 'international' : 'domestic_or_unknown'
            }
        };
    }

    function getPlannerDisplayMessage() {
        const summary = getPlannerSummaryData();
        const documentContext = getPlannerDocumentContext();
        const lines = [
            'Trip planning request',
            `1. Route: ${summary.route}`,
            `2. Dates: ${summary.dates}`,
            `3. Travelers: ${summary.travelerSummary}`,
            `4. Budget & stay: INR ${formatCurrencyInr(plannerState.stay_preferences.budget_total)} • ${plannerState.stay_preferences.budget_type} • ${plannerState.stay_preferences.stay_type}`,
            `5. Preferences: ${summary.interestsSummary} • ${plannerState.transport_preferences.preference} • ${plannerState.transport_preferences.pace}`,
            `6. Personalization: ${summary.personalSummary}`
        ];

        if (documentContext.isApplicable) {
            lines.push(`7. Documents: ${summary.documentSummary}`);
        }

        if (plannerState.special_requirements.notes) {
            lines.push(`${documentContext.isApplicable ? '8' : '7'}. Notes: ${plannerState.special_requirements.notes}`);
        }

        return lines.join('\n');
    }

    function getPlannerBackendMessage(displayMessage) {
        return [
            'Create a personalized travel plan using my booking-style planner details below.',
            'Use the structured planner payload as the source of truth for fields and constraints.',
            displayMessage
        ].join('\n\n');
    }

    function consumeSelectedFiles() {
        const filesToSend = selectedFiles.length > 0 ? [...selectedFiles] : [];
        selectedFiles = [];
        fileInput.value = '';
        document.querySelectorAll('.file-pill').forEach(pill => pill.remove());
        return filesToSend;
    }

    async function submitChatRequest({ message, displayMessage, historyTitle, plannerPayload = null, filesToSend = [] }) {
        if ((!message && !plannerPayload && filesToSend.length === 0) || isProcessing) return;

        chatContainer.classList.add('has-messages');

        if (currentConversationId === null) {
            currentConversationId = Date.now().toString();
            addConversationToHistory(historyTitle || displayMessage || message || 'Trip plan');
        }

        if (displayMessage) {
            appendMessage('user', displayMessage);
            saveCurrentConversation();
        }

        setProcessing(true);

        try {
            const formData = new FormData();
            formData.append('message', message || '');
            if (plannerPayload) {
                formData.append('planner_payload', JSON.stringify(plannerPayload));
            }
            filesToSend.forEach(file => {
                formData.append('file', file);
            });

            const response = await fetch('/api/chat', {
                method: 'POST',
                body: formData
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        handleEvent(event);
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
            appendMessage('assistant', 'Sorry, something went wrong. Please try again.');
        } finally {
            setProcessing(false);
            saveCurrentConversation();
        }
    }

    function handlePlannerAction(action) {
        if (action === 'save') {
            persistPlannerDraft(true);
            return;
        }

        if (action === 'reset') {
            showConfirmModal(
                'Reset planner',
                'Clear the current trip form and start fresh?',
                () => {
                    resetPlannerState();
                    renderWelcomeState();
                }
            );
            return;
        }

        if (action === 'generate') {
            const validation = validatePlannerState();
            if (validation.firstInvalidStep !== undefined) {
                activePlannerStep = validation.firstInvalidStep;
                updatePlannerUI();
                showToast('Complete the required trip details before generating.');
                return;
            }

            const displayMessage = getPlannerDisplayMessage();
            const plannerPayload = getPlannerPayload();
            const filesToSend = consumeSelectedFiles();

            submitChatRequest({
                message: getPlannerBackendMessage(displayMessage),
                displayMessage,
                historyTitle: `Trip to ${plannerState.trip_details.destination_city || 'your destination'}`,
                plannerPayload,
                filesToSend
            });
        }
    }

    // Clear history
    // Clear history
    clearHistoryBtn.addEventListener('click', () => {
        showConfirmModal(
            'Clear History',
            'Are you sure you want to clear all search history?',
            () => {
                searchHistory = [];
                saveSearchHistory();
                renderHistory();

                // Also clear all chat messages and start new conversation
                startNewConversation();
            }
        );
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        stopMicCapture({ keepTranscript: true });
        const message = userInput.value.trim();
        const filesToSend = consumeSelectedFiles();
        if ((!message && filesToSend.length === 0) || isProcessing) return;

        userInput.value = '';
        await submitChatRequest({
            message,
            displayMessage: message,
            historyTitle: message,
            filesToSend
        });
    });

    function handleEvent(event) {
        switch (event.type) {
            case 'message':
                // Only show messages that don't contain raw tool output
                if (!event.content.includes('```tool_outputs')) {
                    appendMessage('assistant', event.content);
                }
                break;
            case 'tool_call':
                appendToolCall(event.name, event.arguments);
                break;
            case 'tool_result':
                // Just update the status, don't display the raw result
                updateToolResult(event.name, event.content, event.is_error);
                break;
            case 'error':
                appendMessage('assistant', `Error: ${event.content}`);
                break;
        }
    }

    function appendMessage(role, content, options = {}) {
        const { persist = true, messageIndexOverride = null, autoplay = true } = options;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const formattedContent = formatMessageContent(content);
        const messageIndex = Number.isInteger(messageIndexOverride) ? messageIndexOverride : conversationMessages.length;

        contentDiv.innerHTML = formattedContent;

        messageDiv.appendChild(contentDiv);
        if (role === 'assistant') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';

            const voiceButton = document.createElement('button');
            voiceButton.type = 'button';
            voiceButton.className = 'message-voice-btn';
            voiceButton.dataset.voiceMessageIndex = String(messageIndex);
            actionsDiv.appendChild(voiceButton);

            messageDiv.appendChild(actionsDiv);
        }
        chatContainer.appendChild(messageDiv);
        scrollToBottom();

        // Update internal state
        if (persist) {
            conversationMessages.push({ role, content });
        }
        updateAllMessageVoiceButtons();

        if (role === 'assistant' && autoplay && shouldAutoPlayAssistantVoice(content)) {
            const voiceButton = messageDiv.querySelector('.message-voice-btn');
            if (voiceButton) {
                void speakConversationMessage(messageIndex, voiceButton, { suppressUnavailableToast: true });
            }
        }
    }

    function formatMessageContent(content) {
        let formattedContent = escapeHtml(content).replace(
            /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        const segments = formattedContent.split(/(<a\b[^>]*>.*?<\/a>)/g);
        formattedContent = segments.map(segment => {
            if (segment.startsWith('<a ')) {
                return segment;
            }
            return linkifyPlainUrls(segment);
        }).join('');

        return formattedContent.replace(/\n/g, '<br>');
    }

    function linkifyPlainUrls(text) {
        return text.replace(/https?:\/\/[^\s<]+/g, (match) => {
            const trailingPunctuationMatch = match.match(/[.,!?;:)\]]+$/);
            const trailingPunctuation = trailingPunctuationMatch ? trailingPunctuationMatch[0] : '';
            const url = trailingPunctuation ? match.slice(0, -trailingPunctuation.length) : match;

            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailingPunctuation}`;
        });
    }

    function appendToolCall(name, args) {
        const toolDiv = document.createElement('div');
        toolDiv.className = 'tool-call';
        toolDiv.id = `tool-${Date.now()}`; // Simple ID generation

        // Get friendly display text
        const displayInfo = getToolDisplayInfo(name, args);

        toolDiv.innerHTML = `
            <div class="tool-icon">
                ${displayInfo.icon}
            </div>
            <div class="tool-details">
                <div class="tool-name">${displayInfo.title}</div>
                <div class="tool-args">${displayInfo.description}</div>
            </div>
            <div class="tool-status running">${displayInfo.runningText}</div>
        `;

        chatContainer.appendChild(toolDiv);
        scrollToBottom();

        // Store reference to update later
        window.lastToolDiv = toolDiv;

        // Add to history state (simplified)
        conversationMessages.push({
            role: 'tool_call_ui',
            name,
            args,
            displayInfo
        });
    }

    function getToolDisplayInfo(name, args) {
        // Return friendly display text based on tool type
        switch (name) {
            case 'search_flights':
                return {
                    title: 'Flight Search',
                    description: `${args.origin || '?'} → ${args.destination || '?'} on ${args.date || '?'}`,
                    runningText: 'Searching...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path></svg>'
                };
            case 'search_trains':
                return {
                    title: 'Train Search',
                    description: `${args.origin || '?'} to ${args.destination || '?'} on ${args.date || '?'}`,
                    runningText: 'Searching...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15V9a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6"></path><path d="M4 15h16"></path><path d="M8 19 6 21"></path><path d="M16 19l2 2"></path><path d="M8 11h.01"></path><path d="M16 11h.01"></path></svg>'
                };
            case 'search_hotels':
                return {
                    title: 'Hotel Search',
                    description: `${args.destination || '?'} on ${args.date || '?'} for ${args.nights || 1} night(s)`,
                    runningText: 'Searching stays...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"></path><path d="M3 13h18"></path><path d="M7 9h.01"></path><path d="M12 9h.01"></path><path d="M17 9h.01"></path></svg>'
                };
            case 'get_forecast':
                return {
                    title: 'Weather Forecast',
                    description: `${args.location || '?'} on ${args.date || '?'}`,
                    runningText: 'Checking weather...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path><circle cx="12" cy="12" r="5"></circle></svg>'
                };
            case 'rent_car':
                return {
                    title: 'Car Rental',
                    description: `${args.location || '?'} from ${args.start_date || '?'} to ${args.end_date || '?'}`,
                    runningText: 'Searching cars...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>'
                };
            case 'book_flight':
                return {
                    title: 'Flight Booking',
                    description: `Booking for ${args.passenger_name || '?'}`,
                    runningText: 'Preparing...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"></path></svg>'
                };
            case 'book_train':
                return {
                    title: 'Train Booking',
                    description: `Booking for ${args.passenger_name || '?'}`,
                    runningText: 'Preparing...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 17h12"></path><path d="M7 4h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"></path><path d="M8 8h8"></path><path d="M8 12h8"></path></svg>'
                };
            case 'verify_travel_documents':
                return {
                    title: 'Document Check',
                    description: `${args.full_name || 'Traveler'} on ${args.destination_country || 'route review'}`,
                    runningText: 'Verifying...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M8 7h8"></path><path d="M8 11h8"></path><path d="M8 15h5"></path></svg>'
                };
            case 'process_payment':
                return {
                    title: 'Payment Setup',
                    description: `${args.amount || '?'} ${args.currency || ''}`,
                    runningText: 'Creating link...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>'
                };
            default:
                return {
                    title: formatToolName(name),
                    description: JSON.stringify(args),
                    runningText: 'Running...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
                };
        }
    }

    function tryParseJson(content) {
        try {
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    function updateToolResult(name, content, isError) {
        if (window.lastToolDiv) {
            const statusDiv = window.lastToolDiv.querySelector('.tool-status');
            const toolNameDiv = window.lastToolDiv.querySelector('.tool-name');
            const toolArgsDiv = window.lastToolDiv.querySelector('.tool-args');
            const toolDetailsDiv = window.lastToolDiv.querySelector('.tool-details');
            const parsedContent = tryParseJson(content);
            statusDiv.classList.remove('running');

            if (isError) {
                statusDiv.textContent = 'Error';
                statusDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                statusDiv.style.color = '#ef4444';
            } else {
                statusDiv.textContent = 'Completed';
                statusDiv.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                statusDiv.style.color = '#22c55e';

                if ((name === 'book_flight' || name === 'book_train') && parsedContent) {
                    if (parsedContent.status === 'pending_payment') {
                        statusDiv.textContent = 'Awaiting payment';
                        statusDiv.style.backgroundColor = 'rgba(11, 87, 208, 0.12)';
                        statusDiv.style.color = '#0b57d0';
                        toolArgsDiv.textContent = parsedContent.message || 'Payment is required before this booking can be confirmed.';
                    } else if (parsedContent.status === 'confirmed') {
                        toolArgsDiv.textContent = parsedContent.booking_reference
                            ? `Reference ${parsedContent.booking_reference}`
                            : (toolArgsDiv.textContent || 'Booking confirmed');
                    }
                }

                if (name === 'process_payment' && parsedContent) {
                    if (parsedContent.provider === 'razorpay') {
                        toolNameDiv.textContent = 'Razorpay Payment';
                        toolArgsDiv.textContent = `${parsedContent.amount || '?'} ${parsedContent.currency || ''} via Razorpay`;
                    }

                    if (parsedContent.status === 'failed') {
                        statusDiv.textContent = 'Error';
                        statusDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        statusDiv.style.color = '#ef4444';
                    } else if (parsedContent.mock) {
                        statusDiv.textContent = 'Demo';
                        statusDiv.style.backgroundColor = 'rgba(251, 188, 4, 0.12)';
                        statusDiv.style.color = '#b06000';
                    } else if (parsedContent.payment_status === 'created' && parsedContent.payment_url) {
                        statusDiv.textContent = 'Link Ready';
                        statusDiv.style.backgroundColor = 'rgba(11, 87, 208, 0.12)';
                        statusDiv.style.color = '#0b57d0';

                        let actionLink = toolDetailsDiv.querySelector('.tool-action-link');
                        if (!actionLink) {
                            actionLink = document.createElement('a');
                            actionLink.className = 'tool-action-link';
                            actionLink.target = '_blank';
                            actionLink.rel = 'noopener noreferrer';
                            actionLink.textContent = 'Open payment link';
                            toolDetailsDiv.appendChild(actionLink);
                        }
                        actionLink.href = parsedContent.payment_url;
                    }
                }
            }
            window.lastToolDiv = null;
        }
    }

    function formatToolName(name) {
        return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function setProcessing(processing) {
        isProcessing = processing;
        if (processing) {
            stopMicCapture({ keepTranscript: true });
        }
        userInput.disabled = processing;
        sendBtn.disabled = processing;
        updateMicButton();

        if (processing) {
            statusDot.classList.add('busy');
            statusText.textContent = 'Thinking...';

            // Add "Thinking" bubble
            const thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'message assistant thinking-bubble';
            thinkingDiv.id = 'thinking-indicator';
            thinkingDiv.innerHTML = `
                <div class="message-content">
                    <div class="thinking-wrapper">
                        <span class="thinking-text">Thinking</span>
                        <div class="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            `;
            chatContainer.appendChild(thinkingDiv);
            scrollToBottom();
        } else {
            statusDot.classList.remove('busy');
            statusText.textContent = 'Ready';
            userInput.focus();

            // Remove "Thinking" bubble
            const thinkingDiv = document.getElementById('thinking-indicator');
            if (thinkingDiv) {
                thinkingDiv.remove();
            }
        }
    }

    // Search History Functions
    function loadSearchHistory() {
        try {
            const saved = localStorage.getItem('travelSearchHistory');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading search history:', e);
            return [];
        }
    }

    function saveSearchHistory() {
        try {
            localStorage.setItem('travelSearchHistory', JSON.stringify(searchHistory));
        } catch (e) {
            console.error('Error saving search history:', e);
        }
    }

    function saveCurrentConversation() {
        if (!currentConversationId) return;

        const index = searchHistory.findIndex(c => c.id === currentConversationId);
        if (index !== -1) {
            searchHistory[index].messages = conversationMessages;
            saveSearchHistory();
        }
    }

    function addConversationToHistory(firstMessage) {
        const conversationItem = {
            id: currentConversationId,
            title: firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage,
            timestamp: new Date().toISOString(),
            messages: [] // Will be populated as we go
        };

        // Add to beginning (most recent first)
        searchHistory.unshift(conversationItem);

        // Limit history to 50 conversations
        if (searchHistory.length > 50) {
            searchHistory = searchHistory.slice(0, 50);
        }

        saveSearchHistory();
        renderHistory();
    }

    function startNewConversation() {
        // Clear current conversation
        stopVoicePlayback();
        stopVoicePreview();
        stopMicCapture({ keepTranscript: false });
        renderWelcomeState();
        currentConversationId = null;
        conversationMessages = [];
        userInput.value = '';
        userInput.focus();

        // Remove active class from history
        document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    }

    function loadConversation(id) {
        const conversation = searchHistory.find(c => c.id === id);
        if (!conversation) return;

        stopVoicePlayback();
        stopVoicePreview();
        stopMicCapture({ keepTranscript: false });
        currentConversationId = id;
        conversationMessages = conversation.messages || [];

        // Clear and rebuild chat
        chatContainer.innerHTML = getWelcomeMarkup();
        updatePlannerUI();
        if (conversationMessages.length > 0) {
            chatContainer.classList.add('has-messages');
        } else {
            chatContainer.classList.remove('has-messages');
        }

        // Replay messages
        isReplayingConversation = true;
        conversationMessages.forEach((msg, index) => {
            if (msg.role === 'tool_call_ui') {
                // Reconstruct tool call UI
                const toolDiv = document.createElement('div');
                toolDiv.className = 'tool-call';
                // We don't need ID for history items really

                const displayInfo = msg.displayInfo || getToolDisplayInfo(msg.name, msg.args);

                toolDiv.innerHTML = `
                    <div class="tool-icon">
                        ${displayInfo.icon}
                    </div>
                    <div class="tool-details">
                        <div class="tool-name">${displayInfo.title}</div>
                        <div class="tool-args">${displayInfo.description}</div>
                    </div>
                    <div class="tool-status completed" style="background-color: rgba(34, 197, 94, 0.1); color: #22c55e;">Completed</div>
                `;
                chatContainer.appendChild(toolDiv);
            } else {
                appendMessage(msg.role, msg.content, {
                    persist: false,
                    messageIndexOverride: index,
                    autoplay: false
                });
            }
        });
        isReplayingConversation = false;

        conversationMessages = conversation.messages || [];

        scrollToBottom();
        renderHistory();
    }

    function deleteConversation(id, event) {
        event.stopPropagation(); // Prevent clicking the item

        showConfirmModal(
            'Delete Conversation',
            'Are you sure you want to delete this conversation?',
            () => {
                searchHistory = searchHistory.filter(c => c.id !== id);
                saveSearchHistory();
                renderHistory();

                if (currentConversationId === id) {
                    startNewConversation();
                }
            }
        );
    }

    function renameConversation(id, newTitle) {
        const conversation = searchHistory.find(c => c.id === id);
        if (conversation) {
            conversation.title = newTitle;
            saveSearchHistory();
            renderHistory();
        }
    }

    function togglePinConversation(id) {
        const conversation = searchHistory.find(c => c.id === id);
        if (conversation) {
            conversation.pinned = !conversation.pinned;
            // Sort: pinned first, then by timestamp
            searchHistory.sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            saveSearchHistory();
            renderHistory();
        }
    }

    function renderHistory() {
        if (searchHistory.length === 0) {
            historyList.innerHTML = '<div class="history-empty">No search history yet</div>';
            return;
        }

        historyList.innerHTML = '';
        searchHistory.forEach((conversation) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            // Add active class if this is the current conversation
            if (conversation.id === currentConversationId) {
                historyItem.classList.add('active');
            }

            // Add pinned class if pinned
            if (conversation.pinned) {
                historyItem.classList.add('pinned');
            }

            historyItem.innerHTML = `
                <div class="history-item-content">
                    <div class="history-item-text">${escapeHtml(conversation.title)}</div>
                    <div class="history-item-time">${formatTimestamp(conversation.timestamp)}</div>
                </div>
                <div class="history-menu-wrapper">
                    <button class="history-menu-btn" title="Options">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"/>
                            <circle cx="12" cy="12" r="2"/>
                            <circle cx="12" cy="19" r="2"/>
                        </svg>
                    </button>
                    <div class="history-dropdown hidden">
                        <button class="dropdown-item share-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                            Share conversation
                        </button>
                        <button class="dropdown-item pin-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="17" x2="12" y2="22"/>
                                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                            </svg>
                            ${conversation.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button class="dropdown-item rename-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                            Rename
                        </button>
                        <button class="dropdown-item delete-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
            `;

            // Click on item to load conversation
            historyItem.querySelector('.history-item-content').addEventListener('click', () => {
                loadConversation(conversation.id);
            });

            // 3-dot menu toggle
            const menuBtn = historyItem.querySelector('.history-menu-btn');
            const dropdown = historyItem.querySelector('.history-dropdown');
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other dropdowns first
                document.querySelectorAll('.history-dropdown').forEach(d => d.classList.add('hidden'));

                // Position dropdown relative to button
                const rect = menuBtn.getBoundingClientRect();
                dropdown.style.top = `${rect.bottom + 4}px`;
                dropdown.style.left = `${rect.left - 150}px`; // Offset to align right edge

                dropdown.classList.toggle('hidden');
            });

            // Share button
            historyItem.querySelector('.share-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.add('hidden');
                const shareText = `Check out my conversation: ${conversation.title}`;
                if (navigator.share) {
                    navigator.share({ title: conversation.title, text: shareText });
                } else {
                    navigator.clipboard.writeText(shareText);
                    showToast('Copied to clipboard!');
                }
            });

            // Pin button
            historyItem.querySelector('.pin-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.add('hidden');
                togglePinConversation(conversation.id);
            });

            // Rename button
            historyItem.querySelector('.rename-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.add('hidden');
                showInputModal('Rename Conversation', 'Enter new title', conversation.title, (newTitle) => {
                    renameConversation(conversation.id, newTitle);
                });
            });

            // Delete button
            historyItem.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.add('hidden');
                deleteConversation(conversation.id, e);
            });

            historyList.appendChild(historyItem);
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.history-dropdown').forEach(d => d.classList.add('hidden'));
        });
    }

    function formatTimestamp(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }

    function showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('confirmation-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        if (!modal) return; // Safety check

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        modal.classList.remove('hidden');
        // Small delay to allow CSS transition
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300); // Match CSS transition duration
            cleanup();
        };

        const handleConfirm = () => {
            onConfirm();
            closeModal();
        };

        const handleCancel = () => {
            closeModal();
        };

        // Ensure we don't stack listeners if function called multiple times?
        // We use a cleanup function, but we need to make sure we remove PREVIOUS listeners if any exist?
        // Actually, with the closure, creating new listeners every time is fine IF we cleanup correctly.
        // But what if user clicks outside? 
        // Let's keep it simple: Add listeners, remove on close.
        // To be safe against double-binding if opened rapidly, maybe clone buttons? 
        // No, simple remove is improved by `once: true` if possible, but we need closure access.

        // Better implementation to avoid listener buildup:
        confirmBtn.onclick = handleConfirm;
        cancelBtn.onclick = handleCancel;
    }

    function showInputModal(title, placeholder, defaultValue, onConfirm) {
        const modal = document.getElementById('input-modal');
        const modalTitle = document.getElementById('input-modal-title');
        const inputField = document.getElementById('input-modal-field');
        const confirmBtn = document.getElementById('input-modal-confirm');
        const cancelBtn = document.getElementById('input-modal-cancel');

        if (!modal) return;

        modalTitle.textContent = title;
        inputField.placeholder = placeholder;
        inputField.value = defaultValue || '';

        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.add('active');
            inputField.focus();
            inputField.select();
        });

        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 200);
        };

        const handleConfirm = () => {
            const value = inputField.value.trim();
            if (value) {
                onConfirm(value);
            }
            closeModal();
        };

        const handleCancel = () => {
            closeModal();
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        };

        confirmBtn.onclick = handleConfirm;
        cancelBtn.onclick = handleCancel;
        inputField.onkeydown = handleKeydown;
    }

    function showToast(message) {
        const toast = document.getElementById('toast-notification');
        const toastMessage = document.getElementById('toast-message');

        if (!toast) return;

        toastMessage.textContent = message;
        toast.classList.remove('hidden');

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 300);
        }, 3000);
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
