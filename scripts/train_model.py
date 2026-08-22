import os
import sys
import json
import time
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from joblib import Parallel, delayed
import joblib

sys.path.insert(0, os.path.dirname(__file__))
from feature_extractor import FEATURE_NAMES, extract_features, extract_domain_info

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix
)
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "PhiUSIIL_Phishing_URL_Dataset.csv")
CACHE_PATH = os.path.join(os.path.dirname(__file__), "data", "phiusiil_features_cache.npz")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts", "api-server", "src", "ml")
os.makedirs(OUTPUT_DIR, exist_ok=True)

MODEL_ONNX_PATH = os.path.join(OUTPUT_DIR, "model.onnx")
MODEL_JOBLIB_PATH = os.path.join(OUTPUT_DIR, "model.joblib")
METADATA_JSON_PATH = os.path.join(OUTPUT_DIR, "model_metadata.json")
TREES_JSON_PATH = os.path.join(OUTPUT_DIR, "model_trees.json")

def extract_single_url(url: str):
    feat_dict = extract_features(str(url))
    info = extract_domain_info(str(url))
    return [float(feat_dict[k]) for k in FEATURE_NAMES], info["registrable"]

def run_training():
    print("=================================================================")
    print("   PHISHGUARD REAL ML MODEL TRAINING (PhiUSIIL 235k DATASET)     ")
    print("=================================================================\n")

    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"PhiUSIIL dataset not found at {DATA_PATH}.")

    print(f"1. Loading PhiUSIIL dataset from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    
    # In PhiUSIIL raw data: label=1 is Legitimate, label=0 is Phishing.
    # Convert to PhishGuard Threat Standard: safe = 0, phishing = 1
    df = df.dropna(subset=["URL", "label"])
    df["target_label"] = (df["label"] == 0).astype(int)

    total_samples = len(df)
    safe_samples = int((df["target_label"] == 0).sum())
    phishing_samples = int((df["target_label"] == 1).sum())

    print(f"   Total URLs:       {total_samples:,}")
    print(f"   Safe samples (0): {safe_samples:,} ({safe_samples/total_samples*100:.2f}%)")
    print(f"   Phishing (1):     {phishing_samples:,} ({phishing_samples/total_samples*100:.2f}%)")

    # Feature extraction (with disk cache for instant re-runs)
    if os.path.exists(CACHE_PATH):
        print(f"\n2. Loading cached {len(FEATURE_NAMES)} features from {CACHE_PATH}...")
        cached = np.load(CACHE_PATH, allow_pickle=True)
        X = cached["X"]
        y = cached["y"]
        groups = cached["groups"]
        print(f"   Loaded X: {X.shape}, y: {y.shape}, groups: {len(groups)}")
    else:
        print(f"\n2. Extracting {len(FEATURE_NAMES)} features across all {total_samples:,} URLs using multi-core parallel processing...")
        start_feat = time.time()
        
        urls = df["URL"].tolist()
        results = Parallel(n_jobs=-1, batch_size=500, verbose=5)(
            delayed(extract_single_url)(u) for u in urls
        )
        
        feature_rows = [r[0] for r in results]
        groups = np.array([r[1] for r in results])
        X = np.array(feature_rows, dtype=np.float32)
        y = df["target_label"].values.astype(int)

        feat_time = time.time() - start_feat
        print(f"   Feature extraction completed in {feat_time:.2f}s ({total_samples/feat_time:.0f} URLs/sec).")
        
        print(f"   Saving feature cache to {CACHE_PATH}...")
        np.savez_compressed(CACHE_PATH, X=X, y=y, groups=groups)

    print("\n3. Splitting Train/Test with Strict Domain-Level Grouping (GroupShuffleSplit 80/20)...")
    gss = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    train_size = len(y_train)
    test_size = len(y_test)
    print(f"   Train set: {train_size:,} ({train_size/total_samples*100:.1f}%) | Safe: {(y_train==0).sum():,}, Phishing: {(y_train==1).sum():,}")
    print(f"   Test set:  {test_size:,} ({test_size/total_samples*100:.1f}%) | Safe: {(y_test==0).sum():,}, Phishing: {(y_test==1).sum():,}")

    print("\n4. Training RandomForestClassifier (150 estimators, max_depth=22, balanced weights)...")
    clf = RandomForestClassifier(
        n_estimators=150,
        max_depth=22,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    t0 = time.time()
    clf.fit(X_train, y_train)
    train_time = time.time() - t0
    print(f"   Model training completed in {train_time:.2f}s.")

    print("\n5. Evaluating on unseen domain-disjoint test set...")
    y_pred = clf.predict(X_test)
    y_probs = clf.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, y_probs))
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = [int(v) for v in cm.ravel()]

    fpr = (fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    fnr = (fn / (fn + tp)) if (fn + tp) > 0 else 0.0

    print("\n================ EVALUATION METRICS (PhiUSIIL Test Set) ================")
    print(f"Accuracy:              {acc * 100:.2f}%")
    print(f"Precision:             {prec * 100:.2f}%")
    print(f"Recall:                {rec * 100:.2f}%")
    print(f"F1-Score:              {f1 * 100:.2f}%")
    print(f"ROC-AUC:               {roc_auc * 100:.2f}%")
    print(f"False Positive Rate:   {fpr * 100:.2f}%")
    print(f"False Negative Rate:   {fnr * 100:.2f}%")
    print("\nConfusion Matrix:")
    print(f"  True Negative (TN):  {tn:6,d}  |  False Positive (FP): {fp:5,d}  (Actual Safe: {tn+fp:,d})")
    print(f"  False Negative (FN): {fn:6,d}  |  True Positive (TP):  {tp:5,d}  (Actual Phishing: {fn+tp:,d})")
    print("=========================================================================")

    # Top 15 Feature Importances
    importances = clf.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    
    feature_importance_list = []
    print("\nTop 15 Feature Importances:")
    for rank, idx in enumerate(sorted_idx, 1):
        name = FEATURE_NAMES[idx]
        imp = float(importances[idx])
        feature_importance_list.append({"name": name, "importance": round(imp, 4)})
        if rank <= 15:
            print(f"  {rank:2d}. {name:<30} {imp * 100:6.2f}%")

    print("\n6. Exporting trained model to ONNX...")
    initial_type = [('float_input', FloatTensorType([None, len(FEATURE_NAMES)]))]
    onx = convert_sklearn(
        clf,
        initial_types=initial_type,
        options={id(clf): {'zipmap': False}},
        target_opset=15
    )
    with open(MODEL_ONNX_PATH, "wb") as f:
        f.write(onx.SerializeToString())
    print(f"   ONNX Model saved to: {MODEL_ONNX_PATH}")

    # Save joblib
    joblib.dump(clf, MODEL_JOBLIB_PATH)
    print(f"   Joblib Model saved to: {MODEL_JOBLIB_PATH}")

    # Export Trees JSON
    trees_data = []
    for estimator in clf.estimators_:
        tree = estimator.tree_
        trees_data.append({
            "children_left": tree.children_left.tolist(),
            "children_right": tree.children_right.tolist(),
            "feature": tree.feature.tolist(),
            "threshold": [round(float(t), 6) for t in tree.threshold],
            "value": [v[0].tolist() for v in tree.value]
        })

    with open(TREES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "n_estimators": len(trees_data),
            "n_classes": 2,
            "classes": [0, 1],
            "trees": trees_data
        }, f)
    print(f"   Tree Structure JSON saved to: {TREES_JSON_PATH}")

    # Save Metadata JSON
    metadata = {
        "modelType": "RandomForestClassifier",
        "algorithm": "Random Forest (scikit-learn)",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "datasetName": "PhiUSIIL_Phishing_URL_Dataset.csv",
        "datasetSize": total_samples,
        "safeCount": safe_samples,
        "phishingCount": phishing_samples,
        "trainSize": train_size,
        "testSize": test_size,
        "numFeatures": len(FEATURE_NAMES),
        "featureNames": FEATURE_NAMES,
        "metrics": {
            "accuracy": round(acc * 100, 2),
            "precision": round(prec * 100, 2),
            "recall": round(rec * 100, 2),
            "f1Score": round(f1 * 100, 2),
            "rocAuc": round(roc_auc * 100, 2),
            "falsePositiveRate": round(fpr * 100, 2),
            "falseNegativeRate": round(fnr * 100, 2),
            "confusionMatrix": {
                "trueNegative": tn,
                "falsePositive": fp,
                "falseNegative": fn,
                "truePositive": tp
            }
        },
        "featureImportances": feature_importance_list
    }

    with open(METADATA_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"   Model Metadata saved to: {METADATA_JSON_PATH}")

    print("\nTraining on PhiUSIIL finished successfully!")

if __name__ == "__main__":
    run_training()
