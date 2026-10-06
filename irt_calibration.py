#!/usr/bin/env python3
"""
IRT 2PL Parameter Estimation Script for SMART-TKA

Run this periodically (e.g., monthly) to calibrate item parameters
from accumulated response data.

Requirements:
  pip install numpy scipy pandas

Usage:
  python3 irt_calibration.py --output items_irt_params.csv
"""

import argparse
import json
import sys
from typing import List, Dict, Tuple

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import expit


def sigmoid(x: float) -> float:
    """Logistic sigmoid function."""
    return 1 / (1 + np.exp(-x))


def irt_2pl_probability(theta: float, a: float, b: float, c: float = 0) -> float:
    """2PL/3PL probability of correct response."""
    p = sigmoid(a * (theta - b))
    return c + (1 - c) * p


def negative_log_likelihood(params: np.ndarray, 
                           responses: List[Dict],
                           n_items: int,
                           n_persons: int) -> float:
    """
    Negative log-likelihood for joint maximum likelihood estimation.
    
    params: [theta_1, ..., theta_n, a_1, ..., a_m, b_1, ..., b_m]
    """
    thetas = params[:n_persons]
    a_params = params[n_persons:n_persons + n_items]
    b_params = params[n_persons + n_items:]
    
    # Constraints
    if np.any(a_params <= 0):
        return 1e10
    if np.any(b_params < -5) or np.any(b_params > 5):
        return 1e10
    if np.any(thetas < -5) or np.any(thetas > 5):
        return 1e10
    
    nll = 0.0
    for r in responses:
        person_idx = r['person_idx']
        item_idx = r['item_idx']
        correct = r['correct']
        
        theta = thetas[person_idx]
        a = a_params[item_idx]
        b = b_params[item_idx]
        
        p = irt_2pl_probability(theta, a, b)
        # Clamp to avoid log(0)
        p = np.clip(p, 1e-10, 1 - 1e-10)
        
        if correct:
            nll -= np.log(p)
        else:
            nll -= np.log(1 - p)
    
    return nll


