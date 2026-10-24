# Advanced AI Journey

Fourteen notebooks, Sessions 0–13, that open up the language models the basic AI Journey course used as tools. Every number in them was measured by running real models: GPT-2, BERT, T5, a small GPT trained from scratch, the Qwen2.5 family and CLIP. Outputs are saved, so the notebooks can be presented without running anything.

**Audience:** graduates of the basic course. They have trained classifiers, used a pre-trained network and met attention, and know terms such as logits, fine-tuning and validation sets at a working level. The notebooks use PyTorch and Hugging Face `transformers` (the basic course uses scikit-learn and, from its Session 6, plain PyTorch) and explain the code they rely on.

**Not sure you have that background?** Start with `prelim_before_you_start`, an optional notebook of about 60 minutes before Session 0. It goes over what this course assumes, from an honest experiment to the LSTM, without assuming the basic course itself was taken, and then introduces attention: an LSTM fails a recall task that one attention head solves. Learners from earlier versions of the basic course, which did not reach attention, should read at least its section 13 before Session 1.

**Format:** each notebook has a title cell with three outcomes and a "To run it yourself" note, 3–5 numbered sections with 2–3 pause questions, a short "What to take away", and a "Going deeper" part for reading afterwards. Each session fits 60 minutes when presented from the saved outputs; Sessions 3 and 5 need 90. `INSTRUCTOR_GUIDE.md` has a plan for each session.

## Sessions

| # | Notebook | What it shows |
|---|---|---|
| – | `prelim_before_you_start` | Optional, before Session 0: experiments, overfitting and evaluation; the training loop, CNNs, transfer learning; tokens, embeddings and the LSTM; attention on a recall task the LSTM can't do |
| 0 | `session_00_from_text_to_probabilities` | GPT-2's tokenizer and one forward pass: tokens, embeddings, logits, cost in bits, and why perplexity depends on the tokenizer |
| 1 | `session_01_attention_inside_a_real_model` | Attention written out and matched to GPT-2, the √d_k scaling measured, induction heads found and removed |
| 2 | `session_02_the_transformer_block` | A block in 30 lines that reproduces GPT-2, the residual stream and logit lens, learned, sinusoidal and rotary positions |
| 3 | `session_03_training_a_small_gpt` (90 min) | An 11.5M-parameter GPT trained on TinyStories in 5 minutes: loss curves, warm-up and norm placement, sampling, comparison with GPT-2 |
| 4 | `session_04_three_transformer_layouts` | BERT, GPT-2 and T5 on one sentence: what each layout can read, the masking recipe, cross-attention as alignment |
| 5 | `session_05_scaling_and_data` (90 min) | A grid of 20 runs, a fitted scaling law, compute-optimal size, repeated and near-duplicate data, smooth and thresholded metrics |
| 6 | `session_06_from_base_model_to_assistant` | Base vs instruct, chat templates, reward models, best-of-N, DPO, checkable rewards |
| 7 | `session_07_fine_tuning_in_practice` | LoRA from its definition on a JSON extraction task: ranks, full fine-tuning, forgetting, merging, storage |
| 8 | `session_08_retrieval_tools_and_agents` | Retrieval over the basic course's notes, retrieve-then-answer, a tool-using agent, prompt injection |
| 9 | `session_09_inference_and_serving` | KV cache, grouped-query attention, prefill and decode, batching, bandwidth, fused attention, quantisation, speculative decoding |
| 10 | `session_10_evaluating_llms` | MMLU with intervals and prompt formats, a contamination probe, LLM judges' biases, item-by-item regression checks |
| 11 | `session_11_experiments_you_can_believe` | Seeds and paired intervals, test-set noise, the best of many runs, multiple comparisons, run records, a flawed study |
| 12 | `session_12_read_a_paper_reproduce_a_claim` | The LoRA paper mapped and graded with its own error bars, three of its claims reproduced at small scale |
| 13 | `session_13_transformers_beyond_text` | Vision transformers and CLIP on the basic course's flower photos: patches, zero-shot, linear probe, attention, text search |

## Hardware and time

The saved outputs come from a laptop RTX 4070 GPU with 8 GB of memory, on a machine shared with other work. GPU times from those runs:

| Session | GPU time | On a CPU |
|---|---|---|
| Before You Start | about 2 minutes | about 10 minutes |
| 0, 1, 2 | under a minute each | practical |
| 3 | about 12 minutes | use `QUICK = True` (a weaker model) |
| 4 | about a minute | slow but possible |
| 5 | about 25 minutes | not practical |
| 6 | 52 minutes with its caches (longer from scratch) | not practical |
| 7 | 913 s | not practical |
| 8 | 114 s | retrieval sections only |
| 9 | 1,489 s | not practical |
| 10 | 631 s with the cached scores (about 10 minutes more without) | not practical |
| 11 | about 18 minutes from scratch, 151 s with its cache | use fewer seeds |
| 12 | 1,126 s | not practical |
| 13 | 48 s | slower, practical |

Sessions 6, 9 and 10 load models of up to 3 GB and keep generation batches small enough for 8 GB. On a GPU with less memory, reduce the batch sizes in those notebooks.

## Downloads

Models and data are fetched by Hugging Face on first use and cached in `~/.cache/huggingface`.

| Session | Downloads |
|---|---|
| Before You Start | nothing (scikit-learn's built-in data and generated sequences) |
| 0 | GPT-2 small (about 500 MB), reused in Sessions 1–4 |
| 3 | one TinyStories shard (about 250 MB), reused in Sessions 4, 5 and 11 |
| 4 | BERT-base (about 440 MB) and T5-small (about 240 MB) |
| 6 | Qwen2.5-0.5B and Qwen2.5-0.5B-Instruct (about 1 GB each), Qwen2.5-1.5B-Instruct (2.9 GB), UltraFeedback preference data (130 MB); reused in Sessions 7–10 and 12 |
| 7 | the UltraFeedback test split (2 MB) |
| 8 | the MiniLM sentence-embedding model (91 MB) |
| 10 | MMLU test and dev splits (3.5 MB) |
| 13 | CLIP ViT-B/32 (about 600 MB), and the basic course's flower photos in `~/.cache/ai_journey/flower_photos` (downloaded by its Session 9) |

## Running the notebooks

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cu130   # or the wheel for your CUDA version
pip install -r requirements.txt
jupyter lab
```

Open the notebooks from this folder: they read and write `cache/` and `data/` by relative path. Run them in order the first time, since later sessions reuse what earlier ones write.

## Shared files

- `aij_common.py`: the device, a seed function and a GPT-2 loader. Each session notebook imports it before `transformers`, which also turns off download progress bars.
- `tinygpt.py`: the small GPT and its training loop, exported from Session 3 and used by Sessions 5 and 11.
- `cache/`: results that are slow to recompute: Session 3's tokenizer, token cache and checkpoint, Session 5's runs, Session 6's vectors, samples and preference pairs (also used by Session 10), Session 10's scores and Session 11's runs. A notebook skips any step whose result is already here; delete a file to recompute it.
- `data/`: frozen inputs for Session 8: the basic course's text cells, 36 questions with their answer passages, and 20 agent tasks. `data/basic_course_chunks.jsonl` is a frozen snapshot of the basic course's text from 2026-10-08; later revisions of the basic course (such as its October 2026 port of Sessions 6–10 to PyTorch) are not reflected in it, so a few numbers it quotes differ from the current basic notebooks.
- `_build/`: the sources and tools used to build and run the notebooks (cells files, text, run logs and the LoRA paper used in Session 12). Not needed to use the course.

`CHANGES.md` lists what changed from the previous version of the advanced course and why.
