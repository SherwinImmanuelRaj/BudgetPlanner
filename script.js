// Budget Planning App - Enhanced with Google Authentication and Sheets Integration

// Google API Configuration - loaded from config.properties
let GOOGLE_CONFIG = {
    CLIENT_ID: '',
    API_KEY: '',
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'
};

// Function to load configuration from properties file
async function loadConfiguration() {
    try {
        const response = await fetch('./config.properties');
        const text = await response.text();
        
        const properties = {};
        text.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split('=', 2);
                if (key && value) {
                    properties[key.trim()] = value.trim();
                }
            }
        });
        
        // Update GOOGLE_CONFIG with loaded properties
        GOOGLE_CONFIG.CLIENT_ID = properties.GOOGLE_CLIENT_ID || '';
        GOOGLE_CONFIG.API_KEY = properties.GOOGLE_API_KEY || '';
        GOOGLE_CONFIG.DISCOVERY_DOC = properties.GOOGLE_DISCOVERY_DOC || GOOGLE_CONFIG.DISCOVERY_DOC;
        GOOGLE_CONFIG.SCOPES = properties.GOOGLE_SCOPES || GOOGLE_CONFIG.SCOPES;
        
        console.log('Configuration loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load configuration:', error);
        return false;
    }
}

// Global variables for Google Auth
let gapi, google;
let isGapiLoaded = false;
let isGoogleLoaded = false;
let currentUser = null;
let spreadsheetId = null;

class BudgetApp {
    constructor() {
        this.data = {};
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth();
        this.charts = {};
        this.templates = {
            fixedExpenses: [],
            debt: []
        };
        this.currentTheme = 'dark';
        this.isLoading = false;
        this.saveTimeout = null;
        this.updateTimeout = null;

        // Load configuration first, then initialize
        this.initializeWithConfig();
    }

    async initializeWithConfig() {
        const configLoaded = await loadConfiguration();
        
        if (!configLoaded || !GOOGLE_CONFIG.CLIENT_ID || !GOOGLE_CONFIG.API_KEY) {
            this.showConfigurationError();
            return;
        }

        // Initialize only if user is authenticated
        if (this.checkAuthStatus()) {
            this.initializeApp();
        } else {
            this.showLoginScreen();
        }
    }

