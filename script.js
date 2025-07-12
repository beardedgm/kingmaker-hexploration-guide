// Main Application Logic
const HexplorationApp = {
    // State
    state: {
        party: [],
        currentDay: 1,
        currentStep: 'start-of-day', // Tracks the current phase of the exploration day
        activities: {
            total: 0,
            remaining: 0,
            used: [] // Stores type of activity used (e.g., 'travel', 'reconnoiter', 'individual')
        },
        currentHex: {
            // Core Hex Properties
            terrainType: 'plains',
            terrainDifficulty: 'open',
            hasRoad: false,
            hasRiver: false,
            isReconnoitered: false,
            isMapped: false,
            // Kingmaker Specific Properties
            zoneDC: 18, // Default example value, updated if Kingmaker mode is on
            zoneEncounterDC: 16 // Default example value, updated if Kingmaker mode is on
        },
        campFortified: false, // Tracks if Fortify Camp was successful for the current night
        forcedMarch: false,   // Tracks if the party is performing a Forced March today
        dayLog: [],           // Stores log messages for the current day
        // --- Kingmaker State ---
        isKingmakerMode: false, // Flag for Kingmaker rules
        weather: {              // Structure for weather conditions
            precipitation: 'none', // 'none', 'light', 'heavy'
            temperature: 'normal', // 'normal', 'mild cold', 'severe cold', etc.
            event: 'none'          // 'none', 'thunderstorm', 'blizzard', etc.
        },
        camping: {              // Structure for Kingmaker camping state
            prepareSuccessLevel: 'none', // 'none', 'success', 'criticalSuccess' - Result of Prepare Campsite check
            hoursSpent: 0,               // Hours spent in Camping Activities phase
            encounterDCModifier: 0     // Modifier to camping encounter DC (decreases per hour)
        }
        // --- End Kingmaker State ---
    },

    // Constants for game rules
    TERRAIN_ENCOUNTER_DCS: { // Base flat check DC for start-of-day encounter
        plains: 12,
        forest: 14,
        swamp: 14,
        mountain: 16,
        aquatic: 17,
        arctic: 17,
        desert: 17
    },
    SPEED_ACTIVITIES: { // Base activities per day based on slowest speed
        '10': 0.5,  // 10 feet or less
        '15': 1,    // 15-25 feet
        '30': 2,    // 30-40 feet
        '45': 3,    // 45-55 feet
        '60': 4     // 60 feet or more
    },
    TERRAIN_DIFFICULTY_COST: { // Base activity cost for Travel/Reconnoiter
        'open': 1,
        'difficult': 2,
        'greater-difficult': 3
    },

    // Initialize the application
    init: function() {
        this.setupEventListeners();
        this.renderPartyMembers(); // Initial render (likely empty)
        this.setupTabs();
        // Add listener for Kingmaker toggle to show/hide relevant inputs in Setup
        const kmToggle = document.getElementById('kingmaker-mode-toggle');
        if (kmToggle) { // Check if element exists before adding listener
            kmToggle.addEventListener('change', (e) => {
                const kmInputs = document.getElementById('kingmaker-hex-inputs');
                if (kmInputs) { // Check if element exists
                    if (e.target.checked) {
                        kmInputs.classList.remove('hidden');
                    } else {
                        kmInputs.classList.add('hidden');
                    }
                }
            });
        } else {
             console.error("Element with ID 'kingmaker-mode-toggle' not found.");
        }
         // Initial check in case the checkbox starts checked (e.g., browser remembers state)
         if (kmToggle && kmToggle.checked) {
              const kmInputs = document.getElementById('kingmaker-hex-inputs');
              if (kmInputs) kmInputs.classList.remove('hidden');
         }

    },

    // Setup primary event listeners for buttons that are always present
    setupEventListeners: function() {
        // Add character button
        const addCharBtn = document.getElementById('add-character-btn');
        if (addCharBtn) {
            addCharBtn.addEventListener('click', () => {
                this.addCharacter();
            });
        } else {
             console.error("Element with ID 'add-character-btn' not found.");
        }


        // Start exploration button
        const startExpBtn = document.getElementById('start-exploration-btn');
         if (startExpBtn) {
             startExpBtn.addEventListener('click', () => {
                 this.startExploration();
             });
         } else {
              console.error("Element with ID 'start-exploration-btn' not found.");
         }
    },

    // Setup tab switching functionality
    setupTabs: function() {
        const tabs = document.querySelectorAll('.tabs li');
        const tabContents = document.querySelectorAll('.tab-content');

         if (tabs.length === 0 || tabContents.length === 0) {
             console.error("Tabs or tab content elements not found.");
             return;
         }


        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate all tabs and hide all content
                tabs.forEach(t => t.classList.remove('is-active'));
                tabContents.forEach(content => {
                    if (!content.classList.contains('hidden')) {
                         content.classList.add('hidden');
                    }
                });

                // Activate the clicked tab
                tab.classList.add('is-active');

                // Show the corresponding content
                const tabId = tab.getAttribute('data-tab');
                 const activeContent = document.getElementById(tabId);
                 if (activeContent) {
                     activeContent.classList.remove('hidden');
                 } else {
                      console.error(`Tab content with ID '${tabId}' not found.`);
                 }
            });
        });
    },

    // Add a new character to the party state and re-render
    addCharacter: function() {
        const characterId = `character-${Date.now()}`; // Unique ID for the character element
        const character = {
            id: characterId,
            name: 'New Character',
            speed: 30,
            constitution: 2, // Constitution Modifier (not score)
            isFatigued: false,
            forcedMarchDays: 0,
            willRest: false // Temporary flag used during fatigue check
            // Add skill proficiencies or other stats here later if needed
        };

        this.state.party.push(character);
        this.renderPartyMembers(); // Update the UI
    },

    // Delete a character from the party state and re-render
    deleteCharacter: function(characterId) {
        this.state.party = this.state.party.filter(character => character.id !== characterId);
        this.renderPartyMembers(); // Update the UI
    },

    // Update a specific property of a character in the state
    updateCharacter: function(characterId, property, value) {
        const character = this.state.party.find(c => c.id === characterId);
        if (character) {
            // Ensure numeric values are stored as numbers
            if (property === 'speed' || property === 'constitution') {
                character[property] = parseInt(value, 10) || 0; // Default to 0 if parsing fails
            } else if (property === 'isFatigued') {
                 character[property] = Boolean(value);
            }
             else {
                character[property] = value;
            }
        } else {
             console.warn(`Character with ID ${characterId} not found for update.`);
        }
    },

    // Render the party member input boxes in the Setup tab
    renderPartyMembers: function() {
        const container = document.getElementById('party-members-container');
        if (!container) {
             console.error("Element with ID 'party-members-container' not found.");
             return;
        }
        container.innerHTML = ''; // Clear existing content

        if (this.state.party.length === 0) {
            container.innerHTML = '<div class="notification is-warning is-light">No characters added yet. Click "Add Character" below.</div>';
            return;
        }

        this.state.party.forEach(character => {
            const characterBox = document.createElement('div');
            characterBox.className = 'character-box box'; // Use Bulma 'box' for consistency
            characterBox.innerHTML = `
                <button class="delete" aria-label="delete" data-id="${character.id}"></button>
                <div class="field">
                    <label class="label is-small">Name</label>
                    <div class="control">
                        <input class="input is-small character-name" type="text" data-id="${character.id}" value="${character.name}">
                    </div>
                </div>
                <div class="field is-horizontal">
                     <div class="field-body">
                        <div class="field">
                            <label class="label is-small">Speed (ft)</label>
                            <div class="control">
                                <input class="input is-small character-speed" type="number" data-id="${character.id}" value="${character.speed}" min="5" step="5">
                            </div>
                        </div>
                        <div class="field">
                            <label class="label is-small">Con Mod</label>
                            <div class="control">
                                <input class="input is-small character-constitution" type="number" data-id="${character.id}" value="${character.constitution}" min="-5"> </div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(characterBox);
        });

        // Add event listeners AFTER elements are added to the DOM
        this.addCharacterEventListeners();
    },

    // Add event listeners to the input fields and delete buttons for characters
    addCharacterEventListeners: function() {
         // Delete buttons
        document.querySelectorAll('.character-box .delete').forEach(button => {
             // Remove existing listener to prevent duplicates if re-rendering
             button.replaceWith(button.cloneNode(true));
             const newButton = document.querySelector(`[data-id="${button.getAttribute('data-id')}"].delete`); // Re-select the cloned button
             if (newButton) {
                 newButton.addEventListener('click', (e) => {
                     const characterId = e.target.getAttribute('data-id');
                     this.deleteCharacter(characterId);
                 });
             }
        });

        // Name inputs
        document.querySelectorAll('.character-name').forEach(input => {
            input.replaceWith(input.cloneNode(true));
             const newInput = document.querySelector(`[data-id="${input.getAttribute('data-id')}"].character-name`);
             if (newInput) {
                 newInput.addEventListener('change', (e) => { // Use 'change' or 'input'
                     const characterId = e.target.getAttribute('data-id');
                     this.updateCharacter(characterId, 'name', e.target.value);
                 });
             }
        });

        // Speed inputs
        document.querySelectorAll('.character-speed').forEach(input => {
            input.replaceWith(input.cloneNode(true));
             const newInput = document.querySelector(`[data-id="${input.getAttribute('data-id')}"].character-speed`);
             if (newInput) {
                 newInput.addEventListener('change', (e) => {
                     const characterId = e.target.getAttribute('data-id');
                     this.updateCharacter(characterId, 'speed', parseInt(e.target.value, 10));
                 });
            }
        });

        // Constitution inputs
        document.querySelectorAll('.character-constitution').forEach(input => {
            input.replaceWith(input.cloneNode(true));
             const newInput = document.querySelector(`[data-id="${input.getAttribute('data-id')}"].character-constitution`);
             if (newInput) {
                 newInput.addEventListener('change', (e) => {
                     const characterId = e.target.getAttribute('data-id');
                     this.updateCharacter(characterId, 'constitution', parseInt(e.target.value, 10));
                 });
             }
        });
    },


    // Start the exploration process
    startExploration: function() {
        // Validate party has members
        if (this.state.party.length === 0) {
            alert('You need to add at least one character to the party.');
            return;
        }

        // Read Kingmaker Mode Toggle status
        const kmToggle = document.getElementById('kingmaker-mode-toggle');
        this.state.isKingmakerMode = kmToggle ? kmToggle.checked : false;


        // Set current hex information from the setup tab inputs
        const zoneDCInput = document.getElementById('zone-dc');
        const zoneEncDCInput = document.getElementById('zone-encounter-dc');

        this.state.currentHex = {
            terrainType: document.getElementById('terrain-type')?.value || 'plains',
            terrainDifficulty: document.getElementById('terrain-difficulty')?.value || 'open',
            hasRoad: document.getElementById('has-road')?.checked || false,
            hasRiver: document.getElementById('has-river')?.checked || false,
            isReconnoitered: document.getElementById('is-reconnoitered')?.checked || false,
            isMapped: document.getElementById('is-mapped')?.checked || false,
            // Read Kingmaker specific values only if mode is enabled
            zoneDC: this.state.isKingmakerMode ? (parseInt(zoneDCInput?.value, 10) || 18) : null,
            zoneEncounterDC: this.state.isKingmakerMode ? (parseInt(zoneEncDCInput?.value, 10) || 16) : null
        };

        // Reset state variables for a new exploration run
        this.state.currentDay = 1;
        this.state.currentStep = 'start-of-day';
        this.state.activities = { total: 0, remaining: 0, used: [] };
        this.state.campFortified = false;
        this.state.forcedMarch = false;
        this.state.dayLog = [];
         // Reset character temporary flags
         this.state.party.forEach(c => c.willRest = false);


        // Reset Kingmaker daily state (Weather will be determined at start of day)
        this.state.weather = { precipitation: 'none', temperature: 'normal', event: 'none' };
        this.state.camping = { prepareSuccessLevel: 'none', hoursSpent: 0, encounterDCModifier: 0 };


        // Add initial log message indicating mode
        this.addToLog(`Starting Exploration (Kingmaker Mode: ${this.state.isKingmakerMode ? 'Enabled' : 'Disabled'}).`);
        this.addToLog(`Starting Hex: ${this.state.currentHex.terrainType}, ${this.state.currentHex.terrainDifficulty}.`);

        // Switch view to the exploration tab
         const expTab = document.querySelector('[data-tab="exploration"]');
         if (expTab) {
             expTab.click(); // Simulate click to activate tab via setupTabs logic
         } else {
             console.error("Exploration tab element not found.");
             return; // Stop if we can't switch tabs
         }


        // Begin the first step of the day
        this.processCurrentStep();
    },

    // Central function to route to the correct logic based on the current step
    processCurrentStep: function() {
         console.log("Processing step:", this.state.currentStep); // Debug log
        // Clear previous action buttons before generating new ones
         const actionButtons = document.getElementById('action-buttons');
         if (actionButtons) {
             actionButtons.innerHTML = '';
         } else {
              console.error("Element #action-buttons not found.");
              return; // Stop if container is missing
         }

        switch (this.state.currentStep) {
            case 'start-of-day':
                this.startOfDay();
                break;
            case 'fatigue-check':
                this.fatigueCheck();
                break;
            case 'determine-activities':
                this.determineActivities();
                break;
            case 'forced-march-option':
                this.forcedMarchOption();
                break;
            case 'random-encounter': // Core start-of-day encounter check
                this.randomEncounter();
                break;
             // --- Placeholder for Kingmaker Weather Step ---
             case 'kingmaker-weather-checks':
                 this.kingmakerWeatherChecks(); // We will create this function
                 break;
             // --- End Placeholder ---
            case 'activity-selection':
                this.activitySelection();
                break;
            case 'group-activity':
                this.groupActivity();
                break;
            case 'individual-activities':
                this.individualActivities();
                break;
            case 'travel':
                this.travel();
                break;
            case 'reconnoiter':
                this.reconnoiter();
                break;
             // Note: Fortify Camp, Map Area, Subsist logic is currently embedded within individualActivities UI generation
            case 'end-of-day':
                this.endOfDay();
                break;
             // --- Placeholder for Kingmaker Camping Steps ---
              case 'kingmaker-prepare-campsite':
                  this.kingmakerPrepareCampsite(); // We will create this
                  break;
              case 'kingmaker-camping-activities':
                   this.kingmakerCampingActivities(); // We will create this
                   break;
             // --- End Placeholder ---
            default:
                console.error('Unknown step:', this.state.currentStep);
                this.addToLog(`Error: Unknown step encountered: ${this.state.currentStep}`);
        }

        // Update the sidebar UI after processing the step
        this.updateUI();
    },

    // --- Start of Day Steps ---

    // Initial setup for the day
    startOfDay: function() {
        // Update UI for the current day display
        const currentDayEl = document.getElementById('current-day');
        if (currentDayEl) currentDayEl.textContent = `Day ${this.state.currentDay}`;


        // Clear previous day's log from state (UI log clears in updateUI/addToLog)
        // this.state.dayLog = []; // Let's keep the log accumulating unless starting fresh exploration

        this.addToLog(`--- Starting Day ${this.state.currentDay} ---`);

        // Reset daily flags/state
        this.state.campFortified = false; // Reset fortification status
        this.state.forcedMarch = false; // Reset forced march decision for the day
        this.state.party.forEach(c => c.willRest = false); // Reset rest decision flag


        // Update main step container
        const stepContainer = document.getElementById('step-container');
         const actionButtons = document.getElementById('action-buttons');
         if (!stepContainer || !actionButtons) return; // Guard clause

        stepContainer.innerHTML = `
            <h3 class="title is-4">Start of Day ${this.state.currentDay}</h3>
            <p>Prepare for the day's exploration.</p>
        `;

        // Decide next step: Fatigue Check
         actionButtons.innerHTML = `
            <button id="continue-btn" class="button is-primary">Continue to Fatigue Check</button>
         `;
         this.addSingleEventListener('continue-btn', () => {
             this.state.currentStep = 'fatigue-check';
             this.processCurrentStep();
         });
    },

    // Check for fatigued characters and prompt for rest decision
    fatigueCheck: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
         if (!stepContainer || !actionButtons) return;

        // Identify characters who ended the *previous* day fatigued (and haven't recovered yet)
        // Note: Fatigue recovery happens *at the end* of the resting day.
        const fatiguedCharacters = this.state.party.filter(character => character.isFatigued);

        if (fatiguedCharacters.length > 0) {
            let characterOptionsHTML = '';
            fatiguedCharacters.forEach(character => {
                 // Assume they will rest by default
                 character.willRest = true; // Set default state for the UI toggle
                characterOptionsHTML += `
                    <div class="field">
                        <label class="label">${character.name} (Fatigued)</label>
                        <div class="control">
                            <label class="checkbox">
                                <input type="checkbox" class="rest-decision" data-id="${character.id}" checked>
                                Rest today to recover? (Cannot perform activities)
                            </label>
                        </div>
                    </div>
                `;
            });


            stepContainer.innerHTML = `
                <h3 class="title is-4">Fatigue Check</h3>
                <div class="notification is-warning">
                    <p>The following characters are currently fatigued:</p>
                    <ul>${fatiguedCharacters.map(c => `<li>${c.name}</li>`).join('')}</ul>
                    <p>Fatigued characters normally need to rest for the entire day (performing no activities) to recover. Decide if they will rest today.</p>
                </div>
                ${characterOptionsHTML}
            `;

             actionButtons.innerHTML = `
                 <button id="confirm-rest-btn" class="button is-primary">Confirm Resting Decisions</button>
             `;

            // Add listeners for the checkboxes
             document.querySelectorAll('.rest-decision').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const characterId = e.target.getAttribute('data-id');
                    const character = this.state.party.find(c => c.id === characterId);
                    if (character) {
                        character.willRest = e.target.checked;
                    }
                });
            });

             // Add listener for the confirmation button
             this.addSingleEventListener('confirm-rest-btn', () => {
                 // Log the decisions
                 fatiguedCharacters.forEach(character => {
                     if (character.willRest) {
                         this.addToLog(`${character.name} is resting today to recover from fatigue.`);
                         // Note: Actual fatigue removal happens at endOfDay
                     } else {
                         this.addToLog(`${character.name} is pushing through fatigue and will NOT rest today.`);
                     }
                 });
                 // Decide next step: Determine Activities
                 this.state.currentStep = 'determine-activities';
                 this.processCurrentStep();
             });

        } else {
            // No fatigued characters
            stepContainer.innerHTML = `
                <h3 class="title is-4">Fatigue Check</h3>
                <p>No characters are currently fatigued. Ready to determine activities!</p>
            `;
             actionButtons.innerHTML = `
                <button id="continue-btn" class="button is-primary">Continue to Activity Determination</button>
             `;
             this.addSingleEventListener('continue-btn', () => {
                 this.state.currentStep = 'determine-activities';
                 this.processCurrentStep();
             });
        }
    },

    // Determine the number of hexploration activities based on slowest active character
    determineActivities: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
        if (!stepContainer || !actionButtons) return;

        // Get characters who are NOT resting today
        const activeCharacters = this.state.party.filter(character => !character.willRest);

        if (activeCharacters.length === 0) {
            // All characters are resting (due to fatigue)
            stepContainer.innerHTML = `
                <h3 class="title is-4">Activity Determination</h3>
                <div class="notification is-danger">
                    <p>All characters are resting today. No hexploration activities can be performed.</p>
                </div>
            `;
             actionButtons.innerHTML = `
                <button id="skip-day-btn" class="button is-warning">Skip to End of Day</button>
             `;
             this.addSingleEventListener('skip-day-btn', () => {
                  this.addToLog("All characters resting; skipping activity phase.");
                 this.state.currentStep = 'end-of-day';
                 this.processCurrentStep();
             });
            return; // Stop further processing for this step
        }

        // Find the slowest character among those participating
        // Ensure speed is treated as a number
        const slowestCharacter = activeCharacters.reduce((slowest, current) => {
             return (parseInt(slowest.speed) < parseInt(current.speed)) ? slowest : current;
        });
        const slowestSpeed = parseInt(slowestCharacter.speed);


        // Determine activities based on the constant map
        let activitiesPerDay = 0;
        if (slowestSpeed <= 10) activitiesPerDay = this.SPEED_ACTIVITIES['10'];
        else if (slowestSpeed <= 25) activitiesPerDay = this.SPEED_ACTIVITIES['15'];
        else if (slowestSpeed <= 40) activitiesPerDay = this.SPEED_ACTIVITIES['30'];
        else if (slowestSpeed <= 55) activitiesPerDay = this.SPEED_ACTIVITIES['45'];
        else activitiesPerDay = this.SPEED_ACTIVITIES['60'];


        // Store activities in state
        // TODO: Handle accumulation for 0.5 activity speed across days? For now, just setting for the day.
        this.state.activities.total = activitiesPerDay;
        this.state.activities.remaining = activitiesPerDay;
        this.state.activities.used = [];

        stepContainer.innerHTML = `
            <h3 class="title is-4">Activity Determination</h3>
            <p>The slowest active character is ${slowestCharacter.name} with a speed of ${slowestSpeed} feet.</p>
            <p>Based on this speed, the party has <strong>${activitiesPerDay === 0.5 ? '1/2 (half)' : activitiesPerDay}</strong> hexploration activity points for today.</p>
            ${activitiesPerDay === 0.5 ? '<p class="has-text-danger notification is-danger is-light">This means it takes 2 days to complete a single full activity!</p>' : ''}
        `;

        this.addToLog(`Party has ${activitiesPerDay === 0.5 ? '1/2' : activitiesPerDay} hexploration activities today (Slowest: ${slowestCharacter.name}, ${slowestSpeed} ft).`);

        // Decide next step: Forced March Option
         actionButtons.innerHTML = `
            <button id="continue-btn" class="button is-primary">Continue to Forced March Option</button>
         `;
         this.addSingleEventListener('continue-btn', () => {
             this.state.currentStep = 'forced-march-option';
             this.processCurrentStep();
         });
    },

    // Present the option to perform a Forced March
    forcedMarchOption: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
        if (!stepContainer || !actionButtons) return;

        // Check if anyone *started* the day fatigued (even if they aren't resting)
        // Forced march is only possible if NO ONE is fatigued at the start of the decision.
        const anyFatigued = this.state.party.some(character => character.isFatigued);

        if (anyFatigued) {
            // Can't do a forced march if anyone is fatigued
            stepContainer.innerHTML = `
                <h3 class="title is-4">Forced March Option</h3>
                <div class="notification is-warning">
                    <p>At least one party member (${this.state.party.filter(c=>c.isFatigued).map(c=>c.name).join(', ')}) is currently fatigued. A forced march is not possible today.</p>
                </div>
            `;
             this.addToLog("Forced March not possible due to fatigued members.");
             // Decide next step based on mode
             const nextStep = this.state.isKingmakerMode ? 'kingmaker-weather-checks' : 'random-encounter';
              actionButtons.innerHTML = `
                 <button id="continue-btn" class="button is-primary">Continue to ${this.state.isKingmakerMode ? 'Weather Checks' : 'Random Encounter Check'}</button>
             `;
             this.addSingleEventListener('continue-btn', () => {
                 this.state.currentStep = nextStep;
                 this.processCurrentStep();
             });
            return;
        }

        // Present forced march option
        stepContainer.innerHTML = `
            <h3 class="title is-4">Forced March Option</h3>
            <div class="box content">
                <p>The party can choose to perform a <strong>Forced March</strong> today.</p>
                <ul>
                    <li>Gain an extra Travel activity (or a full Travel activity for a 10ft- Speed group).</li>
                    <li>This Travel activity is the <strong>ONLY</strong> hexploration activity the party can perform today.</li>
                    <li>Each character adds 1 to their consecutive Forced March Day count.</li>
                    <li>If a character's Forced March Day count exceeds their Constitution modifier (minimum 1), they become Fatigued at the <strong>end of this day</strong>.</li>
                 </ul>
                <p>Do the players want to perform a Forced March today?</p>
            </div>
        `;

         actionButtons.innerHTML = `
            <div class="buttons">
                <button id="forced-march-yes" class="button is-warning">Yes, Forced March</button>
                <button id="forced-march-no" class="button is-info">No, Normal Day</button>
            </div>
         `;

         // Event listener for YES
         this.addSingleEventListener('forced-march-yes', () => {
             this.state.forcedMarch = true; // Set flag for the day

             // Determine the single travel activity available
             let travelActivities = (this.state.activities.total === 0.5) ? 1 : 1; // Base: 1 Travel activity for forced march

             // Update state activities - Forced march grants ONLY travel
             this.state.activities.total = travelActivities;
             this.state.activities.remaining = travelActivities;
             this.state.activities.used = []; // Reset used activities

             this.addToLog('Party is performing a Forced March today. They gain 1 Travel activity and can perform no others.');

             // Increment forced march days for fatigue check at end of day
             this.state.party.forEach(character => {
                  // We only increment the count here. Fatigue check happens at endOfDay.
                 character.forcedMarchDays = (character.forcedMarchDays || 0) + 1;
             });

             // Decide next step based on mode
             const nextStep = this.state.isKingmakerMode ? 'kingmaker-weather-checks' : 'random-encounter';
             this.state.currentStep = nextStep;
             this.processCurrentStep();
         });

         // Event listener for NO
         this.addSingleEventListener('forced-march-no', () => {
             this.state.forcedMarch = false;
             this.addToLog('Party declined to perform a Forced March.');
             // Reset consecutive forced march days if they didn't force march today
             this.state.party.forEach(character => {
                 character.forcedMarchDays = 0;
             });

             // Decide next step based on mode
             const nextStep = this.state.isKingmakerMode ? 'kingmaker-weather-checks' : 'random-encounter';
             this.state.currentStep = nextStep;
             this.processCurrentStep();
         });
    },

     // --- Kingmaker Weather Placeholder ---
     kingmakerWeatherChecks: function() {
         const stepContainer = document.getElementById('step-container');
         const actionButtons = document.getElementById('action-buttons');
         if (!stepContainer || !actionButtons) return;

         // TODO: Implement Kingmaker Weather Logic
         // 1. Precipitation Check (based on season - need season state)
         // 2. Temperature Check (Winter only - based on month - need date/month state)
         // 3. Weather Event Check (DC 17 flat check)
         // For now, just skip to random encounter check

         stepContainer.innerHTML = `
             <h3 class="title is-4">Kingmaker Weather Checks</h3>
             <div class="notification is-info is-light">
                 Weather checks would happen here (Precipitation, Temperature, Events).
                 <br><em>(Not yet implemented)</em>
             </div>
         `;
          this.addToLog("Skipping Kingmaker weather checks (Not Implemented).");

         // Decide next step: Random Encounter Check (Core)
         actionButtons.innerHTML = `
             <button id="continue-btn" class="button is-primary">Continue to Random Encounter Check</button>
         `;
         this.addSingleEventListener('continue-btn', () => {
             this.state.currentStep = 'random-encounter';
             this.processCurrentStep();
         });
     },


    // Perform the core start-of-day random encounter check
    randomEncounter: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
        if (!stepContainer || !actionButtons) return;


        // Determine base DC from terrain constant
        let baseDC = this.TERRAIN_ENCOUNTER_DCS[this.state.currentHex.terrainType] || 14; // Default if terrain type unknown
        let encounterDC = baseDC;
        let modifiers = [];

        // Apply modifiers
        if (this.state.currentHex.hasRoad) {
            encounterDC -= 2;
            modifiers.push("Road (-2 DC)");
        }
         if (this.state.currentHex.hasRiver && !this.state.currentHex.hasRoad) { // Roads often include bridges over rivers
             encounterDC -= 2;
              modifiers.push("River (-2 DC)");
         }
         // Add flying modifier if applicable (needs state tracking)
         // if (this.state.partyIsFlying) { encounterDC += 3; modifiers.push("Flying (+3 DC)"); }


        // Ensure DC doesn't go below a minimum (e.g., 5?) - Rule check needed, assuming 5 for now.
        encounterDC = Math.max(5, encounterDC);

        // Present random encounter check details
        stepContainer.innerHTML = `
            <h3 class="title is-4">Random Encounter Check (Start of Day)</h3>
            <div class="box content">
                <p>At the start of each day, roll a flat check (d20) to determine if a random encounter occurs.</p>
                <ul>
                    <li>Base DC for ${this.state.currentHex.terrainType}: ${baseDC}</li>
                    ${modifiers.length > 0 ? `<li>Modifiers: ${modifiers.join(', ')}</li>` : ''}
                     <li><strong>Final Encounter DC: ${encounterDC}</strong></li>
                 </ul>
                <p>Have a player roll a d20.</p>
            </div>
             <div class="field">
                 <label class="label">Result of d20 roll:</label>
                 <div class="control">
                     <input id="encounter-roll" class="input" type="number" min="1" max="20" placeholder="Enter d20 result">
                 </div>
             </div>
        `;

        actionButtons.innerHTML = `
            <button id="check-encounter-btn" class="button is-primary">Check Encounter Result</button>
        `;

        this.addSingleEventListener('check-encounter-btn', () => {
            const rollInput = document.getElementById('encounter-roll');
             const roll = parseInt(rollInput?.value, 10);

             if (isNaN(roll) || roll < 1 || roll > 20) {
                 alert("Please enter a valid d20 roll (1-20).");
                 return;
             }


            let resultText = '';
            let encounterCount = 0;
             let outcomeClass = 'is-success'; // Default to success (no encounter)

            if (roll >= encounterDC + 10) {
                resultText = `<strong>Critical Success!</strong> (Rolled ${roll} vs DC ${encounterDC}). Two random encounters occur today.`;
                encounterCount = 2;
                 outcomeClass = 'is-danger';
            } else if (roll >= encounterDC) {
                resultText = `<strong>Success!</strong> (Rolled ${roll} vs DC ${encounterDC}). One random encounter occurs today.`;
                encounterCount = 1;
                 outcomeClass = 'is-warning';
            } else {
                resultText = `<strong>Failure.</strong> (Rolled ${roll} vs DC ${encounterDC}). No random encounter at the start of the day.`;
                encounterCount = 0;
                 outcomeClass = 'is-success';
            }

            this.addToLog(`Start of Day Encounter Check: Rolled ${roll} vs DC ${encounterDC}. Result: ${encounterCount > 0 ? encounterCount + ' encounter(s)' : 'None'}.`);


            // Display encounter result and prompt for type if needed
            let encounterTypePrompts = '';
            if (encounterCount > 0) {
                 encounterTypePrompts += `
                     <div class="mt-4 box content">
                         <h5 class="title is-5">Determine Encounter Type(s)</h5>
                         <p>For each encounter, roll d10 on the table below (or use specific tables for the region):</p>
                         <ul><li>1-5: Harmless</li><li>6-7: Hazard</li><li>8-10: Creature</li></ul>
                 `;
                 for (let i = 1; i <= encounterCount; i++) {
                      encounterTypePrompts += `
                          <div class="field">
                             <label class="label">Encounter #${i} Type:</label>
                             <div class="control">
                                 <div class="select is-fullwidth">
                                     <select id="encounter-type-${i}">
                                         <option value="harmless">Harmless (1-5)</option>
                                         <option value="hazard">Hazard (6-7)</option>
                                         <option value="creature">Creature (8-10)</option>
                                     </select>
                                 </div>
                             </div>
                         </div>
                      `;
                 }
                 encounterTypePrompts += `
                     <p class="mt-2 has-text-weight-bold">Important: Resolve these encounters. If they take significant time (hours), manually adjust available hexploration activities later if needed.</p>
                     </div>
                 `;
            }


            stepContainer.innerHTML += `
                <div class="notification ${outcomeClass} mt-4">
                    ${resultText}
                </div>
                ${encounterTypePrompts}
            `;

            // Update action buttons
            actionButtons.innerHTML = `
                <button id="continue-btn" class="button is-primary">Continue to Activity Selection</button>
            `;

             this.addSingleEventListener('continue-btn', () => {
                 // Log selected encounter types if any
                 if (encounterCount > 0) {
                      for (let i = 1; i <= encounterCount; i++) {
                           const typeSelect = document.getElementById(`encounter-type-${i}`);
                           if (typeSelect) {
                               this.addToLog(`Encounter ${i} type determined as: ${typeSelect.value}. (Resolution and time impact handled manually).`);
                           }
                      }
                 }

                 // Proceed to the next step
                 this.state.currentStep = 'activity-selection';
                 this.processCurrentStep();
             });
        });
    },


    // --- Activity Phase Steps ---

    // Main decision point for performing activities
    activitySelection: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
        if (!stepContainer || !actionButtons) return;

        // If this is a forced march day, the only option is Travel.
        if (this.state.forcedMarch) {
            stepContainer.innerHTML = `
                <h3 class="title is-4">Activity Selection</h3>
                <div class="notification is-warning">
                    <p>This is a Forced March day. The party can only perform the granted Travel activity.</p>
                     <p>Remaining Activities: ${this.state.activities.remaining}</p>
                </div>
            `;
             actionButtons.innerHTML = `
                <button id="travel-btn" class="button is-primary">Perform Forced March Travel</button>
             `;
             this.addSingleEventListener('travel-btn', () => {
                 this.state.currentStep = 'travel';
                 this.processCurrentStep();
             });
            return; // Stop here for forced march
        }

        // Check if we still have activities remaining
        if (this.state.activities.remaining <= 0) {
            stepContainer.innerHTML = `
                <h3 class="title is-4">Activity Selection</h3>
                <div class="notification is-info">
                    <p>The party has used all available hexploration activity points for today.</p>
                </div>
            `;
            actionButtons.innerHTML = `
                <button id="end-day-btn" class="button is-primary">Proceed to End of Day</button>
            `;
             this.addSingleEventListener('end-day-btn', () => {
                 this.state.currentStep = 'end-of-day';
                 this.processCurrentStep();
             });
            return; // Stop here if out of activities
        }

        // Handle the 0.5 activity case specifically
        if (this.state.activities.total === 0.5) {
            // This assumes the 0.5 isn't accumulated yet. More complex logic needed for accumulation.
            stepContainer.innerHTML = `
                <h3 class="title is-4">Activity Selection</h3>
                <div class="notification is-warning">
                    <p>The party has only 1/2 activity point today (due to slow speed).</p>
                     <p>They can choose to start a 1-point activity (like Travel in open terrain, Reconnoiter in open terrain, or Individual Activities) which will consume today's 1/2 point and require another 1/2 point tomorrow to complete.</p>
                     <p>Alternatively, they can choose to effectively rest or perform minor tasks that don't count as a hexploration activity and end the activity phase for today.</p>
                     <p>Remaining Activity Points: ${this.state.activities.remaining}</p>
                </div>
            `;
            actionButtons.innerHTML = `
                <div class="buttons">
                    <button id="start-half-activity-btn" class="button is-primary">Start 1-Point Activity (Uses 0.5 today)</button>
                    <button id="skip-half-activity-btn" class="button is-info">Skip Activity Today</button>
                </div>
            `;

            this.addSingleEventListener('start-half-activity-btn', () => {
                 // We need to let them choose WHICH activity, then mark it as started.
                 // For now, let's just go to the choice screen but note it's only the first half.
                 this.addToLog("Party starting a 1-point activity (using 0.5 points today). Requires completion tomorrow.");
                 // Deduct the half point
                 this.state.activities.remaining = 0;
                 // TODO: Add state to track the *pending* activity type for tomorrow.
                 // For now, proceed to choice, but it won't deduct full cost yet.
                 // We'll present the standard choice, but the outcome logic needs adjustment later.

                 stepContainer.innerHTML = `
                     <h3 class="title is-4">Activity Selection (Starting Half)</h3>
                     <p>Remaining Activity Points: ${this.state.activities.remaining}</p>
                     <p>Choose the 1-point activity to begin today (Travel/Reconnoiter in Open terrain, or Individual Activities):</p>
                 `;
                  actionButtons.innerHTML = `
                     <div class="buttons">
                         <button id="group-btn" class="button is-primary">Group Activity</button>
                         <button id="individual-btn" class="button is-info">Individual Activities</button>
                     </div>
                  `;
                   this.addSingleEventListener('group-btn', () => {
                       this.state.activities.used.push('group-started'); // Mark as started
                       this.state.currentStep = 'group-activity'; // Go to group choice
                       this.processCurrentStep(); // Process normally, but cost calculation needs future adjustment
                   });
                    this.addSingleEventListener('individual-btn', () => {
                       this.state.activities.used.push('individual-started'); // Mark as started
                       this.state.currentStep = 'individual-activities'; // Go to individual choice
                       this.processCurrentStep(); // Process normally, but cost calculation needs future adjustment
                   });
             });

            this.addSingleEventListener('skip-half-activity-btn', () => {
                this.addToLog('Party chose not to use their 1/2 activity point today.');
                 this.state.activities.remaining = 0; // Used up the day even if not starting activity
                this.state.currentStep = 'end-of-day';
                this.processCurrentStep();
            });

            return; // Stop here for half activity case
        }


        // Normal activity selection for groups with >= 1 activity point
        stepContainer.innerHTML = `
            <h3 class="title is-4">Activity Selection</h3>
            <p>The party has <strong>${this.state.activities.remaining}</strong> hexploration activity points remaining today.</p>
            <p>Choose the next action:</p>
            <div class="box content">
                <ul>
                    <li><strong>Group Activity:</strong> The entire party performs the same activity (Travel or Reconnoiter). Cost varies by terrain.</li>
                    <li><strong>Individual Activities:</strong> Each active character performs their own task (Fortify Camp, Map, Subsist, etc.). Costs 1 activity point for the group.</li>
                    <li><strong>End the Day:</strong> Stop exploring and proceed to make camp.</li>
                </ul>
             </div>
        `;

        actionButtons.innerHTML = `
            <div class="buttons">
                <button id="group-btn" class="button is-primary">Group Activity</button>
                <button id="individual-btn" class="button is-info">Individual Activities</button>
                <button id="end-day-btn" class="button is-warning">End Day Early</button>
            </div>
        `;

        this.addSingleEventListener('group-btn', () => {
            this.state.currentStep = 'group-activity';
            this.processCurrentStep();
        });

        this.addSingleEventListener('individual-btn', () => {
            this.state.currentStep = 'individual-activities';
            this.processCurrentStep();
        });

        this.addSingleEventListener('end-day-btn', () => {
            this.addToLog(`Party chose to end the day early with ${this.state.activities.remaining} activity points remaining.`);
            this.state.currentStep = 'end-of-day';
            this.processCurrentStep();
        });
    },


    // Present options for Group Activities (Travel or Reconnoiter)
    groupActivity: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
        if (!stepContainer || !actionButtons) return;

        stepContainer.innerHTML = `
            <h3 class="title is-4">Group Activity</h3>
            <p>Remaining Activity Points: ${this.state.activities.remaining}</p>
            <p>The entire party performs the same activity together. Choose one:</p>
            <div class="box">
                <h4 class="title is-5">Travel</h4>
                <p>Move from the current hex to an adjacent hex.</p>
                <p>Cost depends on <strong>destination</strong> terrain difficulty (Roads reduce cost).</p>
            </div>
            <div class="box">
                <h4 class="title is-5">Reconnoiter</h4>
                <p>Thoroughly explore the <strong>current</strong> hex.</p>
                <p>Cost depends on <strong>current</strong> hex terrain difficulty (Roads do NOT reduce cost).</p>
                ${this.state.currentHex.isReconnoitered ? '<p class="has-text-danger">This hex is already reconnoitered!</p>' : ''}
             </div>
        `;

        actionButtons.innerHTML = `
            <div class="buttons">
                <button id="travel-btn" class="button is-primary">Travel</button>
                 <button id="reconnoiter-btn" class="button is-info" ${this.state.currentHex.isReconnoitered ? 'disabled' : ''}>
                    Reconnoiter ${this.state.currentHex.isReconnoitered ? '(Already Done)' : ''}
                 </button>
                <button id="back-btn" class="button is-light">Back to Activity Selection</button>
            </div>
        `;

        this.addSingleEventListener('travel-btn', () => {
            this.state.currentStep = 'travel';
            this.processCurrentStep();
        });

         // Only add listener if the button is not disabled
         const reconnoiterBtn = document.getElementById('reconnoiter-btn');
         if (reconnoiterBtn && !reconnoiterBtn.disabled) {
             this.addSingleEventListener('reconnoiter-btn', () => {
                 this.state.currentStep = 'reconnoiter';
                 this.processCurrentStep();
             });
         }


        this.addSingleEventListener('back-btn', () => {
            this.state.currentStep = 'activity-selection';
            this.processCurrentStep();
        });
    },


    // Allow selection of individual activities for each active character
    individualActivities: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
         if (!stepContainer || !actionButtons) return;

        // Get characters who are participating (not resting)
        const activeCharacters = this.state.party.filter(character => !character.willRest);

        if (activeCharacters.length === 0) {
             // Should not happen if check in determineActivities works, but as a fallback
             stepContainer.innerHTML = `<h3 class="title is-4">Individual Activities</h3><p>No active characters to perform individual activities.</p>`;
              actionButtons.innerHTML = `<button id="back-btn" class="button is-light">Back</button>`;
              this.addSingleEventListener('back-btn', () => {
                  this.state.currentStep = 'activity-selection';
                  this.processCurrentStep();
              });
             return;
        }

        let characterFormsHTML = '';
        activeCharacters.forEach(character => {
            // Determine which options are valid
             const canMap = this.state.currentHex.isReconnoitered;
             // Add other condition checks here (e.g., skills needed, items needed) if implemented

            characterFormsHTML += `
                <div class="box character-activity-choice">
                    <h5 class="title is-6">${character.name}</h5>
                    <div class="field">
                        <label class="label is-small">Activity for ${character.name}:</label>
                        <div class="control">
                            <div class="select is-fullwidth is-small">
                                <select class="individual-activity-select" data-id="${character.id}">
                                    <option value="none">--- Select Activity ---</option>
                                     <option value="fortify-camp">Fortify Camp (Crafting)</option>
                                    <option value="map-area" ${!canMap ? 'disabled' : ''}>
                                        Map the Area (Survival) ${!canMap ? '- Requires Reconnoitered Hex' : ''}
                                    </option>
                                    <option value="subsist">Subsist (Survival)</option>
                                    <option value="aid">Aid Another (GM determines check)</option>
                                    <option value="seek">Seek / Scout Ahead (Perception)</option>
                                    <option value="rest-short">Rest / Minor Task (No check)</option>
                                    <option value="other">Other Action (Specify)</option>
                                </select>
                            </div>
                        </div>
                         <div class="field other-activity-description hidden mt-2">
                              <label class="label is-small">Specify "Other" Action:</label>
                              <div class="control">
                                  <input type="text" class="input is-small other-activity-input" data-id="${character.id}" placeholder="Describe action">
                              </div>
                         </div>
                    </div>
                </div>
            `;
        });

        stepContainer.innerHTML = `
            <h3 class="title is-4">Individual Activities</h3>
            <p>Remaining Activity Points: ${this.state.activities.remaining}</p>
            <p>Each active character can perform a different activity below. This uses <strong>1</strong> group activity point in total.</p>
            ${characterFormsHTML}
        `;

        actionButtons.innerHTML = `
            <div class="buttons">
                <button id="complete-activities-btn" class="button is-primary">Confirm & Complete Activities</button>
                <button id="back-btn" class="button is-light">Back to Activity Selection</button>
            </div>
        `;

        // Add listeners for the "Other" description fields
         document.querySelectorAll('.individual-activity-select').forEach(select => {
            select.addEventListener('change', (e) => {
                 const characterId = e.target.getAttribute('data-id');
                 const otherDescField = document.querySelector(`.other-activity-description .other-activity-input[data-id="${characterId}"]`)?.closest('.field');
                 if (otherDescField) {
                      if (e.target.value === 'other') {
                           otherDescField.classList.remove('hidden');
                      } else {
                           otherDescField.classList.add('hidden');
                      }
                 }
            });
        });


        // Listener for the confirmation button
        this.addSingleEventListener('complete-activities-btn', () => {
            let activitiesPerformed = [];
             let requiresConfirmation = false; // Flag if any activities require GM input/checks

            activeCharacters.forEach(character => {
                const selectElement = document.querySelector(`.individual-activity-select[data-id="${character.id}"]`);
                const activityType = selectElement ? selectElement.value : 'none';
                let description = activityType;

                if (activityType === 'none') {
                     // Skip if no activity selected for this character
                     return;
                }
                 if (activityType === 'other') {
                     const otherInput = document.querySelector(`.other-activity-input[data-id="${character.id}"]`);
                      description = `Other: ${otherInput?.value || 'Not specified'}`;
                 }


                 activitiesPerformed.push({
                     characterName: character.name,
                     activity: activityType,
                     description: description
                 });

                 // Check if this activity requires confirmation/check results
                 if (activityType === 'fortify-camp' || activityType === 'map-area' || activityType === 'subsist' || activityType === 'seek' || activityType === 'aid' || activityType === 'other') {
                     requiresConfirmation = true;
                 }
             });

             if (activitiesPerformed.length === 0) {
                 alert("Please select an activity for at least one character.");
                 return;
             }


             // Log the chosen activities
             this.addToLog(`Starting Individual Activities (Cost: 1 point):`);
             activitiesPerformed.forEach(act => {
                 this.addToLog(`- ${act.characterName}: ${act.description}`);
             });


            // If any activities require checks, show a confirmation step
            if (requiresConfirmation) {
                this.presentIndividualActivityChecks(activitiesPerformed);
            } else {
                 // If only simple activities (like Rest), just deduct cost and move on
                 this.addToLog("Completed simple individual activities.");
                 this.state.activities.remaining -= 1;
                 this.state.activities.used.push('individual');
                 this.state.currentStep = 'activity-selection'; // Go back to select next activity or end day
                 this.processCurrentStep();
            }

        });

        this.addSingleEventListener('back-btn', () => {
            this.state.currentStep = 'activity-selection';
            this.processCurrentStep();
        });
    },

     // Helper function to show confirmation/input for individual activities
     presentIndividualActivityChecks: function(activities) {
         const stepContainer = document.getElementById('step-container');
         const actionButtons = document.getElementById('action-buttons');
         if (!stepContainer || !actionButtons) return;

         let checkPromptsHTML = '';
          activities.forEach((act, index) => {
              let prompt = '';
              switch(act.activity) {
                  case 'fortify-camp':
                       prompt = `
                           <p><strong>${act.characterName} - Fortify Camp:</strong> Enter Crafting check result.</p>
                           <div class="field is-horizontal">
                               <div class="field-label is-normal"><label class="label">Result:</label></div>
                               <div class="field-body"><div class="field"><p class="control"><input id="check-result-${index}" class="input is-small" type="number" placeholder="e.g., 18"></p></div></div>
                               <div class="field-label is-normal"><label class="label">DC:</label></div>
                               <div class="field-body"><div class="field"><p class="control"><input id="check-dc-${index}" class="input is-small" type="number" placeholder="Terrain DC"></p></div></div>
                           </div>`;
                       break;
                  case 'map-area':
                       prompt = `
                           <p><strong>${act.characterName} - Map the Area:</strong> Enter Survival check result.</p>
                            <div class="field is-horizontal">
                               <div class="field-label is-normal"><label class="label">Result:</label></div>
                               <div class="field-body"><div class="field"><p class="control"><input id="check-result-${index}" class="input is-small" type="number" placeholder="e.g., 15"></p></div></div>
                               <div class="field-label is-normal"><label class="label">DC:</label></div>
                               <div class="field-body"><div class="field"><p class="control"><input id="check-dc-${index}" class="input is-small" type="number" placeholder="Terrain DC"></p></div></div>
                           </div>`;
                       break;
                   case 'subsist':
                        prompt = `
                            <p><strong>${act.characterName} - Subsist:</strong> Resolve using standard rules (Survival check vs. DC based on environment). Record outcome:</p>
                            <div class="control"><div class="select is-small"><select id="check-outcome-${index}"><option value="success">Success (Fed)</option><option value="failure">Failure (Not Fed)</option><option value="critSuccess">Crit Success (+)</option><option value="critFailure">Crit Failure (-)</option></select></div></div>`;
                        break;
                  case 'seek':
                       prompt = `<p><strong>${act.characterName} - Seek / Scout:</strong> Resolve Perception check. Note any findings.</p><input type="hidden" id="check-outcome-${index}" value="resolved">`; // Simple acknowledgement
                       break;
                    case 'aid':
                         prompt = `<p><strong>${act.characterName} - Aid:</strong> Resolve Aid check (DC typically 20). Note success/failure.</p><input type="hidden" id="check-outcome-${index}" value="resolved">`;
                         break;
                    case 'other':
                        prompt = `<p><strong>${act.characterName} - ${act.description}:</strong> Resolve as appropriate. Note outcome.</p><input type="hidden" id="check-outcome-${index}" value="resolved">`;
                        break;
                   // Default case for activities like 'rest-short' that don't need input here
                    default:
                         prompt = `<p><strong>${act.characterName} - ${act.description}:</strong> No specific check needed here.</p><input type="hidden" id="check-outcome-${index}" value="resolved">`;
                         break;

              }
              checkPromptsHTML += `<div class="box content is-small">${prompt}</div>`;
          });


          stepContainer.innerHTML = `
              <h3 class="title is-4">Resolve Individual Activities</h3>
              <p>Enter check results or confirm resolution for the following activities. This uses 1 group activity point.</p>
              ${checkPromptsHTML}
          `;

          actionButtons.innerHTML = `
              <button id="confirm-individual-results" class="button is-primary">Confirm Results & Continue</button>
          `;

          this.addSingleEventListener('confirm-individual-results', () => {
              // Process the results entered
              activities.forEach((act, index) => {
                   const resultInput = document.getElementById(`check-result-${index}`);
                   const dcInput = document.getElementById(`check-dc-${index}`);
                   const outcomeSelect = document.getElementById(`check-outcome-${index}`);

                   let resultLog = `- ${act.characterName} (${act.description}): `;

                   if (outcomeSelect && outcomeSelect.tagName === 'SELECT') { // Handle selects (like Subsist)
                        resultLog += `Outcome: ${outcomeSelect.options[outcomeSelect.selectedIndex].text}.`;
                         // Apply state changes based on outcome if needed (e.g., track subsist success)
                   } else if (resultInput && dcInput) { // Handle result vs DC checks
                       const result = parseInt(resultInput.value);
                       const dc = parseInt(dcInput.value);
                        if (!isNaN(result) && !isNaN(dc)) {
                            let successLevel = 'Failure';
                            if (result >= dc + 10) successLevel = 'Critical Success';
                            else if (result >= dc) successLevel = 'Success';
                            else if (result <= dc - 10) successLevel = 'Critical Failure';

                            resultLog += `Rolled ${result} vs DC ${dc} -> ${successLevel}.`;

                            // Apply specific state changes based on activity and success
                            if (act.activity === 'fortify-camp' && (successLevel === 'Success' || successLevel === 'Critical Success')) {
                                this.state.campFortified = true; // Only one success needed
                                 resultLog += ' Camp is now fortified!';
                            }
                             if (act.activity === 'map-area' && (successLevel === 'Success' || successLevel === 'Critical Success')) {
                                 this.state.currentHex.isMapped = true;
                                 resultLog += ' Hex is now mapped!';
                            }
                             // Add other state changes here (e.g., from Aid, Seek)

                        } else {
                             resultLog += `Check results not entered or invalid.`;
                        }
                   } else { // Simple acknowledgement activities
                         resultLog += `Acknowledged/Resolved manually.`;
                   }
                   this.addToLog(resultLog);
              });

              // Update global state if needed (e.g., if any Fortify succeeded)
               if (this.state.campFortified) {
                   this.addToLog("Overall result: Camp is fortified for the night.");
               }
               if (this.state.currentHex.isMapped) {
                    this.addToLog("Overall result: Current hex is mapped.");
               }


               // Deduct the single activity point for the group
               this.state.activities.remaining -= 1;
               this.state.activities.used.push('individual');

              // Go back to activity selection
               this.state.currentStep = 'activity-selection';
               this.processCurrentStep();
          });

     },

    // --- Group Activities Logic ---

    // Handle the Travel activity
    travel: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
        if (!stepContainer || !actionButtons) return;

        // Prepare UI for selecting destination hex details
        let destinationInputsHTML = `
            <div class="field">
                <label class="label">Destination Terrain Type</label>
                <div class="control"> <div class="select is-fullwidth"> <select id="destination-terrain-type"> ${this.getTerrainOptionsHTML()} </select> </div> </div>
            </div>
            <div class="field">
                <label class="label">Destination Terrain Difficulty</label>
                <div class="control"> <div class="select is-fullwidth"> <select id="destination-terrain-difficulty"> ${this.getDifficultyOptionsHTML()} </select> </div> </div>
            </div>
            <div class="field"> <div class="control"> <label class="checkbox"> <input type="checkbox" id="destination-has-road"> Destination has a road </label> </div> </div>
            <div class="field"> <div class="control"> <label class="checkbox"> <input type="checkbox" id="destination-has-river"> Destination has a river </label> </div> </div>
        `;

         // Add Kingmaker specific inputs if mode is enabled
         if (this.state.isKingmakerMode) {
              destinationInputsHTML += `
                  <div class="mt-3 pt-3" style="border-top: 1px dashed #ccc;"> <p class="has-text-weight-semibold mb-2">Kingmaker Destination Details:</p>
                      <div class="field">
                          <label class="label">Destination Zone DC</label>
                          <div class="control"> <input id="destination-zone-dc" class="input" type="number" value="18" min="1"> </div>
                      </div>
                      <div class="field">
                          <label class="label">Destination Encounter DC (Zone)</label>
                          <div class="control"> <input id="destination-zone-encounter-dc" class="input" type="number" value="16" min="1"> </div>
                      </div>
                  </div>
              `;
         }


        stepContainer.innerHTML = `
            <h3 class="title is-4">Travel</h3>
             <p>Remaining Activity Points: ${this.state.activities.remaining}</p>
            <p>The party is traveling from the current hex to an adjacent hex.</p>
            <div class="box content">
                <h5 class="title is-5">Current Hex</h5>
                 <ul> ${this.getCurrentHexInfoList()} </ul>
            </div>
            <div class="box content">
                <h5 class="title is-5">Destination Hex Details</h5>
                <p>Ask the players which adjacent hex they want to travel to and enter its details below.</p>
                ${destinationInputsHTML}
            </div>
        `;

        actionButtons.innerHTML = `
            <button id="calculate-travel-btn" class="button is-primary">Calculate Travel Cost & Proceed</button>
            <button id="back-btn" class="button is-light">Back</button>
        `;

        // Listener for calculating cost and potentially completing travel
        this.addSingleEventListener('calculate-travel-btn', () => {
            const destinationTerrainType = document.getElementById('destination-terrain-type')?.value || 'plains';
            const destinationTerrainDifficulty = document.getElementById('destination-terrain-difficulty')?.value || 'open';
            const destinationHasRoad = document.getElementById('destination-has-road')?.checked || false;
            const destinationHasRiver = document.getElementById('destination-has-river')?.checked || false;
            // Read Kingmaker destination values
            const destinationZoneDC = this.state.isKingmakerMode ? (parseInt(document.getElementById('destination-zone-dc')?.value, 10) || 18) : null;
            const destinationZoneEncounterDC = this.state.isKingmakerMode ? (parseInt(document.getElementById('destination-zone-encounter-dc')?.value, 10) || 16) : null;


            // Calculate activity cost based on destination difficulty
            let baseCost = this.TERRAIN_DIFFICULTY_COST[destinationTerrainDifficulty] || 1;
            let activityCost = baseCost;
            let roadBenefitText = '';

            // Apply road benefit
            if (destinationHasRoad && baseCost > 1) { // Roads reduce difficulty by one step, min cost 1
                activityCost = Math.max(1, baseCost - 1);
                 roadBenefitText = `<p>Road reduces terrain cost from ${baseCost} to ${activityCost}.</p>`;
            } else if (destinationHasRoad && baseCost === 1) {
                 roadBenefitText = `<p>Road provides no cost reduction (minimum 1 activity).</p>`;
            }

            // Check if party has enough remaining activity points
            if (activityCost > this.state.activities.remaining) {
                // Not enough points - show error and options
                 stepContainer.innerHTML += `
                    <div class="notification is-danger mt-4">
                        <h5 class="title is-5">Insufficient Activity Points</h5>
                        <p>Traveling to this hex requires <strong>${activityCost}</strong> activity points.</p>
                        ${roadBenefitText}
                         <p>The party only has <strong>${this.state.activities.remaining}</strong> points remaining today.</p>
                         <p>They cannot complete the travel today.</p>
                     </div>
                 `;
                 actionButtons.innerHTML = `
                    <div class="buttons">
                        <button id="change-destination-btn" class="button is-info">Choose Different Destination/Activity</button>
                         <button id="end-day-btn" class="button is-warning">End Day Here</button>
                    </div>
                 `;
                 this.addSingleEventListener('change-destination-btn', () => {
                      this.state.currentStep = 'activity-selection'; // Go back to choose something else
                      this.processCurrentStep();
                 });
                  this.addSingleEventListener('end-day-btn', () => {
                       this.addToLog("Attempted travel failed due to insufficient activity points. Ending day.");
                      this.state.currentStep = 'end-of-day';
                      this.processCurrentStep();
                 });

            } else {
                // Enough points - confirm travel completion
                stepContainer.innerHTML += `
                    <div class="notification is-success mt-4">
                        <h5 class="title is-5">Confirm Travel</h5>
                        <p>Travel requires <strong>${activityCost}</strong> activity points.</p>
                         ${roadBenefitText}
                         <p>The party has <strong>${this.state.activities.remaining}</strong> points remaining.</p>
                         <p>Complete the travel to the new hex?</p>
                    </div>
                `;
                actionButtons.innerHTML = `
                    <div class="buttons">
                        <button id="complete-travel-btn" class="button is-primary">Yes, Complete Travel</button>
                        <button id="cancel-travel-btn" class="button is-light">No, Cancel Travel</button>
                    </div>
                `;

                this.addSingleEventListener('complete-travel-btn', () => {
                    // Update the current hex state
                    this.state.currentHex = {
                        terrainType: destinationTerrainType,
                        terrainDifficulty: destinationTerrainDifficulty,
                        hasRoad: destinationHasRoad,
                        hasRiver: destinationHasRiver,
                        isReconnoitered: false, // Entering a new hex resets these statuses
                        isMapped: false,
                        zoneDC: destinationZoneDC, // Update Kingmaker values
                        zoneEncounterDC: destinationZoneEncounterDC
                    };

                    // Deduct activity points
                    this.state.activities.remaining -= activityCost;
                    for (let i = 0; i < activityCost; i++) {
                        this.state.activities.used.push('travel');
                    }

                    this.addToLog(`Party traveled to a new ${destinationTerrainType} hex (${destinationTerrainDifficulty}). Cost: ${activityCost} activity points.`);
                    this.addToLog(`Current Hex: ${this.state.currentHex.terrainType}, ${this.state.currentHex.terrainDifficulty}. Reconnoitered: ${this.state.currentHex.isReconnoitered}, Mapped: ${this.state.currentHex.isMapped}.`);


                    // Decide next step:
                    // If this was a forced march, the day ends after the travel.
                    // Otherwise, go back to activity selection to see if more activities can be done.
                    if (this.state.forcedMarch) {
                         this.addToLog("Forced March travel completed. Proceeding to End of Day.");
                        this.state.currentStep = 'end-of-day';
                    } else {
                        this.state.currentStep = 'activity-selection';
                    }
                    this.processCurrentStep();
                });

                this.addSingleEventListener('cancel-travel-btn', () => {
                     // Go back to the group activity selection screen
                     this.state.currentStep = 'group-activity';
                     this.processCurrentStep();
                 });
            }
        });

        // Listener for the initial back button
        this.addSingleEventListener('back-btn', () => {
            // If we were forced marching, back goes to activity selection (which handles forced march)
            // Otherwise, back goes to group activity selection
            this.state.currentStep = this.state.forcedMarch ? 'activity-selection' : 'group-activity';
            this.processCurrentStep();
        });
    },

    // Handle the Reconnoiter activity
    reconnoiter: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
        if (!stepContainer || !actionButtons) return;


        // Check if hex is already reconnoitered - handled by disabling button in groupActivity now
        // if (this.state.currentHex.isReconnoitered) { ... }

        // Calculate activity cost based on *current* hex difficulty (roads don't apply)
        const activityCost = this.TERRAIN_DIFFICULTY_COST[this.state.currentHex.terrainDifficulty] || 1;

        // Check if party has enough activity points
         if (activityCost > this.state.activities.remaining) {
              // Not enough points
             stepContainer.innerHTML = `
                <h3 class="title is-4">Reconnoiter</h3>
                 <p>Remaining Activity Points: ${this.state.activities.remaining}</p>
                 <div class="box content"> <h5 class="title is-5">Current Hex</h5> <ul> ${this.getCurrentHexInfoList()} </ul> </div>
                 <div class="notification is-danger mt-4">
                    <h5 class="title is-5">Insufficient Activity Points</h5>
                     <p>Reconnoitering this ${this.state.currentHex.terrainDifficulty} hex requires <strong>${activityCost}</strong> activity points.</p>
                     <p>The party only has <strong>${this.state.activities.remaining}</strong> points remaining today.</p>
                 </div>
             `;
             actionButtons.innerHTML = `
                <div class="buttons">
                    <button id="back-activity-selection-btn" class="button is-info">Choose Different Activity</button>
                     <button id="end-day-btn" class="button is-warning">End Day Here</button>
                </div>
             `;
              this.addSingleEventListener('back-activity-selection-btn', () => {
                   this.state.currentStep = 'activity-selection'; // Go back to choose something else
                   this.processCurrentStep();
              });
               this.addSingleEventListener('end-day-btn', () => {
                    this.addToLog("Attempted reconnoiter failed due to insufficient activity points. Ending day.");
                   this.state.currentStep = 'end-of-day';
                   this.processCurrentStep();
              });

         } else {
              // Enough points - proceed to confirmation/resolution
             stepContainer.innerHTML = `
                <h3 class="title is-4">Reconnoiter</h3>
                <p>Remaining Activity Points: ${this.state.activities.remaining}</p>
                 <div class="box content"> <h5 class="title is-5">Current Hex</h5> <ul> ${this.getCurrentHexInfoList()} </ul> </div>
                 <div class="notification is-info mt-4 content">
                    <h5 class="title is-5">Confirm Reconnoiter</h5>
                     <p>Reconnoitering this ${this.state.currentHex.terrainDifficulty} hex requires <strong>${activityCost}</strong> activity points.</p>
                     <p>The party has <strong>${this.state.activities.remaining}</strong> points remaining.</p>
                     <p>On success, the hex becomes Reconnoitered, revealing obvious features. A Perception check might find hidden features.</p>
                     <hr>
                     <p><strong>Resolve Hidden Feature Check:</strong></p>
                     <p>Have the party make a Perception check (or other relevant skill check determined by GM) against the DC for any hidden features in this hex.</p>
                      <div class="field">
                          <label class="label">Did the party find any hidden features?</label>
                          <div class="control">
                              <div class="select is-fullwidth">
                                  <select id="hidden-features-result">
                                      <option value="no">No (Check Failed or None Hidden)</option>
                                      <option value="yes">Yes (Check Succeeded)</option>
                                   </select>
                              </div>
                          </div>
                      </div>
                 </div>
             `;
              actionButtons.innerHTML = `
                 <div class="buttons">
                     <button id="complete-reconnoiter-btn" class="button is-primary">Complete Reconnoiter</button>
                     <button id="cancel-reconnoiter-btn" class="button is-light">Cancel Reconnoiter</button>
                 </div>
             `;

              this.addSingleEventListener('complete-reconnoiter-btn', () => {
                  const foundHidden = document.getElementById('hidden-features-result')?.value === 'yes';

                  // Update the current hex state
                  this.state.currentHex.isReconnoitered = true;

                  // Deduct activity points
                  this.state.activities.remaining -= activityCost;
                  for (let i = 0; i < activityCost; i++) {
                      this.state.activities.used.push('reconnoiter');
                  }

                  this.addToLog(`Party reconnoitered the ${this.state.currentHex.terrainType} hex. Cost: ${activityCost} activity points.`);
                   if (foundHidden) {
                       this.addToLog("Perception check successful: Hidden features discovered! (Details handled manually).");
                   } else {
                        this.addToLog("Perception check failed or no hidden features found.");
                   }
                   this.addToLog(`Current Hex: ${this.state.currentHex.terrainType}, ${this.state.currentHex.terrainDifficulty}. Reconnoitered: ${this.state.currentHex.isReconnoitered}, Mapped: ${this.state.currentHex.isMapped}.`);

                  // Go back to activity selection
                  this.state.currentStep = 'activity-selection';
                  this.processCurrentStep();
              });

              this.addSingleEventListener('cancel-reconnoiter-btn', () => {
                  // Go back to the group activity selection screen
                  this.state.currentStep = 'group-activity';
                  this.processCurrentStep();
              });
         }

    },

    // --- End of Day Steps ---

     // Placeholder for Kingmaker Prepare Campsite Step
      kingmakerPrepareCampsite: function() {
           const stepContainer = document.getElementById('step-container');
           const actionButtons = document.getElementById('action-buttons');
           if (!stepContainer || !actionButtons) return;

           // TODO: Implement Prepare Campsite logic
           // 1. Determine time cost (2 hours normally, 1 hour if previously camped in hex - need hex state for this)
           // 2. Prompt for Survival Check result vs. Zone DC (this.state.currentHex.zoneDC)
           // 3. Determine Success/Crit Success/Failure/Crit Failure
           // 4. Update this.state.camping.prepareSuccessLevel
           // 5. Set encounter DC modifier based on success level (+2 for success/crit success?)
           // 6. Log results

           stepContainer.innerHTML = `
               <h3 class="title is-4">Kingmaker - Prepare Campsite</h3>
               <div class="notification is-info is-light">
                   Party spends time preparing the campsite (Survival check vs Zone DC ${this.state.currentHex.zoneDC}).
                   <br><em>(Not yet implemented)</em>
               </div>
           `;
           this.addToLog("Reached Kingmaker Prepare Campsite step (Not Implemented).");


           // Decide next step: Camping Activities
           actionButtons.innerHTML = `
               <button id="continue-btn" class="button is-primary">Continue to Camping Activities</button>
           `;
           this.addSingleEventListener('continue-btn', () => {
               this.state.currentStep = 'kingmaker-camping-activities';
               this.processCurrentStep();
           });
      },

     // Placeholder for Kingmaker Camping Activities Step
      kingmakerCampingActivities: function() {
           const stepContainer = document.getElementById('step-container');
           const actionButtons = document.getElementById('action-buttons');
           if (!stepContainer || !actionButtons) return;


           // TODO: Implement Camping Activities Loop
           // 1. Present list of available activities (Core + Kingmaker Companions if applicable)
           // 2. Ask user how many hours party spends on activities.
           // 3. Loop for each hour spent:
           //    a. Perform Camping Random Encounter check (Flat check vs Zone Encounter DC, modified by Prepare Campsite result and decreasing per hour)
           //    b. If encounter, prompt for resolution.
           //    c. Resolve effects of camping activities chosen for that hour.
           //    d. Decrease encounter DC modifier.
           // 4. After loop, proceed to rest/fatigue recovery.

           stepContainer.innerHTML = `
               <h3 class="title is-4">Kingmaker - Camping Activities</h3>
               <div class="notification is-info is-light">
                   Party can perform various camping activities (Cooking, Aid, Companion skills). Each hour spent triggers a camping encounter check (vs Zone Enc DC ${this.state.currentHex.zoneEncounterDC}).
                   <br><em>(Not yet implemented)</em>
                </div>
           `;
           this.addToLog("Reached Kingmaker Camping Activities step (Not Implemented).");


            // For now, skip directly to rest/fatigue processing
            actionButtons.innerHTML = `
                <button id="continue-btn" class="button is-primary">Continue to Rest/Recovery</button>
            `;
            this.addSingleEventListener('continue-btn', () => {
                 this.completeEndOfDayProcessing(); // Go to final end-of-day steps
            });
      },


    // Handle end-of-day summary and transition to next day or end exploration
    endOfDay: function() {
        const stepContainer = document.getElementById('step-container');
        const actionButtons = document.getElementById('action-buttons');
         if (!stepContainer || !actionButtons) return;

         // If Kingmaker mode, redirect to the camping sequence first
         if (this.state.isKingmakerMode) {
              this.state.currentStep = 'kingmaker-prepare-campsite'; // Start the Kingmaker sequence
              this.processCurrentStep();
              return; // Stop this function, let the Kingmaker one take over
         }

         // --- Standard End of Day Processing (Non-Kingmaker) ---
         this.addToLog(`--- End of Day ${this.state.currentDay} ---`);
         this.completeEndOfDayProcessing(); // Perform final steps
    },

     // Contains the final logic common to both modes after camping/standard rest
     completeEndOfDayProcessing: function() {
         const stepContainer = document.getElementById('step-container');
         const actionButtons = document.getElementById('action-buttons');
         if (!stepContainer || !actionButtons) return;

          let recoveryLog = [];
          // Process fatigue recovery for those who rested
          this.state.party.forEach(character => {
              if (character.isFatigued && character.willRest) {
                   character.isFatigued = false;
                   character.forcedMarchDays = 0; // Resting recovers fatigue and resets count
                   recoveryLog.push(`${character.name} has recovered from fatigue.`);
              }
              // Reset the temporary rest decision flag for the next day
               character.willRest = false;
          });

         // Process fatigue gain for those who completed a forced march today
          let fatigueGainLog = [];
           if (this.state.forcedMarch) { // Only check if they actually force marched
               this.state.party.forEach(character => {
                   // Check if they *became* fatigued from today's march
                    // Ensure con mod minimum is 1
                    const conModMin1 = Math.max(1, character.constitution || 1);
                   if (!character.isFatigued && character.forcedMarchDays > conModMin1) {
                       character.isFatigued = true;
                        fatigueGainLog.push(`${character.name} becomes Fatigued from forced marching (${character.forcedMarchDays} days > Con Mod ${conModMin1}).`);
                   }
               });
           }
           // Reset forced march flag for next day (done in startOfDay now)
            // this.state.forcedMarch = false;


           // Display End of Day Summary
           stepContainer.innerHTML = `
               <h3 class="title is-4">End of Day ${this.state.currentDay} Reached</h3>
               <div class="notification is-info content">
                   <p>The day of hexploration concludes. The party sets up camp.</p>
                   ${this.state.campFortified ? '<p class="has-text-weight-bold has-text-success">Camp was successfully fortified tonight (+2 bonus to watch/defense).</p>' : '<p>Camp was not fortified tonight.</p>'}
                    ${recoveryLog.length > 0 ? `<p><strong>Fatigue Recovery:</strong> ${recoveryLog.join(' ')}</p>` : '<p>No characters recovered from fatigue today.</p>'}
                    ${fatigueGainLog.length > 0 ? `<p class="has-text-danger"><strong>Fatigue Gained:</strong> ${fatigueGainLog.join(' ')}</p>` : ''}
                </div>
               <div class="box">
                   <h5 class="title is-5">Full Day ${this.state.currentDay} Log Summary</h5>
                   <div id="end-day-log-summary" class="content is-small" style="max-height: 300px; overflow-y: auto;">
                       ${this.state.dayLog.map(log => `<p>${log}</p>`).join('')}
                   </div>
               </div>
           `;

            // Reset fortify status for the next day (done in startOfDay now)
             // this.state.campFortified = false;

           // Final action buttons
           actionButtons.innerHTML = `
               <button id="next-day-btn" class="button is-primary">Start Next Day (Day ${this.state.currentDay + 1})</button>
               <button id="end-exploration-btn" class="button is-danger">End Exploration Now</button>
           `;

           this.addSingleEventListener('next-day-btn', () => {
               // Increment the day counter
               this.state.currentDay += 1;

               // Reset relevant daily state (most is done in startOfDay)
                this.state.activities = { total: 0, remaining: 0, used: [] };


               // Start the new day cycle
               this.state.currentStep = 'start-of-day';
               this.processCurrentStep();
           });

           this.addSingleEventListener('end-exploration-btn', () => {
               this.addToLog(`=== Exploration Ended After Day ${this.state.currentDay} ===`);
               alert(`Exploration ended. Final log is available. Returning to Setup.`);
                // Switch back to setup tab
                 const setupTab = document.querySelector('[data-tab="setup"]');
                 if (setupTab) {
                     setupTab.click(); // Use tab logic to switch
                 }
                 // Optionally reset state fully here if desired when ending exploration
           });
     },

    // --- Utility Functions ---

    // Add an entry to the day log state and update the UI display
    addToLog: function(text) {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        // console.log(`[${timestamp}] ${text}`); // Optional console logging
        this.state.dayLog.push(`[${timestamp}] ${text}`);
        this.updateDayLogUI(); // Update the visual log display
    },

    // Update the day log element in the UI
    updateDayLogUI: function() {
        const dayLogContainer = document.getElementById('day-log');
        if (!dayLogContainer) return;

        // Create log entries
        dayLogContainer.innerHTML = this.state.dayLog.map(log => `<p>${log}</p>`).join('');
        // Scroll to the bottom
        dayLogContainer.scrollTop = dayLogContainer.scrollHeight;
    },


    // Update the sidebar UI elements based on current state
    updateUI: function() {
         try { // Add error handling for UI updates
             // Update current hex info display
             const terrainTypeElement = document.getElementById('current-terrain-type');
             const terrainDifficultyElement = document.getElementById('current-terrain-difficulty');
             const hexFeaturesElement = document.getElementById('current-hex-features');
             const kmSidebarSection = document.getElementById('kingmaker-sidebar-status');

             if (terrainTypeElement && terrainDifficultyElement && hexFeaturesElement) {
                 // Format Terrain Type (Capitalize)
                 terrainTypeElement.textContent = this.state.currentHex.terrainType.charAt(0).toUpperCase() + this.state.currentHex.terrainType.slice(1);
                 terrainTypeElement.className = `tag is-medium is-${this.getTerrainColor(this.state.currentHex.terrainType)}`;

                 // Format Terrain Difficulty (Capitalize, replace hyphen)
                 terrainDifficultyElement.textContent = this.state.currentHex.terrainDifficulty.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
                 terrainDifficultyElement.className = `tag is-medium is-${this.getDifficultyColor(this.state.currentHex.terrainDifficulty)}`;

                 // Build features list
                 let features = [];
                 if (this.state.currentHex.hasRoad) features.push('Road');
                 if (this.state.currentHex.hasRiver) features.push('River');

                 // Add Kingmaker specific info display to features if relevant
                 if (this.state.isKingmakerMode) {
                     if (this.state.currentHex.zoneDC) features.push(`Zone DC ${this.state.currentHex.zoneDC}`);
                     if (this.state.currentHex.zoneEncounterDC) features.push(`Enc DC ${this.state.currentHex.zoneEncounterDC}`);
                 }
                 // Add Recon/Mapped status (using bold styling)
                 if (this.state.currentHex.isReconnoitered) features.push('<span class="has-text-weight-bold">Reconnoitered</span>');
                 if (this.state.currentHex.isMapped) features.push('<span class="has-text-weight-bold">Mapped</span>');

                 // Update element using innerHTML to allow for the bold spans
                 hexFeaturesElement.innerHTML = features.join(', ') || 'Standard'; // Show 'Standard' if no other features/statuses
             }

             // Update party status boxes
             const partyStatusElement = document.getElementById('party-status');
             if (partyStatusElement) {
                 let statusHtml = '';
                 if (this.state.party.length === 0) {
                      statusHtml = '<p>No characters in party.</p>';
                 } else {
                      this.state.party.forEach(character => {
                          const conModMin1 = Math.max(1, character.constitution || 1); // Ensure minimum 1 for display comparison
                          statusHtml += `
                              <div class="box character-box is-size-7 p-2"> <h6 class="title is-6 is-size-7 has-text-weight-bold mb-1">${character.name}</h6> <ul class="ml-0" style="list-style-type: none;"> <li><strong>Speed:</strong> ${character.speed} ft</li>
                                      <li><strong>Con Mod:</strong> ${character.constitution}</li>
                                      <li><strong>Status:</strong> ${character.isFatigued ? '<span class="has-text-danger has-text-weight-bold">Fatigued</span>' : '<span class="has-text-success">Normal</span>'}</li>
                                      <li><strong>Forced March:</strong> ${character.forcedMarchDays || 0} / ${conModMin1} days</li>
                                  </ul>
                              </div>
                          `;
                      });
                 }
                 partyStatusElement.innerHTML = statusHtml;
             }

             // Update activity slots display
             const activitySlotsElement = document.getElementById('activity-slots');
             if (activitySlotsElement) {
                 let activityHtml = '';
                 const totalActivities = this.state.activities.total;
                  const remainingActivities = this.state.activities.remaining;
                  const usedActivities = this.state.activities.used;


                 if (totalActivities === 0 && remainingActivities === 0 && this.state.currentStep !== 'start-of-day') { // Only show if activities determined
                     activityHtml = '<p class="is-size-7">No activities determined yet or none available.</p>';
                 } else if (totalActivities === 0.5) {
                     // Handle half activity - show one slot, used if remaining is 0
                      const isUsed = remainingActivities === 0;
                      activityHtml = `
                          <div class="activity-slot ${isUsed ? 'used' : ''}">
                              <strong>Half Activity:</strong> ${isUsed ? (usedActivities[0] ? this.formatActivityType(usedActivities[0]) : 'Used') : 'Available'}
                          </div>`;
                 } else {
                     // Display slots for total activities determined
                     for (let i = 0; i < totalActivities; i++) {
                          // An activity slot is considered "used" if its index is less than the number of used activities recorded.
                           const isUsed = i < usedActivities.length;
                           const activityType = isUsed ? usedActivities[i] : 'available';

                           activityHtml += `
                              <div class="activity-slot ${isUsed ? 'used' : ''}">
                                  <strong>Activity ${i + 1}:</strong> ${isUsed ? this.formatActivityType(activityType) : 'Available'}
                              </div>
                          `;
                     }
                 }
                 activitySlotsElement.innerHTML = activityHtml || '<p class="is-size-7">No activities determined yet.</p>'; // Fallback
             }

             // --- Update Kingmaker Sidebar Info ---
             if (kmSidebarSection) { // Check if the element exists
                 if (this.state.isKingmakerMode) {
                     kmSidebarSection.classList.remove('hidden'); // Make sure section is visible
                     const weatherStatusEl = document.getElementById('weather-status');
                     if (weatherStatusEl) {
                         // TODO: Implement actual weather display logic here based on state.weather
                          weatherStatusEl.innerHTML = `
                             <p><strong>Weather:</strong></p>
                             <ul class="ml-0" style="list-style-type: none;">
                                <li>Precip: ${this.state.weather.precipitation}</li>
                                <li>Temp: ${this.state.weather.temperature}</li>
                                <li>Event: ${this.state.weather.event}</li>
                              </ul>
                             <p class="has-text-grey is-italic is-size-7">(Weather checks not implemented yet)</p>
                          `;
                     }
                 } else {
                     kmSidebarSection.classList.add('hidden'); // Hide section if not in Kingmaker mode
                 }
             }
             // --- End Kingmaker Sidebar Update ---

             // Update day log display (already handled by addToLog)
             // this.updateDayLogUI();
         } catch (error) {
              console.error("Error during UI update:", error);
               // Optionally display an error message to the user in the UI
         }
    },

    // --- Helper functions ---

     // Helper to add event listener to a single element by ID, removing old listener first
     // Prevents duplicate listeners on re-renders
     addSingleEventListener: function(elementId, eventFunction) {
         const element = document.getElementById(elementId);
         if (element) {
             // Clone the element to remove all existing listeners, then replace it
             const newElement = element.cloneNode(true);
             element.parentNode.replaceChild(newElement, element);
             // Add the new listener to the cloned element
              newElement.addEventListener('click', eventFunction);
         } else {
              console.warn(`Element with ID ${elementId} not found for adding listener.`);
         }
     },


    // Get Bulma color class based on terrain type
    getTerrainColor: function(terrainType) {
        switch (terrainType) {
            case 'plains': return 'is-success-light'; // Lighter colors for tags
            case 'forest': return 'is-success';
            case 'mountain': return 'is-grey';
            case 'desert': return 'is-warning-light';
            case 'swamp': return 'is-info';
            case 'aquatic': return 'is-link-light';
            case 'arctic': return 'is-light';
            default: return 'is-black'; // Default fallback
        }
    },

    // Get Bulma color class based on terrain difficulty
    getDifficultyColor: function(difficulty) {
        switch (difficulty) {
            case 'open': return 'is-success';
            case 'difficult': return 'is-warning';
            case 'greater-difficult': return 'is-danger';
            default: return 'is-light';
        }
    },

     // Helper to generate HTML options for terrain types
     getTerrainOptionsHTML: function() {
         const types = ['plains', 'forest', 'mountain', 'desert', 'swamp', 'aquatic', 'arctic'];
         return types.map(type => `<option value="${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</option>`).join('');
     },

      // Helper to generate HTML options for terrain difficulties
      getDifficultyOptionsHTML: function() {
          const difficulties = {'open': 'Open (1)', 'difficult': 'Difficult (2)', 'greater-difficult': 'Greater Difficult (3)'};
          return Object.entries(difficulties).map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
      },

      // Helper to get current hex info as list items
      getCurrentHexInfoList: function() {
          let items = [
               `<li><strong>Terrain:</strong> ${this.state.currentHex.terrainType}</li>`,
               `<li><strong>Difficulty:</strong> ${this.state.currentHex.terrainDifficulty}</li>`,
               `<li><strong>Road:</strong> ${this.state.currentHex.hasRoad ? 'Yes' : 'No'}</li>`,
               `<li><strong>River:</strong> ${this.state.currentHex.hasRiver ? 'Yes' : 'No'}</li>`
          ];
           if (this.state.isKingmakerMode) {
               items.push(`<li><strong>Zone DC:</strong> ${this.state.currentHex.zoneDC || 'N/A'}</li>`);
                items.push(`<li><strong>Zone Enc DC:</strong> ${this.state.currentHex.zoneEncounterDC || 'N/A'}</li>`);
           }
            items.push(`<li><strong>Reconnoitered:</strong> ${this.state.currentHex.isReconnoitered ? 'Yes' : 'No'}</li>`);
            items.push(`<li><strong>Mapped:</strong> ${this.state.currentHex.isMapped ? 'Yes' : 'No'}</li>`);
           return items.join('');
      },


    // Format the activity type string for display in the UI slots
    formatActivityType: function(activityType) {
        switch (activityType) {
            case 'travel': return 'Travel';
            case 'reconnoiter': return 'Reconnoiter';
            case 'individual': return 'Individual Tasks';
            case 'group-started': return 'Group (Started)'; // For half-activity tracking later
            case 'individual-started': return 'Individual (Started)'; // For half-activity tracking later
            default: return 'Used'; // Fallback for unknown types
        }
    }
};

// Initialize the application once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    HexplorationApp.init();
});
