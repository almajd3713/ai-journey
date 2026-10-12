# Capstone: reproduce one claim from a paper, at small scale

Sessions 11 and 12 gave you the method: several seeds, an interval for a difference, equal budgets, and a paper map that grades each claim against the paper's own noise.
The capstone is to do it on a claim you choose, with the course's small GPT, and to report what held, what did not, and at what scale.

**Time:** 4 to 6 hours of work, most of it waiting for runs. **Hardware:** Session 3's `QUICK = True` mode (20,000 stories, 600 steps) runs on a laptop CPU in minutes per run; a GPU makes the full mode (3,000 steps) practical.
**Starting point:** `tinygpt.py` and the data preparation of Session 3. You do not need the course's `cache/` folder: run Session 3's data cells once.

## Pick a claim (or propose your own with the same shape)

| Claim | Source | A small test |
|---|---|---|
| Learning-rate warm-up makes training stable at a high learning rate | Vaswani et al. (2017); Session 3 | validation loss with warm-up 0, 20, 100 at one high rate, 5 seeds each |
| Pre-norm trains more stably than post-norm without warm-up | Xiong et al. (2020) | the same two layouts at 3 learning rates, 5 seeds each |
| Dropout helps when data is scarce and hurts when it is plentiful | Srivastava et al. (2014) | dropout 0, 0.1, 0.3 on 5% and 100% of the stories |
| Gradient clipping prevents loss spikes | Pascanu et al. (2013) | clip 0.1, 1, none at a high rate, count the spikes over 5 seeds |
| Loss falls as a power law in training tokens | Kaplan et al. (2020); Session 5 | five budgets, fit `a * D**-b + c`, report the exponent with an interval over seeds |

## The steps, and what each must show

1. **Paper map (Session 12).** In half a page: the question, the method, the evidence (which table or figure supports the claim, at what scale, with what error bars), the compute, and what would make you doubt it. Quote the paper's numbers and where they are.
2. **Pre-register the test.** Before running anything, write the setting grid, the number of seeds, the metric, and what result would count as 'held', 'did not hold', and 'cannot tell'.
3. **Equal budgets.** Every arm gets the same steps, data and batch size, except the one thing you vary. Say how you checked.
4. **Seeds and intervals.** At least five seeds per arm. Report each difference as a paired interval (a bootstrap over seeds, as in Session 11), not a single number.
5. **A control for luck.** Retrain your best setting with new seeds and report how much of its advantage remains, as Session 11 did for the learning-rate search.
6. **Count your comparisons.** State how many things you compared, and correct or caveat the conclusion accordingly.
7. **Grade the claim.** For each part of the claim: held, did not hold, or cannot tell at this scale, with the number and its interval beside the paper's.
8. **Record it.** A record that names the data (by hash), the code, the settings with seeds, the software and the hardware, as in Session 11, so someone can rerun a run and get the same loss.

## Report

Two pages: the paper map; the pre-registered plan; one table of results with intervals; one figure; the grade for each part of the claim; three limits (scale, data, what you did not vary).

## Rubric (20 points)

| | 0 | 1 | 2 |
|---|---|---|---|
| **Claim understood** | restated loosely | the claim and the method | the claim, its evidence, its scale and its noise, quoted with locations |
| **Plan before the runs** | none | settings only | settings, seeds, metric and the three outcomes defined in advance |
| **Fair comparison** | arms differ in more than one thing | budgets equal, other changes unchecked | one variable changed, equal budgets, and how it was checked |
| **Seeds** | one run per arm | two or three | five or more, with paired differences |
| **Uncertainty** | single numbers | a standard deviation | an interval for each difference, and the paper's interval beside it |
| **Winner's luck** | none | mentioned | the best setting retrained with new seeds and the shrinkage reported |
| **Multiple comparisons** | not counted | counted | counted and the conclusion corrected or caveated |
| **Grading** | 'it works' | a verdict for the whole claim | a verdict per part, with the number that supports it |
| **Record** | none | settings listed | data hash, code hash, seeds, environment, and a rerun that matched |
| **Limits** | none | one general limit | three specific limits including the scale difference from the paper |

**16 or more:** a reproduction another group could build on. **12 to 15:** sound, with one weak step. **Below 12:** return to the steps marked 0.

'Did not hold at this scale' is a legitimate result. 'Cannot tell' is the honest result more often than either of the others.
