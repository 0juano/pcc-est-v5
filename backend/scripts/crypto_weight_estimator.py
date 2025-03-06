#!/usr/bin/env python3
"""
Crypto Fund Weight Estimator

This script estimates the weights of cryptocurrencies in a fund based on historical
monthly performance data. It uses various statistical and machine learning approaches
to find the best combination of weights that would explain the fund's performance.
"""

import os
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit, cross_val_score, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import RFE, SelectFromModel
from scipy.optimize import minimize
import warnings
from datetime import datetime
import argparse

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')

# Parse command line arguments
parser = argparse.ArgumentParser(description='Estimate crypto fund weights')
parser.add_argument('--assets', type=str, help='Comma-separated list of assets to analyze')
args = parser.parse_args()

# Custom JSON encoder to handle NaN values
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return None if np.isnan(obj) else float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NpEncoder, self).default(obj)

# Set path constants
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')
CRYPTO_DATA_DIR = os.path.join(DATA_DIR, 'crypto_data')
FUND_DATA_PATH = os.path.join(DATA_DIR, 'fund_data.csv')
CRYPTO_CONFIG_PATH = os.path.join(DATA_DIR, 'crypto_config.json')

class CryptoWeightEstimator:
    """
    A class for estimating cryptocurrency weights in a fund based on historical returns.
    """
    
    def __init__(self, selected_assets=None):
        """Initialize the estimator with data loading and preprocessing."""
        self.fund_data = None
        self.cryptos_data = {}
        self.merged_data = None
        self.cryptos_list = []
        self.results = {}
        self.selected_assets = selected_assets.split(',') if selected_assets else None
        
    def normalize_weights(self, weights):
        """Normalize weights to sum to 1 and ensure non-negative values."""
        # Convert to Series if it's a numpy array
        if isinstance(weights, np.ndarray):
            weights = pd.Series(weights, index=self.crypto_cols)
            
        # Create a copy to avoid modifying the original
        normalized = weights.copy()
        
        # Replace NaN values with 0
        normalized = normalized.fillna(0)
        
        # Set negative weights to zero
        normalized[normalized < 0] = 0
        
        # Normalize to sum to 1 if sum is positive
        if normalized.sum() > 0:
            normalized = normalized / normalized.sum()
        else:
            # Fallback to equal weights if all weights are zero or negative
            normalized = pd.Series([1/len(normalized)] * len(normalized), index=normalized.index)
            
        return normalized
        
    def load_data(self):
        """Load fund and crypto data from CSV files."""
        print("Loading data...")
        
        # Load crypto configuration
        with open(CRYPTO_CONFIG_PATH, 'r') as f:
            crypto_config = json.load(f)
            all_cryptos = [crypto['symbol'] for crypto in crypto_config]
            # Filter cryptos if selected_assets is provided
            self.cryptos_list = self.selected_assets if self.selected_assets else all_cryptos
        
        # Load fund data
        self.fund_data = pd.read_csv(FUND_DATA_PATH)
        # Convert date to datetime
        self.fund_data['Date'] = pd.to_datetime(self.fund_data['Date'], format='%d-%b-%y')
        self.fund_data.sort_values('Date', inplace=True)
        
        # Load crypto data
        for crypto in self.cryptos_list:
            file_path = os.path.join(CRYPTO_DATA_DIR, f"{crypto.lower()}_usd_eom.csv")
            if os.path.exists(file_path):
                df = pd.read_csv(file_path)
                df['Date'] = pd.to_datetime(df['Date'])
                df.sort_values('Date', inplace=True)
                df.rename(columns={'MoM_%_Chg': f'{crypto}_Return'}, inplace=True)
                self.cryptos_data[crypto] = df[['Date', f'{crypto}_Return']]
            else:
                print(f"Warning: Data file for {crypto} not found at {file_path}")
                
        return self
    
    def preprocess_data(self):
        """Preprocess and merge all data sources."""
        print("Preprocessing data...")
        
        # Start with fund data
        self.merged_data = self.fund_data.rename(columns={'MoM_%_Chg': 'Fund_Return'})
        
        # Store the original fund data date range before merging
        fund_date_min = self.merged_data['Date'].min()
        fund_date_max = self.merged_data['Date'].max()
        
        # Merge crypto data
        for crypto, data in self.cryptos_data.items():
            self.merged_data = pd.merge(self.merged_data, data, on='Date', how='left')
        
        # Check if we're missing crypto data for the latest fund data dates
        crypto_columns = [f"{crypto}_Return" for crypto in self.cryptos_list]
        latest_complete_date = None
        
        # Find the latest date where we have complete crypto data
        for date in sorted(self.merged_data['Date'].unique(), reverse=True):
            row = self.merged_data[self.merged_data['Date'] == date]
            if not row[crypto_columns].isnull().any().any():
                latest_complete_date = date
                break
        
        # Check if we're missing data for the most recent fund data points
        if latest_complete_date and latest_complete_date < fund_date_max:
            missing_dates = self.merged_data[(self.merged_data['Date'] > latest_complete_date) & 
                                            (self.merged_data['Date'] <= fund_date_max)]
            
            missing_dates_list = missing_dates['Date'].dt.strftime('%Y-%m-%d').tolist()
            missing_cryptos = {}
            
            for date in missing_dates['Date']:
                row = self.merged_data[self.merged_data['Date'] == date]
                for crypto in self.cryptos_list:
                    col = f"{crypto}_Return"
                    if col in row.columns and row[col].isnull().any():
                        if crypto not in missing_cryptos:
                            missing_cryptos[crypto] = []
                        missing_cryptos[crypto].append(date.strftime('%Y-%m-%d'))
            
            error_message = {
                "error": "Missing crypto data for latest fund dates",
                "latest_complete_date": latest_complete_date.strftime('%Y-%m-%d'),
                "fund_data_max_date": fund_date_max.strftime('%Y-%m-%d'),
                "missing_dates": missing_dates_list,
                "missing_cryptos": missing_cryptos
            }
            
            print(json.dumps(error_message, indent=2, cls=NpEncoder))
            raise ValueError("Missing crypto data for latest fund dates. Please update crypto data files.")
        
        # Handle missing values - forward fill then backward fill
        for col in self.merged_data.columns:
            if col != 'Date':
                # First, convert any strings to numeric
                self.merged_data[col] = pd.to_numeric(self.merged_data[col], errors='coerce')
                
                # Identify and handle outliers
                if self.merged_data[col].notnull().sum() > 0:  # Check if column has non-null values
                    q1 = self.merged_data[col].quantile(0.05)
                    q3 = self.merged_data[col].quantile(0.95)
                    iqr = q3 - q1
                    lower_bound = q1 - 1.5 * iqr
                    upper_bound = q3 + 1.5 * iqr
                    
                    # Replace outliers with NaN
                    self.merged_data.loc[(self.merged_data[col] < lower_bound) | 
                                         (self.merged_data[col] > upper_bound), col] = np.nan
                
                # Fill missing values
                self.merged_data[col] = self.merged_data[col].fillna(method='ffill').fillna(method='bfill')
        
        # Set Date as index
        self.merged_data.set_index('Date', inplace=True)
        
        # Calculate exponential time weights (more recent data gets higher weight)
        dates = self.merged_data.index
        half_life_months = 12  # Weight halves every year
        time_diff = (dates - dates.min()).days / 30.44  # Convert to months
        decay_rate = np.log(2) / half_life_months
        
        # Fix: Convert time_diff to numpy array before applying exponential function
        time_diff_array = np.array(time_diff)
        self.time_weights = np.exp(decay_rate * time_diff_array)
        self.time_weights = self.time_weights / np.sum(self.time_weights)  # Normalize
        
        # Remove rows with NaN values
        self.merged_data = self.merged_data.dropna()
        
        # Create feature matrix X and target vector y
        self.crypto_cols = [f"{crypto}_Return" for crypto in self.cryptos_list if f"{crypto}_Return" in self.merged_data.columns]
        self.X = self.merged_data[self.crypto_cols]
        self.y = self.merged_data['Fund_Return']
        
        print(f"Preprocessed data shape: {self.merged_data.shape}")
        return self
    
    def analyze_individual_cryptos(self):
        """Analyze correlation and predictive power of individual cryptocurrencies."""
        print("\nAnalyzing individual cryptocurrencies...")
        
        # Calculate correlations
        pearson_corr = self.X.corrwith(self.y, method='pearson').sort_values(ascending=False)
        spearman_corr = self.X.corrwith(self.y, method='spearman').sort_values(ascending=False)
        
        # Initialize results
        individual_results = pd.DataFrame({
            'Pearson_Correlation': pearson_corr,
            'Spearman_Correlation': spearman_corr,
            'R_Squared': np.nan,
            'Weight_OLS': np.nan
        })
        
        # Run linear regression for each crypto and save results
        for crypto in self.crypto_cols:
            X_single = self.X[[crypto]]
            model = LinearRegression()
            model.fit(X_single, self.y)
            y_pred = model.predict(X_single)
            r2 = r2_score(self.y, y_pred)
            individual_results.loc[crypto, 'R_Squared'] = r2
            individual_results.loc[crypto, 'Weight_OLS'] = model.coef_[0]
        
        # Sort by R-squared
        individual_results = individual_results.sort_values('R_Squared', ascending=False)
        self.results['individual_analysis'] = individual_results
        
        print("Individual cryptocurrency analysis completed.")
        return self
    
    def run_linear_regression(self):
        """Run multiple linear regression models with constraints."""
        print("\nRunning linear regression models...")
        
        # Standard multiple linear regression
        lr = LinearRegression()
        lr.fit(self.X, self.y)
        y_pred_lr = lr.predict(self.X)
        r2_lr = r2_score(self.y, y_pred_lr, sample_weight=self.time_weights)
        mse_lr = mean_squared_error(self.y, y_pred_lr, sample_weight=self.time_weights)
        
        # Store coefficients
        lr_coefs = pd.Series(lr.coef_, index=self.crypto_cols)
        # Normalize OLS coefficients to use as weights
        lr_coefs_normalized = self.normalize_weights(lr_coefs)
        
        # Constrained optimization: weights sum to 1 and are non-negative
        def objective(weights):
            return mean_squared_error(self.y, self.X.dot(weights), sample_weight=self.time_weights)
        
        def constraint_sum_to_one(weights):
            return np.sum(weights) - 1.0
        
        constraints = [{'type': 'eq', 'fun': constraint_sum_to_one}]
        bounds = [(0, 1) for _ in range(len(self.crypto_cols))]
        
        # Use OLS coefficients as initial weights after normalization
        # This provides a better starting point than equal weights
        initial_weights = lr_coefs_normalized.values
        
        # Try different optimization methods if the first one fails
        methods = ['SLSQP', 'trust-constr']
        best_result = None
        best_mse = float('inf')
        
        for method in methods:
            try:
                result = minimize(objective, initial_weights, method=method, 
                                bounds=bounds, constraints=constraints)
                
                # Check if this result is better than previous ones
                if result.success and result.fun < best_mse:
                    best_result = result
                    best_mse = result.fun
            except:
                continue
        
        # If all optimization methods failed, use normalized OLS weights
        if best_result is None:
            constrained_weights = pd.Series(initial_weights, index=self.crypto_cols)
            print("Warning: Constrained optimization failed. Using normalized OLS weights.")
        else:
            constrained_weights = pd.Series(best_result.x, index=self.crypto_cols)
        
        y_pred_const = self.X.dot(constrained_weights)
        r2_const = r2_score(self.y, y_pred_const, sample_weight=self.time_weights)
        mse_const = mean_squared_error(self.y, y_pred_const, sample_weight=self.time_weights)
        
        # Cap extremely negative R2 values for display purposes
        # This doesn't change the actual model, just how it's reported
        r2_const_display = max(r2_const, -1.0)
        
        # Feature selection with RFE
        rfe = RFE(LinearRegression(), n_features_to_select=min(5, len(self.crypto_cols)))
        rfe.fit(self.X, self.y, sample_weight=self.time_weights)
        selected_features = self.X.columns[rfe.support_]
        
        # Regularized regression models with cross-validation
        alphas = np.logspace(-6, 2, 9)
        
        # Ridge regression
        ridge_cv = GridSearchCV(
            Ridge(random_state=42), 
            {'alpha': alphas},
            cv=TimeSeriesSplit(n_splits=5),
            scoring='neg_mean_squared_error'
        )
        ridge_cv.fit(self.X, self.y, sample_weight=self.time_weights)
        ridge = ridge_cv.best_estimator_
        ridge_coefs = pd.Series(ridge.coef_, index=self.crypto_cols)
        ridge_coefs_normalized = self.normalize_weights(ridge_coefs)
        ridge_pred = ridge.predict(self.X)
        ridge_r2 = r2_score(self.y, ridge_pred, sample_weight=self.time_weights)
        
        # Lasso regression
        lasso_cv = GridSearchCV(
            Lasso(random_state=42), 
            {'alpha': alphas},
            cv=TimeSeriesSplit(n_splits=5),
            scoring='neg_mean_squared_error'
        )
        lasso_cv.fit(self.X, self.y, sample_weight=self.time_weights)
        lasso = lasso_cv.best_estimator_
        lasso_coefs = pd.Series(lasso.coef_, index=self.crypto_cols)
        lasso_coefs_normalized = self.normalize_weights(lasso_coefs)
        lasso_pred = lasso.predict(self.X)
        lasso_r2 = r2_score(self.y, lasso_pred, sample_weight=self.time_weights)
        
        # Elastic Net regression
        elastic_cv = GridSearchCV(
            ElasticNet(random_state=42), 
            {'alpha': alphas, 'l1_ratio': [0.1, 0.5, 0.7, 0.9]},
            cv=TimeSeriesSplit(n_splits=5),
            scoring='neg_mean_squared_error'
        )
        elastic_cv.fit(self.X, self.y, sample_weight=self.time_weights)
        elastic = elastic_cv.best_estimator_
        elastic_coefs = pd.Series(elastic.coef_, index=self.crypto_cols)
        elastic_coefs_normalized = self.normalize_weights(elastic_coefs)
        elastic_pred = elastic.predict(self.X)
        elastic_r2 = r2_score(self.y, elastic_pred, sample_weight=self.time_weights)
        
        # Store results
        self.results['linear_models'] = {
            'OLS': {
                'weights': lr_coefs,  # Original coefficients
                'normalized_weights': lr_coefs_normalized,  # Portfolio weights
                'r2': r2_lr, 
                'mse': mse_lr
            },
            'Constrained': {
                'weights': constrained_weights,  # Already normalized by constraint
                'normalized_weights': constrained_weights,  # Same as weights for constrained
                'r2': r2_const_display,  # Use the capped value for display
                'r2_actual': r2_const,   # Store the actual value for reference
                'mse': mse_const
            },
            'Ridge': {
                'weights': ridge_coefs,  # Original coefficients
                'normalized_weights': ridge_coefs_normalized,  # Portfolio weights
                'alpha': ridge.alpha, 
                'r2': ridge_r2
            },
            'Lasso': {
                'weights': lasso_coefs,  # Original coefficients
                'normalized_weights': lasso_coefs_normalized,  # Portfolio weights
                'alpha': lasso.alpha, 
                'r2': lasso_r2
            },
            'ElasticNet': {
                'weights': elastic_coefs,  # Original coefficients
                'normalized_weights': elastic_coefs_normalized,  # Portfolio weights
                'alpha': elastic.alpha, 
                'l1_ratio': elastic.l1_ratio, 
                'r2': elastic_r2
            },
            'Selected_Features': selected_features,
        }
        
        print("Linear regression models completed.")
        return self
    
    def run_advanced_models(self):
        """Run tree-based and advanced regression models."""
        print("\nRunning advanced models...")
        
        # Random Forest Regressor
        rf = RandomForestRegressor(n_estimators=100, random_state=42)
        rf.fit(self.X, self.y, sample_weight=self.time_weights)
        rf_feature_importance = pd.Series(rf.feature_importances_, index=self.crypto_cols)
        rf_feature_importance_normalized = self.normalize_weights(rf_feature_importance)
        rf_pred = rf.predict(self.X)
        rf_r2 = r2_score(self.y, rf_pred, sample_weight=self.time_weights)
        
        # Gradient Boosting Regressor
        gb = GradientBoostingRegressor(n_estimators=100, random_state=42)
        gb.fit(self.X, self.y, sample_weight=self.time_weights)
        gb_feature_importance = pd.Series(gb.feature_importances_, index=self.crypto_cols)
        gb_feature_importance_normalized = self.normalize_weights(gb_feature_importance)
        gb_pred = gb.predict(self.X)
        gb_r2 = r2_score(self.y, gb_pred, sample_weight=self.time_weights)
        
        # Rolling window analysis
        window_sizes = [3, 6, 12]
        rolling_results = {}
        
        for window in window_sizes:
            rolling_weights = pd.DataFrame(index=self.merged_data.index[window:], columns=self.crypto_cols)
            
            for i in range(window, len(self.merged_data)):
                X_window = self.X.iloc[i-window:i]
                y_window = self.y.iloc[i-window:i]
                
                # Fit constrained model on window
                def objective(weights):
                    return mean_squared_error(y_window, X_window.dot(weights))
                
                def constraint_sum_to_one(weights):
                    return np.sum(weights) - 1.0
                
                constraints = [{'type': 'eq', 'fun': constraint_sum_to_one}]
                bounds = [(0, 1) for _ in range(len(self.crypto_cols))]
                initial_weights = np.ones(len(self.crypto_cols)) / len(self.crypto_cols)
                
                try:
                    result = minimize(objective, initial_weights, method='SLSQP', 
                                  bounds=bounds, constraints=constraints)
                    rolling_weights.iloc[i-window] = result.x
                except:
                    # If optimization fails, use equal weights
                    rolling_weights.iloc[i-window] = initial_weights
            
            rolling_results[f'{window}m'] = rolling_weights
            
        # Store results
        self.results['advanced_models'] = {
            'RandomForest': {
                'importance': rf_feature_importance,  # Original feature importance
                'normalized_weights': rf_feature_importance_normalized,  # Portfolio weights
                'r2': rf_r2
            },
            'GradientBoosting': {
                'importance': gb_feature_importance,  # Original feature importance
                'normalized_weights': gb_feature_importance_normalized,  # Portfolio weights
                'r2': gb_r2
            },
            'Rolling_Windows': rolling_results
        }
        
        print("Advanced models completed.")
        return self
    
    def ensemble_models(self):
        """Create an ensemble of models to produce final weight estimates."""
        print("\nCreating model ensemble...")
        
        # Get weights from different models
        model_weights = {
            'OLS': self.results['linear_models']['OLS']['normalized_weights'],
            'Constrained': self.results['linear_models']['Constrained']['normalized_weights'],
            'Ridge': self.results['linear_models']['Ridge']['normalized_weights'],
            'Lasso': self.results['linear_models']['Lasso']['normalized_weights'],
            'ElasticNet': self.results['linear_models']['ElasticNet']['normalized_weights'],
        }
        
        # Get R² values for each model
        model_r2 = {
            'OLS': self.results['linear_models']['OLS']['r2'],
            'Constrained': self.results['linear_models']['Constrained']['r2'],
            'Ridge': self.results['linear_models']['Ridge']['r2'],
            'Lasso': self.results['linear_models']['Lasso']['r2'],
            'ElasticNet': self.results['linear_models']['ElasticNet']['r2'],
        }
        
        # Add tree-based models' weights and R² values
        model_weights['RandomForest'] = self.results['advanced_models']['RandomForest']['normalized_weights']
        model_weights['GradientBoosting'] = self.results['advanced_models']['GradientBoosting']['normalized_weights']
        model_r2['RandomForest'] = self.results['advanced_models']['RandomForest']['r2']
        model_r2['GradientBoosting'] = self.results['advanced_models']['GradientBoosting']['r2']
        
        # Calculate model weights based on R² performance
        # Define thresholds for model inclusion
        r2_threshold_poor = 0.3  # Models below this are ignored
        
        # Create model importance weights based on R² values
        model_importance = {}
        for model, r2 in model_r2.items():
            # Ignore poor models
            if r2 < r2_threshold_poor:
                model_importance[model] = 0
            else:
                # Use a higher power (4 instead of 2) to give even more weight to better models
                model_importance[model] = r2 ** 4
        
        # Normalize model importance to sum to 1
        total_importance = sum(model_importance.values())
        if total_importance > 0:
            for model in model_importance:
                model_importance[model] /= total_importance
        
        print("Model weights in ensemble:")
        for model, weight in model_importance.items():
            print(f"  {model}: {weight:.4f} (R² = {model_r2[model]:.4f})")
        
        # Create weighted ensemble
        ensemble_weights = pd.Series(0, index=self.crypto_cols)
        print("\nContributions to ensemble weights:")
        for model, importance in model_importance.items():
            if importance > 0:
                contribution = model_weights[model] * importance
                ensemble_weights += contribution
                print(f"  {model} contribution to DOT_Return: {contribution['DOT_Return']*100:.2f}% (weight: {model_weights[model]['DOT_Return']*100:.2f}% × importance: {importance*100:.2f}%)")
        
        # Normalize final ensemble weights
        ensemble_weights = self.normalize_weights(ensemble_weights)
        print(f"\nFinal DOT_Return weight (before normalization): {ensemble_weights['DOT_Return']*100:.2f}%")
        print(f"Final DOT_Return weight (after normalization): {ensemble_weights['DOT_Return']*100:.2f}%")
        
        # Calculate confidence intervals using bootstrapping
        n_bootstrap = 1000
        bootstrap_weights = np.zeros((n_bootstrap, len(self.crypto_cols)))
        
        for i in range(n_bootstrap):
            # Sample with replacement
            idx = np.random.choice(len(self.X), size=len(self.X), replace=True)
            X_boot, y_boot = self.X.iloc[idx], self.y.iloc[idx]
            
            # Constrained optimization on bootstrap sample
            def objective(weights):
                return mean_squared_error(y_boot, X_boot.dot(weights))
            
            def constraint_sum_to_one(weights):
                return np.sum(weights) - 1.0
            
            constraints = [{'type': 'eq', 'fun': constraint_sum_to_one}]
            bounds = [(0, 1) for _ in range(len(self.crypto_cols))]
            initial_weights = ensemble_weights.values
            
            try:
                result = minimize(objective, initial_weights, method='SLSQP', 
                              bounds=bounds, constraints=constraints)
                bootstrap_weights[i] = result.x
            except:
                bootstrap_weights[i] = initial_weights
        
        # Calculate 95% confidence intervals
        lower_ci = np.percentile(bootstrap_weights, 2.5, axis=0)
        upper_ci = np.percentile(bootstrap_weights, 97.5, axis=0)
        
        confidence_intervals = pd.DataFrame({
            'Lower_CI': pd.Series(lower_ci, index=self.crypto_cols),
            'Upper_CI': pd.Series(upper_ci, index=self.crypto_cols)
        })
        
        # Calculate backtest performance
        backtest_fund = pd.Series(index=self.X.index)
        for i, (idx, row) in enumerate(self.X.iterrows()):
            if i >= 12:  # Use 12 months of data to train initial weights
                X_train = self.X.iloc[max(0, i-24):i]  # Use up to 24 months of training data
                y_train = self.y.iloc[max(0, i-24):i]
                
                # Train model on historical data
                def objective(weights):
                    return mean_squared_error(y_train, X_train.dot(weights))
                
                def constraint_sum_to_one(weights):
                    return np.sum(weights) - 1.0
                
                constraints = [{'type': 'eq', 'fun': constraint_sum_to_one}]
                bounds = [(0, 1) for _ in range(len(self.crypto_cols))]
                initial_weights = np.ones(len(self.crypto_cols)) / len(self.crypto_cols)
                
                try:
                    result = minimize(objective, initial_weights, method='SLSQP', 
                                  bounds=bounds, constraints=constraints)
                    backtest_weights = result.x
                except:
                    backtest_weights = initial_weights
                
                # Predict fund return
                backtest_fund[idx] = row.dot(backtest_weights)
        
        # Calculate tracking error - handle NaN values
        valid_idx = backtest_fund.dropna().index
        if len(valid_idx) > 0:
            tracking_error = np.sqrt(mean_squared_error(
                self.y[valid_idx], 
                backtest_fund[valid_idx]
            ))
            # Calculate ensemble R²
            ensemble_r2 = r2_score(self.y[valid_idx], backtest_fund[valid_idx])
        else:
            tracking_error = np.nan
            ensemble_r2 = 0  # Default if no valid data
        
        # Cap extremely negative R2 values for display purposes
        ensemble_r2_display = max(ensemble_r2, -1.0)
        
        # Store results
        self.results['ensemble'] = {
            'weights': ensemble_weights,
            'confidence_intervals': confidence_intervals,
            'backtest': backtest_fund,
            'tracking_error': tracking_error,
            'all_model_weights': model_weights,  # This now contains normalized weights
            'model_importance': model_importance,
            'r2': ensemble_r2_display,  # Use the capped value for display
            'r2_actual': ensemble_r2    # Store the actual value for reference
        }
        
        print(f"Ensemble model R²: {ensemble_r2_display:.4f} (capped for display)")
        if ensemble_r2 < ensemble_r2_display:
            print(f"Actual ensemble R²: {ensemble_r2:.4f}")
        print("Model ensemble completed.")
        return self
    
    def generate_visualizations(self):
        """Generate visualizations of the results."""
        print("\nGenerating visualizations...")
        output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'analysis')
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. Correlation heatmap
        plt.figure(figsize=(12, 10))
        corr_matrix = self.X.join(self.y).corr()
        mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
        sns.heatmap(corr_matrix, mask=mask, annot=True, cmap='coolwarm', vmin=-1, vmax=1, fmt='.2f')
        plt.title('Correlation Matrix of Cryptocurrencies and Fund Returns')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'correlation_heatmap.png'))
        plt.close()
        
        # 2. Individual crypto correlation with fund
        plt.figure(figsize=(10, 6))
        self.results['individual_analysis']['Pearson_Correlation'].sort_values().plot(kind='barh')
        plt.title('Pearson Correlation with Fund Returns')
        plt.xlabel('Correlation Coefficient')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'pearson_correlation.png'))
        plt.close()
        
        # 3. Weight estimates from different models
        plt.figure(figsize=(12, 8))
        model_weights_df = pd.DataFrame(self.results['ensemble']['all_model_weights'])
        model_weights_df.plot(kind='bar')
        plt.title('Weight Estimates from Different Models')
        plt.xlabel('Cryptocurrency')
        plt.ylabel('Weight')
        plt.axhline(y=0, color='black', linestyle='-', alpha=0.3)
        plt.grid(axis='y', linestyle='--', alpha=0.3)
        plt.legend(loc='upper center', bbox_to_anchor=(0.5, -0.15), ncol=3)
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'model_weights.png'))
        plt.close()
        
        # 4. Final ensemble weights with confidence intervals
        plt.figure(figsize=(10, 6))
        ensemble_weights = self.results['ensemble']['weights']
        ci = self.results['ensemble']['confidence_intervals']
        
        # Sort by weight value
        sorted_idx = ensemble_weights.sort_values(ascending=False).index
        ensemble_weights = ensemble_weights[sorted_idx]
        ci = ci.loc[sorted_idx]
        
        # Fix: Ensure error bars are non-negative
        lower_errors = np.maximum(0, ensemble_weights - ci['Lower_CI'])
        upper_errors = np.maximum(0, ci['Upper_CI'] - ensemble_weights)
        
        plt.barh(range(len(ensemble_weights)), ensemble_weights, xerr=[lower_errors, upper_errors], alpha=0.7)
        plt.yticks(range(len(ensemble_weights)), [c.split('_')[0] for c in sorted_idx])
        plt.title('Estimated Cryptocurrency Weights with 95% Confidence Intervals')
        plt.xlabel('Weight')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'ensemble_weights.png'))
        plt.close()
        
        # 5. Rolling window weights over time
        plt.figure(figsize=(12, 8))
        rolling_weights = self.results['advanced_models']['Rolling_Windows']['12m']
        rolling_weights.plot()
        plt.title('Rolling 12-Month Weights Over Time')
        plt.xlabel('Date')
        plt.ylabel('Weight')
        plt.grid(alpha=0.3)
        plt.legend(loc='upper center', bbox_to_anchor=(0.5, -0.15), ncol=4)
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'rolling_weights.png'))
        plt.close()
        
        # 6. Fund vs Backtest Performance
        plt.figure(figsize=(12, 6))
        backtest = self.results['ensemble']['backtest']
        compare_df = pd.DataFrame({
            'Actual Fund': self.y[backtest.index],
            'Predicted Fund': backtest
        })
        compare_df.plot()
        plt.title('Actual vs Predicted Fund Returns')
        plt.xlabel('Date')
        plt.ylabel('Monthly Return')
        plt.grid(alpha=0.3)
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'backtest_performance.png'))
        plt.close()
        
        print(f"Visualizations saved to {output_dir}")
        return self
    
    def generate_report(self):
        """Generate a JSON report with the results."""
        print("\nGenerating final report...")
        
        # Format ensemble weights for report
        ensemble_weights = self.results['ensemble']['weights']
        ci = self.results['ensemble']['confidence_intervals']
        
        weights_with_ci = pd.DataFrame({
            'Weight': ensemble_weights,
            'Lower_CI': ci['Lower_CI'],
            'Upper_CI': ci['Upper_CI']
        })
        
        # Sort by weight value
        weights_with_ci = weights_with_ci.sort_values('Weight', ascending=False)
        
        # Format crypto names (remove _Return suffix)
        weights_with_ci.index = [c.split('_')[0] for c in weights_with_ci.index]
        
        # Individual crypto analysis
        individual_analysis = self.results['individual_analysis'].copy()
        individual_analysis.index = [c.split('_')[0] for c in individual_analysis.index]
        
        # Create report
        report = {
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'data_range': {
                'start': str(self.merged_data.index.min().date()),
                'end': str(self.merged_data.index.max().date()),
                'months': len(self.merged_data)
            },
            'ensemble_weights': weights_with_ci.to_dict(orient='index'),
            'individual_analysis': individual_analysis.to_dict(orient='index'),
            'tracking_error': float(self.results['ensemble']['tracking_error']),
            'model_performance': {
                'OLS_R2': float(self.results['linear_models']['OLS']['r2']),
                'Constrained_R2': float(self.results['linear_models']['Constrained']['r2']),
                'Ridge_R2': float(self.results['linear_models']['Ridge']['r2']),
                'Lasso_R2': float(self.results['linear_models']['Lasso']['r2']),
                'ElasticNet_R2': float(self.results['linear_models']['ElasticNet']['r2']),
                'RandomForest_R2': float(self.results['advanced_models']['RandomForest']['r2']),
                'GradientBoosting_R2': float(self.results['advanced_models']['GradientBoosting']['r2']),
                'Ensemble_R2': float(self.results['ensemble']['r2'])  # Add ensemble R² to report
            },
            'model_importance': self.results['ensemble']['model_importance'],
            'model_weights': {
                'OLS': self.results['linear_models']['OLS']['normalized_weights'].to_dict(),
                'Constrained': self.results['linear_models']['Constrained']['normalized_weights'].to_dict(),
                'Ridge': self.results['linear_models']['Ridge']['normalized_weights'].to_dict(),
                'Lasso': self.results['linear_models']['Lasso']['normalized_weights'].to_dict(),
                'ElasticNet': self.results['linear_models']['ElasticNet']['normalized_weights'].to_dict(),
                'RandomForest': self.results['advanced_models']['RandomForest']['normalized_weights'].to_dict(),
                'GradientBoosting': self.results['advanced_models']['GradientBoosting']['normalized_weights'].to_dict()
            },
            'visualization_paths': {
                'correlation_heatmap': 'analysis/correlation_heatmap.png',
                'pearson_correlation': 'analysis/pearson_correlation.png',
                'model_weights': 'analysis/model_weights.png',
                'ensemble_weights': 'analysis/ensemble_weights.png',
                'rolling_weights': 'analysis/rolling_weights.png',
                'backtest_performance': 'analysis/backtest_performance.png'
            }
        }
        
        # Cap extremely negative R2 values for display purposes
        # This doesn't change the actual model, just how it's reported in the UI
        if 'Constrained_R2' in report['model_performance'] and report['model_performance']['Constrained_R2'] < -1.0:
            report['model_performance']['Constrained_R2'] = -1.0
        
        # Save report
        output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
        os.makedirs(output_dir, exist_ok=True)
        report_path = os.path.join(output_dir, 'weight_analysis_report.json')
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2, cls=NpEncoder)
        
        print(f"Final report saved to {report_path}")
        return report

def run_analysis():
    """Run the complete analysis pipeline."""
    try:
        # Initialize estimator with selected assets
        estimator = CryptoWeightEstimator(selected_assets=args.assets)
        
        # Run analysis pipeline
        (estimator
         .load_data()
         .preprocess_data()
         .analyze_individual_cryptos()
         .run_linear_regression()
         .run_advanced_models()
         .ensemble_models()
         .generate_visualizations()
         .generate_report())
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }, cls=NpEncoder))
        return

if __name__ == '__main__':
    run_analysis() 