    showConfigurationError() {
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                <h1 style="color: #ff4444;">Configuration Error</h1>
                <p>Please configure your Google API credentials in the <code>config.properties</code> file.</p>
                <p>Update the following values:</p>
                <ul style="text-align: left; max-width: 400px;">
                    <li>GOOGLE_CLIENT_ID</li>
                    <li>GOOGLE_API_KEY</li>
                </ul>
                <p>See <code>userdata/google-setup-instructions.md</code> for detailed setup instructions.</p>
                <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Reload Page</button>
            </div>
        `;
    }

    checkAuthStatus() {
        // Check if user is already authenticated
        return currentUser !== null;
    }

    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        this.initializeGoogleAuth();
    }

    hideLoginScreen() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        this.initializeApp();
    }

    async initializeGoogleAuth() {
        try {
            // Load Google APIs
            await this.loadGoogleApis();

            // Initialize Google Identity Services
            google.accounts.id.initialize({
                client_id: GOOGLE_CONFIG.CLIENT_ID,
                callback: this.handleCredentialResponse.bind(this)
            });

            // Update the g_id_onload element with the client_id
            const gIdOnload = document.getElementById('g_id_onload');
            if (gIdOnload) {
                gIdOnload.setAttribute('data-client_id', GOOGLE_CONFIG.CLIENT_ID);
            }

            // Render the sign-in button
            google.accounts.id.renderButton(
                document.querySelector('.g_id_signin'),
                {
                    theme: 'filled_blue',
                    size: 'large',
                    type: 'standard',
                    shape: 'rectangular',
                    text: 'signin_with',
                    logo_alignment: 'left'
                }
            );

            console.log('Google authentication initialized');
        } catch (error) {
            console.error('Failed to initialize Google auth:', error);
            this.showError('Failed to initialize Google authentication');
        }
    }

    async loadGoogleApis() {
        return new Promise((resolve, reject) => {
            // Load Google APIs script if not already loaded
            if (typeof gapi === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/api.js';
                script.onload = () => {
                    // Wait a bit for gapi to be available
                    setTimeout(() => {
                        if (typeof gapi !== 'undefined' && gapi.load) {
                            gapi.load('client', async () => {
                                try {
                                    await gapi.client.init({
                                        apiKey: GOOGLE_CONFIG.API_KEY,
                                        discoveryDocs: [GOOGLE_CONFIG.DISCOVERY_DOC]
                                    });
                                    isGapiLoaded = true;
                                    resolve();
                                } catch (error) {
                                    console.error('Failed to initialize gapi client:', error);
                                    reject(error);
                                }
                            });
                        } else {
                            reject(new Error('Google APIs failed to load'));
                        }
                    }, 100);
                };
                script.onerror = () => reject(new Error('Failed to load Google APIs script'));
                document.head.appendChild(script);
            } else {
                if (isGapiLoaded) {
                    resolve();
                } else {
                    gapi.load('client', async () => {
                        try {
                            await gapi.client.init({
                                apiKey: GOOGLE_CONFIG.API_KEY,
                                discoveryDocs: [GOOGLE_CONFIG.DISCOVERY_DOC]
                            });
                            isGapiLoaded = true;
                            resolve();
                        } catch (error) {
                            console.error('Failed to initialize gapi client:', error);
                            reject(error);
                        }
                    });
                }
            }
        });
    }

    async handleCredentialResponse(response) {
        try {
            console.log('Processing credential response...');
            const responsePayload = this.decodeJwtResponse(response.credential);
            currentUser = {
                id: responsePayload.sub,
                name: responsePayload.name,
                email: responsePayload.email,
                picture: responsePayload.picture
            };

            console.log('User authenticated:', currentUser.name);

            // Set up user profile in UI
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userPhoto').src = currentUser.picture;

            // Get access token for API calls
            console.log('Getting access token...');
            await this.getAccessToken();

            // Initialize or find user's spreadsheet
            console.log('Initializing spreadsheet...');
            await this.initializeUserSpreadsheet();

            console.log('Hiding login screen...');
            this.hideLoginScreen();
            console.log('User authenticated successfully:', currentUser);
        } catch (error) {
            console.error('Authentication failed:', error);
            this.showError('Authentication failed. Please try again.');
        }
    }

    decodeJwtResponse(token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    }

    async getAccessToken() {
        return new Promise((resolve, reject) => {
            try {
                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CONFIG.CLIENT_ID,
                    scope: GOOGLE_CONFIG.SCOPES,
                    callback: (response) => {
                        if (response.error) {
                            console.error('Token error:', response.error);
                            reject(response);
                            return;
                        }
                        console.log('Access token received');
                        gapi.client.setToken(response);
                        resolve(response.access_token);
                    }
                });
                tokenClient.requestAccessToken();
            } catch (error) {
                console.error('Failed to initialize token client:', error);
                reject(error);
            }
        });
    }

    async initializeUserSpreadsheet() {
        try {
            console.log('Initializing user spreadsheet...');
            // Try to find existing spreadsheet for this user
            const userSpreadsheetName = `Budget_App_${currentUser.id}`;

            console.log('Searching for existing spreadsheet...');
            // Search for existing spreadsheet
            const searchResponse = await gapi.client.request({
                path: 'https://www.googleapis.com/drive/v3/files',
                params: {
                    q: `name='${userSpreadsheetName}' and mimeType='application/vnd.google-apps.spreadsheet'`,
                    fields: 'files(id, name)'
                }
            });

            if (searchResponse.result.files && searchResponse.result.files.length > 0) {
                // Use existing spreadsheet
                spreadsheetId = searchResponse.result.files[0].id;
                console.log('Found existing spreadsheet:', spreadsheetId);
            } else {
                // Create new spreadsheet
                console.log('Creating new spreadsheet...');
                await this.createNewSpreadsheet();
            }

            // Load data from spreadsheet
            console.log('Loading data from sheets...');
            await this.loadDataFromSheets();
            console.log('Spreadsheet initialization complete');
        } catch (error) {
            console.error('Failed to initialize spreadsheet:', error);
            this.showError('Failed to set up your data storage. Using local storage as fallback.');
            this.initializeLocalData();
        }
    }

    async createNewSpreadsheet() {
        try {
            const userSpreadsheetName = `Budget_App_${currentUser.id}`;

            // Create new spreadsheet
            const createResponse = await gapi.client.sheets.spreadsheets.create({
                properties: {
                    title: userSpreadsheetName
                },
                sheets: [
                    { properties: { title: 'Budget_Data' } },
                    { properties: { title: 'Templates' } },
                    { properties: { title: 'Settings' } }
                ]
            });

            spreadsheetId = createResponse.result.spreadsheetId;

            // Initialize spreadsheet with headers
            await this.setupSpreadsheetStructure();

            console.log('Created new spreadsheet:', spreadsheetId);
            return spreadsheetId;
        } catch (error) {
            console.error('Failed to create spreadsheet:', error);
            throw error;
        }
    }

    async setupSpreadsheetStructure() {
        try {
            // Set up headers and initial structure
            const requests = [
                {
                    updateCells: {
                        range: {
                            sheetId: 0, // Budget_Data sheet
                            startRowIndex: 0,
                            startColumnIndex: 0,
                            endRowIndex: 1,
                            endColumnIndex: 10
                        },
                        rows: [{
                            values: [
                                { userEnteredValue: { stringValue: 'Year' } },
                                { userEnteredValue: { stringValue: 'Month' } },
                                { userEnteredValue: { stringValue: 'Category' } },
                                { userEnteredValue: { stringValue: 'Type' } },
                                { userEnteredValue: { stringValue: 'Name' } },
                                { userEnteredValue: { stringValue: 'Planned' } },
                                { userEnteredValue: { stringValue: 'Actual' } },
                                { userEnteredValue: { stringValue: 'Amount' } },
                                { userEnteredValue: { stringValue: 'CarriedBalance' } },
                                { userEnteredValue: { stringValue: 'LastUpdated' } }
                            ]
                        }],
                        fields: 'userEnteredValue'
                    }
                }
            ];

            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                requests: requests
            });
        } catch (error) {
            console.error('Failed to setup spreadsheet structure:', error);
        }
    }

    async loadDataFromSheets() {
        try {
            if (!spreadsheetId) return;

            // Load budget data
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: 'Budget_Data!A2:J'
            });

            const rows = response.result.values || [];
            this.data = {};

            // Parse data from sheets
            rows.forEach(row => {
                const [year, month, category, type, name, planned, actual, amount, carriedBalance] = row;

                if (!this.data[year]) this.data[year] = {};
                if (!this.data[year][month]) {
                    this.data[year][month] = {
                        income: [],
                        fixedExpenses: [],
                        otherExpenses: [],
                        debt: [],
                        investment: [],
                        travelEntertainment: [],
                        carriedBalance: parseFloat(carriedBalance) || 0
                    };
                }

                const item = {
                    name: name || '',
                    planned: parseFloat(planned) || 0,
                    actual: parseFloat(actual) || 0,
                    amount: parseFloat(amount) || 0
                };

                if (this.data[year][month][category]) {
                    this.data[year][month][category].push(item);
                }
            });

            // Load templates
            await this.loadTemplatesFromSheets();

            // Load settings
            await this.loadSettingsFromSheets();

            console.log('Data loaded from Google Sheets successfully');
        } catch (error) {
            console.error('Failed to load data from sheets:', error);
            this.initializeLocalData();
        }
    }

    async loadTemplatesFromSheets() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: 'Templates!A2:C'
            });

            const rows = response.result.values || [];
            this.templates = { fixedExpenses: [], debt: [] };

            rows.forEach(row => {
                const [type, name, amount] = row;
                if (this.templates[type]) {
                    this.templates[type].push({
                        name: name || '',
                        amount: parseFloat(amount) || 0
                    });
                }
            });
        } catch (error) {
            console.error('Failed to load templates from sheets:', error);
        }
    }

    async loadSettingsFromSheets() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: 'Settings!A2:B'
            });

            const rows = response.result.values || [];
            rows.forEach(row => {
                const [key, value] = row;
                if (key === 'theme') {
                    this.currentTheme = value || 'dark';
                }
            });
        } catch (error) {
            console.error('Failed to load settings from sheets:', error);
        }
    }

    async saveDataToSheets() {
        try {
            if (!spreadsheetId) return;

            // Prepare data for sheets
            const rows = [];

            Object.keys(this.data).forEach(year => {
                Object.keys(this.data[year]).forEach(month => {
                    const monthData = this.data[year][month];

                    Object.keys(monthData).forEach(category => {
                        if (category === 'carriedBalance') {
                            // Handle carried balance separately
                            rows.push([
                                year,
                                month,
                                'carriedBalance',
                                '',
                                '',
                                '',
                                '',
                                '',
                                monthData.carriedBalance,
                                new Date().toISOString()
                            ]);
                        } else if (Array.isArray(monthData[category])) {
                            monthData[category].forEach(item => {
                                rows.push([
                                    year,
                                    month,
                                    category,
                                    this.getCategoryType(category),
                                    item.name || '',
                                    item.planned || '',
                                    item.actual || '',
                                    item.amount || '',
                                    '',
                                    new Date().toISOString()
                                ]);
                            });
                        }
                    });
                });
            });

            // Clear existing data and write new data
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: spreadsheetId,
                range: 'Budget_Data!A2:J'
            });

            if (rows.length > 0) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    range: 'Budget_Data!A2',
                    valueInputOption: 'RAW',
                    values: rows
                });
            }

            // Save templates
            await this.saveTemplatesToSheets();

            // Save settings
            await this.saveSettingsToSheets();

            console.log('Data saved to Google Sheets successfully');
        } catch (error) {
            console.error('Failed to save data to sheets:', error);
            this.showError('Failed to save data to cloud. Data saved locally.');
        }
    }

    async saveTemplatesToSheets() {
        try {
            const rows = [];

            Object.keys(this.templates).forEach(type => {
                this.templates[type].forEach(template => {
                    rows.push([type, template.name, template.amount]);
                });
            });

            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: spreadsheetId,
                range: 'Templates!A2:C'
            });

            if (rows.length > 0) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    range: 'Templates!A2',
                    valueInputOption: 'RAW',
                    values: rows
                });
            }
        } catch (error) {
            console.error('Failed to save templates to sheets:', error);
        }
    }

    async saveSettingsToSheets() {
        try {
            const rows = [
                ['theme', this.currentTheme]
            ];

            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: spreadsheetId,
                range: 'Settings!A2:B'
            });

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Settings!A2',
                valueInputOption: 'RAW',
                values: rows
            });
        } catch (error) {
            console.error('Failed to save settings to sheets:', error);
        }
    }

    getCategoryType(category) {
        const types = {
            income: 'income',
            fixedExpenses: 'expense',
            otherExpenses: 'expense',
            debt: 'expense',
            investment: 'investment',
            travelEntertainment: 'expense'
        };
        return types[category] || 'other';
    }

    initializeLocalData() {
        // Fallback to local storage if Google Sheets fails
        this.loadFromLocalStorage();
        if (Object.keys(this.data).length === 0) {
            this.initializeEmptyData();
        }
    }

    initializeApp() {
        try {
            this.initializeEmptyData();
            this.setupEventListeners();
            this.applyTheme();
            this.updateMonthDisplay();
            this.renderCurrentMonth();
            this.updateCalculations();
            this.updateAllCharts();
            this.loadTemplates();
            console.log('Budget app initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize the application');
        }
    }

    logout() {
        currentUser = null;
        spreadsheetId = null;
        google.accounts.id.disableAutoSelect();
        this.showLoginScreen();
    }

    async syncWithSheets() {
        try {
            this.showLoading('Syncing with Google Sheets...');
            await this.saveDataToSheets();
            await this.loadDataFromSheets();
            this.renderCurrentMonth();
            this.updateCalculations();
            this.updateAllCharts();
            this.showSuccess('Data synced successfully');
        } catch (error) {
            console.error('Sync failed:', error);
            this.showError('Failed to sync with Google Sheets');
        } finally {
            this.hideLoading();
        }
    }

    showLoading(message = 'Loading...') {
        // Implement loading indicator
        console.log(message);
    }

    hideLoading() {
        // Hide loading indicator
    }

    showSuccess(message) {
        console.log('Success:', message);
        // Implement success toast
    }

    showError(message) {
        console.error('Error:', message);
        // Implement error toast
    }

    // Rest of the original BudgetApp methods...
    initializeEmptyData() {
        const currentYear = this.currentYear;
        const currentMonth = this.currentMonth;

        if (!this.data[currentYear]) {
            this.data[currentYear] = {};
        }

        for (let month = 0; month < 12; month++) {
            if (!this.data[currentYear][month]) {
                this.data[currentYear][month] = {
                    income: [],
                    fixedExpenses: [],
                    otherExpenses: [],
                    debt: [],
                    investment: [],
                    travelEntertainment: [],
                    carriedBalance: 0
                };
            }
        }
    }

    setupEventListeners() {
        try {
            // Theme toggle
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => this.toggleTheme());
            }

            // Logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.logout());
            }

            // Close modals when clicking outside
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal')) {
                    e.target.style.display = 'none';
                }
            });

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeAllModals();
                }
            });

            console.log('Event listeners setup successfully');
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    debouncedSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveDataToSheets();
        }, 1000);
    }

    // Additional methods from the original implementation...
    updateMonthDisplay() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const monthElement = document.getElementById('currentMonth');
        if (monthElement) {
            monthElement.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        }
    }

    previousMonth() {
        if (this.currentMonth === 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else {
            this.currentMonth--;
        }
        this.updateMonthDisplay();
        this.renderCurrentMonth();
        this.updateCalculations();
        this.updateAllCharts();
    }

    nextMonth() {
        if (this.currentMonth === 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else {
            this.currentMonth++;
        }
        this.updateMonthDisplay();
        this.renderCurrentMonth();
        this.updateCalculations();
        this.updateAllCharts();
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.debouncedSave();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const sunIcon = themeToggle.querySelector('.sun-icon');
            const moonIcon = themeToggle.querySelector('.moon-icon');

            if (this.currentTheme === 'light') {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            } else {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            }
        }
    }

    renderCurrentMonth() {
        this.initializeEmptyData();
        const monthData = this.data[this.currentYear][this.currentMonth];

        this.renderTable('income', monthData.income, ['name', 'planned', 'actual']);
        this.renderTable('fixedExpenses', monthData.fixedExpenses, ['name', 'planned', 'actual', 'balance']);
        this.renderTable('otherExpenses', monthData.otherExpenses, ['name', 'amount']);
        this.renderTable('debt', monthData.debt, ['name', 'amount']);
        this.renderTable('travelEntertainment', monthData.travelEntertainment, ['name', 'planned', 'actual', 'balance']);
        this.renderTable('investment', monthData.investment, ['name', 'amount']);
    }

    renderTable(tableType, data, columns) {
        const table = document.getElementById(`${tableType}Table`);
        if (!table) return;

        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            this.addRow(tableType);
            return;
        }

        data.forEach((item, index) => {
            const row = this.createTableRow(tableType, item, index, columns);
            tbody.appendChild(row);
        });
    }

    createTableRow(tableType, item, index, columns) {
        const row = document.createElement('tr');

        columns.forEach(field => {
            const cell = document.createElement('td');

            if (field === 'balance') {
                const balance = (parseFloat(item.planned) || 0) - (parseFloat(item.actual) || 0);
                cell.textContent = `₹${balance.toFixed(2)}`;
                cell.classList.add('calculated');
                if (balance < 0) cell.classList.add('negative');
                else if (balance > 0) cell.classList.add('positive');
            } else {
                if (field === 'name') {
                    cell.contentEditable = 'true';
                    cell.textContent = item[field] || '';
                } else {
                    cell.contentEditable = 'true';
                    cell.classList.add('number-input');
                    const value = item[field] || 0;
                    cell.textContent = field.includes('amount') || field.includes('planned') || field.includes('actual') ?
                        (value > 0 ? value.toString() : '') : value.toString();
                }

                cell.addEventListener('blur', (e) => {
                    this.updateItemValue(tableType, index, field, e.target.textContent.trim());
                });

                cell.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.target.blur();
                    }
                });
            }

            row.appendChild(cell);
        });

        return row;
    }

    updateItemValue(tableType, index, field, value) {
        const monthData = this.data[this.currentYear][this.currentMonth];

        if (!monthData[tableType][index]) {
            monthData[tableType][index] = {};
        }

        if (field === 'name') {
            monthData[tableType][index][field] = value;
        } else {
            const numValue = parseFloat(value) || 0;
            monthData[tableType][index][field] = numValue;
        }

        if (field !== 'name') {
            this.updateCalculations();
            this.updateAllCharts();

            // Update balance calculations for fixed expenses and travel entertainment
            if (tableType === 'fixedExpenses' || tableType === 'travelEntertainment') {
                this.updateBalanceDisplays(tableType);
            }
        }

        this.debouncedSave();
    }

    updateBalanceDisplays(tableType) {
        try {
            const table = document.getElementById(`${tableType}Table`);
            if (!table) return;

            const tbody = table.querySelector('tbody');
            if (!tbody) return;

            const rows = tbody.querySelectorAll('tr');
            const monthData = this.data[this.currentYear][this.currentMonth];

            rows.forEach((row, index) => {
                if (monthData[tableType] && monthData[tableType][index]) {
                    const item = monthData[tableType][index];
                    const balanceCell = row.querySelector('td:last-child');

                    if (balanceCell && balanceCell.classList.contains('calculated')) {
                        const balance = (parseFloat(item.planned) || 0) - (parseFloat(item.actual) || 0);
                        balanceCell.textContent = `₹${balance.toFixed(2)}`;

                        // Update balance styling
                        balanceCell.classList.remove('negative', 'positive');
                        if (balance < 0) balanceCell.classList.add('negative');
                        else if (balance > 0) balanceCell.classList.add('positive');
                    }
                }
            });
        } catch (error) {
            console.error('Error updating balance displays:', error);
        }
    }

    addRow(tableType) {
        const monthData = this.data[this.currentYear][this.currentMonth];
        const newItem = { name: '', planned: 0, actual: 0, amount: 0 };
        monthData[tableType].push(newItem);
        this.renderCurrentMonth();
    }

    updateCalculations() {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];

            // Calculate totals
            const totalIncome = this.calculateTotal(monthData.income, ['planned', 'actual']);
            const totalExpenses = this.calculateTotalExpenses(monthData);
            const availableBalance = totalIncome - totalExpenses + (monthData.carriedBalance || 0);
            const savingsRate = totalIncome > 0 ? ((availableBalance / totalIncome) * 100) : 0;

            // Update display
            this.updateSummaryCard('totalIncome', totalIncome);
            this.updateSummaryCard('totalExpenses', totalExpenses);
            this.updateSummaryCard('availableBalance', availableBalance);
            this.updateSummaryCard('savingsRate', `${savingsRate.toFixed(1)}%`);

        } catch (error) {
            console.error('Error updating calculations:', error);
        }
    }

    calculateTotal(items, fields) {
        return items.reduce((total, item) => {
            return total + fields.reduce((sum, field) => sum + (parseFloat(item[field]) || 0), 0);
        }, 0);
    }

    calculateTotalExpenses(monthData) {
        const fixedExpenses = this.calculateTotal(monthData.fixedExpenses, ['actual']);
        const otherExpenses = this.calculateTotal(monthData.otherExpenses, ['amount']);
        const debt = this.calculateTotal(monthData.debt, ['amount']);
        const travelEntertainment = this.calculateTotal(monthData.travelEntertainment, ['actual']);
        const investment = this.calculateTotal(monthData.investment, ['amount']);

        return fixedExpenses + otherExpenses + debt + travelEntertainment + investment;
    }

    updateSummaryCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            if (elementId === 'savingsRate') {
                element.textContent = value;
            } else {
                element.textContent = `₹${parseFloat(value).toFixed(2)}`;
                element.classList.toggle('negative', parseFloat(value) < 0);
            }
        }
    }

    updateAllCharts() {
        this.updateExpenseChart();
        this.updateTrendChart();
        this.updateBalanceChart();
    }

    updateExpenseChart() {
        try {
            const ctx = document.getElementById('expenseChart');
            if (!ctx) return;

            const monthData = this.data[this.currentYear][this.currentMonth];

            const expenseData = {
                'Fixed Expenses': this.calculateTotal(monthData.fixedExpenses, ['actual']),
                'Other Expenses': this.calculateTotal(monthData.otherExpenses, ['amount']),
                'Debt': this.calculateTotal(monthData.debt, ['amount']),
                'Travel & Entertainment': this.calculateTotal(monthData.travelEntertainment, ['actual']),
                'Investment': this.calculateTotal(monthData.investment, ['amount'])
            };

            const labels = Object.keys(expenseData).filter(key => expenseData[key] > 0);
            const values = labels.map(key => expenseData[key]);

            if (this.charts.expense) {
                this.charts.expense.destroy();
            }

            this.charts.expense = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: [
                            '#FF6384',
                            '#36A2EB',
                            '#FFCE56',
                            '#4BC0C0',
                            '#9966FF'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'var(--text-primary)',
                                font: { size: 12 }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error updating expense chart:', error);
        }
    }

    updateTrendChart() {
        try {
            const ctx = document.getElementById('trendChart');
            if (!ctx) return;

            const months = [];
            const efficiencyData = [];

            // Get last 6 months data
            for (let i = 5; i >= 0; i--) {
                let month = this.currentMonth - i;
                let year = this.currentYear;

                if (month < 0) {
                    month += 12;
                    year--;
                }

                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                months.push(monthNames[month]);

                if (this.data[year] && this.data[year][month]) {
                    const monthData = this.data[year][month];
                    const income = this.calculateTotal(monthData.income, ['actual']);
                    const expenses = this.calculateTotalExpenses(monthData);
                    const efficiency = income > 0 ? ((income - expenses) / income * 100) : 0;
                    efficiencyData.push(efficiency);
                } else {
                    efficiencyData.push(0);
                }
            }

            if (this.charts.trend) {
                this.charts.trend.destroy();
            }

            this.charts.trend = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Savings Rate %',
                        data: efficiencyData,
                        borderColor: '#36A2EB',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: 'var(--text-primary)'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: 'var(--text-secondary)' }
                        },
                        y: {
                            ticks: { color: 'var(--text-secondary)' },
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error updating trend chart:', error);
        }
    }

    updateBalanceChart() {
        try {
            const ctx = document.getElementById('balanceChart');
            if (!ctx) return;

            const monthData = this.data[this.currentYear][this.currentMonth];
            const totalIncome = this.calculateTotal(monthData.income, ['planned', 'actual']);
            const totalExpenses = this.calculateTotalExpenses(monthData);

            if (this.charts.balance) {
                this.charts.balance.destroy();
            }

            this.charts.balance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Available', 'Used'],
                    datasets: [{
                        data: [totalIncome - totalExpenses, totalExpenses],
                        backgroundColor: ['#4BC0C0', '#FF6384'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: 'var(--text-secondary)' }
                        },
                        y: {
                            ticks: { color: 'var(--text-secondary)' }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error updating balance chart:', error);
        }
    }

    loadTemplates() {
        this.renderTemplates('fixedExpenses');
        this.renderTemplates('debt');
    }

    renderTemplates(type) {
        const container = document.getElementById(`${type}Templates`);
        if (!container) return;

        container.innerHTML = '';

        this.templates[type].forEach((template, index) => {
            const div = document.createElement('div');
            div.className = 'template-item';
            div.innerHTML = `
                <span>${template.name} - ₹${template.amount}</span>
                <button onclick="budgetApp.deleteTemplate('${type}', ${index})" class="delete-template">×</button>
            `;
            container.appendChild(div);
        });
    }

    addTemplate(type) {
        const nameInput = document.getElementById(`${type}TemplateName`);
        const amountInput = document.getElementById(`${type}TemplateAmount`);

        if (!nameInput || !amountInput) return;

        const name = nameInput.value.trim();
        const amount = parseFloat(amountInput.value) || 0;

        if (name && amount > 0) {
            this.templates[type].push({ name, amount });
            this.renderTemplates(type);
            this.debouncedSave();

            nameInput.value = '';
            amountInput.value = '';
        }
    }

    deleteTemplate(type, index) {
        this.templates[type].splice(index, 1);
        this.renderTemplates(type);
        this.debouncedSave();
    }

    showAdminPanel() {
        const modal = document.getElementById('adminModal');
        if (modal) {
            modal.style.display = 'block';
            this.loadTemplates();

            // Update spreadsheet ID display
            const spreadsheetIdElement = document.getElementById('currentSpreadsheetId');
            if (spreadsheetIdElement) {
                spreadsheetIdElement.textContent = spreadsheetId || 'Not connected';
            }
        }
    }

    closeAdminPanel() {
        const modal = document.getElementById('adminModal');
        if (modal) modal.style.display = 'none';
    }

    showDeletePanel(tableType) {
        const modal = document.getElementById('deleteModal');
        if (!modal) return;

        this.currentDeleteType = tableType;
        const monthData = this.data[this.currentYear][this.currentMonth];
        const items = monthData[tableType];

        const deleteList = document.getElementById('deleteList');
        deleteList.innerHTML = '';

        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'delete-item';
            div.innerHTML = `
                <label>
                    <input type="checkbox" value="${index}">
                    ${item.name || 'Unnamed item'} - ₹${(item.amount || item.planned || item.actual || 0).toFixed(2)}
                </label>
            `;
            deleteList.appendChild(div);
        });

        modal.style.display = 'block';
    }

    closeDeletePanel() {
        const modal = document.getElementById('deleteModal');
        if (modal) modal.style.display = 'none';
    }

    confirmDelete() {
        const selectedItems = Array.from(document.querySelectorAll('#deleteList input:checked'))
            .map(input => parseInt(input.value))
            .sort((a, b) => b - a); // Sort in descending order

        const monthData = this.data[this.currentYear][this.currentMonth];

        selectedItems.forEach(index => {
            monthData[this.currentDeleteType].splice(index, 1);
        });

        this.renderCurrentMonth();
        this.updateCalculations();
        this.updateAllCharts();
        this.debouncedSave();
        this.closeDeletePanel();
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.style.display = 'none');
    }

    async exportToPDF() {
        try {
            this.showLoading('Generating PDF...');

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();

            // Add title
            pdf.setFontSize(20);
            pdf.text('Budget Report', 20, 20);

            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            pdf.setFontSize(14);
            pdf.text(`${monthNames[this.currentMonth]} ${this.currentYear}`, 20, 35);

            // Add summary
            let yPosition = 50;
            const summaryData = [
                ['Total Income', document.getElementById('totalIncome').textContent],
                ['Total Expenses', document.getElementById('totalExpenses').textContent],
                ['Available Balance', document.getElementById('availableBalance').textContent],
                ['Savings Rate', document.getElementById('savingsRate').textContent]
            ];

            pdf.setFontSize(12);
            summaryData.forEach(([label, value]) => {
                pdf.text(`${label}: ${value}`, 20, yPosition);
                yPosition += 10;
            });

            // Add detailed tables (simplified version)
            yPosition += 10;
            const monthData = this.data[this.currentYear][this.currentMonth];

            Object.keys(monthData).forEach(category => {
                if (Array.isArray(monthData[category]) && monthData[category].length > 0) {
                    pdf.text(category.toUpperCase(), 20, yPosition);
                    yPosition += 10;

                    monthData[category].forEach(item => {
                        const line = `${item.name}: ₹${(item.amount || item.actual || item.planned || 0).toFixed(2)}`;
                        pdf.text(line, 25, yPosition);
                        yPosition += 8;

                        if (yPosition > 280) {
                            pdf.addPage();
                            yPosition = 20;
                        }
                    });
                    yPosition += 5;
                }
            });

            pdf.save(`budget-${monthNames[this.currentMonth]}-${this.currentYear}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showError('Failed to generate PDF');
        } finally {
            this.hideLoading();
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('budgetData');
            if (saved) {
                this.data = JSON.parse(saved);
            }

            const savedTemplates = localStorage.getItem('budgetTemplates');
            if (savedTemplates) {
                this.templates = JSON.parse(savedTemplates);
            }

            const savedTheme = localStorage.getItem('budgetTheme');
            if (savedTheme) {
                this.currentTheme = savedTheme;
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    cleanup() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        clearTimeout(this.saveTimeout);
        clearTimeout(this.updateTimeout);
    }
}

// Global functions for Google Auth
window.handleCredentialResponse = function(response) {
    if (budgetApp) {
        budgetApp.handleCredentialResponse(response);
    }
};

// Global app instance
let budgetApp;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        budgetApp = new BudgetApp();
    } catch (error) {
        console.error('Failed to initialize budget app:', error);
        alert('Failed to initialize the application. Please refresh the page.');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (budgetApp) {
        budgetApp.cleanup();
    }
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (budgetApp) {
        budgetApp.showError('An unexpected error occurred');
    }
});
