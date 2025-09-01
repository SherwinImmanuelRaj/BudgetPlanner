
# Budget App Data Storage

This folder contains your budget application data files:

## Files:
- `budget-data.json` - Your main budget data (income, expenses, etc.)
- `fixed-expense-templates.json` - Templates for recurring fixed expenses
- `debt-templates.json` - Templates for debt payments
- `theme-setting.json` - Your theme preference (light/dark)

## Usage:
1. When you modify data in the app, it will automatically download updated JSON files
2. To backup your data, copy these JSON files to a safe location
3. To restore data, use the browser's file upload feature (will be added to admin panel)
4. For GitHub Pages deployment, commit these files to maintain your data

## GitHub Pages Deployment:
1. Commit all files including the userdata folder to your repository
2. Enable GitHub Pages in repository settings
3. Your app will be available at: `https://yourusername.github.io/repositoryname/`

The app works entirely in the browser - no server required!
