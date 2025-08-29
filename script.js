// Budget Planning App - Enhanced with Bug fixes and Performance improvements

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
        this.isNavigating = false; // Prevent race conditions
        this.saveTimeout = null; // Debounce auto-save
        this.chartUpdateTimeout = null; // Debounce chart updates

        // Cache DOM elements to improve performance
        this.domCache = {};

        this.init();
    }

    async init() {
        try {
            // Wait for DOM to be fully ready
            await this.waitForDOM();

            // Cache important DOM elements
            this.cacheDOMElements();

            // Load data first with error handling
            this.data = await this.loadData();
            this.fixedExpenseTemplates = await this.loadFixedExpenseTemplates();
            this.debtTemplates = await this.loadDebtTemplates();

            // Setup everything else
            this.setupEventListeners();
            this.setupTooltips();
            this.updateCurrentMonthDisplay();
            this.loadMonth(this.currentMonth, this.currentYear);
            this.setupTheme();
            this.updateAllCharts();

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
            'remainingAmount', 'carriedAmount', 'adminModal', 'deleteModal',
            'tooltip', 'errorToast', 'errorMessage', 'expenseChart', 
            'efficiencyChart', 'balanceChart'
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

    setupEventListeners() {
        try {
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

            // Theme toggle with null check
            const themeToggle = this.getElement('themeToggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    this.toggleTheme();
                });
            }

            // Admin panel with null check
            const adminButton = this.getElement('adminPanel');
            if (adminButton) {
                adminButton.addEventListener('click', () => {
                    this.openAdminPanel();
                });
            }

            // PDF export with null check
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

                // Immediate calculation update and debounced save
                if (e.target.classList.contains('editable')) {
                    this.updateCalculations(); // Immediate calculation update
                    this.debouncedSave(); // Still debounce the save operation
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

        this.saveTimeout = setTimeout(() => {
            try {
                this.saveData();
                this.updateCalculations();
                this.debouncedChartUpdate();
            } catch (error) {
                console.error('Error in debounced save:', error);
                this.showError('Failed to save data');
            }
        }, 500); // Increased debounce time to reduce frequency
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
        if (this.isNavigating) return; // Prevent concurrent navigation

        this.isNavigating = true;

        try {
            // Clear any pending saves before navigation
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.saveData(); // Save immediately before navigation
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
        const tooltipHeaders = document.querySelectorAll('.tooltip-header');

        if (!tooltip) {
            console.warn('Tooltip element not found');
            return;
        }

        tooltipHeaders.forEach(header => {
            header.addEventListener('mouseenter', (e) => {
                try {
                    const tooltipText = e.target.dataset.tooltip;
                    if (tooltipText) {
                        tooltip.textContent = tooltipText;
                        tooltip.classList.add('show');

                        const rect = e.target.getBoundingClientRect();
                        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                        tooltip.style.left = `${rect.left + scrollLeft + (rect.width / 2)}px`;
                        tooltip.style.top = `${rect.bottom + scrollTop + 10}px`;
                    }
                } catch (error) {
                    console.error('Error showing tooltip:', error);
                }
            });

            header.addEventListener('mouseleave', () => {
                if (tooltip) {
                    tooltip.classList.remove('show');
                }
            });
        });
    }

    setupTheme() {
        try {
            const savedTheme = this.getStoredTheme() || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);

            const themeToggle = this.getElement('themeToggle');
            if (themeToggle) {
                themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
            }
        } catch (error) {
            console.error('Error setting up theme:', error);
        }
    }

    toggleTheme() {
        try {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            this.saveTheme(newTheme);

            const themeToggle = this.getElement('themeToggle');
            if (themeToggle) {
                themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
            }

            // Update chart colors after theme change
            setTimeout(() => {
                this.updateAllCharts();
            }, 100);

        } catch (error) {
            console.error('Error toggling theme:', error);
            this.showError('Failed to toggle theme');
        }
    }

    async loadData() {
        try {
            const savedData = localStorage.getItem('budget-data');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                return parsed;
            }

            // Initialize empty data structure
            const data = {};
            const currentYear = new Date().getFullYear();
            for (let year = currentYear - 2; year <= currentYear + 5; year++) {
                data[year] = {};
                for (let month = 0; month < 12; month++) {
                    data[year][month] = {
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
            return data;
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data from storage');
            return {};
        }
    }

    async loadFixedExpenseTemplates() {
        try {
            const savedTemplates = localStorage.getItem('budget-fixed-expense-templates');
            return savedTemplates ? JSON.parse(savedTemplates) : [];
        } catch (error) {
            console.error('Error loading fixed expense templates:', error);
            return [];
        }
    }

    async loadDebtTemplates() {
        try {
            const savedTemplates = localStorage.getItem('budget-debt-templates');
            return savedTemplates ? JSON.parse(savedTemplates) : [];
        } catch (error) {
            console.error('Error loading debt templates:', error);
            return [];
        }
    }

    saveData() {
        try {
            // Check localStorage availability and quota
            if (typeof Storage === "undefined") {
                throw new Error('localStorage not supported');
            }

            const dataString = JSON.stringify(this.data);

            // Check if we're approaching localStorage limit
            if (dataString.length > 5 * 1024 * 1024) { // 5MB warning
                console.warn('Data size approaching localStorage limit');
            }

            localStorage.setItem('budget-data', dataString);
            console.log('Data saved successfully');
        } catch (error) {
            console.error('Error saving data:', error);
            if (error.name === 'QuotaExceededError') {
                this.showError('Storage quota exceeded. Please clear some data.');
            } else {
                this.showError('Failed to save data');
            }
        }
    }

    saveFixedExpenseTemplates() {
        try {
            localStorage.setItem('budget-fixed-expense-templates', JSON.stringify(this.fixedExpenseTemplates));
        } catch (error) {
            console.error('Error saving fixed expense templates:', error);
            this.showError('Failed to save expense templates');
        }
    }

    saveDebtTemplates() {
        try {
            localStorage.setItem('budget-debt-templates', JSON.stringify(this.debtTemplates));
        } catch (error) {
            console.error('Error saving debt templates:', error);
            this.showError('Failed to save debt templates');
        }
    }

    getStoredTheme() {
        try {
            return localStorage.getItem('budget-theme');
        } catch (error) {
            console.error('Error getting stored theme:', error);
            return 'light';
        }
    }

    saveTheme(theme) {
        try {
            localStorage.setItem('budget-theme', theme);
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    }

    async loadMonth(month, year) {
        try {
            this.initializeYearData(year);

            if (!this.data[year][month]) {
                this.data[year][month] = {
                    income: [],
                    fixedExpenses: [],
                    otherExpenses: [],
                    debt: [],
                    investment: [],
                    travelEntertainment: [],
                    carriedBalance: 0
                };
            }

            this.ensureMonthArrays(this.data[year][month]);
            this.carryOverBalance(month, year);

            // Apply templates for current and future months
            await this.applyTemplates(month, year);

            this.populateTables();
            this.updateCalculations();
            this.updateAllCharts();
        } catch (error) {
            console.error('Error loading month:', error);
            this.showError('Failed to load month data');
        }
    }

    async applyTemplates(month, year) {
        try {
            const currentDate = new Date();
            const targetDate = new Date(year, month, 1);

            // Only apply templates for current month and beyond
            if (targetDate >= new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)) {
                const monthData = this.data[year][month];

                // Apply fixed expense templates
                this.fixedExpenseTemplates.forEach(template => {
                    const exists = monthData.fixedExpenses.some(expense => 
                        expense.name && expense.name.toLowerCase() === template.name.toLowerCase()
                    );

                    if (!exists) {
                        monthData.fixedExpenses.push({
                            name: template.name,
                            planned: template.planned,
                            actual: 0
                        });
                    }
                });

                // Apply debt templates using the proper logic
                this.applyDebtTemplates(month, year);
            }
        } catch (error) {
            console.error('Error applying templates:', error);
        }
    }

    populateTables() {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];

            // Populate each table with error handling
            this.populateTable('income', monthData.income, ['name', 'amount']);
            this.populateTable('fixedExpenses', monthData.fixedExpenses, ['name', 'planned', 'actual', 'balance']);
            this.populateTable('otherExpenses', monthData.otherExpenses, ['name', 'amount']);
            this.populateTable('debt', monthData.debt, ['name', 'amount']);
            this.populateTable('investment', monthData.investment, ['name', 'amount']);
            this.populateTable('travelEntertainment', monthData.travelEntertainment, ['name', 'planned', 'actual', 'balance']);
        } catch (error) {
            console.error('Error populating tables:', error);
            this.showError('Failed to populate tables');
        }
    }

    populateTable(tableType, data, columns) {
        try {
            const table = document.getElementById(`${tableType}Table`);
            if (!table) {
                console.warn(`Table ${tableType} not found`);
                return;
            }

            const tbody = table.querySelector('tbody');
            if (!tbody) {
                console.warn(`Table body for ${tableType} not found`);
                return;
            }

            tbody.innerHTML = '';

            data.forEach((item, index) => {
                const row = this.createTableRow(tableType, item, index, columns);
                tbody.appendChild(row);
            });

            // Add empty row for new entries
            if (data.length === 0) {
                const emptyRow = this.createTableRow(tableType, {}, 0, columns);
                tbody.appendChild(emptyRow);
            }
        } catch (error) {
            console.error(`Error populating table ${tableType}:`, error);
        }
    }

    createTableRow(tableType, item, index, columns) {
        const row = document.createElement('tr');

        // Serial number
        const snoCell = document.createElement('td');
        snoCell.textContent = index + 1;
        row.appendChild(snoCell);

        columns.forEach(column => {
            const cell = document.createElement('td');

            if (column === 'balance') {
                // Calculated field
                const balance = (parseFloat(item.planned) || 0) - (parseFloat(item.actual) || 0);
                cell.textContent = `₹${balance.toFixed(2)}`;
                cell.className = 'calculated';
                if (balance < 0) cell.classList.add('negative');
                else if (balance > 0) cell.classList.add('positive');
            } else {
                // Editable field
                const input = document.createElement('input');
                input.type = column === 'name' ? 'text' : 'number';
                input.className = 'editable';
                if (column !== 'name') input.className += ' numeric-input';
                input.value = item[column] || '';
                input.placeholder = column === 'name' ? 'Enter name' : '0';

                input.addEventListener('input', (e) => {
                    this.updateItemValue(tableType, index, column, e.target.value);
                });

                input.addEventListener('blur', () => {
                    this.saveData();
                });

                cell.appendChild(input);
            }

            row.appendChild(cell);
        });

        // No more individual delete buttons - using centralized delete panel
        return row;
    }

    updateItemValue(tableType, index, field, value) {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];

            if (!monthData[tableType][index]) {
                monthData[tableType][index] = {};
            }

            if (field === 'name') {
                monthData[tableType][index][field] = value;
            } else {
                monthData[tableType][index][field] = parseFloat(value) || 0;
            }

            // Update calculations immediately for numeric fields
            if (field !== 'name') {
                this.updateCalculations();
                this.updateAllCharts();
            }

            this.debouncedSave();
        } catch (error) {
            console.error('Error updating item value:', error);
        }
    }

    addRow(tableType) {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];

            if (!monthData[tableType]) {
                monthData[tableType] = [];
            }

            // Check if there's already an empty row
            const hasEmptyRow = monthData[tableType].some(item => {
                if (tableType === 'fixedExpenses' || tableType === 'travelEntertainment') {
                    return (!item.name || item.name.trim() === '') && 
                           (!item.planned || item.planned === 0) && 
                           (!item.actual || item.actual === 0);
                } else {
                    return (!item.name || item.name.trim() === '') && 
                           (!item.amount || item.amount === 0);
                }
            });

            // Don't add if there's already an empty row
            if (hasEmptyRow) {
                return;
            }

            const newItem = { name: '', amount: 0 };
            if (tableType === 'fixedExpenses' || tableType === 'travelEntertainment') {
                newItem.planned = 0;
                newItem.actual = 0;
            }

            monthData[tableType].push(newItem);
            this.populateTables();
            this.saveData();
        } catch (error) {
            console.error('Error adding row:', error);
            this.showError('Failed to add new row');
        }
    }

    deleteRow(tableType, index) {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];

            if (monthData[tableType] && monthData[tableType][index] !== undefined) {
                monthData[tableType].splice(index, 1);
                this.populateTables();
                this.updateCalculations();
                this.updateAllCharts();
                this.saveData();
            }
        } catch (error) {
            console.error('Error deleting row:', error);
            this.showError('Failed to delete row');
        }
    }

    showDeleteModal(tableType) {
        const modal = this.getElement('deleteModal');
        const confirmBtn = document.getElementById('confirmDelete');

        if (modal && confirmBtn) {
            modal.classList.add('show');

            // Remove existing event listeners to prevent duplicates
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

            newConfirmBtn.addEventListener('click', () => {
                this.deleteTable(tableType);
                this.closeDeleteModal();
            });
        }
    }

    closeDeleteModal() {
        const modal = this.getElement('deleteModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    deleteTable(tableType) {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];
            if (monthData[tableType]) {
                monthData[tableType] = [];
                this.populateTables();
                this.updateCalculations();
                this.updateAllCharts();
                this.saveData();
            }
        } catch (error) {
            console.error('Error deleting table:', error);
            this.showError('Failed to delete table data');
        }
    }

    updateCalculations() {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];

            // Calculate totals with error handling
            const totalIncome = (monthData.income || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

            const totalExpenses = 
                (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

            const remainingAmount = totalIncome - totalExpenses + (monthData.carriedBalance || 0);

            // Update display with null checks
            const totalIncomeEl = this.getElement('totalIncome');
            const totalExpensesEl = this.getElement('totalExpenses');
            const remainingAmountEl = this.getElement('remainingAmount');
            const carriedAmountEl = this.getElement('carriedAmount');

            if (totalIncomeEl) totalIncomeEl.textContent = `₹${totalIncome.toFixed(2)}`;
            if (totalExpensesEl) totalExpensesEl.textContent = `₹${totalExpenses.toFixed(2)}`;
            if (remainingAmountEl) {
                remainingAmountEl.textContent = `₹${remainingAmount.toFixed(2)}`;
                remainingAmountEl.className = 'amount';
                if (remainingAmount < 0) remainingAmountEl.classList.add('negative');
                else if (remainingAmount > 0) remainingAmountEl.classList.add('positive');
            }
            if (carriedAmountEl) carriedAmountEl.textContent = `₹${(monthData.carriedBalance || 0).toFixed(2)}`;

        } catch (error) {
            console.error('Error updating calculations:', error);
        }
    }

    validateNumericInput(input) {
        try {
            // Remove non-numeric characters except decimals
            let value = input.value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Update input value if it was changed
            if (value !== input.value) {
                input.value = value;
            }
            
            const numericValue = parseFloat(value);
            if (isNaN(numericValue) || numericValue < 0) {
                input.classList.add('error');
            } else {
                input.classList.remove('error');
            }
        } catch (error) {
            console.error('Error validating numeric input:', error);
        }
    }

    updateAllCharts() {
        try {
            this.updateExpenseChart();
            this.updateEfficiencyChart();
            this.updateBalanceChart();
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    getChartColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            primary: isDark ? '#0a84ff' : '#007aff',
            success: isDark ? '#32d74b' : '#30d158',
            warning: isDark ? '#ff9f0a' : '#ff9500',
            error: isDark ? '#ff453a' : '#ff3b30',
            text: isDark ? '#ffffff' : '#1d1d1f',
            secondary: isDark ? '#98989d' : '#86868b'
        };
    }

    updateExpenseChart() {
        try {
            const canvas = this.getElement('expenseChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const colors = this.getChartColors();

            // Destroy existing chart to prevent memory leaks
            if (this.expenseChart) {
                this.expenseChart.destroy();
            }

            const monthData = this.data[this.currentYear][this.currentMonth];

            const expenses = {
                'Fixed Expenses': (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0),
                'Other Expenses': (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
                'Travel & Entertainment': (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0),
                'Debt': (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
                'Investment': (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
            };

            const labels = Object.keys(expenses).filter(key => expenses[key] > 0);
            const data = labels.map(key => expenses[key]);

            if (data.length === 0) {
                // Show empty state
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = colors.text;
                ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('No expense data', canvas.width / 2, canvas.height / 2);
                return;
            }

            this.expenseChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: [
                            colors.primary,
                            colors.success,
                            colors.warning,
                            colors.error,
                            '#8e8e93'
                        ],
                        borderWidth: 2,
                        borderColor: colors.text
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: colors.text,
                                font: {
                                    size: 11
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error updating expense chart:', error);
        }
    }

    updateEfficiencyChart() {
        try {
            const canvas = this.getElement('efficiencyChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const colors = this.getChartColors();

            if (this.efficiencyChart) {
                this.efficiencyChart.destroy();
            }

            // Get last 6 months data
            const months = [];
            const efficiencyData = [];

            for (let i = 5; i >= 0; i--) {
                let targetMonth = this.currentMonth - i;
                let targetYear = this.currentYear;

                if (targetMonth < 0) {
                    targetMonth += 12;
                    targetYear -= 1;
                }

                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                months.push(monthNames[targetMonth]);

                if (this.data[targetYear] && this.data[targetYear][targetMonth]) {
                    const monthData = this.data[targetYear][targetMonth];
                    const income = (monthData.income || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                    const expenses = 
                        (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                        (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                        (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                        (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                        (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

                    const efficiency = income > 0 ? ((income - expenses) / income) * 100 : 0;
                    efficiencyData.push(Math.max(0, efficiency));
                } else {
                    efficiencyData.push(0);
                }
            }

            this.efficiencyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Savings Efficiency %',
                        data: efficiencyData,
                        borderColor: colors.success,
                        backgroundColor: colors.success + '20',
                        borderWidth: 2,
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
                                color: colors.text,
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: {
                                color: colors.secondary + '30'
                            }
                        },
                        x: {
                            ticks: {
                                color: colors.text
                            },
                            grid: {
                                color: colors.secondary + '30'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: colors.text
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error updating efficiency chart:', error);
        }
    }

    updateBalanceChart() {
        try {
            const canvas = this.getElement('balanceChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const colors = this.getChartColors();

            if (this.balanceChart) {
                this.balanceChart.destroy();
            }

            const monthData = this.data[this.currentYear][this.currentMonth];
            const totalIncome = (monthData.income || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            const totalExpenses = 
                (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

            const available = totalIncome + (monthData.carriedBalance || 0);
            const remaining = available - totalExpenses;

            this.balanceChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Available', 'Used', 'Remaining'],
                    datasets: [{
                        data: [available, totalExpenses, Math.max(0, remaining)],
                        backgroundColor: [
                            colors.primary,
                            colors.warning,
                            remaining >= 0 ? colors.success : colors.error
                        ],
                        borderWidth: 1,
                        borderColor: colors.text
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                color: colors.text,
                                callback: function(value) {
                                    return '₹' + value.toLocaleString();
                                }
                            },
                            grid: {
                                color: colors.secondary + '30'
                            }
                        },
                        y: {
                            ticks: {
                                color: colors.text
                            },
                            grid: {
                                color: colors.secondary + '30'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error updating balance chart:', error);
        }
    }

    openAdminPanel() {
        try {
            const modal = this.getElement('adminModal');
            if (modal) {
                modal.classList.add('show');
                this.populateTemplateList();
                this.populateDebtTemplateList();
            }
        } catch (error) {
            console.error('Error opening admin panel:', error);
            this.showError('Failed to open admin panel');
        }
    }

    closeAdminPanel() {
        const modal = this.getElement('adminModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    populateTemplateList() {
        try {
            const container = document.getElementById('templateList');
            if (!container) return;

            container.innerHTML = '';

            if (this.fixedExpenseTemplates.length === 0) {
                container.innerHTML = '<p>No templates available</p>';
                return;
            }

            this.fixedExpenseTemplates.forEach((template, index) => {
                const div = document.createElement('div');
                div.className = 'template-item';
                div.innerHTML = `
                    <span class="template-info">${template.name}</span>
                    <span class="template-amount">₹${template.planned}</span>
                    <button class="template-edit" onclick="budgetApp.editFixedExpenseTemplate(${index})">Edit</button>
                    <button class="template-delete" onclick="budgetApp.deleteFixedExpenseTemplate(${index})">Delete</button>
                `;
                container.appendChild(div);
            });
        } catch (error) {
            console.error('Error populating template list:', error);
        }
    }

    populateDebtTemplateList() {
        try {
            const container = document.getElementById('debtTemplateList');
            if (!container) return;

            container.innerHTML = '';

            if (this.debtTemplates.length === 0) {
                container.innerHTML = '<p>No debt templates available</p>';
                return;
            }

            this.debtTemplates.forEach((template, index) => {
                const div = document.createElement('div');
                div.className = 'template-item';

                const monthsInfo = template.monthsRemaining && template.monthsRemaining > 0 
                    ? ` (${template.monthsRemaining} months)` 
                    : ' (unlimited)';

                div.innerHTML = `
                    <span class="template-info">${template.name}${monthsInfo}</span>
                    <span class="template-amount">₹${template.amount}</span>
                    <button class="template-edit" onclick="budgetApp.editDebtTemplate(${index})">Edit</button>
                    <button class="template-delete" onclick="budgetApp.deleteDebtTemplate(${index})">Delete</button>
                `;
                container.appendChild(div);
            });
        } catch (error) {
            console.error('Error populating debt template list:', error);
        }
    }

    addFixedExpenseTemplate() {
        try {
            const nameInput = document.getElementById('templateName');
            const plannedInput = document.getElementById('templatePlanned');
            const addButton = document.getElementById('addTemplate');

            if (!nameInput || !plannedInput) return;

            const name = nameInput.value.trim();
            const planned = parseFloat(plannedInput.value);

            if (name && planned > 0) {
                if (this.editingTemplateType === 'fixed' && this.editingTemplateIndex !== undefined) {
                    // Editing existing template
                    const oldTemplate = this.fixedExpenseTemplates[this.editingTemplateIndex];

                    // Remove old template from all months
                    this.removeFixedExpenseFromFutureMonths(oldTemplate);

                    // Update template
                    this.fixedExpenseTemplates[this.editingTemplateIndex] = { name, planned };

                    // Reset editing state
                    this.editingTemplateIndex = undefined;
                    this.editingTemplateType = null;
                    if (addButton) addButton.textContent = 'Add Template';
                } else {
                    // Adding new template
                    this.fixedExpenseTemplates.push({ name, planned });
                }

                this.saveFixedExpenseTemplates();
                this.populateTemplateList();

                nameInput.value = '';
                plannedInput.value = '';

                // Apply template to current month and refresh UI immediately
                this.applyTemplatesToCurrentMonth();
                this.updateAllCharts();
            } else {
                this.showError('Please enter valid template details');
            }
        } catch (error) {
            console.error('Error adding/editing fixed expense template:', error);
            this.showError('Failed to save template');
        }
    }

    addDebtTemplate() {
        try {
            const nameInput = document.getElementById('debtTemplateName');
            const amountInput = document.getElementById('debtTemplateAmount');
            const monthsInput = document.getElementById('debtTemplateMonths');
            const addButton = document.getElementById('addDebtTemplate');

            if (!nameInput || !amountInput) return;

            const name = nameInput.value.trim();
            const amount = parseFloat(amountInput.value);
            const monthsRemaining = monthsInput ? parseInt(monthsInput.value) || 0 : 0;

            if (name && amount > 0) {
                if (this.editingTemplateType === 'debt' && this.editingTemplateIndex !== undefined) {
                    // Editing existing template
                    const oldTemplate = this.debtTemplates[this.editingTemplateIndex];

                    // Remove old template from all months
                    this.removeDebtFromFutureMonths(oldTemplate);

                    // Update template
                    this.debtTemplates[this.editingTemplateIndex] = { name, amount, monthsRemaining };

                    // Reset editing state
                    this.editingTemplateIndex = undefined;
                    this.editingTemplateType = null;
                    if (addButton) addButton.textContent = 'Add Debt Template';
                } else {
                    // Adding new template - set start month/year to current month
                    const newTemplate = {
                        name, 
                        amount, 
                        monthsRemaining,
                        startMonth: this.currentMonth,
                        startYear: this.currentYear
                    };
                    this.debtTemplates.push(newTemplate);
                }

                this.saveDebtTemplates();
                this.populateDebtTemplateList();

                nameInput.value = '';
                amountInput.value = '';
                if (monthsInput) monthsInput.value = '';

                // Apply template to current month and refresh UI immediately
                this.applyDebtTemplates(this.currentMonth, this.currentYear);
                this.populateTables();
                this.updateCalculations();
                this.updateAllCharts();
            } else {
                this.showError('Please enter valid debt template details');
            }
        } catch (error) {
            console.error('Error adding/editing debt template:', error);
            this.showError('Failed to save debt template');
        }
    }

    editFixedExpenseTemplate(index) {
        try {
            if (index >= 0 && index < this.fixedExpenseTemplates.length) {
                const template = this.fixedExpenseTemplates[index];

                // Pre-fill the form with existing values
                const nameInput = document.getElementById('templateName');
                const plannedInput = document.getElementById('templatePlanned');

                if (nameInput && plannedInput) {
                    nameInput.value = template.name;
                    plannedInput.value = template.planned;

                    // Store the index for updating
                    this.editingTemplateIndex = index;
                    this.editingTemplateType = 'fixed';

                    // Change the button text to indicate editing mode
                    const addButton = document.getElementById('addTemplate');
                    if (addButton) {
                        addButton.textContent = 'Update Template';
                    }
                }
            }
        } catch (error) {
            console.error('Error editing fixed expense template:', error);
            this.showError('Failed to edit template');
        }
    }

    deleteFixedExpenseTemplate(index) {
        try {
            if (index >= 0 && index < this.fixedExpenseTemplates.length) {
                const templateToRemove = this.fixedExpenseTemplates[index];

                // Remove from current and future months
                this.removeFixedExpenseFromFutureMonths(templateToRemove);

                this.fixedExpenseTemplates.splice(index, 1);
                this.saveFixedExpenseTemplates();
                this.populateTemplateList();
                this.populateTables(); // Refresh current view
                this.updateCalculations();
            }
        } catch (error) {
            console.error('Error deleting fixed expense template:', error);
            this.showError('Failed to delete template');
        }
    }

    editDebtTemplate(index) {
        try {
            if (index >= 0 && index < this.debtTemplates.length) {
                const template = this.debtTemplates[index];

                // Pre-fill the form with existing values
                const nameInput = document.getElementById('debtTemplateName');
                const amountInput = document.getElementById('debtTemplateAmount');
                const monthsInput = document.getElementById('debtTemplateMonths');

                if (nameInput && amountInput) {
                    nameInput.value = template.name;
                    amountInput.value = template.amount;
                    if (monthsInput) {
                        monthsInput.value = template.monthsRemaining || 0;
                    }

                    // Store the index for updating
                    this.editingTemplateIndex = index;
                    this.editingTemplateType = 'debt';

                    // Change the button text to indicate editing mode
                    const addButton = document.getElementById('addDebtTemplate');
                    if (addButton) {
                        addButton.textContent = 'Update Debt Template';
                    }
                }
            }
        } catch (error) {
            console.error('Error editing debt template:', error);
            this.showError('Failed to edit debt template');
        }
    }

    deleteDebtTemplate(index) {
        try {
            if (index >= 0 && index < this.debtTemplates.length) {
                const templateToRemove = this.debtTemplates[index];

                // Remove from current and future months
                this.removeDebtFromFutureMonths(templateToRemove);

                this.debtTemplates.splice(index, 1);
                this.saveDebtTemplates();
                this.populateDebtTemplateList();
                
                // Refresh UI immediately
                this.populateTables();
                this.updateCalculations();
                this.updateAllCharts();
            }
        } catch (error) {
            console.error('Error deleting debt template:', error);
            this.showError('Failed to delete debt template');
        }
    }

    showError(message) {
        try {
            const toast = this.getElement('errorToast');
            const messageEl = this.getElement('errorMessage');

            if (toast && messageEl) {
                messageEl.textContent = message;
                toast.classList.add('show');

                setTimeout(() => {
                    this.hideErrorToast();
                }, 5000);
            } else {
                // Fallback to console and alert
                console.error(message);
                alert(message);
            }
        } catch (error) {
            console.error('Error showing error message:', error);
        }
    }

    hideErrorToast() {
        const toast = this.getElement('errorToast');
        if (toast) {
            toast.classList.remove('show');
        }
    }

    async exportToPDF() {
        try {
            const exportBtn = this.getElement('exportPDF');
            if (exportBtn) {
                exportBtn.disabled = true;
                exportBtn.textContent = 'Exporting...';
            }

            // Check if required libraries are loaded
            if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
                throw new Error('PDF export libraries not loaded');
            }

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();

            // Add title
            pdf.setFontSize(20);
            pdf.text('Budget Report', 20, 30);

            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                               'July', 'August', 'September', 'October', 'November', 'December'];
            pdf.setFontSize(12);
            pdf.text(`${monthNames[this.currentMonth]} ${this.currentYear}`, 20, 45);

            // Add summary
            const monthData = this.data[this.currentYear][this.currentMonth];
            const totalIncome = (monthData.income || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            const totalExpenses = 
                (monthData.fixedExpenses || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.otherExpenses || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.travelEntertainment || []).reduce((sum, item) => sum + (parseFloat(item.actual) || 0), 0) +
                (monthData.debt || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                (monthData.investment || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

            const remaining = totalIncome - totalExpenses + (monthData.carriedBalance || 0);

            pdf.text(`Total Income: ₹${totalIncome.toFixed(2)}`, 20, 65);
            pdf.text(`Total Expenses: ₹${totalExpenses.toFixed(2)}`, 20, 80);
            pdf.text(`Remaining: ₹${remaining.toFixed(2)}`, 20, 95);
            pdf.text(`Carried Forward: ₹${(monthData.carriedBalance || 0).toFixed(2)}`, 20, 110);

            // Capture and add charts if possible
            try {
                const chartsSection = document.querySelector('.charts-grid');
                if (chartsSection) {
                    const canvas = await html2canvas(chartsSection, {
                        backgroundColor: null,
                        scale: 1
                    });

                    const imgData = canvas.toDataURL('image/png');
                    pdf.addImage(imgData, 'PNG', 20, 130, 170, 100);
                }
            } catch (chartError) {
                console.warn('Could not capture charts for PDF:', chartError);
            }

            pdf.save(`budget-${monthNames[this.currentMonth]}-${this.currentYear}.pdf`);

        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showError('Failed to export PDF. Please try again.');
        } finally {
            const exportBtn = this.getElement('exportPDF');
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.textContent = '📄 Export PDF';
            }
        }
    }

    // Cleanup method to prevent memory leaks
    cleanup() {
        try {
            if (this.expenseChart) {
                this.expenseChart.destroy();
                this.expenseChart = null;
            }
            if (this.efficiencyChart) {
                this.efficiencyChart.destroy();
                this.efficiencyChart = null;
            }
            if (this.balanceChart) {
                this.balanceChart.destroy();
                this.balanceChart = null;
            }

            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }
            if (this.chartUpdateTimeout) {
                clearTimeout(this.chartUpdateTimeout);
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    applyTemplatesToCurrentMonth() {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];

            // Apply fixed expense templates
            this.fixedExpenseTemplates.forEach(template => {
                const exists = monthData.fixedExpenses.some(expense => 
                    expense.name && expense.name.toLowerCase() === template.name.toLowerCase()
                );

                if (!exists) {
                    monthData.fixedExpenses.push({
                        name: template.name,
                        planned: template.planned,
                        actual: 0
                    });
                }
            });

            // Apply debt templates
            this.debtTemplates.forEach(template => {
                const exists = monthData.debt.some(debt => 
                    debt.name && debt.name.toLowerCase() === template.name.toLowerCase()
                );

                if (!exists && this.shouldApplyDebtTemplate(template, this.currentMonth, this.currentYear)) {
                    monthData.debt.push({
                        name: template.name,
                        amount: template.amount
                    });
                }
            });

            // Refresh the display
            this.populateTables();
            this.updateCalculations();
            this.saveData();

        } catch (error) {
            console.error('Error applying templates to current month:', error);
        }
    }

    shouldApplyDebtTemplate(template, month, year) {
        if (!template.monthsRemaining || template.monthsRemaining <= 0) {
            return true; // No limit specified, always apply
        }

        // If template doesn't have start month/year, set it to current month/year
        if (template.startMonth === undefined || template.startYear === undefined) {
            template.startMonth = this.currentMonth;
            template.startYear = this.currentYear;
        }

        // Calculate months from the template's start date
        const monthsFromStart = (year - template.startYear) * 12 + (month - template.startMonth);

        // Apply from start month (0) for the specified number of remaining months
        const shouldApply = monthsFromStart >= 0 && monthsFromStart < template.monthsRemaining;
        
        console.log(`Debt "${template.name}" - Start: ${template.startMonth+1}/${template.startYear}, Check: ${month+1}/${year}, Months from start: ${monthsFromStart}, Remaining: ${template.monthsRemaining}, Apply: ${shouldApply}`);
        
        return shouldApply;
    }

    applyDebtTemplates(month, year) {
        try {
            if (!this.debtTemplates || this.debtTemplates.length === 0) {
                return;
            }

            // Remove all template-based debt entries to avoid duplicates
            this.data[year][month].debt = this.data[year][month].debt.filter(debt => !debt.fromTemplate);

            // Apply debt templates that should be active for this month
            this.debtTemplates.forEach((template, index) => {
                if (this.shouldApplyDebtTemplate(template, month, year)) {
                    this.data[year][month].debt.push({
                        name: template.name,
                        amount: template.amount,
                        fromTemplate: true,
                        templateId: index
                    });
                }
            });

            console.log(`Applied debt templates for ${month + 1}/${year}`, this.data[year][month].debt.filter(d => d.fromTemplate));
        } catch (error) {
            console.error('Error applying debt templates:', error);
        }
    }

    showDeletePanel(tableType) {
        try {
            const modal = document.getElementById('deleteSelectionModal');
            const titleEl = document.getElementById('deleteSelectionTitle');
            const tableNameEl = document.getElementById('deleteTableName');
            const listEl = document.getElementById('deleteSelectionList');
            const confirmBtn = document.getElementById('confirmSelectedDelete');

            if (!modal || !titleEl || !tableNameEl || !listEl || !confirmBtn) {
                this.showError('Delete selection panel elements not found');
                return;
            }

            // Set table name for display
            const tableNames = {
                'income': 'Income',
                'fixedExpenses': 'Fixed Expenses',
                'otherExpenses': 'Other Expenses',
                'investment': 'Investment',
                'debt': 'Debt',
                'travelEntertainment': 'Travel and Entertainment'
            };

            tableNameEl.textContent = tableNames[tableType] || tableType;
            this.currentDeleteTableType = tableType;

            // Populate the list
            this.populateDeleteSelectionList(tableType, listEl);

            // Set up confirm button
            confirmBtn.onclick = () => this.deleteSelectedItems();

            modal.classList.add('show');

        } catch (error) {
            console.error('Error showing delete panel:', error);
            this.showError('Failed to open delete panel');
        }
    }

    populateDeleteSelectionList(tableType, listEl) {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];
            const items = monthData[tableType] || [];

            listEl.innerHTML = '';

            if (items.length === 0) {
                listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">No items to delete</div>';
                return;
            }

            items.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'delete-selection-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = index;
                checkbox.id = `delete-item-${index}`;

                const infoDiv = document.createElement('div');
                infoDiv.className = 'delete-item-info';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'delete-item-name';
                nameSpan.textContent = item.name || `Item ${index + 1}`;

                const amountSpan = document.createElement('span');
                amountSpan.className = 'delete-item-amount';

                // Display amount based on table type
                let amountText = '';
                if (tableType === 'fixedExpenses' || tableType === 'travelEntertainment') {
                    const planned = parseFloat(item.planned) || 0;
                    const actual = parseFloat(item.actual) || 0;
                    amountText = `Planned: ₹${planned.toFixed(0)} | Actual: ₹${actual.toFixed(0)}`;
                } else {
                    const amount = parseFloat(item.amount) || 0;
                    amountText = `₹${amount.toFixed(0)}`;
                }
                amountSpan.textContent = amountText;

                infoDiv.appendChild(nameSpan);
                infoDiv.appendChild(amountSpan);

                itemDiv.appendChild(checkbox);
                itemDiv.appendChild(infoDiv);

                listEl.appendChild(itemDiv);
            });

        } catch (error) {
            console.error('Error populating delete selection list:', error);
            listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--error-color);">Error loading items</div>';
        }
    }

    deleteSelectedItems() {
        try {
            const listEl = document.getElementById('deleteSelectionList');
            const checkboxes = listEl.querySelectorAll('input[type="checkbox"]:checked');

            if (checkboxes.length === 0) {
                this.showError('Please select items to delete');
                return;
            }

            // Get indices in reverse order to avoid index shifting
            const indicesToDelete = Array.from(checkboxes)
                .map(cb => parseInt(cb.value))
                .sort((a, b) => b - a);

            const monthData = this.data[this.currentYear][this.currentMonth];
            const items = monthData[this.currentDeleteTableType];

            // Delete items
            indicesToDelete.forEach(index => {
                if (index >= 0 && index < items.length) {
                    items.splice(index, 1);
                }
            });

            // Save and refresh
            this.saveData();
            this.populateTables();
            this.updateCalculations();
            this.updateAllCharts();

            this.closeDeleteSelectionPanel();

        } catch (error) {
            console.error('Error deleting selected items:', error);
            this.showError('Failed to delete selected items');
        }
    }

    closeDeleteSelectionPanel() {
        const modal = document.getElementById('deleteSelectionModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.currentDeleteTableType = null;
    }

    showManagePanel(tableType) {
        try {
            const modal = document.getElementById('manageModal');
            const title = document.getElementById('manageTitle');
            const typeName = document.getElementById('manageTypeName');

            if (modal && title && typeName) {
                this.currentManageTableType = tableType;

                const typeNames = {
                    'fixedExpenses': 'Fixed Expenses',
                    'debt': 'Debt'
                };

                title.textContent = `Manage ${typeNames[tableType]}`;
                typeName.textContent = typeNames[tableType];

                modal.classList.add('show');
                this.populateManagePanel(tableType);
            }
        } catch (error) {
            console.error('Error showing manage panel:', error);
            this.showError('Failed to show manage panel');
        }
    }

    closeManagePanel() {
        const modal = document.getElementById('manageModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.currentManageTableType = null;
    }

    populateManagePanel(tableType) {
        try {
            const templatesContainer = document.getElementById('manageTemplatesList');
            const currentItemsContainer = document.getElementById('manageCurrentItems');

            if (!templatesContainer || !currentItemsContainer) return;

            templatesContainer.innerHTML = '';
            currentItemsContainer.innerHTML = '';

            const monthData = this.data[this.currentYear][this.currentMonth];

            if (tableType === 'fixedExpenses') {
                this.populateFixedExpenseManage(templatesContainer, currentItemsContainer, monthData);
            } else if (tableType === 'debt') {
                this.populateDebtManage(templatesContainer, currentItemsContainer, monthData);
            }

        } catch (error) {
            console.error('Error populating manage panel:', error);
        }
    }

    populateFixedExpenseManage(templatesContainer, currentItemsContainer, monthData) {
        // Show available templates that are not in current month
        this.fixedExpenseTemplates.forEach((template, index) => {
            const exists = monthData.fixedExpenses.some(expense => 
                expense.name && expense.name.toLowerCase() === template.name.toLowerCase()
            );

            if (!exists) {
                const div = document.createElement('div');
                div.className = 'manage-item';
                div.innerHTML = `
                    <span class="manage-item-info">${template.name} - ₹${template.planned}</span>
                    <button class="glass-button" onclick="budgetApp.addTemplateToMonth('fixedExpenses', ${index})">Add to Month</button>
                `;
                templatesContainer.appendChild(div);
            }
        });

        if (templatesContainer.children.length === 0) {
            templatesContainer.innerHTML = '<p>All templates are already added to this month</p>';
        }

        // Show current month items that can be removed
        monthData.fixedExpenses.forEach((expense, index) => {
            const div = document.createElement('div');
            div.className = 'manage-item';
            div.innerHTML = `
                <span class="manage-item-info">${expense.name} - Planned: ₹${expense.planned}, Actual: ₹${expense.actual}</span>
                <button class="glass-button delete-btn" onclick="budgetApp.removeItemFromMonth('fixedExpenses', ${index})">Remove</button>
            `;
            currentItemsContainer.appendChild(div);
        });

        if (currentItemsContainer.children.length === 0) {
            currentItemsContainer.innerHTML = '<p>No fixed expenses in this month</p>';
        }
    }

    populateDebtManage(templatesContainer, currentItemsContainer, monthData) {
        // Show available debt templates that should apply to this month
        this.debtTemplates.forEach((template, index) => {
            const shouldApply = this.shouldApplyDebtTemplate(template, this.currentMonth, this.currentYear);
            const exists = monthData.debt.some(debt => 
                debt.name && debt.name.toLowerCase() === template.name.toLowerCase()
            );

            if (shouldApply && !exists) {
                const monthsInfo = template.monthsRemaining && template.monthsRemaining > 0 
                    ? ` (${template.monthsRemaining} months)` 
                    : ' (unlimited)';

                const div = document.createElement('div');
                div.className = 'manage-item';
                div.innerHTML = `
                    <span class="manage-item-info">${template.name}${monthsInfo} - ₹${template.amount}</span>
                    <button class="glass-button" onclick="budgetApp.addTemplateToMonth('debt', ${index})">Add to Month</button>
                `;
                templatesContainer.appendChild(div);
            }
        });

        if (templatesContainer.children.length === 0) {
            templatesContainer.innerHTML = '<p>All applicable debt templates are already added to this month</p>';
        }

        // Show current month debt items that can be removed
        monthData.debt.forEach((debt, index) => {
            const div = document.createElement('div');
            div.className = 'manage-item';
            div.innerHTML = `
                <span class="manage-item-info">${debt.name} - ₹${debt.amount}</span>
                <button class="glass-button delete-btn" onclick="budgetApp.removeItemFromMonth('debt', ${index})">Remove</button>
            `;
            currentItemsContainer.appendChild(div);
        });

        if (currentItemsContainer.children.length === 0) {
            currentItemsContainer.innerHTML = '<p>No debt items in this month</p>';
        }
    }

    addTemplateToMonth(tableType, templateIndex) {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];

            if (tableType === 'fixedExpenses' && templateIndex < this.fixedExpenseTemplates.length) {
                const template = this.fixedExpenseTemplates[templateIndex];
                monthData.fixedExpenses.push({
                    name: template.name,
                    planned: template.planned,
                    actual: 0
                });
            } else if (tableType === 'debt' && templateIndex < this.debtTemplates.length) {
                const template = this.debtTemplates[templateIndex];
                monthData.debt.push({
                    name: template.name,
                    amount: template.amount
                });
            }

            this.saveData();
            this.populateTables();
            this.updateCalculations();
            this.populateManagePanel(tableType);

        } catch (error) {
            console.error('Error adding template to month:', error);
            this.showError('Failed to add template to month');
        }
    }

    removeItemFromMonth(tableType, itemIndex) {
        try {
            const monthData = this.data[this.currentYear][this.currentMonth];

            if (monthData[tableType] && itemIndex < monthData[tableType].length) {
                monthData[tableType].splice(itemIndex, 1);

                this.saveData();
                this.populateTables();
                this.updateCalculations();
                this.populateManagePanel(tableType);
            }

        } catch (error) {
            console.error('Error removing item from month:', error);
            this.showError('Failed to remove item from month');
        }
    }

    removeFixedExpenseFromFutureMonths(template) {
        try {
            // Iterate through all years and months to remove this template
            for (const year in this.data) {
                for (const month in this.data[year]) {
                    const monthData = this.data[year][month];
                    if (monthData.fixedExpenses) {
                        // Remove entries that match this template
                        monthData.fixedExpenses = monthData.fixedExpenses.filter(expense => 
                            expense.name !== template.name || expense.planned !== template.amount
                        );
                    }
                }
            }
            this.saveData();
        } catch (error) {
            console.error('Error removing fixed expense from future months:', error);
        }
    }

    removeDebtFromFutureMonths(template) {
        try {
            // Iterate through all years and months to remove this template
            for (const year in this.data) {
                for (const month in this.data[year]) {
                    const monthData = this.data[year][month];
                    if (monthData.debt) {
                        // Remove entries that match this template
                        monthData.debt = monthData.debt.filter(debt => 
                            debt.name !== template.name || debt.amount !== template.amount
                        );
                    }
                }
            }
            this.saveData();
        } catch (error) {
            console.error('Error removing debt from future months:', error);
        }
    }
}

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
        budgetApp.showError('An unexpected error occurred. Please refresh the page if problems persist.');
    }
});
