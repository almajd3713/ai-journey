# AI Journey: machine learning from the ground up

Thirteen notebooks that take you from "what does it mean to learn from examples?" to building a retrieval system around a language model and attacking it with prompt injection. Each one is a 60-minute, demonstration-led session: a short main path with real experiments, two or three pause questions, and a Going deeper section for reading afterwards.

**Who it is for:** people new to machine learning, typically software engineers. The notebooks assume you read Python comfortably. They assume no ML background: every ML term is defined where it first appears, and the maths stays at an engineer's level, with derivations in Going deeper.

**Every output is saved.** You can read the whole course without running anything. Every number quoted in the text comes from the saved outputs, including the results that make a method look bad.

## The sessions

| # | Notebook | What it covers |
|---|---|---|
| 0 | `session_00_teaching_a_machine` | One complete experiment: split, baseline, a hand-written rule, a model, its mistakes. A map of the course and a timeline of the field. |
| 1 | `session_01_reading_a_dataset` | A checklist for a new table: duplicates, missing and impossible values, the target, which features separate the outcomes. |
| 2 | `session_02_preprocessing_and_leakage` | Fit preprocessing on training data only, pipelines, cross-validation, and a leaked column that gives a perfect score. |
| 3 | `session_03_classical_models` | Logistic regression, k-nearest neighbours, a decision tree and a random forest on one protocol; overfitting; scaling. |
| 4 | `session_04_evaluation_and_generalization` | Why 99% accuracy can be useless, three sets with three jobs, choosing a threshold by a written policy, opening the test set once. |
| 5 | `session_05_unsupervised_learning` | k-means, choosing the number of clusters, the effect of units, PCA. |
| 6 | `session_06_neural_networks` | XOR and the limit of one unit, why layers need activations, **how a model learns** (loss, gradient, a small step, written by hand), a network in PyTorch. |
| 7 | `session_07_training_neural_networks` | Reading training curves: too simple, too flexible, steps too big; learning rate; early stopping, dropout, L2; a bug the loss hides. |
| 8 | `session_08_computer_vision` | Convolution by hand, why a CNN needs fewer parameters, and a shift test that shows what it buys. |
| 9 | `session_09_transfer_learning` | Reusing a network trained on ImageNet: from scratch against frozen features against fine-tuning, on flower photos. |
| 10 | `session_10_nlp_foundations` | Tokens, ids and vectors; TF-IDF and word pairs against an LSTM on movie reviews; word embeddings. |
| 11 | `session_11_attention_and_transformers` | Attention by hand, the causal mask, what BERT's real attention does and doesn't show, subword tokens. |
| 12 | `session_12_llm_systems` | A language model predicting the next token; retrieval-augmented generation; abstaining; prompt injection and a defence outside the model. |

`INSTRUCTOR_GUIDE.md` has, per session, the main thread, a suggested 60-minute split, what to skip on screen, the purpose of each pause, and the misconception to catch. `CHANGES.md` records what changed between editions and why.

## Setting up

One Python environment runs the whole course. Sessions 0–5 use scikit-learn; Sessions 6–12 use PyTorch (6–10 with plain `torch.nn` and a training loop you can read, 11–12 with Hugging Face `transformers`).

```bash
python3.12 -m venv .venv
source .venv/bin/activate
# install torch and torchvision for your machine first: https://pytorch.org/get-started/locally/
pip install -r requirements.txt
jupyter lab
```

`requirements.txt` gives the versions the saved outputs came from as minimums; `_build/venv_freeze.txt` lists the exact environment. With other versions or another GPU, expect small differences in the numbers.

## Downloads

Each is fetched the first time the notebook runs. Data goes to `~/.cache/ai_journey/`, models to the PyTorch and Hugging Face caches.

| Session | Download | Size |
|---|---|---|
| 8 | MNIST handwritten digits (torchvision) | about 11 MB |
| 9 | Flower photos (TensorFlow example images) | 229 MB |
| 9 | MobileNetV2 ImageNet weights (torchvision) | 14 MB |
| 10 | IMDB movie reviews (Hugging Face hub, `stanfordnlp/imdb`) | 2 × 20 MB |
| 11 | `bert-base-uncased` | about 440 MB |
| 12 | `Qwen/Qwen2.5-1.5B-Instruct` | about 3 GB |

## Hardware and run times

The saved outputs came from a laptop with an 8 GB NVIDIA GPU. Times are for the whole notebook once the downloads are cached.

| Session | Device used | Time | On a CPU only |
|---|---|---|---|
| 0–5 | CPU | under 15 s each | fine |
| 6 | CPU | about 20 s | fine |
| 7 | CPU | about 30 s | fine |
| 8 | GPU | about 30 s | a few minutes |
| 9 | GPU | about 5 minutes | slow (the from-scratch run); lower `PER_CLASS` to 100 for a quick pass |
| 10 | GPU | 2–3 minutes | several minutes (the LSTM) |
| 11 | CPU | under 30 s | fine |
| 12 | GPU | about 1.5 minutes | possible with about 6 GB of free memory; each answer takes several seconds |

GPU runs are set up to repeat exactly on the same machine (`torch.use_deterministic_algorithms`); on another machine the numbers may differ slightly.

## The `_build` folder

Tools used to write and check the notebooks; you don't need them to use the course. `src/bNN.cells` is each notebook as plain text; `buildadv.py` builds and runs a notebook from it, `checknums.py` lists any number in the text that is not in the outputs, `retext.py` changes the text while keeping the outputs, and `history_sources.md` gives the source for every date in the course. `orig/` keeps the notebooks as they were before the October 2026 revision.

## Related

The advanced course, `../advanced_ai_journey_third_edition/`, follows this one: it builds and trains transformers in PyTorch, and its Session 13 compares CLIP with this course's Session 9 on the same flower photos.
