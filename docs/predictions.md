I need to estimate the weights of a crypto fund based on historical monthly performance data. The fund contains these 8 cryptocurrencies: Bitcoin, Ethereum, Solana, Polkadot, Dogecoin, BNB, Tether USDT, and Bittensor. I have month-over-month percentage changes going back to December 2020.

Write a Python script that:

1. DATA PREPARATION:
   - Imports necessary libraries (pandas, numpy, sklearn, matplotlib, seaborn, etc.)
   - Creates a function to load monthly percentage change data for the 8 cryptos and the fund from December 2020 to present
   - Implements an exponential time-weighting function that gives higher importance to recent months
   - Handles missing values and outliers in the monthly series
   - Accounts for the limited number of data points (~50 months) when designing models

2. INDIVIDUAL CRYPTO ANALYSIS:
   - Calculates both Pearson and Spearman correlations between each crypto's monthly returns and fund returns
   - Creates time series plots and scatter plots showing these relationships
   - Implements simple linear regression for each crypto against the fund
   - Ranks cryptos by their individual predictive power (R², correlation values)
   - Outputs a summary table showing which cryptos best predict the fund individually

3. MULTIPLE REGRESSION MODELS:
   - Implements multiple linear regression with all cryptos using monthly return data
   - Uses feature selection methods to find optimal crypto combinations that explain fund performance
   - Applies regularization techniques (Ridge, Lasso, Elastic Net) with cross-validation
   - Implements constrained optimization ensuring weights sum to 1 and are non-negative
   - Compares AIC/BIC criteria to avoid overfitting given the limited monthly observations

4. ADVANCED MODELS:
   - Implements Random Forest and Gradient Boosting Regressors appropriate for the monthly data volume
   - Extracts feature importance from tree-based models
   - Creates a rolling window analysis function (3/6/12 months) to detect weight changes over time
   - Implements time series analysis techniques to account for potential seasonality or trends
   - Uses expanding window cross-validation appropriate for time series data

5. MODEL ENSEMBLE & VALIDATION:
   - Creates a time-weighted validation metric prioritizing recent months
   - Implements a model ensemble combining predictions from multiple models
   - Generates confidence intervals for weight estimates using bootstrapping
   - Uses time series cross-validation techniques appropriate for monthly financial data
   - Implements a backtesting function showing how estimated weights would have performed historically

6. FINAL OUTPUT:
   - Generates a summary table showing estimated weights from all models
   - Creates a recommended weight allocation based on ensemble results
   - Visualizes weight evolution over time if significant drift is detected
   - Produces a correlation matrix heatmap showing relationships between cryptos
   - Calculates tracking error metrics using monthly returns
   - Creates visualizations comparing actual fund returns vs. returns predicted by the estimated weights

Include comments throughout the code explaining the logic and implementation details. Prioritize accuracy while accounting for potential fund drift over time. Consider that with monthly data since December 2020, we have a limited number of observations (~50 data points), so choose model complexity accordingly.