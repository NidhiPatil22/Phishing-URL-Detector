import os
import json
import joblib
import numpy as np

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts", "api-server", "src", "ml")
MODEL_JOBLIB_PATH = os.path.join(OUTPUT_DIR, "model.joblib")
TREES_JSON_PATH = os.path.join(OUTPUT_DIR, "model_trees.json")

def export_trees():
    clf = joblib.load(MODEL_JOBLIB_PATH)
    trees_data = []

    for estimator in clf.estimators_:
        tree = estimator.tree_
        # Export arrays
        trees_data.append({
            "children_left": tree.children_left.tolist(),
            "children_right": tree.children_right.tolist(),
            "feature": tree.feature.tolist(),
            "threshold": [round(float(t), 6) for t in tree.threshold],
            "value": [v[0].tolist() for v in tree.value]  # [safe_weight, phish_weight]
        })

    with open(TREES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "n_estimators": len(trees_data),
            "n_classes": 2,
            "classes": [0, 1],
            "trees": trees_data
        }, f)

    print(f"Exported {len(trees_data)} decision trees to {TREES_JSON_PATH}")

if __name__ == "__main__":
    export_trees()
