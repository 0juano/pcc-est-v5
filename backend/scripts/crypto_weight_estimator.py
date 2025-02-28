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
        
        # Merge crypto data
        for crypto, data in self.cryptos_data.items():
            self.merged_data = pd.merge(self.merged_data, data, on='Date', how='left')
        
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
        
        # Constrained optimization: weights sum to 1 and are non-negative
        def objective(weights):
            return mean_squared_error(self.y, self.X.dot(weights), sample_weight=self.time_weights)
        
        def constraint_sum_to_one(weights):
            return np.sum(weights) - 1.0
        
        constraints = [{'type': 'eq', 'fun': constraint_sum_to_one}]
        bounds = [(0, 1) for _ in range(len(self.crypto_cols))]
        initial_weights = np.ones(len(self.crypto_cols)) / len(self.crypto_cols)
        
        result = minimize(objective, initial_weights, method='SLSQP', 
                          bounds=bounds, constraints=constraints)
        
        constrained_weights = pd.Series(result.x, index=self.crypto_cols)
        y_pred_const = self.X.dot(constrained_weights)
        r2_const = r2_score(self.y, y_pred_const, sample_weight=self.time_weights)
        mse_const = mean_squared_error(self.y, y_pred_const, sample_weight=self.time_weights)
        
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
        
        # Store results
        self.results['linear_models'] = {
            'OLS': {'weights': lr_coefs, 'r2': r2_lr, 'mse': mse_lr},
            'Constrained': {'weights': constrained_weights, 'r2': r2_const, 'mse': mse_const},
            'Ridge': {'weights': ridge_coefs, 'alpha': ridge.alpha},
            'Lasso': {'weights': lasso_coefs, 'alpha': lasso.alpha},
            'ElasticNet': {'weights': elastic_coefs, 'alpha': elastic.alpha, 'l1_ratio': elastic.l1_ratio},
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
        rf_pred = rf.predict(self.X)
        rf_r2 = r2_score(self.y, rf_pred, sample_weight=self.time_weights)
        
        # Gradient Boosting Regressor
        gb = GradientBoostingRegressor(n_estimators=100, random_state=42)
        gb.fit(self.X, self.y, sample_weight=self.time_weights)
        gb_feature_importance = pd.Series(gb.feature_importances_, index=self.crypto_cols)
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
            'RandomForest': {'importance': rf_feature_importance, 'r2': rf_r2},
            'GradientBoosting': {'importance': gb_feature_importance, 'r2': gb_r2},
            'Rolling_Windows': rolling_results
        }
        
        print("Advanced models completed.")
        return self
    
    def ensemble_models(self):
        """Create an ensemble of models to produce final weight estimates."""
        print("\nCreating model ensemble...")
        
        # Get weights from different models
        model_weights = {
            'OLS': self.results['linear_models']['OLS']['weights'],
            'Constrained': self.results['linear_models']['Constrained']['weights'],
            'Ridge': self.results['linear_models']['Ridge']['weights'],
            'Lasso': self.results['linear_models']['Lasso']['weights'],
            'ElasticNet': self.results['linear_models']['ElasticNet']['weights'],
        }
        
        # Normalize tree model feature importances to use as weights
        rf_importance = self.results['advanced_models']['RandomForest']['importance']
        gb_importance = self.results['advanced_models']['GradientBoosting']['importance']
        
        def normalize_weights(weights):
            # Set negative weights to zero
            weights[weights < 0] = 0
            # Normalize to sum to 1 if sum is not zero
            if weights.sum() > 0:
                weights = weights / weights.sum()
            return weights
        
        # Normalize all weights
        for model, weights in model_weights.items():
            model_weights[model] = normalize_weights(weights)
        
        # Add tree-based models
        model_weights['RandomForest'] = normalize_weights(rf_importance)
        model_weights['GradientBoosting'] = normalize_weights(gb_importance)
        
        # Create ensemble weights (simple average of all models)
        ensemble_weights = pd.DataFrame(model_weights).mean(axis=1)
        ensemble_weights = normalize_weights(ensemble_weights)
        
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
                
                constraints = [{'type': 'eq', 'fun': constraint_sum_to_one}]
                bounds = [(0, 1) for _ in range(len(self.crypto_cols))]
                initial_weights = np.ones(len(self.crypto_cols)) / len(self.crypto_cols)
                
                try:
                    result = minimize(objective, initial_weights, method='SLSQP', 
                                  bounds=bounds, constraints=constraints)
                    weights = result.x
                except:
                    weights = initial_weights
                
                # Calculate predicted return
                backtest_fund.iloc[i] = row.dot(weights)
        
        # Calculate tracking error - handle NaN values
        # Drop NaN values before calculating tracking error
        valid_idx = backtest_fund.dropna().index
        if len(valid_idx) > 0:
            tracking_error = np.sqrt(mean_squared_error(
                self.y[valid_idx], 
                backtest_fund[valid_idx]
            ))
        else:
            tracking_error = np.nan
        
        # Store ensemble results
        self.results['ensemble'] = {
            'weights': ensemble_weights,
            'confidence_intervals': confidence_intervals,
            'backtest': backtest_fund,
            'tracking_error': tracking_error,
            'all_model_weights': model_weights
        }
        
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
                'RandomForest_R2': float(self.results['advanced_models']['RandomForest']['r2']),
                'GradientBoosting_R2': float(self.results['advanced_models']['GradientBoosting']['r2'])
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