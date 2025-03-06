# PCC-EST: Cryptocurrency Price Tracker and Estimator

A modern web application built with React and Node.js that allows users to track historical cryptocurrency prices and analyze price trends.

![Cryptocurrency Dashboard](https://images.unsplash.com/photo-1621761311991-e2ef13e32d01?auto=format&fit=crop&q=80&w=1650&h=650)

## Features

- 📊 **Historical Price Tracking**: View historical price data for various cryptocurrencies including Bitcoin, Ethereum, and more
- 📱 **Responsive Design**: Fully responsive design that works on desktops, tablets, and mobile devices
- 🌓 **Dark/Light Mode**: Toggle between dark and light themes (dark mode by default)
- 📈 **Data Visualization**: Interactive charts built with Recharts for visualizing price trends
- 🔄 **Real-time Updates**: Integration with cryptocurrency APIs for fresh data
- ⚡ **Fast Performance**: Built with Vite for lightning-fast development and production builds

## Tech Stack

- **Frontend**: React 19, React Router, Tailwind CSS, Recharts
- **Backend**: Node.js, Express
- **Data Processing**: CSV processing with csvtojson and csv-writer
- **API Integration**: Yahoo Finance API for historical data

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/pcc-est-v5.git
   cd pcc-est-v5
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5001
   ```

### Running the Application

Start both the frontend and backend concurrently:

```bash
npm start
```

Or run them separately:

```bash
# Frontend only
npm run dev

# Backend only
npm run server

# Backend with nodemon (auto-restart)
npm run dev:server
```

## Project Structure

```
pcc-est-v5/
├── src/                  # Frontend React application
│   ├── components/       # React components
│   ├── pages/            # Page components
│   ├── context/          # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   ├── api/              # API client functions
│   └── assets/           # Static assets
├── backend/              # Node.js Express server
│   ├── controllers/      # Route controllers
│   ├── routes/           # API routes
│   └── scripts/          # Data processing scripts
├── data/                 # Data storage
│   └── crypto_data/      # Cryptocurrency data files
├── public/               # Static public files
└── .claude/              # Claude AI optimization structure
    ├── metadata/         # Codebase metadata and component relationships
    ├── code_index/       # Code semantic relationships and intent classification
    ├── debug_history/    # Common issues and solutions
    ├── patterns/         # Implementation pattern libraries
    ├── cheatsheets/      # Component-specific quick references
    ├── qa/               # Solutions to previous problems
    ├── documentation/    # Model-friendly component documentation
    └── delta/            # Version change documentation
```

## Claude AI Optimization

This repository includes a specialized `.claude` directory structure designed to help Claude AI better understand, navigate, and work with the codebase. This structure provides context, patterns, and historical information that enhances Claude's ability to provide assistance.

### Memory Anchors

The codebase utilizes special memory anchor comments that help Claude precisely reference specific sections of code:

```javascript
// CLAUDE-ANCHOR: section-name uuid
// Description of the code section
```

These anchors provide semantic structure and identifiers that make it easier for Claude to understand and navigate the codebase.

### Benefits of the Claude Structure

- **Enhanced Code Understanding**: Provides Claude with comprehensive knowledge about component relationships, data flows, and code intentions
- **Pattern Recognition**: Documents established patterns for consistent code generation
- **Error Handling**: Catalogs common errors and their solutions for faster debugging
- **Historical Context**: Preserves knowledge about why certain decisions were made

For more information about the Claude optimization structure, see the [.claude/README.md](./.claude/README.md) file.

## Data Sources

The application uses historical price data from Yahoo Finance for cryptocurrencies. Data is stored in CSV format in the `data/crypto_data/` directory.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
