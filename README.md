# Budget Planning App

## Overview

This is a client-side personal finance management application built with vanilla HTML, CSS, and JavaScript. The app provides users with an intuitive interface to manage their monthly budgets, track income and expenses, visualize spending patterns through interactive charts, and export budget reports as PDFs. The application features a modern glassmorphism design with dual theme support and operates entirely offline using browser localStorage for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Pure client-side application**: Built entirely with vanilla HTML, CSS, and JavaScript without any framework dependencies
- **Class-based architecture**: Organized around a main `BudgetApp` class that encapsulates all application logic and state management
- **Component-based design**: Modular approach with separate methods for different UI components and functionalities
- **Responsive design**: Mobile-first approach using CSS Grid and Flexbox for adaptive layouts across devices

### Data Management
- **Browser localStorage persistence**: All budget data is stored locally in the user's browser for complete offline functionality
- **Multi-year data structure**: Budget information organized by month and year to support historical data tracking and analysis
- **Real-time data synchronization**: Automatic saving of user inputs with debounced persistence to localStorage for performance
- **Balance carry-over system**: Automatic calculation and carry-forward of remaining balance from previous months
- **Data validation**: Client-side validation for numeric inputs and data integrity checks with error handling

### User Interface Design
- **iOS Vision OS Liquid Glass Theme**: Advanced glassmorphism effects with backdrop blur, gradient backgrounds, and liquid refraction effects
- **Dual theme support**: Light and dark mode switching using CSS custom properties with system preference detection
- **Interactive navigation**: Month navigation with arrow controls, current month display, and smooth transitions
- **Sticky dashboard**: Summary cards and charts remain visible while scrolling through budget tables for constant overview
- **Performance optimizations**: DOM element caching, debounced updates, and race condition prevention

### Data Visualization
- **Chart.js integration**: Three different chart types for comprehensive financial visualization:
  - **Expense Distribution**: Pie chart showing breakdown of expense categories
  - **6-Month Efficiency Trend**: Line chart displaying savings patterns over time
  - **Balance Comparison**: Horizontal bar chart comparing available vs used amounts
- **Dynamic chart updates**: Charts automatically refresh when budget data changes with debounced updates
- **Responsive charts**: Charts adapt to different screen sizes and maintain aspect ratios

### Budget Management Features
- **Editable data tables**: Direct cell editing for income, expenses, debt, and investment entries with real-time calculations
- **Multiple expense categories**: Separate tracking for fixed expenses, variable expenses, debt payments, and investments
- **Template system**: Reusable templates for fixed expenses and debt entries accessible through admin panel
- **Month-by-month tracking**: Independent budget management for each month with seamless navigation
- **Automatic calculations**: Real-time computation of balances, totals, and remaining amounts with error handling

### Export and Admin Features
- **PDF export functionality**: Client-side PDF generation using jsPDF and html2canvas libraries for complete budget reports
- **Admin panel**: Administrative interface for managing expense and debt templates with CRUD operations
- **Error handling**: Comprehensive error catching and user feedback for failed operations
- **Performance monitoring**: Console logging and timeout management for debugging and optimization

## External Dependencies

### JavaScript Libraries
- **Chart.js (v3.9.1)**: Data visualization library for creating interactive pie charts, line graphs, and bar charts
- **jsPDF (v2.5.1)**: Client-side PDF generation library for exporting budget reports
- **html2canvas (v1.4.1)**: HTML to canvas conversion library used in conjunction with jsPDF for PDF export functionality

### Browser APIs
- **localStorage API**: Primary data persistence mechanism for storing budget data, templates, and user preferences
- **CSS Custom Properties**: Dynamic theming system for light/dark mode switching
- **DOM APIs**: Comprehensive DOM manipulation for dynamic content updates and user interactions

### External Resources
- **CDN Dependencies**: All JavaScript libraries are loaded from cdnjs.cloudflare.com for reliability and performance
- **No server dependencies**: Application runs entirely in the browser without requiring any backend services
- **No database requirements**: All data storage handled through browser localStorage with JSON serialization
