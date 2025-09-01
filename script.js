// Budget Planning App - Enhanced with Google Drive and Sheets Integration

class BudgetApp {
    constructor() {
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.expenseChart = null;
        this.efficiencyChart = null;
        this.balanceChart = null;
        this.data = null;
        this.fixedExpenseTemplates = null;
        this.debtTemplates = null;
        this.isNavigating = false;
        this.saveTimeout = null;
        this.chartUpdateTimeout = null;

        // Google APIs Configuration
        this.GOOGLE_CLIENT_ID = '264294259025-p9mp7hpo23l4ni8teppstb2tc5rkjqg1.apps.googleusercontent.com';
        this.GOOGLE_API_KEY = 'AIzaSyAg4YE9tX0cVWUo8YywjV0pahsOWIL2qfo';
        this.DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
        this.SHEETS_DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile';
        
        // Google Drive folder and spreadsheet IDs
        this.DRIVE_FOLDER_ID = '1RskB1eMFAqD3IZdx3hfI1zSBoG9qDY7L';
        this.SPREADSHEET_ID = '1k84u57ZKkpiian68HX6K63sgx1JgIF3hXNxjkYrZjgE';

        // Authentication state
        this.isSignedIn = false;
        this.tokenClient = null;
        this.gapi = null;

        // File IDs for Google Drive
        this.fileIds = {
            budgetData: null,
            fixedExpenseTemplates: null,
            debtTemplates: null,
            themeSettings: null
        };

        // Cache DOM elements to improve performance
        this.domCache = {};

        this.init();
    }

    async init() {
        try {
            await this.waitForDOM();
            this.cacheDOMElements();
            
            // Initialize Google APIs
            await this.initializeGoogleAPIs();
            
            // Load data (try cloud first, then fallback to local cache)
            await this.loadAllData();
            
            this.setupEventListeners();
            this.setupTooltips();
            this.updateCurrentMonthDisplay();
            this.loadMonth(this.currentMonth, this.currentYear);
            this.setupTheme();
            this.updateAllCharts();
            this.updateAuthUI(); // Show appropriate UI based on auth status

            console.log('Budget app initialized successfully');
        } catch (error) {
            console.error('Failed to initialize budget app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    cacheDOMElements() {
        const elements = [
            'prevMonth', 'nextMonth', 'currentMonth', 'themeToggle', 
            'adminPanel', 'exportPDF', 'totalIncome', 'totalExpenses', 
            'remainingAmount', 'carriedAmount', 'adminModal',
            'tooltip', 'errorToast', 'errorMessage', 'expenseChart', 
            'efficiencyChart', 'balanceChart', 'authStatus', 'authMessage',
            'syncIndicator', 'signInBtn', 'signOutBtn', 'userInfo',
            'userAvatar', 'userName', 'authControls', 'signInPrompt', 'mainContent'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.domCache[id] = element;
            } else {
                console.warn(`Element with ID '${id}' not found`);
            }
        });
    }

