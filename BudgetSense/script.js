// Budget Planning App - Main JavaScript File

class BudgetApp {
    constructor() {
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.expenseChart = null;
        this.efficiencyChart = null;
        this.balanceChart = null;
        this.data = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Wait for DOM to be fully ready
            await this.waitForDOM();
            
            // Load data first
            this.data = await this.loadData();
            
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
        }
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
            // Navigation arrows
            const prevButton = document.getElementById('prevMonth');
            const nextButton = document.getElementById('nextMonth');
            
            if (prevButton && nextButton) {
                prevButton.addEventListener('click', () => {
                    this.navigateMonth(-1);
                });
                
                nextButton.addEventListener('click', () => {
                    this.navigateMonth(1);
                });
            } else {
                console.error('Navigation buttons not found');
            }
            
            // Theme toggle
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    this.toggleTheme();
                });
            } else {
                console.error('Theme toggle button not found');
            }
            
            // PDF export
            const exportButton = document.getElementById('exportPDF');
            if (exportButton) {
                exportButton.addEventListener('click', () => {
                    this.exportToPDF();
                });
            } else {
                console.error('Export button not found');
            }
            
            // Add export data button functionality if it exists
            const exportDataButton = document.getElementById('exportData');
            if (exportDataButton) {
                exportDataButton.addEventListener('click', () => {
                    this.exportToDataFolder();
                });
            }
            
            // Input validation
            document.addEventListener('input', (e) => {
                if (e.target.classList.contains('numeric-input')) {
                    this.validateNumericInput(e.target);
                }
            });
            
            // Auto-save on change
            document.addEventListener('input', (e) => {
                if (e.target.classList.contains('editable')) {
                    setTimeout(() => {
                        this.saveData();
                        this.updateCalculations();
                        this.updateAllCharts();
                    }, 300);
                }
            });
            
            console.log('Event listeners setup successfully');
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }
    
    updateCurrentMonthDisplay() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const currentMonthElement = document.getElementById('currentMonth');
        if (currentMonthElement) {
            currentMonthElement.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        }
    }
    
    navigateMonth(direction) {
        this.currentMonth += direction;
        
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear += 1;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear -= 1;
        }
        
        this.updateCurrentMonthDisplay();
        this.loadMonth(this.currentMonth, this.currentYear);
    }
    
    initializeYearData(year) {
        if (!this.data[year]) {
            this.data[year] = {};
            for (let month = 0; month < 12; month++) {
                this.data[year][month] = {
                    income: [],
                    fixedExpenses: [],
                    otherExpenses: [],
                    debt: [],
                    investment: [],
                    carriedBalance: 0
                };
            }
        }
    }
    
    carryOverBalance(month, year) {
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
            const prevIncome = prevMonthData.income.reduce((sum, item) => sum + (item.amount || 0), 0);
            const prevExpenses = 
                prevMonthData.fixedExpenses.reduce((sum, item) => sum + (item.actual || 0), 0) +
                prevMonthData.otherExpenses.reduce((sum, item) => sum + (item.actual || 0), 0) +
                prevMonthData.debt.reduce((sum, item) => sum + (item.amount || 0), 0) +
                prevMonthData.investment.reduce((sum, item) => sum + (item.amount || 0), 0);
            
            const prevRemaining = prevIncome - prevExpenses + (prevMonthData.carriedBalance || 0);
            this.data[year][month].carriedBalance = prevRemaining > 0 ? prevRemaining : 0;
        }
    }
    
    setupTooltips() {
        const tooltip = document.getElementById('tooltip');
        const tooltipHeaders = document.querySelectorAll('.tooltip-header');
        
        if (!tooltip) {
            console.error('Tooltip element not found');
            return;
        }
        
        tooltipHeaders.forEach(header => {
            header.addEventListener('mouseenter', (e) => {
                const tooltipText = e.target.dataset.tooltip;
                tooltip.textContent = tooltipText;
                tooltip.classList.add('show');
                
                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
                tooltip.style.top = `${rect.bottom + 10}px`;
            });
            
            header.addEventListener('mouseleave', () => {
                tooltip.classList.remove('show');
            });
        });
    }
    
    setupTheme() {
        const savedTheme = this.getStoredTheme() || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        }
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        this.saveTheme(newTheme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }
    }
    
    async loadData() {
        try {
            // Try to load from localStorage first (fallback for compatibility)
            const savedData = localStorage.getItem('budget-data');
            if (savedData) {
                return JSON.parse(savedData);
            }
            
            // Initialize empty data structure for all months and years
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
                        carriedBalance: 0
                    };
                }
            }
            return data;
        } catch (error) {
            console.error('Error loading data:', error);
            return {};
        }
    }
    
    saveData() {
        try {
            // Save to localStorage for persistent storage
            localStorage.setItem('budget-data', JSON.stringify(this.data));
            console.log('Data saved to localStorage');
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }
    
    exportToDataFolder() {
        try {
            // Only create download when user explicitly wants to export
            const dataStr = JSON.stringify(this.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const link = document.createElement('a');
            link.href = url;
            link.download = 'budget-data.json';
            link.style.display = 'none';
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(url);
            
            this.showError('Data exported successfully!');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showError('Failed to export data');
        }
    }
    
    getStoredTheme() {
        return localStorage.getItem('budget-app-theme');
    }
    
    saveTheme(theme) {
        localStorage.setItem('budget-app-theme', theme);
    }
    
    loadMonth(month, year) {
        if (!this.data[year]) {
            this.initializeYearData(year);
        }
        
        const monthData = this.data[year][month];
        
        // Carry over balance from previous month
        this.carryOverBalance(month, year);
        
        // Load each table
        this.loadTable('income', monthData.income);
        this.loadTable('fixedExpenses', monthData.fixedExpenses);
        this.loadTable('otherExpenses', monthData.otherExpenses);
        this.loadTable('debt', monthData.debt);
        this.loadTable('investment', monthData.investment);
        
        this.updateCalculations();
        this.updateAllCharts();
    }
    
    loadTable(tableType, data) {
        const table = document.getElementById(`${tableType}Table`);
        if (!table) {
            console.error(`Table ${tableType}Table not found`);
            return;
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.error(`Table body for ${tableType}Table not found`);
            return;
        }
        
        tbody.innerHTML = '';
        
        data.forEach((row, index) => {
            this.addRowToTable(tableType, row, index + 1);
        });
        
        // Add empty row if no data
        if (data.length === 0) {
            this.addRowToTable(tableType, {}, 1);
        }
    }
    
    addRow(tableType) {
        try {
            if (!this.data[this.currentYear]) {
                this.initializeYearData(this.currentYear);
            }
            const monthData = this.data[this.currentYear][this.currentMonth];
            const newRow = {};
            
            // Initialize based on table type
            switch (tableType) {
                case 'income':
                    newRow.source = '';
                    newRow.amount = 0;
                    break;
                case 'fixedExpenses':
                case 'otherExpenses':
                    newRow.name = '';
                    newRow.planned = 0;
                    newRow.actual = 0;
                    break;
                case 'debt':
                case 'investment':
                    newRow.name = '';
                    newRow.amount = 0;
                    break;
            }
            
            monthData[tableType].push(newRow);
            const rowNumber = monthData[tableType].length;
            
            this.addRowToTable(tableType, newRow, rowNumber);
            this.saveData();
            
            console.log(`Added new row to ${tableType}`);
        } catch (error) {
            console.error(`Error adding row to ${tableType}:`, error);
        }
    }
    
    addRowToTable(tableType, rowData, rowNumber) {
        const table = document.getElementById(`${tableType}Table`);
        if (!table) {
            console.error(`Table ${tableType}Table not found`);
            return;
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.error(`Table body for ${tableType}Table not found`);
            return;
        }
        
        const row = document.createElement('tr');
        
        let rowHTML = `<td class="row-number">${rowNumber}</td>`;
        
        switch (tableType) {
            case 'income':
                rowHTML += `
                    <td><input type="text" class="editable" value="${rowData.source || ''}" data-field="source" data-row="${rowNumber - 1}"></td>
                    <td><input type="number" class="editable numeric-input" value="${rowData.amount || ''}" data-field="amount" data-row="${rowNumber - 1}" step="0.01" min="0"></td>
                `;
                break;
                
            case 'fixedExpenses':
            case 'otherExpenses':
                const balance = (rowData.planned || 0) - (rowData.actual || 0);
                rowHTML += `
                    <td><input type="text" class="editable" value="${rowData.name || ''}" data-field="name" data-row="${rowNumber - 1}"></td>
                    <td><input type="number" class="editable numeric-input" value="${rowData.planned || ''}" data-field="planned" data-row="${rowNumber - 1}" step="0.01" min="0"></td>
                    <td><input type="number" class="editable numeric-input" value="${rowData.actual || ''}" data-field="actual" data-row="${rowNumber - 1}" step="0.01" min="0"></td>
                    <td class="calculated ${balance >= 0 ? 'positive' : 'negative'}" data-row="${rowNumber - 1}">₹${balance.toFixed(2)}</td>
                `;
                break;
                
            case 'debt':
            case 'investment':
                rowHTML += `
                    <td><input type="text" class="editable" value="${rowData.name || ''}" data-field="name" data-row="${rowNumber - 1}"></td>
                    <td><input type="number" class="editable numeric-input" value="${rowData.amount || ''}" data-field="amount" data-row="${rowNumber - 1}" step="0.01" min="0"></td>
                `;
                break;
        }
        
        rowHTML += `<td><button class="delete-btn" onclick="deleteRowHandler('${tableType}', ${rowNumber - 1})">Delete</button></td>`;
        row.innerHTML = rowHTML;
        tbody.appendChild(row);
        
        // Add event listeners for this row
        const inputs = row.querySelectorAll('.editable');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.updateRowData(tableType, e.target);
            });
        });
    }
    
    updateRowData(tableType, input) {
        const rowIndex = parseInt(input.dataset.row);
        const field = input.dataset.field;
        const value = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
        
        if (!this.data[this.currentYear]) {
            this.initializeYearData(this.currentYear);
        }
        const monthData = this.data[this.currentYear][this.currentMonth];
        if (!monthData[tableType][rowIndex]) {
            monthData[tableType][rowIndex] = {};
        }
        
        monthData[tableType][rowIndex][field] = value;
        
        // Update balance for expense tables
        if (tableType === 'fixedExpenses' || tableType === 'otherExpenses') {
            this.updateBalance(tableType, rowIndex);
        }
    }
    
    updateBalance(tableType, rowIndex) {
        const monthData = this.data[this.currentYear][this.currentMonth];
        const rowData = monthData[tableType][rowIndex];
        const planned = rowData.planned || 0;
        const actual = rowData.actual || 0;
        const balance = planned - actual;
        
        const balanceCell = document.querySelector(`#${tableType}Table .calculated[data-row="${rowIndex}"]`);
        if (balanceCell) {
            balanceCell.textContent = `₹${balance.toFixed(2)}`;
            balanceCell.className = `calculated ${balance >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    deleteRow(tableType, rowIndex) {
        const monthData = this.data[this.currentYear][this.currentMonth];
        monthData[tableType].splice(rowIndex, 1);
        
        this.loadTable(tableType, monthData[tableType]);
        this.saveData();
        this.updateCalculations();
        this.updateAllCharts();
    }
    
    validateNumericInput(input) {
        const value = input.value;
        const isValid = /^\d*\.?\d*$/.test(value) && value !== '';
        
        if (!isValid && value !== '') {
            input.classList.add('error');
            this.showError('Please enter a valid number');
        } else {
            input.classList.remove('error');
        }
    }
    
    updateCalculations() {
        const monthData = this.data[this.currentYear][this.currentMonth];
        
        // Calculate total income
        const totalIncome = monthData.income.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        // Calculate total expenses
        const totalFixedExpenses = monthData.fixedExpenses.reduce((sum, item) => sum + (item.actual || 0), 0);
        const totalOtherExpenses = monthData.otherExpenses.reduce((sum, item) => sum + (item.actual || 0), 0);
        const totalDebt = monthData.debt.reduce((sum, item) => sum + (item.amount || 0), 0);
        const totalInvestment = monthData.investment.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        const totalExpenses = totalFixedExpenses + totalOtherExpenses + totalDebt + totalInvestment;
        const remaining = totalIncome - totalExpenses + (monthData.carriedBalance || 0);
        
        // Update summary cards
        const totalIncomeEl = document.getElementById('totalIncome');
        const totalExpensesEl = document.getElementById('totalExpenses');
        const carriedAmountEl = document.getElementById('carriedAmount');
        const remainingAmountEl = document.getElementById('remainingAmount');
        
        if (totalIncomeEl) totalIncomeEl.textContent = `₹${totalIncome.toFixed(2)}`;
        if (totalExpensesEl) totalExpensesEl.textContent = `₹${totalExpenses.toFixed(2)}`;
        if (carriedAmountEl) carriedAmountEl.textContent = `₹${(monthData.carriedBalance || 0).toFixed(2)}`;
        
        if (remainingAmountEl) {
            remainingAmountEl.textContent = `₹${remaining.toFixed(2)}`;
            remainingAmountEl.className = `amount ${remaining >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    updateExpenseChart() {
        const monthData = this.data[this.currentYear][this.currentMonth];
        
        const totalFixedExpenses = monthData.fixedExpenses.reduce((sum, item) => sum + (item.actual || 0), 0);
        const totalOtherExpenses = monthData.otherExpenses.reduce((sum, item) => sum + (item.actual || 0), 0);
        const totalDebt = monthData.debt.reduce((sum, item) => sum + (item.amount || 0), 0);
        const totalInvestment = monthData.investment.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        const ctx = document.getElementById('expenseChart')?.getContext('2d');
        if (!ctx) {
            console.error('Expense chart canvas not found');
            return;
        }
        
        if (this.expenseChart) {
            this.expenseChart.destroy();
        }
        
        const hasData = totalFixedExpenses > 0 || totalOtherExpenses > 0 || totalDebt > 0 || totalInvestment > 0;
        
        if (!hasData) {
            this.expenseChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['No data available'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e0e0e0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
            return;
        }
        
        this.expenseChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Fixed Expenses', 'Other Expenses', 'Debt', 'Investment'],
                datasets: [{
                    data: [totalFixedExpenses, totalOtherExpenses, totalDebt, totalInvestment],
                    backgroundColor: [
                        '#007aff',
                        '#ff9500',
                        '#ff3b30',
                        '#30d158'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ₹${context.parsed.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    updateEfficiencyChart() {
        const ctx = document.getElementById('efficiencyChart')?.getContext('2d');
        if (!ctx) {
            console.error('Efficiency chart canvas not found');
            return;
        }
        
        if (this.efficiencyChart) {
            this.efficiencyChart.destroy();
        }
        
        // Get last 6 months data
        const labels = [];
        const efficiencyData = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        for (let i = 5; i >= 0; i--) {
            let month = this.currentMonth - i;
            let year = this.currentYear;
            
            if (month < 0) {
                month += 12;
                year -= 1;
            }
            
            labels.push(`${monthNames[month]} ${year}`);
            
            if (this.data[year] && this.data[year][month]) {
                const monthData = this.data[year][month];
                const totalIncome = monthData.income.reduce((sum, item) => sum + (item.amount || 0), 0);
                const totalExpenses = 
                    monthData.fixedExpenses.reduce((sum, item) => sum + (item.actual || 0), 0) +
                    monthData.otherExpenses.reduce((sum, item) => sum + (item.actual || 0), 0) +
                    monthData.debt.reduce((sum, item) => sum + (item.amount || 0), 0) +
                    monthData.investment.reduce((sum, item) => sum + (item.amount || 0), 0);
                
                const efficiency = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
                efficiencyData.push(Math.max(efficiency, 0));
            } else {
                efficiencyData.push(0);
            }
        }
        
        this.efficiencyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Efficiency %',
                    data: efficiencyData,
                    borderColor: '#007aff',
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Efficiency: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                },
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
                }
            }
        });
    }
    
    updateBalanceChart() {
        const ctx = document.getElementById('balanceChart')?.getContext('2d');
        if (!ctx) {
            console.error('Balance chart canvas not found');
            return;
        }
        
        if (this.balanceChart) {
            this.balanceChart.destroy();
        }
        
        const monthData = this.data[this.currentYear][this.currentMonth];
        const totalIncome = monthData.income.reduce((sum, item) => sum + (item.amount || 0), 0);
        const totalExpenses = 
            monthData.fixedExpenses.reduce((sum, item) => sum + (item.actual || 0), 0) +
            monthData.otherExpenses.reduce((sum, item) => sum + (item.actual || 0), 0) +
            monthData.debt.reduce((sum, item) => sum + (item.amount || 0), 0) +
            monthData.investment.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        const availableBalance = totalIncome - totalExpenses + (monthData.carriedBalance || 0);
        const usedAmount = totalExpenses;
        
        const hasData = totalIncome > 0 || totalExpenses > 0;
        
        if (!hasData) {
            this.balanceChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e0e0e0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            display: false
                        }
                    }
                }
            });
            return;
        }
        
        this.balanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Available', 'Used'],
                datasets: [{
                    data: [Math.max(availableBalance, 0), usedAmount],
                    backgroundColor: ['#30d158', '#ff3b30'],
                    borderWidth: 0,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ₹${context.parsed.x.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value;
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }
    
    updateAllCharts() {
        this.updateExpenseChart();
        this.updateEfficiencyChart();
        this.updateBalanceChart();
    }
    
    async exportToPDF() {
        try {
            const exportBtn = document.getElementById('exportPDF');
            if (!exportBtn) return;
            
            const originalText = exportBtn.textContent;
            exportBtn.textContent = 'Generating PDF...';
            exportBtn.disabled = true;
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // Add title
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
            pdf.setFontSize(20);
            pdf.text(`Budget Report - ${monthNames[this.currentMonth]} ${this.currentYear}`, 20, 20);
            
            // Add summary
            pdf.setFontSize(12);
            const totalIncome = document.getElementById('totalIncome')?.textContent || '₹0.00';
            const totalExpenses = document.getElementById('totalExpenses')?.textContent || '₹0.00';
            const remaining = document.getElementById('remainingAmount')?.textContent || '₹0.00';
            
            pdf.text(`Total Income: ${totalIncome}`, 20, 40);
            pdf.text(`Total Expenses: ${totalExpenses}`, 20, 50);
            pdf.text(`Remaining: ${remaining}`, 20, 60);
            
            // Capture main content
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                const canvas = await html2canvas(mainContent, {
                    scale: 1,
                    useCORS: true,
                    allowTaint: true,
                    height: mainContent.scrollHeight,
                    width: mainContent.scrollWidth
                });
                
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 170;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                if (imgHeight > 200) {
                    let position = 0;
                    const pageHeight = 200;
                    
                    while (position < imgHeight) {
                        if (position > 0) {
                            pdf.addPage();
                        }
                        
                        pdf.addImage(imgData, 'PNG', 20, 80 - position, imgWidth, imgHeight);
                        position += pageHeight;
                    }
                } else {
                    pdf.addImage(imgData, 'PNG', 20, 80, imgWidth, imgHeight);
                }
            }
            
            // Save PDF
            pdf.save(`budget-${monthNames[this.currentMonth].toLowerCase()}-${this.currentYear}.pdf`);
            
            // Reset button
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showError('Failed to generate PDF. Please try again.');
            
            const exportBtn = document.getElementById('exportPDF');
            if (exportBtn) {
                exportBtn.textContent = '📄 Export PDF';
                exportBtn.disabled = false;
            }
        }
    }
    
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        
        if (errorDiv && errorText) {
            errorText.textContent = message;
            errorDiv.classList.add('show');
            
            setTimeout(() => {
                this.hideError();
            }, 5000);
        } else {
            console.error(message);
        }
    }
    
    hideError() {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.classList.remove('show');
        }
    }
}

// Global app variable
let budgetApp = null;

// Global functions for button clicks
function addRow(tableType) {
    if (budgetApp) {
        budgetApp.addRow(tableType);
    } else {
        console.error('Budget app not initialized');
    }
}

function deleteRowHandler(tableType, rowIndex) {
    if (budgetApp) {
        budgetApp.deleteRow(tableType, rowIndex);
    } else {
        console.error('Budget app not initialized');
    }
}

function hideError() {
    if (budgetApp) {
        budgetApp.hideError();
    }
}

// Initialize app when everything is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing budget app...');
    
    // Wait a bit more to ensure all elements are ready
    setTimeout(() => {
        budgetApp = new BudgetApp();
        window.budgetApp = budgetApp;
    }, 500);
});

// Handle beforeunload to save data
window.addEventListener('beforeunload', () => {
    if (budgetApp) {
        budgetApp.saveData();
    }
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (!budgetApp) return;
    
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        budgetApp.saveData();
        budgetApp.showError('Data saved successfully!');
    }
    
    // Ctrl/Cmd + E to export PDF
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        budgetApp.exportToPDF();
    }
    
    // Arrow keys for navigation
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        budgetApp.navigateMonth(-1);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        budgetApp.navigateMonth(1);
    }
});