def estimate_irt_jmle(responses_df: pd.DataFrame, 
                      min_responses_per_item: int = 50,
                      min_responses_per_person: int = 5) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Joint Maximum Likelihood Estimation for 2PL IRT model.
    
    Returns:
        item_params: DataFrame with item_id, a, b, n_responses
        person_params: DataFrame with person_id, theta, se, n_responses
    """
    # Filter items and persons with sufficient data
    item_counts = responses_df.groupby('item_id').size()
    person_counts = responses_df.groupby('person_id').size()
    
    valid_items = item_counts[item_counts >= min_responses_per_item].index.tolist()
    valid_persons = person_counts[person_counts >= min_responses_per_person].index.tolist()
    
    print(f"Valid items: {len(valid_items)} (min {min_responses_per_item} responses)")
    print(f"Valid persons: {len(valid_persons)} (min {min_responses_per_person} responses)")
    
    # Filter responses
    filtered = responses_df[
        responses_df['item_id'].isin(valid_items) & 
        responses_df['person_id'].isin(valid_persons)
    ].copy()
    
    # Create indices
    item_to_idx = {item: i for i, item in enumerate(valid_items)}
    person_to_idx = {person: i for i, person in enumerate(valid_persons)}
    
    filtered['item_idx'] = filtered['item_id'].map(item_to_idx)
    filtered['person_idx'] = filtered['person_id'].map(person_to_idx)
    
    responses = filtered[['person_idx', 'item_idx', 'is_correct']].to_dict('records')
    
    n_items = len(valid_items)
    n_persons = len(valid_persons)
    
    print(f"Total responses for estimation: {len(responses)}")
    
    # Initial parameters
    # theta: 0 for all persons
    # a: 1.0 for all items
    # b: based on empirical p-value
    initial_thetas = np.zeros(n_persons)
    initial_a = np.ones(n_items)
    
    # Initial b from empirical difficulty
    item_p = filtered.groupby('item_idx')['is_correct'].mean()
    initial_b = np.array([-np.log(p / (1 - p)) if 0 < p < 1 else 0 for p in item_p])
    initial_b = np.nan_to_num(initial_b, nan=0.0, posinf=2.0, neginf=-2.0)
    
    initial_params = np.concatenate([initial_thetas, initial_a, initial_b])
    
    # Bounds
    bounds = [( -4, 4)] * n_persons + [(0.1, 3.0)] * n_items + [(-4, 4)] * n_items
    
    print("Running JMLE optimization...")
    result = minimize(
        negative_log_likelihood,
        initial_params,
        args=(responses, n_items, n_persons),
        method='L-BFGS-B',
        bounds=bounds,
        options={'maxiter': 500, 'ftol': 1e-6, 'disp': True}
    )
    
    if not result.success:
        print(f"Warning: Optimization did not converge: {result.message}")
    
    # Extract parameters
    thetas = result.x[:n_persons]
    a_params = result.x[n_persons:n_persons + n_items]
    b_params = result.x[n_persons + n_items:]
    
    # Compute standard errors for theta (Fisher information)
    person_ses = []
    for p_idx in range(n_persons):
        theta = thetas[p_idx]
        info = 0.0
        person_responses = [r for r in responses if r['person_idx'] == p_idx]
        for r in person_responses:
            i_idx = r['item_idx']
            a = a_params[i_idx]
            b = b_params[i_idx]
            p = irt_2pl_probability(theta, a, b)
            info += a * a * p * (1 - p)
        se = 1 / np.sqrt(info) if info > 0 else 999
        person_ses.append(se)
    
    # Create output DataFrames
    item_params = pd.DataFrame({
        'item_id': valid_items,
        'irt_a': np.round(a_params, 3),
        'irt_b': np.round(b_params, 3),
        'irt_c': 0.0,
        'n_responses': [item_counts[i] for i in valid_items]
    })
    
    person_params = pd.DataFrame({
        'person_id': valid_persons,
        'irt_theta': np.round(thetas, 3),
        'irt_se': np.round(person_ses, 3),
        'n_responses': [person_counts[p] for p in valid_persons]
    })
    
    return item_params, person_params


def main():
    parser = argparse.ArgumentParser(description='IRT 2PL Calibration for SMART-TKA')
    parser.add_argument('--input', required=True, help='CSV file with response data')
    parser.add_argument('--output-items', default='irt_item_params.csv', help='Output CSV for item parameters')
    parser.add_argument('--output-persons', default='irt_person_params.csv', help='Output CSV for person parameters')
    parser.add_argument('--min-item-responses', type=int, default=50, help='Min responses per item')
    parser.add_argument('--min-person-responses', type=int, default=5, help='Min responses per person')
    parser.add_argument('--json', action='store_true', help='Also output JSON for direct DB import')
    
    args = parser.parse_args()
    
    # Load data
    # Expected columns: person_id, item_id, is_correct (boolean)
    df = pd.read_csv(args.input)
    print(f"Loaded {len(df)} responses from {args.input}")
    print(f"Unique persons: {df['person_id'].nunique()}")
    print(f"Unique items: {df['item_id'].nunique()}")
    
    # Ensure correct column types
    df['is_correct'] = df['is_correct'].astype(bool)
    
    # Run estimation
    item_params, person_params = estimate_irt_jmle(
        df,
        min_responses_per_item=args.min_item_responses,
        min_responses_per_person=args.min_person_responses
    )
    
    # Save item parameters
    item_params.to_csv(args.output_items, index=False)
    print(f"Saved item parameters to {args.output_items}")
    
    # Save person parameters
    person_params.to_csv(args.output_persons, index=False)
    print(f"Saved person parameters to {args.output_persons}")
    
    # JSON output for DB import
    if args.json:
        json_data = {
            'items': item_params.to_dict('records'),
            'persons': person_params.to_dict('records')
        }
        with open('irt_params.json', 'w') as f:
            json.dump(json_data, f, indent=2)
        print("Saved JSON to irt_params.json")
    
    # Summary stats
    print("\n=== Item Parameter Summary ===")
    print(f"a (discrimination): mean={item_params['irt_a'].mean():.3f}, "
          f"std={item_params['irt_a'].std():.3f}, "
          f"range=[{item_params['irt_a'].min():.3f}, {item_params['irt_a'].max():.3f}]")
    print(f"b (difficulty): mean={item_params['irt_b'].mean():.3f}, "
          f"std={item_params['irt_b'].std():.3f}, "
          f"range=[{item_params['irt_b'].min():.3f}, {item_params['irt_b'].max():.3f}]")
    
    print("\n=== Person Parameter Summary ===")
    print(f"theta: mean={person_params['irt_theta'].mean():.3f}, "
          f"std={person_params['irt_theta'].std():.3f}, "
          f"range=[{person_params['irt_theta'].min():.3f}, {person_params['irt_theta'].max():.3f}]")
    print(f"SE: mean={person_params['irt_se'].mean():.3f}")


if __name__ == '__main__':
    main()