    getElement(id) {
        return this.domCache[id] || document.getElementById(id);
    }

    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }

    // Google APIs Initialization
    async initializeGoogleAPIs() {
        try {
            this.showSyncStatus('Initializing Google APIs...');
            
            // Initialize gapi for API calls
            await new Promise((resolve, reject) => {
                gapi.load('client', {
                    callback: resolve,
                    onerror: reject
                });
            });

            await gapi.client.init({
                apiKey: this.GOOGLE_API_KEY,
                discoveryDocs: [this.DISCOVERY_DOC, this.SHEETS_DISCOVERY_DOC]
            });

            // Initialize Google Identity Services for authentication
            await this.initializeGoogleIdentity();

            this.hideSyncStatus();
            console.log('Google APIs initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Google APIs:', error);
            this.showError('Failed to initialize Google APIs. Please refresh and try again.');
            this.hideSyncStatus();
        }
    }

    async initializeGoogleIdentity() {
        return new Promise((resolve) => {
            // Wait for Google Identity Services to load
            const checkGSI = () => {
                if (typeof google !== 'undefined' && google.accounts) {
                    // Initialize token client for authentication
                    this.tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: this.GOOGLE_CLIENT_ID,
                        scope: this.SCOPES,
                        prompt: 'select_account',
                        callback: (tokenResponse) => {
                            console.log('Token received:', tokenResponse);
                            if (tokenResponse.access_token) {
                                gapi.client.setToken(tokenResponse);
                                this.handleAuthSuccess();
                            }
                        }
                    });
                    resolve();
                } else {
                    // Check again in 100ms
                    setTimeout(checkGSI, 100);
                }
            };
            checkGSI();
        });
    }

    // Authentication Methods
    signIn() {
        if (this.tokenClient) {
            this.showSyncStatus('Signing in...');
            try {
                this.tokenClient.requestAccessToken({prompt: 'consent'});
            } catch (error) {
                console.error('Sign in failed:', error);
                this.showError('Failed to sign in. Please try again.');
                this.hideSyncStatus();
            }
        } else {
            this.showError('Google APIs not initialized');
        }
    }

    signOut() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
        }
        
        this.isSignedIn = false;
        this.updateAuthUI();
        this.showSyncStatus('Signed out');
        setTimeout(() => this.hideSyncStatus(), 2000);
        
        // Clear data since we only use cloud storage
        this.data = this.getDefaultBudgetData();
        this.fixedExpenseTemplates = [];
        this.debtTemplates = [];
        this.loadMonth(this.currentMonth, this.currentYear);
        this.updateAllCharts();
    }

    async handleAuthSuccess() {
        this.isSignedIn = true;
        this.updateAuthUI();
        
        try {
            // Get user info using the People API
            const response = await gapi.client.request({
                path: 'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos'
            });
            
            const person = response.result;
            const userInfo = {
                name: person.names?.[0]?.displayName || 'User',
                email: person.emailAddresses?.[0]?.value || '',
                picture: person.photos?.[0]?.url || ''
            };
            this.updateUserInfo(userInfo);
            
            // Load data from Google Drive
            await this.loadAllDataFromCloud();
            this.loadMonth(this.currentMonth, this.currentYear);
            this.updateAllCharts();
            
            this.showSyncStatus('Signed in successfully');
            setTimeout(() => this.hideSyncStatus(), 2000);
        } catch (error) {
            console.error('Error after authentication:', error);
            // Continue anyway, user is authenticated
            this.isSignedIn = true;
            this.updateAuthUI();
            await this.loadAllDataFromCloud();
            this.loadMonth(this.currentMonth, this.currentYear);
            this.updateAllCharts();
            this.showSyncStatus('Signed in successfully');
            setTimeout(() => this.hideSyncStatus(), 2000);
        }
    }

    updateAuthUI() {
        const signInBtn = this.getElement('signInBtn');
        const userInfo = this.getElement('userInfo');
        const signInPrompt = this.getElement('signInPrompt');
        const mainContent = this.getElement('mainContent');
        
        if (this.isSignedIn) {
            // User is signed in - show main app
            if (signInBtn) signInBtn.classList.add('hidden');
            if (userInfo) userInfo.classList.remove('hidden');
            if (signInPrompt) signInPrompt.classList.add('hidden');
            if (mainContent) mainContent.classList.remove('hidden');
        } else {
            // User is not signed in - show sign in prompt
            if (signInBtn) signInBtn.classList.remove('hidden');
            if (userInfo) userInfo.classList.add('hidden');
            if (signInPrompt) signInPrompt.classList.remove('hidden');
            if (mainContent) mainContent.classList.add('hidden');
        }
    }

    updateUserInfo(userInfo) {
        const userAvatar = this.getElement('userAvatar');
        const userName = this.getElement('userName');
        
        if (userAvatar && userInfo.picture) {
            userAvatar.src = userInfo.picture;
        }
        
        if (userName && userInfo.name) {
            userName.textContent = userInfo.name;
        }
    }

    showSyncStatus(message) {
        const authStatus = this.getElement('authStatus');
        const authMessage = this.getElement('authMessage');
        
        if (authStatus && authMessage) {
            authMessage.textContent = message;
            authStatus.classList.remove('hidden');
        }
    }

    hideSyncStatus() {
        const authStatus = this.getElement('authStatus');
        if (authStatus) {
            authStatus.classList.add('hidden');
        }
    }

    // Google Drive File Management
    async findOrCreateFile(fileName, mimeType = 'application/json') {
        try {
            // Search for existing file in the folder
            const response = await gapi.client.drive.files.list({
                q: `name='${fileName}' and parents in '${this.DRIVE_FOLDER_ID}' and trashed=false`,
                fields: 'files(id, name)'
            });

            if (response.result.files.length > 0) {
                return response.result.files[0].id;
            }

            // Create new file if not found
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: fileName,
                    parents: [this.DRIVE_FOLDER_ID],
                    mimeType: mimeType
                }
            });

            return createResponse.result.id;
        } catch (error) {
            console.error(`Error finding/creating file ${fileName}:`, error);
            throw error;
        }
    }

    async saveFileToGoogleDrive(fileId, content) {
        try {
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            const metadata = {
                'mimeType': 'application/json'
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(content) +
                close_delim;

            const request = gapi.client.request({
                'path': 'https://www.googleapis.com/upload/drive/v3/files/' + fileId,
                'method': 'PATCH',
                'params': {'uploadType': 'multipart'},
                'headers': {
                    'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                },
                'body': multipartRequestBody
            });

            return await request;
        } catch (error) {
            console.error('Error saving to Google Drive:', error);
            throw error;
        }
    }

    async loadFileFromGoogleDrive(fileId) {
        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            return JSON.parse(response.body);
        } catch (error) {
            console.error('Error loading from Google Drive:', error);
            return null;
        }
    }

    // Google Sheets Integration
    async saveBudgetDataToSheets() {
        try {
            if (!this.data) return;

            // Prepare data for sheets
            const values = [];
            
            // Header row
            values.push(['Year', 'Month', 'Category', 'Type', 'Name', 'Planned', 'Actual', 'Amount']);

            // Process each year and month
            for (const [year, yearData] of Object.entries(this.data)) {
                for (const [month, monthData] of Object.entries(yearData)) {
                    const monthInt = parseInt(month);
                    
                    // Income
                    monthData.income?.forEach(item => {
                        values.push([year, monthInt, 'Income', 'Income', item.source || '', '', '', item.amount || 0]);
                    });

                    // Fixed Expenses
                    monthData.fixedExpenses?.forEach(item => {
                        values.push([year, monthInt, 'Fixed Expense', 'Expense', item.name || '', item.planned || 0, item.actual || 0, '']);
                    });

                    // Other Expenses
                    monthData.otherExpenses?.forEach(item => {
                        values.push([year, monthInt, 'Other Expense', 'Expense', item.name || '', '', '', item.amount || 0]);
                    });

                    // Travel & Entertainment
                    monthData.travelEntertainment?.forEach(item => {
                        values.push([year, monthInt, 'Travel & Entertainment', 'Expense', item.name || '', item.planned || 0, item.actual || 0, '']);
                    });

                    // Investment
                    monthData.investment?.forEach(item => {
                        values.push([year, monthInt, 'Investment', 'Investment', item.name || '', '', '', item.amount || 0]);
                    });

                    // Debt
                    monthData.debt?.forEach(item => {
                        values.push([year, monthInt, 'Debt', 'Debt', item.name || '', '', '', item.amount || 0]);
                    });

                    // Carried Balance
                    if (monthData.carriedBalance && monthData.carriedBalance > 0) {
                        values.push([year, monthInt, 'Carried Balance', 'Balance', 'Carried Forward', '', '', monthData.carriedBalance]);
                    }
                }
            }

            // Clear existing data and write new data
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: this.SPREADSHEET_ID,
                range: 'Budget Data!A:H'
            });

            if (values.length > 0) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: this.SPREADSHEET_ID,
                    range: 'Budget Data!A1',
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: values
                    }
                });
            }

            console.log('Budget data saved to Google Sheets successfully');
        } catch (error) {
            console.error('Error saving to Google Sheets:', error);
        }
    }

    // Data Loading and Saving Methods
    async loadAllData() {
        if (this.isSignedIn) {
            await this.loadAllDataFromCloud();
        } else {
            // Use default data until user signs in
            this.data = this.getDefaultBudgetData();
            this.fixedExpenseTemplates = [];
            this.debtTemplates = [];
            this.applyTheme('light');
            console.log('Using default data - please sign in to access your cloud data');
        }
    }

    async loadAllDataFromCloud() {
        try {
            this.showSyncStatus('Loading data from cloud...');

            // Find or create files
            this.fileIds.budgetData = await this.findOrCreateFile('budget-data.json');
            this.fileIds.fixedExpenseTemplates = await this.findOrCreateFile('fixed-expense-templates.json');
            this.fileIds.debtTemplates = await this.findOrCreateFile('debt-templates.json');
            this.fileIds.themeSettings = await this.findOrCreateFile('theme-setting.json');

            // Load data from files
            this.data = await this.loadFileFromGoogleDrive(this.fileIds.budgetData) || this.getDefaultBudgetData();
            this.fixedExpenseTemplates = await this.loadFileFromGoogleDrive(this.fileIds.fixedExpenseTemplates) || [];
            this.debtTemplates = await this.loadFileFromGoogleDrive(this.fileIds.debtTemplates) || [];
            
            const themeData = await this.loadFileFromGoogleDrive(this.fileIds.themeSettings) || { theme: 'light' };
            this.applyTheme(themeData.theme);

            this.hideSyncStatus();
            console.log('Data loaded from cloud successfully');
        } catch (error) {
            console.error('Error loading data from cloud:', error);
            this.showError('Failed to load data from cloud. Please check your connection and try again.');
            this.hideSyncStatus();
        }
    }

    getDefaultBudgetData() {
        const defaultData = {};
        const currentYear = new Date().getFullYear();
        
        for (let year = currentYear - 1; year <= currentYear + 1; year++) {
            defaultData[year] = {};
            for (let month = 0; month < 12; month++) {
                defaultData[year][month] = {
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
        
        return defaultData;
    }

    async saveAllData() {
        if (this.isSignedIn) {
            await this.saveAllDataToCloud();
        } else {
            this.showError('Please sign in to save your data to the cloud.');
        }
    }

    async saveAllDataToCloud() {
        try {
            this.showSyncStatus('Syncing to cloud...');

            // Save all files to Google Drive
            await Promise.all([
                this.saveFileToGoogleDrive(this.fileIds.budgetData, this.data),
                this.saveFileToGoogleDrive(this.fileIds.fixedExpenseTemplates, this.fixedExpenseTemplates),
                this.saveFileToGoogleDrive(this.fileIds.debtTemplates, this.debtTemplates)
            ]);

            // Save to Google Sheets
            await this.saveBudgetDataToSheets();

            this.hideSyncStatus();
            console.log('Data saved to cloud successfully');
        } catch (error) {
            console.error('Error saving to cloud:', error);
            this.showError('Failed to sync to cloud. Please check your connection and try again.');
        }
    }

    setupEventListeners() {
        try {
            // Authentication event listeners
            const signInBtn = this.getElement('signInBtn');
            const signOutBtn = this.getElement('signOutBtn');
            
            if (signInBtn) {
                signInBtn.addEventListener('click', () => this.signIn());
            }
            
            if (signOutBtn) {
                signOutBtn.addEventListener('click', () => this.signOut());
            }

            // Navigation arrows with null checks
            const prevButton = this.getElement('prevMonth');
            const nextButton = this.getElement('nextMonth');

            if (prevButton && nextButton) {
                prevButton.addEventListener('click', () => {
                    if (!this.isNavigating) {
                        this.navigateMonth(-1);
                    }
                });

                nextButton.addEventListener('click', () => {
                    if (!this.isNavigating) {
                        this.navigateMonth(1);
                    }
                });
            }

            // Theme toggle
            const themeToggle = this.getElement('themeToggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    this.toggleTheme();
                });
            }

            // Admin panel
            const adminButton = this.getElement('adminPanel');
            if (adminButton) {
                adminButton.addEventListener('click', () => {
                    this.openAdminPanel();
                });
            }

            // PDF export
            const exportButton = this.getElement('exportPDF');
            if (exportButton) {
                exportButton.addEventListener('click', () => {
                    this.exportToPDF();
                });
            }

            // Admin panel forms
            const addTemplateButton = document.getElementById('addTemplate');
            if (addTemplateButton) {
                addTemplateButton.addEventListener('click', () => {
                    this.addFixedExpenseTemplate();
                });
            }

            const addDebtTemplateButton = document.getElementById('addDebtTemplate');
            if (addDebtTemplateButton) {
                addDebtTemplateButton.addEventListener('click', () => {
                    this.addDebtTemplate();
                });
            }

            // Input validation with immediate calculations
            document.addEventListener('input', (e) => {
                if (e.target.classList.contains('numeric-input')) {
                    this.validateNumericInput(e.target);
                }

                if (e.target.classList.contains('editable')) {
                    this.updateCalculations();
                    this.debouncedSave();
                }
            });

            // Close modal on overlay click
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    this.closeAdminPanel();
                    this.closeDeleteSelectionPanel();
                    this.closeManagePanel();
                }
            });

            // Keyboard navigation
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeAdminPanel();
                    this.closeDeleteSelectionPanel();
                    this.closeManagePanel();
                }
            });

            console.log('Event listeners setup successfully');
        } catch (error) {
            console.error('Error setting up event listeners:', error);
            this.showError('Failed to setup event listeners');
        }
    }

    debouncedSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(async () => {
            try {
                await this.saveAllData();
                this.updateCalculations();
                this.debouncedChartUpdate();
            } catch (error) {
                console.error('Error in debounced save:', error);
                this.showError('Failed to save data');
            }
        }, 500);
    }

    debouncedChartUpdate() {
        if (this.chartUpdateTimeout) {
            clearTimeout(this.chartUpdateTimeout);
        }

        this.chartUpdateTimeout = setTimeout(() => {
            try {
                this.updateAllCharts();
            } catch (error) {
                console.error('Error updating charts:', error);
            }
        }, 300);
    }

    updateCurrentMonthDisplay() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const currentMonthElement = this.getElement('currentMonth');
        if (currentMonthElement) {
            currentMonthElement.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        }
    }

    async navigateMonth(direction) {
        if (this.isNavigating) return;

        this.isNavigating = true;

        try {
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                await this.saveAllData();
            }

            this.currentMonth += direction;

            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear += 1;
            } else if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear -= 1;
            }

            this.updateCurrentMonthDisplay();
            await this.loadMonth(this.currentMonth, this.currentYear);

        } catch (error) {
            console.error('Error navigating month:', error);
            this.showError('Failed to navigate to month');
        } finally {
            this.isNavigating = false;
        }
    }

    initializeYearData(year) {
        if (!this.data[year]) {
            this.data[year] = {};
            for (let month = 0; month < 12; month++) {
                this.data[year][month] = {
                    income: [],
                    fixedExpenses: [],
                    otherExpenses: [],
                    travelEntertainment: [],
                    debt: [],
                    investment: [],
                    carriedBalance: 0
                };
            }
        }
    }

    ensureMonthArrays(monthData) {
        const requiredArrays = ['income', 'fixedExpenses', 'otherExpenses', 'debt', 'investment', 'travelEntertainment'];
        requiredArrays.forEach(array => {
            if (!monthData[array]) monthData[array] = [];
        });
        if (typeof monthData.carriedBalance !== 'number') monthData.carriedBalance = 0;
    }

    carryOverBalance(month, year) {
        try {
            if (!this.data[year] || !this.data[year][month]) {
                return;
            }

            let previousMonth = month - 1;
            let previousYear = year;

            if (previousMonth < 0) {
                previousMonth = 11;
                previousYear = year - 1;
            }

            if (this.data[previousYear] && this.data[previousYear][previousMonth]) {
                const prevMonthData = this.data[previousYear][previousMonth];
                const prevIncome = (prevMonthData.income || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                const prevExpenses = 
                    (prevMonthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                    (prevMonthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                    (prevMonthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                    (prevMonthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                    (prevMonthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

                const prevRemaining = prevIncome - prevExpenses + (prevMonthData.carriedBalance || 0);
                this.data[year][month].carriedBalance = prevRemaining > 0 ? prevRemaining : 0;
            }
        } catch (error) {
            console.error('Error carrying over balance:', error);
        }
    }

    setupTooltips() {
        const tooltip = this.getElement('tooltip');
        if (!tooltip) return;

        document.addEventListener('mouseover', (e) => {
            if (e.target.hasAttribute('data-tooltip')) {
                const tooltipText = e.target.getAttribute('data-tooltip');
                tooltip.textContent = tooltipText;
                tooltip.classList.remove('hidden');
                
                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = rect.left + 'px';
                tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.hasAttribute('data-tooltip')) {
                tooltip.classList.add('hidden');
            }
        });
    }

    async loadMonth(month, year) {
        try {
            this.initializeYearData(year);
            
            if (!this.data[year][month]) {
                this.data[year][month] = {
                    income: [],
                    fixedExpenses: [],
                    otherExpenses: [],
                    travelEntertainment: [],
                    debt: [],
                    investment: [],
                    carriedBalance: 0
                };
            }

            const monthData = this.data[year][month];
            this.ensureMonthArrays(monthData);
            this.carryOverBalance(month, year);

            this.renderTables(monthData);
            this.updateCalculations();
            this.updateAllCharts();

        } catch (error) {
            console.error('Error loading month:', error);
            this.showError('Failed to load month data');
        }
    }

    renderTables(monthData) {
        try {
            this.renderIncomeTable(monthData.income);
            this.renderFixedExpensesTable(monthData.fixedExpenses);
            this.renderOtherExpensesTable(monthData.otherExpenses);
            this.renderTravelEntertainmentTable(monthData.travelEntertainment);
            this.renderDebtTable(monthData.debt);
            this.renderInvestmentTable(monthData.investment);
        } catch (error) {
            console.error('Error rendering tables:', error);
            this.showError('Failed to render tables');
        }
    }

    renderIncomeTable(incomeData) {
        const tbody = document.querySelector('#incomeTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        incomeData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable income-source" value="${item.source || ''}" 
                    data-index="${index}" data-field="source"></td>
                <td><input type="number" class="editable numeric-input income-amount" value="${item.amount || ''}" 
                    data-index="${index}" data-field="amount" step="0.01" min="0"></td>
            `;
            tbody.appendChild(row);
        });

        this.attachTableEventListeners('#incomeTable', 'income');
    }

    renderFixedExpensesTable(fixedExpensesData) {
        const tbody = document.querySelector('#fixedExpensesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        fixedExpensesData.forEach((item, index) => {
            const row = document.createElement('tr');
            const balance = (parseFloat(item.planned) || 0) - (parseFloat(item.actual) || 0);
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable fixed-expense-name" value="${item.name || ''}" 
                    data-index="${index}" data-field="name"></td>
                <td><input type="number" class="editable numeric-input fixed-expense-planned" value="${item.planned || ''}" 
                    data-index="${index}" data-field="planned" step="0.01" min="0"></td>
                <td><input type="number" class="editable numeric-input fixed-expense-actual" value="${item.actual || ''}" 
                    data-index="${index}" data-field="actual" step="0.01" min="0"></td>
                <td class="balance-cell ${balance >= 0 ? 'positive' : 'negative'}">₹${balance.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });

        this.attachTableEventListeners('#fixedExpensesTable', 'fixedExpenses');
    }

    renderOtherExpensesTable(otherExpensesData) {
        const tbody = document.querySelector('#otherExpensesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        otherExpensesData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable other-expense-name" value="${item.name || ''}" 
                    data-index="${index}" data-field="name"></td>
                <td><input type="number" class="editable numeric-input other-expense-amount" value="${item.amount || ''}" 
                    data-index="${index}" data-field="amount" step="0.01" min="0"></td>
            `;
            tbody.appendChild(row);
        });

        this.attachTableEventListeners('#otherExpensesTable', 'otherExpenses');
    }

    renderTravelEntertainmentTable(travelData) {
        const tbody = document.querySelector('#travelEntertainmentTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        travelData.forEach((item, index) => {
            const row = document.createElement('tr');
            const balance = (parseFloat(item.planned) || 0) - (parseFloat(item.actual) || 0);
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable travel-name" value="${item.name || ''}" 
                    data-index="${index}" data-field="name"></td>
                <td><input type="number" class="editable numeric-input travel-planned" value="${item.planned || ''}" 
                    data-index="${index}" data-field="planned" step="0.01" min="0"></td>
                <td><input type="number" class="editable numeric-input travel-actual" value="${item.actual || ''}" 
                    data-index="${index}" data-field="actual" step="0.01" min="0"></td>
                <td class="balance-cell ${balance >= 0 ? 'positive' : 'negative'}">₹${balance.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });

        this.attachTableEventListeners('#travelEntertainmentTable', 'travelEntertainment');
    }

    renderDebtTable(debtData) {
        const tbody = document.querySelector('#debtTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        debtData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable debt-name" value="${item.name || ''}" 
                    data-index="${index}" data-field="name"></td>
                <td><input type="number" class="editable numeric-input debt-amount" value="${item.amount || ''}" 
                    data-index="${index}" data-field="amount" step="0.01" min="0"></td>
            `;
            tbody.appendChild(row);
        });

        this.attachTableEventListeners('#debtTable', 'debt');
    }

    renderInvestmentTable(investmentData) {
        const tbody = document.querySelector('#investmentTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        investmentData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable investment-name" value="${item.name || ''}" 
                    data-index="${index}" data-field="name"></td>
                <td><input type="number" class="editable numeric-input investment-amount" value="${item.amount || ''}" 
                    data-index="${index}" data-field="amount" step="0.01" min="0"></td>
            `;
            tbody.appendChild(row);
        });

        this.attachTableEventListeners('#investmentTable', 'investment');
    }

    attachTableEventListeners(tableSelector, dataType) {
        const table = document.querySelector(tableSelector);
        if (!table) return;

        const inputs = table.querySelectorAll('input.editable');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.updateDataFromInput(e.target, dataType);
                if (dataType === 'fixedExpenses' || dataType === 'travelEntertainment') {
                    this.updateBalanceCell(e.target);
                }
            });

            input.addEventListener('blur', () => {
                this.debouncedSave();
            });
        });
    }

    updateDataFromInput(input, dataType) {
        try {
            const index = parseInt(input.dataset.index);
            const field = input.dataset.field;
            const value = input.value;

            if (!this.data[this.currentYear][this.currentMonth][dataType][index]) {
                this.data[this.currentYear][this.currentMonth][dataType][index] = {};
            }

            if (field === 'amount' || field === 'planned' || field === 'actual') {
                this.data[this.currentYear][this.currentMonth][dataType][index][field] = parseFloat(value) || 0;
            } else {
                this.data[this.currentYear][this.currentMonth][dataType][index][field] = value;
            }

            this.updateCalculations();
        } catch (error) {
            console.error('Error updating data from input:', error);
        }
    }

    updateBalanceCell(input) {
        try {
            const row = input.closest('tr');
            const balanceCell = row.querySelector('.balance-cell');
            if (!balanceCell) return;

            const plannedInput = row.querySelector('[data-field="planned"]');
            const actualInput = row.querySelector('[data-field="actual"]');
            
            if (plannedInput && actualInput) {
                const planned = parseFloat(plannedInput.value) || 0;
                const actual = parseFloat(actualInput.value) || 0;
                const balance = planned - actual;

                balanceCell.textContent = `₹${balance.toFixed(2)}`;
                balanceCell.className = `balance-cell ${balance >= 0 ? 'positive' : 'negative'}`;
            }
        } catch (error) {
            console.error('Error updating balance cell:', error);
        }
    }

    updateCalculations() {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];
            if (!monthData) return;

            // Calculate totals
            const totalIncome = (monthData.income || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            
            const totalExpenses = 
                (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

            const carriedBalance = monthData.carriedBalance || 0;
            const remainingAmount = totalIncome - totalExpenses + carriedBalance;

            // Update UI
            this.updateElement('totalIncome', `₹${totalIncome.toFixed(2)}`);
            this.updateElement('totalExpenses', `₹${totalExpenses.toFixed(2)}`);
            this.updateElement('remainingAmount', `₹${remainingAmount.toFixed(2)}`);
            this.updateElement('carriedAmount', `₹${carriedBalance.toFixed(2)}`);

            // Update amount colors
            this.updateAmountColor('remainingAmount', remainingAmount);

        } catch (error) {
            console.error('Error updating calculations:', error);
        }
    }

    updateElement(id, value) {
        const element = this.getElement(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateAmountColor(elementId, amount) {
        const element = this.getElement(elementId);
        if (element) {
            element.className = element.className.replace(/\b(positive|negative)\b/g, '');
            element.classList.add(amount >= 0 ? 'positive' : 'negative');
        }
    }

    validateNumericInput(input) {
        let value = input.value;
        value = value.replace(/[^0-9.-]/g, '');
        
        const dotCount = (value.match(/\./g) || []).length;
        if (dotCount > 1) {
            const parts = value.split('.');
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        
        if (value !== input.value) {
            input.value = value;
        }
    }

    addRow(tableType) {
        try {
            if (!this.data[this.currentYear] || !this.data[this.currentYear][this.currentMonth]) {
                this.initializeYearData(this.currentYear);
            }

            const monthData = this.data[this.currentYear][this.currentMonth];
            
            if (!monthData[tableType]) {
                monthData[tableType] = [];
            }

            let newItem = {};
            
            switch (tableType) {
                case 'income':
                    newItem = { source: '', amount: 0 };
                    break;
                case 'fixedExpenses':
                case 'travelEntertainment':
                    newItem = { name: '', planned: 0, actual: 0 };
                    break;
                case 'otherExpenses':
                case 'debt':
                case 'investment':
                    newItem = { name: '', amount: 0 };
                    break;
            }

            monthData[tableType].push(newItem);
            this.renderTables(monthData);
            this.updateCalculations();
            this.debouncedSave();

        } catch (error) {
            console.error(`Error adding row to ${tableType}:`, error);
            this.showError(`Failed to add ${tableType} row`);
        }
    }

    // Admin Panel Methods
    openAdminPanel() {
        const modal = this.getElement('adminModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.renderTemplatesLists();
        }
    }

    closeAdminPanel() {
        const modal = this.getElement('adminModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    renderTemplatesLists() {
        this.renderFixedExpenseTemplatesList();
        this.renderDebtTemplatesList();
    }

    renderFixedExpenseTemplatesList() {
        const container = document.getElementById('templatesList');
        if (!container || !this.fixedExpenseTemplates) return;

        container.innerHTML = '';
        
        this.fixedExpenseTemplates.forEach((template, index) => {
            const div = document.createElement('div');
            div.className = 'template-item glass-card';
            div.innerHTML = `
                <span>${template.name} - ₹${template.planned}</span>
                <button class="delete-template-btn" onclick="budgetApp.deleteFixedExpenseTemplate(${index})">×</button>
            `;
            container.appendChild(div);
        });
    }

    renderDebtTemplatesList() {
        const container = document.getElementById('debtTemplatesList');
        if (!container || !this.debtTemplates) return;

        container.innerHTML = '';
        
        this.debtTemplates.forEach((template, index) => {
            const div = document.createElement('div');
            div.className = 'template-item glass-card';
            const monthsInfo = template.monthsRemaining ? ` (${template.monthsRemaining} months)` : '';
            div.innerHTML = `
                <span>${template.name} - ₹${template.amount}${monthsInfo}</span>
                <button class="delete-template-btn" onclick="budgetApp.deleteDebtTemplate(${index})">×</button>
            `;
            container.appendChild(div);
        });
    }

    async addFixedExpenseTemplate() {
        try {
            const nameInput = document.getElementById('templateName');
            const plannedInput = document.getElementById('templatePlanned');
            
            if (!nameInput || !plannedInput) return;

            const name = nameInput.value.trim();
            const planned = parseFloat(plannedInput.value) || 0;

            if (name && planned > 0) {
                const template = { name, planned };
                this.fixedExpenseTemplates.push(template);
                await this.saveAllData();
                this.renderFixedExpenseTemplatesList();
                
                // Apply template to current month automatically
                await this.applyNewTemplate('fixedExpenses', template);
                
                nameInput.value = '';
                plannedInput.value = '';
                
                this.showSyncStatus('Fixed expense template added and applied to current month');
                setTimeout(() => this.hideSyncStatus(), 2000);
            }
        } catch (error) {
            console.error('Error adding fixed expense template:', error);
            this.showError('Failed to add template');
        }
    }

    async addDebtTemplate() {
        try {
            const nameInput = document.getElementById('debtTemplateName');
            const amountInput = document.getElementById('debtTemplateAmount');
            const monthsInput = document.getElementById('debtTemplateMonths');
            
            if (!nameInput || !amountInput || !monthsInput) return;

            const name = nameInput.value.trim();
            const amount = parseFloat(amountInput.value) || 0;
            const monthsRemaining = parseInt(monthsInput.value) || 0;

            if (name && amount > 0 && monthsRemaining > 0) {
                const template = {
                    name, 
                    amount, 
                    monthsRemaining,
                    startMonth: this.currentMonth,
                    startYear: this.currentYear
                };
                
                this.debtTemplates.push(template);
                await this.saveAllData();
                this.renderDebtTemplatesList();
                
                // Apply template to all applicable months automatically
                await this.applyDebtTemplateToAllMonths(template);
                
                nameInput.value = '';
                amountInput.value = '';
                monthsInput.value = '';
                
                this.showSyncStatus(`Debt template added and applied to ${monthsRemaining} month${monthsRemaining > 1 ? 's' : ''}`);
                setTimeout(() => this.hideSyncStatus(), 2000);
            }
        } catch (error) {
            console.error('Error adding debt template:', error);
            this.showError('Failed to add debt template');
        }
    }

    async applyDebtTemplateToAllMonths(template) {
        try {
            const { monthsRemaining, startMonth, startYear } = template;
            
            for (let i = 0; i < monthsRemaining; i++) {
                // Calculate target month and year
                let targetMonth = startMonth + i;
                let targetYear = startYear;
                
                // Handle year overflow
                while (targetMonth > 11) {
                    targetMonth -= 12;
                    targetYear += 1;
                }
                
                // Ensure year and month data exists
                if (!this.data[targetYear]) {
                    this.initializeYearData(targetYear);
                }
                
                if (!this.data[targetYear][targetMonth]) {
                    this.data[targetYear][targetMonth] = this.getDefaultMonthData();
                }
                
                const monthData = this.data[targetYear][targetMonth];
                
                if (!monthData.debt) {
                    monthData.debt = [];
                }
                
                // Check if template already exists in this month
                const existingItem = monthData.debt.find(item => item.name === template.name);
                
                if (!existingItem) {
                    const newItem = {
                        name: template.name,
                        amount: template.amount
                    };
                    
                    monthData.debt.push(newItem);
                    console.log(`Applied debt template "${template.name}" to month ${targetMonth + 1}/${targetYear}`);
                }
            }
            
            // Save all changes
            await this.saveAllData();
            
            // Refresh current month display if it was modified
            this.loadMonth(this.currentMonth, this.currentYear);
            this.updateCalculations();
            
        } catch (error) {
            console.error('Error applying debt template to all months:', error);
            throw error;
        }
    }

    async deleteFixedExpenseTemplate(index) {
        try {
            this.fixedExpenseTemplates.splice(index, 1);
            await this.saveAllData();
            this.renderFixedExpenseTemplatesList();
        } catch (error) {
            console.error('Error deleting fixed expense template:', error);
            this.showError('Failed to delete template');
        }
    }

    async deleteDebtTemplate(index) {
        try {
            this.debtTemplates.splice(index, 1);
            await this.saveAllData();
            this.renderDebtTemplatesList();
        } catch (error) {
            console.error('Error deleting debt template:', error);
            this.showError('Failed to delete debt template');
        }
    }

    // Delete Panel Methods
    showDeletePanel(tableType) {
        const modal = document.getElementById('deleteModal');
        const itemsList = document.getElementById('deleteItemsList');
        const confirmBtn = document.getElementById('confirmDelete');
        
        if (!modal || !itemsList || !confirmBtn) return;

        const monthData = this.data[this.currentYear][this.currentMonth];
        const items = monthData[tableType] || [];

        itemsList.innerHTML = '';
        
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'delete-item';
            
            const itemName = item.source || item.name || `Item ${index + 1}`;
            
            div.innerHTML = `
                <label>
                    <input type="checkbox" value="${index}">
                    ${itemName}
                </label>
            `;
            itemsList.appendChild(div);
        });

        confirmBtn.onclick = () => this.deleteSelectedItems(tableType);
        modal.classList.remove('hidden');
    }

    async deleteSelectedItems(tableType) {
        try {
            const checkboxes = document.querySelectorAll('#deleteItemsList input[type="checkbox"]:checked');
            const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => b - a);

            const monthData = this.data[this.currentYear][this.currentMonth];
            
            indicesToDelete.forEach(index => {
                monthData[tableType].splice(index, 1);
            });

            this.renderTables(monthData);
            this.updateCalculations();
            await this.saveAllData();
            this.closeDeleteSelectionPanel();

        } catch (error) {
            console.error('Error deleting selected items:', error);
            this.showError('Failed to delete items');
        }
    }

    closeDeleteSelectionPanel() {
        const modal = document.getElementById('deleteModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // Manage Panel Methods
    showManagePanel(tableType) {
        const modal = document.getElementById('manageModal');
        const templatesList = document.getElementById('manageTemplatesList');
        
        if (!modal || !templatesList) return;

        templatesList.innerHTML = '';
        
        // Create sections for added and available templates
        const addedSection = document.createElement('div');
        addedSection.className = 'manage-section';
        addedSection.innerHTML = '<h4>Already Added to Current Month</h4>';
        
        const availableSection = document.createElement('div');
        availableSection.className = 'manage-section';
        availableSection.innerHTML = '<h4>Available Templates</h4>';
        
        const templates = tableType === 'fixedExpenses' ? this.fixedExpenseTemplates : this.debtTemplates;
        const monthData = this.data[this.currentYear][this.currentMonth];
        const currentItems = monthData[tableType] || [];
        
        const addedTemplates = [];
        const availableTemplates = [];
        
        templates.forEach((template, index) => {
            // Check if template is applicable for current month (for debt templates)
            if (tableType === 'debt' && template.monthsRemaining !== undefined) {
                if (!this.isTemplateApplicableForMonth(template, this.currentMonth, this.currentYear)) {
                    return; // Skip non-applicable templates
                }
            }
            
            // Check if template is already added to current month
            const isAdded = currentItems.some(item => item.name === template.name);
            
            if (isAdded) {
                addedTemplates.push({ template, index });
            } else {
                availableTemplates.push({ template, index });
            }
        });
        
        // Render added templates
        if (addedTemplates.length > 0) {
            addedTemplates.forEach(({ template, index }) => {
                const div = document.createElement('div');
                div.className = 'manage-template-item glass-card added';
                const amount = template.planned || template.amount || 0;
                const monthsInfo = template.monthsRemaining ? ` (${this.getRemainingMonthsForCurrent(template)} months left)` : '';
                
                div.innerHTML = `
                    <span>${template.name} - ₹${amount}${monthsInfo}</span>
                    <button class="remove-template-btn glass-button" onclick="budgetApp.removeTemplateFromMonth('${tableType}', '${template.name}')">
                        Remove
                    </button>
                `;
                addedSection.appendChild(div);
            });
        } else {
            const noItems = document.createElement('p');
            noItems.textContent = 'No templates added to current month';
            noItems.className = 'no-items';
            addedSection.appendChild(noItems);
        }
        
        // Render available templates
        if (availableTemplates.length > 0) {
            availableTemplates.forEach(({ template, index }) => {
                const div = document.createElement('div');
                div.className = 'manage-template-item glass-card available';
                const amount = template.planned || template.amount || 0;
                const monthsInfo = template.monthsRemaining ? ` (${this.getRemainingMonthsForCurrent(template)} months left)` : '';
                
                div.innerHTML = `
                    <span>${template.name} - ₹${amount}${monthsInfo}</span>
                    <button class="apply-template-btn glass-button" onclick="budgetApp.applyTemplate('${tableType}', ${index})">
                        Apply
                    </button>
                `;
                availableSection.appendChild(div);
            });
        } else {
            const noItems = document.createElement('p');
            noItems.textContent = 'No available templates for current month';
            noItems.className = 'no-items';
            availableSection.appendChild(noItems);
        }
        
        templatesList.appendChild(addedSection);
        templatesList.appendChild(availableSection);
        
        modal.classList.remove('hidden');
    }

    async applyTemplate(tableType, templateIndex) {
        try {
            const templates = tableType === 'fixedExpenses' ? this.fixedExpenseTemplates : this.debtTemplates;
            const template = templates[templateIndex];
            
            if (!template) return;

            await this.applyNewTemplate(tableType, template);
            this.closeManagePanel();

        } catch (error) {
            console.error('Error applying template:', error);
            this.showError('Failed to apply template');
        }
    }

    async applyNewTemplate(tableType, template) {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];
            
            if (!monthData[tableType]) {
                monthData[tableType] = [];
            }

            // Check if template already exists in current month
            const existingItem = monthData[tableType].find(item => 
                item.name === template.name
            );
            
            if (existingItem) {
                console.log(`Template ${template.name} already exists in current month`);
                return;
            }

            let newItem = {};
            
            if (tableType === 'fixedExpenses') {
                newItem = { name: template.name, planned: template.planned, actual: 0 };
            } else if (tableType === 'debt') {
                newItem = { name: template.name, amount: template.amount };
            }

            monthData[tableType].push(newItem);
            this.renderTables(monthData);
            this.updateCalculations();
            await this.saveAllData();

        } catch (error) {
            console.error('Error applying new template:', error);
            throw error;
        }
    }

    closeManagePanel() {
        const modal = document.getElementById('manageModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // Helper methods for template management
    isTemplateApplicableForMonth(template, month, year) {
        if (!template.startMonth || !template.startYear || !template.monthsRemaining) {
            return true; // No restrictions, always applicable
        }
        
        const startDate = new Date(template.startYear, template.startMonth);
        const currentDate = new Date(year, month);
        const endDate = new Date(template.startYear, template.startMonth + template.monthsRemaining - 1);
        
        return currentDate >= startDate && currentDate <= endDate;
    }
    
    getRemainingMonthsForCurrent(template) {
        if (!template.startMonth || !template.startYear || !template.monthsRemaining) {
            return template.monthsRemaining || 0;
        }
        
        const startDate = new Date(template.startYear, template.startMonth);
        const currentDate = new Date(this.currentYear, this.currentMonth);
        const endDate = new Date(template.startYear, template.startMonth + template.monthsRemaining - 1);
        
        if (currentDate > endDate) {
            return 0;
        }
        
        const monthsElapsed = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                             (currentDate.getMonth() - startDate.getMonth());
        
        return Math.max(0, template.monthsRemaining - monthsElapsed);
    }
    
    async removeTemplateFromMonth(tableType, templateName) {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];
            
            if (!monthData[tableType]) {
                return;
            }
            
            const itemIndex = monthData[tableType].findIndex(item => item.name === templateName);
            
            if (itemIndex !== -1) {
                monthData[tableType].splice(itemIndex, 1);
                this.renderTables(monthData);
                this.updateCalculations();
                await this.saveAllData();
                
                // Refresh the manage panel
                this.showManagePanel(tableType);
                
                this.showSyncStatus(`${templateName} removed from current month`);
                setTimeout(() => this.hideSyncStatus(), 2000);
            }
        } catch (error) {
            console.error('Error removing template from month:', error);
            this.showError('Failed to remove template');
        }
    }

    // Theme Methods
    setupTheme() {
        // Default theme is light
        this.applyTheme('light');
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        this.saveTheme(newTheme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const themeToggle = this.getElement('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
        }
    }

    async saveTheme(theme) {
        try {
            if (this.isSignedIn && this.fileIds.themeSettings) {
                await this.saveFileToGoogleDrive(this.fileIds.themeSettings, { theme });
            }
        } catch (error) {
            console.error('Error saving theme to cloud:', error);
        }
    }

    // Chart Methods
    updateAllCharts() {
        try {
            this.updateExpenseChart();
            this.updateEfficiencyChart();
            this.updateBalanceChart();
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    updateExpenseChart() {
        const ctx = this.getElement('expenseChart');
        if (!ctx) return;

        const monthData = this.data[this.currentYear][this.currentMonth];
        if (!monthData) return;

        const fixedExpenses = (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0);
        const otherExpenses = (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const travelExpenses = (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0);
        const debtPayments = (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const investments = (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        if (this.expenseChart) {
            this.expenseChart.destroy();
        }

        this.expenseChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Fixed Expenses', 'Other Expenses', 'Travel & Entertainment', 'Debt Payments', 'Investments'],
                datasets: [{
                    data: [fixedExpenses, otherExpenses, travelExpenses, debtPayments, investments],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 205, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 205, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

    updateEfficiencyChart() {
        const ctx = this.getElement('efficiencyChart');
        if (!ctx) return;

        const months = [];
        const efficiencyData = [];

        for (let i = 5; i >= 0; i--) {
            let month = this.currentMonth - i;
            let year = this.currentYear;

            if (month < 0) {
                month += 12;
                year -= 1;
            }

            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            months.push(monthNames[month]);

            if (this.data[year] && this.data[year][month]) {
                const monthData = this.data[year][month];
                const income = (monthData.income || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                const expenses = 
                    (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                    (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                    (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                    (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                    (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

                const efficiency = income > 0 ? ((income - expenses) / income) * 100 : 0;
                efficiencyData.push(Math.max(efficiency, 0));
            } else {
                efficiencyData.push(0);
            }
        }

        if (this.efficiencyChart) {
            this.efficiencyChart.destroy();
        }

        this.efficiencyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Savings Rate (%)',
                    data: efficiencyData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

    updateBalanceChart() {
        const ctx = this.getElement('balanceChart');
        if (!ctx) return;

        const monthData = this.data[this.currentYear][this.currentMonth];
        if (!monthData) return;

        const totalIncome = (monthData.income || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalExpenses = 
            (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
            (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
            (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
            (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
            (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        const carriedBalance = monthData.carriedBalance || 0;
        const available = totalIncome + carriedBalance;
        const used = totalExpenses;

        if (this.balanceChart) {
            this.balanceChart.destroy();
        }

        this.balanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Available', 'Used'],
                datasets: [{
                    data: [available, used],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(255, 99, 132, 0.8)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // PDF Export
    async exportToPDF() {
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();

            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                               'July', 'August', 'September', 'October', 'November', 'December'];
            const title = `Budget Report - ${monthNames[this.currentMonth]} ${this.currentYear}`;

            pdf.setFontSize(16);
            pdf.text(title, 20, 20);

            const monthData = this.data[this.currentYear][this.currentMonth];
            if (!monthData) return;

            let yPosition = 40;

            // Summary
            pdf.setFontSize(12);
            const totalIncome = (monthData.income || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            const totalExpenses = 
                (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

            pdf.text(`Total Income: ₹${totalIncome.toFixed(2)}`, 20, yPosition);
            yPosition += 10;
            pdf.text(`Total Expenses: ₹${totalExpenses.toFixed(2)}`, 20, yPosition);
            yPosition += 10;
            pdf.text(`Remaining: ₹${(totalIncome - totalExpenses + (monthData.carriedBalance || 0)).toFixed(2)}`, 20, yPosition);
            yPosition += 20;

            // Income
            if (monthData.income && monthData.income.length > 0) {
                pdf.setFontSize(14);
                pdf.text('Income', 20, yPosition);
                yPosition += 10;
                
                pdf.setFontSize(10);
                monthData.income.forEach(item => {
                    pdf.text(`${item.source || 'N/A'}: ₹${(item.amount || 0).toFixed(2)}`, 25, yPosition);
                    yPosition += 7;
                });
                yPosition += 10;
            }

            pdf.save(`budget-${monthNames[this.currentMonth]}-${this.currentYear}.pdf`);

        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showError('Failed to export PDF');
        }
    }

    // Error Handling
    showError(message) {
        const errorToast = this.getElement('errorToast');
        const errorMessage = this.getElement('errorMessage');
        
        if (errorToast && errorMessage) {
            errorMessage.textContent = message;
            errorToast.classList.remove('hidden');
            
            setTimeout(() => {
                this.hideError();
            }, 5000);
        }
        
        console.error('Budget App Error:', message);
    }

    hideError() {
        const errorToast = this.getElement('errorToast');
        if (errorToast) {
            errorToast.classList.add('hidden');
        }
    }
}
