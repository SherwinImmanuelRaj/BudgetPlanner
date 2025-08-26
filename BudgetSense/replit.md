# Budget Planning App

## Overview

This is a client-side budget planning application built with vanilla HTML, CSS, and JavaScript. It provides users with an intuitive interface to manage their monthly budgets, track income and expenses, and visualize their financial data through interactive charts. The app features a modern iOS 16-inspired liquid glass design with dark/light theme support, month navigation, and PDF export functionality.

## User Preferences

Preferred communication style: Simple, everyday language.
Currency: Indian Rupees (₹)
Theme preference: Apple liquid glass inspired by iOS 16

## System Architecture

### Frontend Architecture
- **Pure client-side application**: Built entirely with vanilla HTML, CSS, and JavaScript without any framework dependencies
- **Component-based design**: Organized around a main `BudgetApp` class that encapsulates all application logic
- **Responsive design**: Mobile-first approach using CSS Grid and Flexbox for adaptive layouts
- **iOS 16 Theme system**: CSS custom properties with liquid glass morphism effects

### Data Management
- **Local storage persistence**: All budget data is stored in browser's localStorage for offline functionality
- **Multi-year data structure**: Budget information organized by month and year (2023-2030)
- **Real-time updates**: Automatic saving of user inputs with validation and error handling
- **Balance carry-over**: Automatic carry-forward of remaining balance from previous months

### Navigation System
- **Arrow navigation**: Left/right arrows for intuitive month navigation
- **Single calendar view**: Unified month/year display instead of separate selectors
- **Sticky dashboard**: Charts and summary cards remain visible while scrolling

### UI Design Pattern
- **iOS 16 Liquid Glass**: Advanced glassmorphism with backdrop blur and gradient backgrounds
- **Sticky dashboard**: Summary cards and charts frozen at top for quick reference
- **Smooth animations**: Cubic-bezier transitions and hover effects
- **Responsive grid**: Adaptive layouts for mobile and desktop

### Data Visualization
- **Chart.js integration**: Three different chart types for varied data representation
  - **Expense Split**: Pie chart showing expense distribution
  - **6-Month Efficiency**: Line chart showing savings trend over 6 months
  - **Available vs Used**: Horizontal bar chart comparing available balance vs used amount
- **Dynamic updates**: Charts automatically refresh when budget data changes
- **Sticky positioning**: Charts remain visible while scrolling through tables

### Export Functionality
- **PDF generation**: Uses jsPDF and html2canvas libraries for client-side PDF creation
- **Snapshot capability**: Converts current budget view into downloadable PDF reports
- **Print-friendly formatting**: Optimized layouts for both screen and print media

## External Dependencies

### JavaScript Libraries
- **Chart.js (v3.9.1)**: Provides interactive charting capabilities for data visualization
- **jsPDF (v2.5.1)**: Enables client-side PDF generation and export functionality
- **html2canvas (v1.4.1)**: Converts DOM elements to canvas for PDF export feature

### Browser APIs
- **localStorage**: For persistent data storage across browser sessions
- **Date API**: For month/year selection and date-based data organization
- **DOM APIs**: For dynamic content manipulation and event handling

### Design Resources
- **System fonts**: Uses native system font stack for optimal performance and consistency
- **CSS custom properties**: For theme management and design token system
- **Browser backdrop-filter**: For glassmorphism visual effects (with fallbacks)