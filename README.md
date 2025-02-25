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
└── public/               # Static public files
```

## Data Sources

The application uses historical price data from Yahoo Finance for cryptocurrencies. Data is stored in CSV format in the `data/crypto_data/` directory.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
