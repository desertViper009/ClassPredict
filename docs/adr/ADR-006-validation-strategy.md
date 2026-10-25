# ADR-006: Rolling-Origin Temporal Cross-Validation vs. Random Splitting

> **Status**: Accepted  
> **Date**: October 2026  
> **Scope**: Model Validation, Testing Strategy & Statistical Honesty

---

## 1. Context

In predictive modeling, validation is designed to estimate generalization error on unseen future data. A widespread error in student machine learning and numerical projects is applying standard random cross-validation ($k$-fold CV or random $80/20$ row shuffling) to sequential time-series data. 

In academic progression:
* Later semesters inherently depend on earlier foundation courses.
* Shuffling rows across time allows future grading distributions, student maturity, and senior-level syllabus curves to leak into past training sets.
* Evaluating models on randomly sampled past transitions after training on future transitions violates causality and produces artificially deflated error metrics.

---

## 2. Alternatives Considered

* **Random $k$-Fold Cross-Validation**: Shuffles all transition records randomly into $k$ buckets. Rejected: Severe temporal data leakage; invalidates scientific findings.
* **Static Train/Test Split (e.g., Train Sem 1–2, Test Sem 3)**: Temporally valid, but evaluates performance on only a single transition horizon, ignoring later semesters.
* **Rolling-Origin (Expanding-Window) Temporal Cross-Validation (SELECTED)**:
  - Iteratively expands the training horizon across semester boundaries.
  - Fold 1: Train on Semesters $1 \to 2$; evaluate on predicting Semester 3.
  - Fold 2: Train on Semesters $1 \to 3$; evaluate on predicting Semester 4.
  - Evaluates models strictly forward in time, exactly mimicking how the software will be deployed in real university advising.

---

## 3. Decision

1. **Mandate Rolling-Origin Backtesting**: All cohort models must be evaluated using expanding-window temporal folds.
2. **Benchmark Against Persistence Baseline**: The Persistence Baseline ($\hat{s}_{t+1} = s_t$) must be calculated over the identical test transitions. Models must report relative percentage improvement $\Delta_{\text{MAE}}$.
3. **Small-Sample Disclaimers**: If a test fold has fewer than 30 evaluation targets ($M < 30$), the UI appends a prominent disclaimer: *"Sample size < 30; metrics lack statistical power"*.
4. **Prohibit $R^2$ as Percentage Accuracy**: System reports MAE and RMSE in genuine SGPA units to avoid deceptive metric presentation.

---

## 4. Consequences & Trade-offs

* **Positive**: Absolute scientific validity; zero temporal leakage; impressive methodological defense during university oral examination.
* **Negative**: Requires at least 3 completed semesters to generate the first evaluation fold ($K \ge 3$).
