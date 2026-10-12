# Capstone: a complete experiment report on a new dataset

You have run the same chain in every session: **split, baseline, hand-written rule, model, read the errors**, with the checks that make each step honest.
The capstone is to run it once, alone, on a dataset you have not seen, and report it in one page that someone else could trust.

**Time:** 2 to 3 hours. **Hardware:** a laptop CPU is enough. **Notebook:** `capstone_template.ipynb` in this folder has the headings and a loader for each dataset.

## Choose a dataset (all small, public, tabular, with a yes/no outcome)

| Name | Rows | What is predicted | Loader |
|---|---|---|---|
| `credit-g` | 1,000 | whether a loan applicant is a good or bad credit risk | `fetch_openml("credit-g", version=1)` |
| `diabetes` | 768 | whether a patient tested positive for diabetes | `fetch_openml("diabetes", version=1)` |
| `blood-transfusion-service-center` | 748 | whether a donor gave blood again in the next period | `fetch_openml("blood-transfusion-service-center", version=1)` |

## The steps, and what each must show

1. **Read the table (Session 1).** Rows, columns, types; missing values; impossible values; duplicates; the share of each outcome. Say which column is the target and whether any column should not be a feature.
2. **Split first (Sessions 0 and 2).** Training, validation and test, stratified, with a seed. Put the test set away and say where you opened it, once.
3. **Baseline (Session 0).** The accuracy of always answering the most common outcome. Add one number that suits an imbalanced outcome (recall, precision or the area under the precision-recall curve), and say why.
4. **A rule written by hand (Session 0).** One or two thresholds you chose by reading the training rows, with the score on training and validation. This is the bar the model has to clear.
5. **A model, inside a pipeline (Sessions 2 and 3).** Preprocessing fitted on the training rows only. Compare at least two model families on the same protocol, tune on cross-validation inside the training rows, and report the spread, not one number.
6. **A written decision rule (Session 4).** State, before looking at the plot, which mistake costs more, and choose the threshold on the validation set under that policy.
7. **Open the test set once.** Report the test numbers for the locked model, with a 95% interval (Session 9's arithmetic).
8. **Read the errors (Session 0).** Look at ten test cases the model got wrong. What do they have in common? Is there a column that explains it, or a label you doubt?
9. **Say what you do not know.** At least three limits: one about the data, one about the model, one about how the result might not hold elsewhere.

## One-page report

Write the report in the notebook's last section, in plain sentences, with one table and at most two figures:
*the question; the data and its problems; the baseline and the hand rule; the model and how it was chosen; the test result with its interval; the errors; the limits.*

## Rubric (20 points)

| | 0 | 1 | 2 |
|---|---|---|---|
| **Data read** | table not inspected | some problems found | duplicates, gaps, impossible values and the outcome share all reported, and a decision made for each |
| **Split** | one random split, test set reused | train and test, preprocessing before the split | three sets, stratified, seeded, preprocessing inside a pipeline, test opened once |
| **Baseline and rule** | none | baseline only | baseline, a metric that suits the outcome, and a hand-written rule with its score |
| **Models compared** | one model | two models, one split | two or more families, cross-validated, spread reported |
| **Decision rule** | default threshold | threshold tuned on the test set | policy written first, threshold chosen on validation, applied once |
| **Test result** | a single number | number without uncertainty | number with a 95% interval and the baseline beside it |
| **Errors read** | not looked at | counted | ten examples read and a pattern named |
| **Honesty about limits** | none | one vague limit | three specific limits, one for each of data, model and transfer |
| **No leakage** | a leaked column or test-set tuning | a doubtful step | every learned number comes from training rows, and you can say where |
| **Clarity** | cannot follow | readable with effort | a colleague could rerun it and agree with every number |

**16 or more:** a report someone could act on. **12 to 15:** sound, with one weak step. **Below 12:** go back to the steps marked 0.

A good report can say "the model does not beat the hand rule". That is a finding, not a failure.
