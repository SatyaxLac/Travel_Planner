document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatContainer = document.getElementById('chat-container');
    const sendBtn = document.getElementById('send-btn');
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
    const paceOptions = ['Relaxed', 'Balanced', 'Packed'];
    const foodPreferenceOptions = ['Vegetarian', 'Non-vegetarian', 'Vegan', 'Jain', 'Seafood', 'No preference'];
    const languageOptions = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese'];
    const currencyOptions = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
    const genderOptions = ['Prefer not to say', 'Female', 'Male', 'Non-binary'];
    const ageGroupOptions = ['Under 18', '18-24', '25-34', '35-49', '50+'];
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
                pace: 'Balanced'
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

    function syncPlannerDerivedState(state = plannerState) {
        const nextState = state;
        nextState.trip_details.duration_days = clampInteger(nextState.trip_details.duration_days, 1, 30, 5);
        nextState.travelers.adults = clampInteger(nextState.travelers.adults, 1, 9, 2);
        nextState.travelers.children = clampInteger(nextState.travelers.children, 0, 6, 0);
        nextState.travelers.rooms = clampInteger(nextState.travelers.rooms, 1, 6, 1);
        nextState.stay_preferences.budget_total = clampInteger(nextState.stay_preferences.budget_total, 5000, 500000, 40000);

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
                        <input id="planner-departure-date" class="planner-input" type="date" data-path="trip_details.departure_date" value="${escapeHtml(plannerState.trip_details.departure_date)}">
                    </label>
                    <label class="planner-field" data-return-field>
                        <span class="planner-label">Return date</span>
                        <input id="planner-return-date" class="planner-input" type="date" data-path="trip_details.return_date" value="${escapeHtml(plannerState.trip_details.return_date)}">
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

        return {
            route,
            dates,
            travelerCount,
            travelerSummary,
            interestsSummary,
            personalSummary
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

        if (!trip.origin_city) errors[0].push('Choose an origin city.');
        if (!trip.destination_city) errors[0].push('Choose a destination city.');
        if (trip.origin_city && trip.destination_city && trip.origin_city.toLowerCase() === trip.destination_city.toLowerCase()) {
            errors[0].push('Origin and destination should be different.');
        }
        if (!trip.departure_date) errors[0].push('Select a departure date.');
        if (trip.date_mode === 'round_trip') {
            if (!trip.return_date) {
                errors[0].push('Select a return date or switch to duration-based planning.');
            } else if (trip.departure_date && trip.return_date <= trip.departure_date) {
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
        const returnInput = document.getElementById('planner-return-date');
        const durationInput = document.getElementById('planner-duration-days');
        const usesRoundTrip = plannerState.trip_details.date_mode === 'round_trip';
        if (returnField) returnField.hidden = !usesRoundTrip;
        if (durationField) durationField.hidden = usesRoundTrip;
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
            ${getSummarySectionCard('Preferences', summary.interestsSummary, `${plannerState.transport_preferences.preference} • ${plannerState.transport_preferences.pace}`, 3)}
            ${getSummarySectionCard('Personalization', summary.personalSummary, plannerState.personal_info.enabled ? 'Optional details included' : 'Still optional', 4)}
        `;
    }

    function renderPlannerReviewSections(summary) {
        const container = document.querySelector('[data-review-sections]');
        if (!container) return;

        container.innerHTML = `
            ${getReviewSectionCard('Route', summary.route, summary.dates, 0)}
            ${getReviewSectionCard('Travelers', summary.travelerSummary, plannerState.travelers.accessible_needs ? 'Accessible travel needs enabled' : 'Standard travel needs', 1)}
            ${getReviewSectionCard('Budget & Stay', `INR ${formatCurrencyInr(plannerState.stay_preferences.budget_total)} • ${plannerState.stay_preferences.budget_type}`, `${plannerState.stay_preferences.stay_type} • ${plannerState.stay_preferences.room_preference} • ${plannerState.stay_preferences.meal_preference}`, 2)}
            ${getReviewSectionCard('Preferences', summary.interestsSummary, `${plannerState.transport_preferences.preference} • ${plannerState.transport_preferences.pace} • ${plannerState.interests.food_preferences.join(', ')}`, 3)}
            ${getReviewSectionCard('Personalization', summary.personalSummary, plannerState.special_requirements.notes || 'No additional notes yet.', 4)}
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

    // Initialize history display
    renderHistory();
    renderWelcomeState();

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
                pace: plannerState.transport_preferences.pace
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
            special_requirements: {
                notes: plannerState.special_requirements.notes
            },
            submission_context: {
                source: 'web_booking_planner'
            }
        };
    }

    function getPlannerDisplayMessage() {
        const summary = getPlannerSummaryData();
        const lines = [
            'Trip planning request',
            `1. Route: ${summary.route}`,
            `2. Dates: ${summary.dates}`,
            `3. Travelers: ${summary.travelerSummary}`,
            `4. Budget & stay: INR ${formatCurrencyInr(plannerState.stay_preferences.budget_total)} • ${plannerState.stay_preferences.budget_type} • ${plannerState.stay_preferences.stay_type}`,
            `5. Preferences: ${summary.interestsSummary} • ${plannerState.transport_preferences.preference} • ${plannerState.transport_preferences.pace}`,
            `6. Personalization: ${summary.personalSummary}`
        ];

        if (plannerState.special_requirements.notes) {
            lines.push(`7. Notes: ${plannerState.special_requirements.notes}`);
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

    function appendMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const formattedContent = formatMessageContent(content);

        contentDiv.innerHTML = formattedContent;

        messageDiv.appendChild(contentDiv);
        chatContainer.appendChild(messageDiv);
        scrollToBottom();

        // Update internal state
        conversationMessages.push({ role, content });
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
                    runningText: 'Booking...',
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"></path></svg>'
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
        userInput.disabled = processing;
        sendBtn.disabled = processing;

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
        conversationMessages.forEach(msg => {
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
                appendMessage(msg.role, msg.content);
            }
        });

        // Remove duplicate messages from state (appendMessage adds them again)
        // Actually appendMessage adds to conversationMessages, so we should reset it before replaying
        // But wait, appendMessage pushes to conversationMessages. 
        // So if we loop and call appendMessage, we are doubling the array.
        // Let's fix this by decoupling UI rendering from state update in appendMessage, 
        // OR just reset conversationMessages after replaying?
        // Better: make appendMessage NOT update state, handle state separately.
        // But for now, let's just reset it to the loaded messages after replaying.
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
